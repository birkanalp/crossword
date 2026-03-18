// =============================================================================
// _shared/review.ts
//
// Deterministic + LLM-advisory puzzle review logic.
// Used by admin/index.ts and cronTriggerAiReview/index.ts.
//
// Design principles:
//  1. Deterministic checks ALWAYS run first. If they fail, LLM is never called.
//  2. LLM is an advisor ONLY — it scores each clue individually (0-100).
//     It never makes a binary pass/fail decision.
//  3. The pass/fail threshold is enforced in CODE (avg >= 60, low count <= 2).
//  4. Rejection history is NOT injected into the prompt (removes hallucination bias).
//  5. Raw LLM output is captured for audit/debugging.
// =============================================================================

export interface ClueRecord {
  number: number;
  question: string;
  answer_length: number;
  start: { row: number; col: number };
  answer?: string;
  hint?: string;
}

export interface CluesJson {
  across: ClueRecord[];
  down: ClueRecord[];
}

export interface GridJson {
  rows: number;
  cols: number;
  cells?: { row: number; col: number; type: string; number?: number }[];
}

// ---------------------------------------------------------------------------
// Phase 1: Deterministic validation
// ---------------------------------------------------------------------------

export interface DeterministicResult {
  passed: boolean;
  failures: string[];
}

/** Turkish uppercase alphabet (including special chars) */
const TR_UPPER_RE = /^[A-ZÇĞİÖŞÜ]+$/;

export function runDeterministicChecks(
  clues: CluesJson,
  grid: GridJson,
): DeterministicResult {
  const failures: string[] = [];

  const acrossClues = clues?.across ?? [];
  const downClues = clues?.down ?? [];

  // Direction coverage
  if (acrossClues.length === 0) failures.push("Hiç yatay ipucu yok");
  if (downClues.length === 0) failures.push("Hiç dikey ipucu yok");

  // Per-clue validation
  for (const [dirLabel, dirKey, list] of [
    ["YATAY", "across", acrossClues],
    ["DİKEY", "down", downClues],
  ] as [string, string, ClueRecord[]][]) {
    const seenNumbers = new Set<number>();

    for (const c of list) {
      const tag = `[${dirLabel} ${c.number}]`;

      // Duplicate clue numbers
      if (seenNumbers.has(c.number)) {
        failures.push(`${tag} Tekrarlı ipucu numarası`);
      }
      seenNumbers.add(c.number);

      // Empty question text
      if (!c.question || c.question.trim().length === 0) {
        failures.push(`${tag} Soru metni boş`);
      }

      // Empty answer
      const answer = (c.answer ?? "").trim().toUpperCase().replace(/\s/g, "");
      if (answer.length === 0) {
        failures.push(`${tag} Cevap boş veya null`);
        continue; // can't do further checks without an answer
      }

      // Answer length vs declared length
      if (answer.length !== c.answer_length) {
        failures.push(
          `${tag} Uzunluk tutarsız: "${c.answer}" (${answer.length} harf) ≠ beyan ${c.answer_length}`,
        );
      }

      // Minimum word length
      if (answer.length < 2) {
        failures.push(`${tag} Cevap çok kısa (${answer.length} harf)`);
      }

      // Turkish alphabet check (uppercase only — answers should be normalised)
      if (!TR_UPPER_RE.test(answer)) {
        failures.push(`${tag} Cevap geçersiz karakter içeriyor: "${answer}"`);
      }

      // Grid boundary check
      if (c.start) {
        const { row, col } = c.start;
        if (row < 0 || col < 0 || row >= grid.rows || col >= grid.cols) {
          failures.push(`${tag} Başlangıç konumu ızgara dışı: (${row},${col})`);
        } else {
          const endRow = dirKey === "down" ? row + answer.length - 1 : row;
          const endCol = dirKey === "across" ? col + answer.length - 1 : col;
          if (endRow >= grid.rows || endCol >= grid.cols) {
            failures.push(
              `${tag} Cevap ızgara sınırını aşıyor: son konum (${endRow},${endCol})`,
            );
          }
        }
      }
    }
  }

  return { passed: failures.length === 0, failures };
}

// ---------------------------------------------------------------------------
// Phase 2: LLM advisory review
// ---------------------------------------------------------------------------

export interface ClueScore {
  dir: "across" | "down";
  number: number;
  score: number; // 0–100
}

export interface LlmAdvisoryResult {
  /** Code-computed pass/fail — NOT from LLM */
  passed: boolean;
  avgScore: number;
  lowCount: number; // clues scoring < 40
  clueScores: ClueScore[];
  issues: string[]; // low-scoring clue descriptions
  rawResponse: string; // full raw Ollama output for audit
}

const PASS_AVG_THRESHOLD = 60;
const PASS_LOW_COUNT_LIMIT = 2;
const LOW_SCORE_CUTOFF = 40;
const BATCH_SIZE = 8;

interface BatchItem {
  dir: "across" | "down";
  number: number;
  question: string;
  answer: string;
}

/** Parse the Ollama API response envelope, returning the inner object. */
function parseOllamaResponse(raw: unknown): Record<string, unknown> {
  // Ollama returns { response: <object or string> }
  if (typeof raw === "object" && raw !== null) {
    const envelope = raw as Record<string, unknown>;
    const inner = envelope["response"];

    if (typeof inner === "object" && inner !== null) {
      return inner as Record<string, unknown>;
    }

    if (typeof inner === "string") {
      const content = inner.trim();
      // Find the first complete JSON object
      const start = content.indexOf("{");
      if (start === -1) throw new Error(`No JSON object in Ollama response: ${content.slice(0, 300)}`);
      // Scan forward to find the matching closing brace
      let depth = 0;
      let end = -1;
      for (let i = start; i < content.length; i++) {
        if (content[i] === "{") depth++;
        else if (content[i] === "}") {
          depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      if (end === -1) throw new Error(`Truncated JSON in Ollama response: ${content.slice(0, 300)}`);
      return JSON.parse(content.slice(start, end + 1));
    }
  }
  throw new Error(`Unexpected Ollama response shape: ${JSON.stringify(raw).slice(0, 300)}`);
}

/** Call Ollama for a single batch, returning per-clue scores. */
async function evaluateBatch(
  items: BatchItem[],
  ollamaBaseUrl: string,
  ollamaModel: string,
  timeoutMs: number,
): Promise<number[]> {
  const itemLines = items
    .map(
      (it, i) =>
        `${i + 1}. [${it.dir === "across" ? "YATAY" : "DİKEY"} ${it.number}] ` +
        `Soru: "${it.question}" | Cevap: "${it.answer}" (${it.answer.length} harf)`,
    )
    .join("\n");

  const requiredKeys = items.map((_, i) => `score_${i + 1}`);

  const schemaProperties: Record<string, unknown> = {};
  for (const key of requiredKeys) {
    schemaProperties[key] = { type: "integer", minimum: 0, maximum: 100 };
  }

  const promptText =
    `Sen bir Türkçe çapraz bulmaca kalite denetçisisin.\n` +
    `Aşağıdaki ${items.length} soru-cevap çiftini BAĞIMSIZ olarak değerlendir.\n` +
    `Her çifti tek başına ele al. Önceki değerlendirmelerden bağımsız düşün.\n\n` +
    `Her çift için 0-100 arası kalite puanı ver:\n` +
    `- 85-100: Soru net, anlamlı, cevap doğru eşleşiyor, Türkçe hatasız\n` +
    `- 60-84: Küçük sorunlar var ama kabul edilebilir\n` +
    `- 30-59: Soru belirsiz, anlamsız veya cevapla zayıf eşleşme\n` +
    `- 0-29: Çok kötü, anlamsız, sayı/kod, eşleşmiyor\n\n` +
    `KRİTİK KURALLAR (bu kurallardan herhangi birini ihlal eden çifte 0 puan ver):\n` +
    `1. Soru tek başına anlamlı bir Türkçe cümle veya tanım olmalı. Sayı, kod, "0", "343 tekrar tekrar" gibi anlamsız metinler → 0 puan.\n` +
    `2. Cevap anlamlı bir Türkçe kelime veya özel isim olmalı. Rastgele harf dizileri → 0 puan.\n` +
    `3. Soru metninde cevap kelimesi geçMEMELİ. Cevabı doğrudan içeren soru → 0 puan.\n` +
    `4. Cevap gerçekten sorunun karşılığı olmalı. Soru "başkent" diyorsa cevap bir başkent olmalı → eşleşmiyorsa 0 puan.\n\n` +
    `DİĞER KRİTERLER:\n` +
    `5. Soru ile cevap anlamsal olarak eşleşiyor mu?\n` +
    `6. Türkçe doğru yazılmış mı?\n` +
    `7. İçerik aile dostu mu?\n` +
    `8. Soru bulmaca standartlarına uygun mu (kısa, net)?\n\n` +
    `SORULAR VE CEVAPLAR:\n${itemLines}\n\n` +
    `SADECE şu ${requiredKeys.length} anahtar ile JSON döndür: ${requiredKeys.join(", ")}\n` +
    `Başka anahtar veya açıklama ekleme.\n\nJSON:`;

  const res = await fetch(`${ollamaBaseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model: ollamaModel,
      system: "Sen bir Türkçe çapraz bulmaca kalite denetçisisin. Her istekte sana verilen soru-cevap çiftlerini BAĞIMSIZ değerlendir. Önceki isteklerden hiçbir bilgi taşıma.",
      prompt: promptText,
      stream: false,
      context: [],  // Ollama context'i sıfırla — önceki istek kalıntısı taşımasın
      format: {
        type: "object",
        properties: schemaProperties,
        required: requiredKeys,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const parsed = parseOllamaResponse(data);

  return items.map((_, i) => {
    const raw = parsed[`score_${i + 1}`];
    const n = typeof raw === "number" ? raw : parseInt(String(raw ?? "50"), 10);
    return isNaN(n) ? 50 : Math.min(100, Math.max(0, n));
  });
}

/**
 * Run LLM advisory review on a puzzle.
 * Returns per-clue scores and a code-computed pass/fail.
 * The LLM never makes the pass/fail decision.
 */
export async function runLlmAdvisoryReview(
  clues: CluesJson,
  ollamaBaseUrl: string,
  ollamaModel: string,
  batchTimeoutMs = 120_000,
): Promise<LlmAdvisoryResult> {
  const items: BatchItem[] = [];
  const allRawResponses: string[] = [];

  for (const c of clues?.across ?? []) {
    const answer = (c.answer ?? "").trim().toUpperCase();
    if (answer && c.question?.trim()) {
      items.push({ dir: "across", number: c.number, question: c.question, answer });
    }
  }
  for (const c of clues?.down ?? []) {
    const answer = (c.answer ?? "").trim().toUpperCase();
    if (answer && c.question?.trim()) {
      items.push({ dir: "down", number: c.number, question: c.question, answer });
    }
  }

  if (items.length === 0) {
    return {
      passed: false,
      avgScore: 0,
      lowCount: items.length,
      clueScores: [],
      issues: ["Geçerli ipucu/cevap bulunamadı"],
      rawResponse: "",
    };
  }

  const allScores: number[] = [];
  const batches: BatchItem[][] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    batches.push(items.slice(i, i + BATCH_SIZE));
  }

  for (const batch of batches) {
    const scores = await evaluateBatch(
      batch,
      ollamaBaseUrl,
      ollamaModel,
      batchTimeoutMs,
    );
    allScores.push(...scores);
    // Small pause between batches to avoid overwhelming Ollama
    if (batches.length > 1) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  const clueScores: ClueScore[] = items.map((it, i) => ({
    dir: it.dir,
    number: it.number,
    score: allScores[i],
  }));

  const avgScore = Math.round(
    allScores.reduce((a, b) => a + b, 0) / allScores.length,
  );
  const lowCount = allScores.filter((s) => s < LOW_SCORE_CUTOFF).length;

  // Code-enforced pass/fail — LLM never decides this
  const passed = avgScore >= PASS_AVG_THRESHOLD && lowCount <= PASS_LOW_COUNT_LIMIT;

  // Identify the worst clues for the feedback message
  const worstClues = clueScores
    .filter((cs) => cs.score < 50)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map(
      (cs) =>
        `[${cs.dir === "across" ? "YATAY" : "DİKEY"} ${cs.number}] puan: ${cs.score}/100`,
    );

  return {
    passed,
    avgScore,
    lowCount,
    clueScores,
    issues: worstClues,
    rawResponse: allRawResponses.join("\n---\n"),
  };
}

// ---------------------------------------------------------------------------
// Final decision
// ---------------------------------------------------------------------------

export interface ReviewDecision {
  passed: boolean;
  score: number;
  deterministicFailures: string[];
  llmAvgScore: number | null;
  llmClueScores: ClueScore[] | null;
  issues: string[];
  feedback: string;
  /** Which phase caused rejection, or null if passed */
  rejectedBy: "deterministic" | "llm" | null;
}

export function makeReviewDecision(
  det: DeterministicResult,
  llm: LlmAdvisoryResult | null,
): ReviewDecision {
  if (!det.passed) {
    return {
      passed: false,
      score: 0,
      deterministicFailures: det.failures,
      llmAvgScore: null,
      llmClueScores: null,
      issues: det.failures,
      feedback:
        `Bulmaca yapısal doğrulama aşamasında başarısız oldu. ` +
        `${det.failures.length} sorun tespit edildi: ${det.failures.slice(0, 3).join("; ")}`,
      rejectedBy: "deterministic",
    };
  }

  if (!llm) {
    // LLM was skipped (e.g. no valid clues to score)
    return {
      passed: false,
      score: 0,
      deterministicFailures: [],
      llmAvgScore: null,
      llmClueScores: null,
      issues: ["YZ değerlendirmesi yapılamadı"],
      feedback: "YZ değerlendirmesi sırasında beklenmeyen bir hata oluştu.",
      rejectedBy: "llm",
    };
  }

  const worstDetails = (llm.clueScores ?? [])
    .filter((cs) => cs.score < 50)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map(
      (cs) =>
        `[${cs.dir === "across" ? "YATAY" : "DİKEY"} ${cs.number}] puan:${cs.score}`,
    );

  const feedback = llm.passed
    ? `Bulmaca kalite değerlendirmesini geçti. Ortalama puan: ${llm.avgScore}/100. ` +
      `${llm.clueScores.length} ipucu incelendi.`
    : `Bulmaca kalite eşiğini geçemedi. Ortalama puan: ${llm.avgScore}/100. ` +
      `Düşük puanlı ipuç sayısı: ${llm.lowCount}. ` +
      (worstDetails.length > 0 ? `Sorunlu: ${worstDetails.join("; ")}` : "");

  return {
    passed: llm.passed,
    score: llm.avgScore,
    deterministicFailures: [],
    llmAvgScore: llm.avgScore,
    llmClueScores: llm.clueScores,
    issues: [...llm.issues, ...worstDetails],
    feedback,
    rejectedBy: llm.passed ? null : "llm",
  };
}
