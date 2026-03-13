/**
 * run-ai-review.ts
 *
 * Tüm `ai_review` statüsündeki bulmacaları sırayla inceler.
 * Host üzerinden çalışır → Ollama port 11435, Postgres port 54322.
 *
 * Kullanım:
 *   npx tsx scripts/run-ai-review.ts
 *   npx tsx scripts/run-ai-review.ts --dry-run   # sadece listele, güncelleme yok
 *   npx tsx scripts/run-ai-review.ts --limit=5   # ilk 5 bulmacayı işle
 *
 * İki aşamalı inceleme:
 *   Phase 1 — Deterministik yapısal doğrulama (LLM gerektirmez)
 *             Boş cevap, uzunluk tutarsızlığı, karakter hatası, ızgara sınırı
 *             Kritik hata varsa LLM'ye hiç gönderilmez → direkt red.
 *   Phase 2 — YZ danışman incelemesi (küçük batch'ler, max 8 ipucu/istek)
 *             LLM her ipucuna 0-100 puan verir — PASS/FAIL kararı VERMez.
 *             Karar KOD tarafından alınır: ortalama >= 60 VE düşük sayı <= 2.
 */

import { Client } from 'pg';

// ── Ayarlar ──────────────────────────────────────────────────────────────────
const PG_URL = process.env.DATABASE_URL
  ?? 'postgresql://postgres:your-super-secret-and-long-postgres-password@localhost:54322/postgres';
const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11435';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'qwen2.5:7b';
const TIMEOUT_MS = 120_000; // 2 dakika/batch
const PASS_AVG_THRESHOLD = 60;
const PASS_LOW_COUNT_LIMIT = 2;
const LOW_SCORE_CUTOFF = 40;
const BATCH_SIZE = 8; // Her AI isteğinde max kaç clue

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const limitArg = args.find(a => a.startsWith('--limit=') || a === '--limit');
const LIMIT = limitArg
  ? parseInt(limitArg.startsWith('--limit=') ? limitArg.split('=')[1] : args[args.indexOf('--limit') + 1] ?? '999')
  : 999;

// ── Tipler ───────────────────────────────────────────────────────────────────
interface ClueRecord {
  number: number;
  clue: string;
  answer_length: number;
  start: { row: number; col: number };
  answer?: string;
  hint?: string;
}

interface CluesJson {
  across: ClueRecord[];
  down: ClueRecord[];
}

interface GridJson {
  rows: number;
  cols: number;
}

interface Level {
  id: string;
  difficulty: string;
  grid_json: GridJson;
  clues_json: CluesJson;
  review_status: string;
}

interface BatchItem {
  dir: 'across' | 'down';
  number: number;
  clue: string;
  answer: string;
}

// ── Renk yardımcıları ────────────────────────────────────────────────────────
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';

// ── Phase 1: Deterministik yapısal doğrulama ─────────────────────────────────
/** Turkish uppercase alphabet regex — must match _shared/review.ts */
const TR_UPPER_RE = /^[A-ZÇĞİÖŞÜ]+$/;

function runDeterministicChecks(
  clues: CluesJson,
  grid: GridJson,
): { passed: boolean; failures: string[] } {
  const failures: string[] = [];

  const acrossClues = clues?.across ?? [];
  const downClues   = clues?.down   ?? [];

  if (acrossClues.length === 0) failures.push('Hiç yatay ipucu yok');
  if (downClues.length === 0)   failures.push('Hiç dikey ipucu yok');

  for (const [dirLabel, dirKey, list] of [
    ['YATAY', 'across', acrossClues],
    ['DİKEY', 'down',   downClues],
  ] as [string, string, ClueRecord[]][]) {
    const seenNumbers = new Set<number>();

    for (const c of list) {
      const tag = `[${dirLabel} ${c.number}]`;

      if (seenNumbers.has(c.number)) {
        failures.push(`${tag} Tekrarlı ipucu numarası`);
      }
      seenNumbers.add(c.number);

      if (!c.clue || c.clue.trim().length === 0) {
        failures.push(`${tag} Soru metni boş`);
      }

      const answer = (c.answer ?? '').trim().toUpperCase().replace(/\s/g, '');
      if (answer.length === 0) {
        failures.push(`${tag} Cevap boş veya null`);
        continue;
      }

      if (answer.length !== c.answer_length) {
        failures.push(
          `${tag} Uzunluk tutarsız: "${c.answer}" (${answer.length} harf) ≠ beyan ${c.answer_length}`,
        );
      }

      if (answer.length < 2) {
        failures.push(`${tag} Cevap çok kısa (${answer.length} harf)`);
      }

      if (!TR_UPPER_RE.test(answer)) {
        failures.push(`${tag} Cevap geçersiz karakter içeriyor: "${answer}"`);
      }

      if (c.start) {
        const { row, col } = c.start;
        if (row < 0 || col < 0 || row >= grid.rows || col >= grid.cols) {
          failures.push(`${tag} Başlangıç konumu ızgara dışı: (${row},${col})`);
        } else {
          const endRow = dirKey === 'down'   ? row + answer.length - 1 : row;
          const endCol = dirKey === 'across' ? col + answer.length - 1 : col;
          if (endRow >= grid.rows || endCol >= grid.cols) {
            failures.push(`${tag} Cevap ızgara sınırını aşıyor: son konum (${endRow},${endCol})`);
          }
        }
      }
    }
  }

  return { passed: failures.length === 0, failures };
}

// ── Phase 2: LLM danışman değerlendirme (batch) ───────────────────────────────
async function evaluateBatch(items: BatchItem[]): Promise<number[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const itemLines = items.map((it, i) =>
    `${i + 1}. [${it.dir === 'across' ? 'YATAY' : 'DİKEY'} ${it.number}] ` +
    `İpucu: "${it.clue}" | Cevap: "${it.answer}" (${it.answer.length} harf)`
  ).join('\n');

  const requiredKeys = items.map((_, i) => `score_${i + 1}`);
  const schemaProps: Record<string, unknown> = {};
  for (const k of requiredKeys) {
    schemaProps[k] = { type: 'integer', minimum: 0, maximum: 100 };
  }

  const promptText =
    `Sen bir Türkçe çapraz bulmaca kalite denetçisisin.\n` +
    `Aşağıdaki ${items.length} ipucu-cevap çiftini BAĞIMSIZ olarak değerlendir.\n` +
    `Her çifti tek başına ele al. Önceki değerlendirmelerden bağımsız düşün.\n\n` +
    `Her çift için 0-100 arası kalite puanı ver:\n` +
    `- 85-100: İpucu net, anlamlı, cevap doğru eşleşiyor, Türkçe hatasız\n` +
    `- 60-84: Küçük sorunlar var ama kabul edilebilir\n` +
    `- 30-59: İpucu belirsiz, anlamsız veya cevapla zayıf eşleşme\n` +
    `- 0-29: Çok kötü, anlamsız, sayı/kod, eşleşmiyor\n\n` +
    `KRİTİK KURALLAR (bu kurallardan herhangi birini ihlal eden çifte 0 puan ver):\n` +
    `1. İpucu tek başına anlamlı bir Türkçe cümle veya tanım olmalı. Sayı, kod, "0", "343 tekrar tekrar" gibi anlamsız metinler → 0 puan.\n` +
    `2. Cevap anlamlı bir Türkçe kelime veya özel isim olmalı. Rastgele harf dizileri → 0 puan.\n` +
    `3. İpucu metninde cevap kelimesi geçMEMELİ. Cevabı doğrudan içeren ipucu → 0 puan.\n` +
    `4. Cevap gerçekten ipucunun karşılığı olmalı. İpucu "başkent" diyorsa cevap bir başkent olmalı → eşleşmiyorsa 0 puan.\n\n` +
    `DİĞER KRİTERLER:\n` +
    `5. İpucu ile cevap anlamsal olarak eşleşiyor mu?\n` +
    `6. Türkçe doğru yazılmış mı?\n` +
    `7. İçerik aile dostu mu?\n` +
    `8. İpucu bulmaca standartlarına uygun mu (kısa, net)?\n\n` +
    `İPUÇLARI VE CEVAPLAR:\n${itemLines}\n\n` +
    `SADECE şu ${requiredKeys.length} anahtar ile JSON döndür: ${requiredKeys.join(', ')}\n` +
    `Başka anahtar veya açıklama ekleme.\n\nJSON:`;

  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        system: "Sen bir Türkçe çapraz bulmaca kalite denetçisisin. Her istekte sana verilen ipucu-cevap çiftlerini BAĞIMSIZ değerlendir. Önceki isteklerden hiçbir bilgi taşıma.",
        prompt: promptText,
        stream: false,
        context: [],  // Ollama context'i sıfırla — önceki istek kalıntısı taşımasın
        format: {
          type: 'object',
          properties: schemaProps,
          required: requiredKeys,
        },
      }),
    });

    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`);

    const data = await res.json() as { response: unknown };
    let parsed: Record<string, unknown>;

    if (typeof data.response === 'object' && data.response !== null) {
      parsed = data.response as Record<string, unknown>;
    } else {
      const content = String(data.response ?? '').trim();
      const start = content.indexOf('{');
      if (start === -1) throw new Error(`JSON bulunamadı: ${content.slice(0, 200)}`);
      let depth = 0, end = -1;
      for (let i = start; i < content.length; i++) {
        if (content[i] === '{') depth++;
        else if (content[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
      }
      if (end === -1) throw new Error(`Kırık JSON: ${content.slice(0, 200)}`);
      parsed = JSON.parse(content.slice(start, end + 1));
    }

    return items.map((_, i) => {
      const raw = parsed[`score_${i + 1}`];
      const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? '50'), 10);
      return isNaN(n) ? 50 : Math.min(100, Math.max(0, n));
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function runLlmAdvisoryReview(clues: CluesJson): Promise<{
  passed: boolean;
  avgScore: number;
  lowCount: number;
  issues: string[];
  batchCount: number;
}> {
  const items: BatchItem[] = [];

  for (const c of clues?.across ?? []) {
    const answer = (c.answer ?? '').trim().toUpperCase();
    if (answer && c.clue?.trim()) {
      items.push({ dir: 'across', number: c.number, clue: c.clue, answer });
    }
  }
  for (const c of clues?.down ?? []) {
    const answer = (c.answer ?? '').trim().toUpperCase();
    if (answer && c.clue?.trim()) {
      items.push({ dir: 'down', number: c.number, clue: c.clue, answer });
    }
  }

  if (items.length === 0) {
    return { passed: false, avgScore: 0, lowCount: 0, issues: ['Geçerli ipucu/cevap bulunamadı'], batchCount: 0 };
  }

  const batches: BatchItem[][] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    batches.push(items.slice(i, i + BATCH_SIZE));
  }

  const allScores: number[] = [];
  for (let b = 0; b < batches.length; b++) {
    process.stdout.write(` batch ${b + 1}/${batches.length}`);
    const scores = await evaluateBatch(batches[b]);
    allScores.push(...scores);
    if (b < batches.length - 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  const avgScore = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length);
  const lowCount = allScores.filter(s => s < LOW_SCORE_CUTOFF).length;

  // Code-enforced pass/fail — LLM never decides this
  const passed = avgScore >= PASS_AVG_THRESHOLD && lowCount <= PASS_LOW_COUNT_LIMIT;

  const worstDetails = items
    .map((it, i) => ({ it, s: allScores[i] }))
    .filter(({ s }) => s < 50)
    .sort((a, b) => a.s - b.s)
    .slice(0, 3)
    .map(({ it, s }) => `[${it.dir === 'across' ? 'YATAY' : 'DİKEY'} ${it.number}] "${it.clue}" → "${it.answer}" (puan:${s})`);

  return { passed, avgScore, lowCount, issues: worstDetails, batchCount: batches.length };
}

// ── Ana işlem ─────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${BOLD}${CYAN}═══ Bulmaca YZ İnceleme Scripti (v3 – İki Aşamalı) ═══${RESET}`);
  console.log(`Model: ${OLLAMA_MODEL}  |  Ollama: ${OLLAMA_URL}  |  Batch boyutu: ${BATCH_SIZE}`);
  console.log(`Eşik: ortalama >= ${PASS_AVG_THRESHOLD}, düşük ipuç (<${LOW_SCORE_CUTOFF}) <= ${PASS_LOW_COUNT_LIMIT}`);
  if (DRY_RUN) console.log(`${YELLOW}[DRY-RUN] Veritabanı güncellenmeyecek${RESET}`);
  console.log();

  // Ollama bağlantı testi
  try {
    const ping = await fetch(`${OLLAMA_URL}/api/tags`);
    const info = await ping.json() as { models: { name: string }[] };
    const found = info.models.find(m =>
      m.name === OLLAMA_MODEL || m.name.startsWith(OLLAMA_MODEL.split(':')[0])
    );
    if (!found) {
      const available = info.models.map(m => m.name).join(', ') || 'yok';
      console.error(`${RED}✗ Model "${OLLAMA_MODEL}" yüklü değil. Yüklü: ${available}${RESET}`);
      process.exit(1);
    }
    console.log(`${GREEN}✓ Ollama hazır — model: ${found.name}${RESET}`);
  } catch (e) {
    console.error(`${RED}✗ Ollama'ya bağlanılamadı (${OLLAMA_URL}): ${e}${RESET}`);
    process.exit(1);
  }

  // DB bağlantısı
  const db = new Client({ connectionString: PG_URL });
  await db.connect();
  console.log(`${GREEN}✓ PostgreSQL bağlantısı kuruldu${RESET}\n`);

  // İncelenecek bulmacaları çek
  const { rows: puzzles } = await db.query<Level>(`
    SELECT id, difficulty, grid_json, clues_json, review_status
    FROM levels
    WHERE deleted_at IS NULL
      AND review_status = 'ai_review'
      AND ai_reviewed_at IS NULL
    ORDER BY created_at ASC
    LIMIT $1
  `, [LIMIT]);

  if (puzzles.length === 0) {
    console.log(`${YELLOW}İncelenecek bulmaca bulunamadı (ai_review ve ai_reviewed_at IS NULL).${RESET}`);
    await db.end();
    return;
  }

  console.log(`${BOLD}Toplam ${puzzles.length} bulmaca sırayla incelenecek${RESET}\n`);
  console.log('─'.repeat(60));

  let passCount = 0, failCount = 0, errorCount = 0;
  let detRejectCount = 0;

  for (let i = 0; i < puzzles.length; i++) {
    const puzzle = puzzles[i];
    const num = `[${i + 1}/${puzzles.length}]`;
    const clueCount = (puzzle.clues_json?.across?.length ?? 0) + (puzzle.clues_json?.down?.length ?? 0);

    console.log(`\n${BOLD}${num} ID: ${puzzle.id.slice(0, 8)}… | ${puzzle.difficulty} | ${clueCount} ipucu${RESET}`);

    // ── Phase 1: Deterministik doğrulama ────────────────────────────────────
    const detResult = runDeterministicChecks(puzzle.clues_json, puzzle.grid_json);

    if (!detResult.passed) {
      console.log(`  ${YELLOW}⚠ Yapısal hatalar (${detResult.failures.length}):${RESET}`);
      detResult.failures.forEach(f => console.log(`    • ${f}`));
      console.log(`  ${RED}✗ Deterministik doğrulama başarısız → direkt red${RESET}`);

      if (!DRY_RUN) {
        await db.query(`
          UPDATE levels SET
            review_status         = 'rejected',
            ai_review_notes       = $1,
            ai_reviewed_at        = NOW(),
            ai_review_score       = 0,
            deterministic_failures = $2,
            llm_raw_response      = NULL,
            llm_clue_scores       = NULL,
            review_rejected_by    = 'deterministic'
          WHERE id = $3
        `, [
          `Yapısal doğrulama aşamasında başarısız:\n${detResult.failures.join('\n')}`,
          JSON.stringify(detResult.failures),
          puzzle.id,
        ]);
        console.log(`  ${CYAN}→ DB: rejected (deterministic)${RESET}`);
      }
      failCount++;
      detRejectCount++;
      continue;
    }

    console.log(`  ${GREEN}✓ Phase 1 geçti${RESET}`);

    // ── Phase 2: LLM danışman incelemesi ────────────────────────────────────
    let llmResult: Awaited<ReturnType<typeof runLlmAdvisoryReview>>;
    try {
      process.stdout.write(`  Ollama inceliyor...`);
      const start = Date.now();
      llmResult = await runLlmAdvisoryReview(puzzle.clues_json);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      process.stdout.write(` ${elapsed}s (${llmResult.batchCount} batch)\n`);
    } catch (e) {
      process.stdout.write('\n');
      console.log(`  ${RED}✗ Ollama hatası: ${e}${RESET}`);

      if (!DRY_RUN) {
        await db.query(`UPDATE levels SET review_status = 'pending' WHERE id = $1`, [puzzle.id]);
        console.log(`  ${YELLOW}→ Hata: ai_review → pending (geri alındı)${RESET}`);
      }
      errorCount++;
      continue;
    }

    // Karar KOD'dan gelir, LLM'den değil
    const statusIcon = llmResult.passed ? `${GREEN}✓ ONAY` : `${RED}✗ RED`;
    console.log(`  ${statusIcon}${RESET} | Ortalama: ${llmResult.avgScore}/100 | Düşük: ${llmResult.lowCount}`);
    if (llmResult.issues.length > 0) {
      console.log(`  Sorunlu ipuçları: ${llmResult.issues.slice(0, 3).join(' | ')}`);
    }

    if (!DRY_RUN) {
      const newStatus = llmResult.passed ? 'pending' : 'rejected';
      const notes = llmResult.passed
        ? `Bulmaca kalite değerlendirmesini geçti. Ortalama: ${llmResult.avgScore}/100.`
        : `Kalite eşiği geçilemedi. Ortalama: ${llmResult.avgScore}/100. Düşük ipuç: ${llmResult.lowCount}.\n` +
          (llmResult.issues.length > 0 ? 'Sorunlar:\n' + llmResult.issues.slice(0, 5).join('\n') : '');

      await db.query(`
        UPDATE levels SET
          review_status         = $1,
          ai_review_notes       = $2,
          ai_reviewed_at        = NOW(),
          ai_review_score       = $3,
          deterministic_failures = '[]'::jsonb,
          review_rejected_by    = $4
        WHERE id = $5
      `, [newStatus, notes, llmResult.avgScore, llmResult.passed ? null : 'llm', puzzle.id]);

      console.log(`  ${CYAN}→ DB: ${newStatus} (llm)${RESET}`);
    }

    if (llmResult.passed) passCount++; else failCount++;

    if (i < puzzles.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  await db.end();

  console.log('\n' + '═'.repeat(60));
  console.log(`${BOLD}ÖZET${RESET}`);
  console.log(`  Toplam işlenen             : ${puzzles.length}`);
  console.log(`  ${GREEN}Onaylanan (pending)${RESET}        : ${passCount}`);
  console.log(`  ${RED}Reddedilen (toplam)${RESET}        : ${failCount}`);
  console.log(`    - Deterministik red      : ${detRejectCount}`);
  console.log(`    - YZ danışman red        : ${failCount - detRejectCount}`);
  if (errorCount > 0) console.log(`  ${YELLOW}Hata (pending'e döndü)${RESET}     : ${errorCount}`);
  if (DRY_RUN) console.log(`\n${YELLOW}[DRY-RUN] Veritabanı değiştirilmedi.${RESET}`);
  console.log();
}

main().catch(e => {
  console.error(`${RED}Kritik hata:${RESET}`, e);
  process.exit(1);
});
