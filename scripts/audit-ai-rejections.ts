/**
 * audit-ai-rejections.ts
 *
 * Backfill audit: finds AI-only rejected puzzles that would now pass
 * the deterministic checks, suggesting they were hallucination victims.
 *
 * Kullanım:
 *   npx tsx scripts/audit-ai-rejections.ts            # report only
 *   npx tsx scripts/audit-ai-rejections.ts --restore  # move suspects back to pending
 *   npx tsx scripts/audit-ai-rejections.ts --limit=50
 *
 * Çıktı:
 *   - Total AI-only rejections found
 *   - How many would pass deterministic checks (likely hallucination victims)
 *   - Per-puzzle breakdown with rejection notes
 *   - With --restore: moves suspects back to pending for admin re-review
 */

import { Client } from 'pg';

const PG_URL = process.env.DATABASE_URL
  ?? 'postgresql://postgres:your-super-secret-and-long-postgres-password@localhost:54322/postgres';

const args = process.argv.slice(2);
const RESTORE = args.includes('--restore');
const limitArg = args.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : 999;

const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';

// ── Turkish uppercase regex (must match _shared/review.ts) ─────────────────
const TR_UPPER_RE = /^[A-ZÇĞİÖŞÜ]+$/;

interface ClueRecord {
  number: number;
  question: string;
  answer_length: number;
  start: { row: number; col: number };
  answer?: string;
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
  ai_review_notes: string | null;
  ai_review_score: number | null;
  ai_reviewed_at: string | null;
  review_rejected_by: string | null;
  deterministic_failures: string[] | null;
  created_at: string;
}

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

      if (!c.question || c.question.trim().length === 0) {
        failures.push(`${tag} Soru metni boş`);
      }

      const answer = (c.answer ?? '').trim().toUpperCase().replace(/\s/g, '');
      if (answer.length === 0) {
        failures.push(`${tag} Cevap boş veya null`);
        continue;
      }

      if (answer.length !== c.answer_length) {
        failures.push(
          `${tag} Uzunluk tutarsız: "${c.answer}" (${answer.length}) ≠ beyan ${c.answer_length}`,
        );
      }

      if (answer.length < 2) failures.push(`${tag} Cevap çok kısa`);

      if (!TR_UPPER_RE.test(answer)) {
        failures.push(`${tag} Geçersiz karakter: "${answer}"`);
      }

      if (c.start) {
        const { row, col } = c.start;
        if (row < 0 || col < 0 || row >= grid.rows || col >= grid.cols) {
          failures.push(`${tag} Başlangıç ızgara dışı: (${row},${col})`);
        } else {
          const endRow = dirKey === 'down'   ? row + answer.length - 1 : row;
          const endCol = dirKey === 'across' ? col + answer.length - 1 : col;
          if (endRow >= grid.rows || endCol >= grid.cols) {
            failures.push(`${tag} Cevap ızgara sınırını aşıyor`);
          }
        }
      }
    }
  }

  return { passed: failures.length === 0, failures };
}

async function main() {
  console.log(`\n${BOLD}${CYAN}═══ Hallüsinasyon Denetim Scripti ═══${RESET}`);
  if (RESTORE) {
    console.log(`${YELLOW}[RESTORE] Şüpheli redler pending'e döndürülecek${RESET}`);
  }
  console.log();

  const db = new Client({ connectionString: PG_URL });
  await db.connect();
  console.log(`${GREEN}✓ PostgreSQL bağlantısı kuruldu${RESET}\n`);

  // Fetch AI-only rejections (no human reviewer involved)
  const { rows: levels } = await db.query<Level>(`
    SELECT
      id, difficulty, grid_json, clues_json,
      ai_review_notes, ai_review_score, ai_reviewed_at,
      review_rejected_by, deterministic_failures, created_at
    FROM levels
    WHERE deleted_at IS NULL
      AND review_status = 'rejected'
      AND reviewed_by IS NULL
      AND ai_review_notes IS NOT NULL
    ORDER BY created_at DESC
    LIMIT $1
  `, [LIMIT]);

  if (levels.length === 0) {
    console.log(`${YELLOW}Denetlenecek AI-only red bulunamadı.${RESET}`);
    await db.end();
    return;
  }

  console.log(`${BOLD}Toplam ${levels.length} AI-only red incelenecek${RESET}\n`);
  console.log('─'.repeat(70));

  let suspects = 0;
  let alreadyDeterministicFail = 0;
  const suspectIds: string[] = [];

  for (const level of levels) {
    const detResult = runDeterministicChecks(level.clues_json, level.grid_json);
    const clueCount = (level.clues_json?.across?.length ?? 0) + (level.clues_json?.down?.length ?? 0);
    const shortId = level.id.slice(0, 8);
    const date = new Date(level.created_at).toISOString().slice(0, 10);

    if (detResult.passed) {
      // Deterministic checks PASS → this rejection was likely a hallucination
      suspects++;
      suspectIds.push(level.id);
      console.log(`${RED}[ŞÜPHELI]${RESET} ${shortId}… | ${level.difficulty} | ${clueCount} ipucu | ${date}`);
      console.log(`  AI notu: ${(level.ai_review_notes ?? '').slice(0, 120)}`);
      console.log(`  AI puanı: ${level.ai_review_score ?? 'N/A'}`);
      if (level.review_rejected_by) {
        console.log(`  Red nedeni: ${level.review_rejected_by}`);
      }
      console.log();
    } else {
      // Deterministic checks FAIL → rejection was likely legitimate
      alreadyDeterministicFail++;
      if (process.env.VERBOSE) {
        console.log(`${GREEN}[GEÇERLİ RED]${RESET} ${shortId}… | ${level.difficulty} | Yapısal hata: ${detResult.failures[0]}`);
      }
    }
  }

  console.log('─'.repeat(70));
  console.log(`\n${BOLD}ÖZET${RESET}`);
  console.log(`  İncelenen AI-only red      : ${levels.length}`);
  console.log(`  ${RED}Şüpheli hallüsinasyon     : ${suspects}${RESET} (deterministik olarak geçiyor)`);
  console.log(`  ${GREEN}Geçerli red (yapısal hata): ${alreadyDeterministicFail}${RESET}`);

  if (suspects > 0) {
    const pct = Math.round((suspects / levels.length) * 100);
    console.log(`\n  Hallüsinasyon oranı (tahmini): ${pct}%`);
    console.log(`\n${YELLOW}Bu bulmacalar muhtemelen hallüsinasyon nedeniyle hatalı reddedildi.`);
    console.log(`Gerçek sorunları admin panelinden kontrol ediniz.${RESET}`);
  }

  if (RESTORE && suspects > 0) {
    console.log(`\n${CYAN}→ ${suspects} şüpheli bulmaca pending'e döndürülüyor...${RESET}`);

    const { rowCount } = await db.query(`
      UPDATE levels
      SET
        review_status   = 'pending',
        ai_review_notes = CONCAT('[HALLÜSİNASYON DENETIMI: pending''e döndürüldü] ', COALESCE(ai_review_notes, '')),
        updated_at      = NOW()
      WHERE id = ANY($1::uuid[])
        AND review_status = 'rejected'
        AND reviewed_by IS NULL
    `, [suspectIds]);

    console.log(`${GREEN}✓ ${rowCount} bulmaca pending'e döndürüldü${RESET}`);
    console.log(`${YELLOW}Admin panelinden bu bulmaçları manuel inceleyin.${RESET}`);
  } else if (suspects > 0 && !RESTORE) {
    console.log(`\n${YELLOW}Bunları geri yüklemek için: npx tsx scripts/audit-ai-rejections.ts --restore${RESET}`);
  }

  await db.end();
  console.log();
}

main().catch(e => {
  console.error(`${RED}Kritik hata:${RESET}`, e);
  process.exit(1);
});
