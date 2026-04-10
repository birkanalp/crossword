// =============================================================================
// _shared/review.ts
//
// Deterministic + OpenAI-advisory puzzle review logic.
// Used by admin/index.ts and cronTriggerAiReview/index.ts.
//
// Design principles:
//  1. Deterministic checks ALWAYS run first. If they fail, OpenAI is never called.
//  2. OpenAI is an advisor ONLY — it scores clues and flags issues.
//     It never makes a binary pass/fail decision.
//  3. Pass/fail thresholds are enforced in CODE (see policy constants below).
//  4. Auto-fix is limited to a configurable max per puzzle.
//  5. Hint generation is a separate, conditional pass (only if score > 70).
//  6. All prompts are centralized here — edit prompts here only.
// =============================================================================

import { callOpenAI } from "./openai.ts";

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
// Phase 1: Deterministic validation (unchanged)
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

      // Turkish alphabet check
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
// Phase 2 types
// ---------------------------------------------------------------------------

export type ClueStatus =
  | "accepted"
  | "auto_fix_candidate"
  | "auto_fixed"
  | "needs_human_review"
  | "rejected";

export interface ClueReview {
  /** e.g. "1A", "3D" */
  clueId:           string;
  answer:           string;
  originalClue:     string;
  status:           ClueStatus;
  issueCodes:       string[];
  /** 0–1 */
  confidence:       number;
  smallFixPossible: boolean;
  /** Non-null only when smallFixPossible=true and model provided a safe suggestion */
  fixedClue:        string | null;
  /** 0–100 */
  score:            number;
  hintEligible:     boolean;
  /** Populated in hint pass if hintEligible=true */
  hint:             string | null;
}

export interface PuzzleReviewResult {
  puzzleScore:           number;
  passed:                boolean;
  autoFixCount:          number;
  maxAutoFixesAllowed:   number;
  needsHumanReview:      boolean;
  summaryIssueCodes:     string[];
  hintGenerationEnabled: boolean;
  items:                 ClueReview[];
}

// ---------------------------------------------------------------------------
// Policy constants (all thresholds in one place — never inside prompts)
// ---------------------------------------------------------------------------

/** Puzzle avg score must reach this to pass review. */
const PUZZLE_PASS_THRESHOLD        = 60;
/** Below this score, puzzle is flagged for human review even if "passed". */
const HUMAN_REVIEW_SCORE_THRESHOLD = 80;
/** Above this score, eligible clues receive hints. */
const HINT_ELIGIBILITY_THRESHOLD   = 70;
/** Default maximum clues that may be auto-fixed per puzzle. */
export const DEFAULT_MAX_AUTO_FIXES = 3;
/** Clue score below this is ineligible for hints. */
const LOW_SCORE_CUTOFF             = 40;
/** Max tokens for the review call. */
const REVIEW_MAX_TOKENS            = 1200;
/** Max tokens for the hint call. */
const HINT_MAX_TOKENS              = 600;
/** Timeout per OpenAI call. */
const CALL_TIMEOUT_MS              = 60_000;

// ---------------------------------------------------------------------------
// Prompts — edit here only
// ---------------------------------------------------------------------------

const REVIEW_SYSTEM_PROMPT =
  `Sen bir Türkçe çapraz bulmaca kalite denetçisisin.\n` +
  `Her soru-cevap çiftini BAĞIMSIZ değerlendir. Önceki çiftlerden bağımsız düşün.\n` +
  `Sadece sana verilen JSON şemasına uygun çıktı üret. Açıklama ekleme.`;

function buildReviewUserPrompt(
  items: { id: string; question: string; answer: string }[],
): string {
  const lines = items
    .map(
      (it) =>
        `[${it.id}] Soru: "${it.question}" | Cevap: "${it.answer}" (${it.answer.length} harf)`,
    )
    .join("\n");

  return (
    `Aşağıdaki ${items.length} bulmaca sorusunu değerlendir.\n\n` +
    `PUANLAMA (0-100):\n` +
    `- 85-100: Net, anlamlı Türkçe soru, doğru eşleşme, hatasız\n` +
    `- 60-84: Küçük sorunlar, kabul edilebilir\n` +
    `- 30-59: Belirsiz, zayıf eşleşme\n` +
    `- 0-29: Anlamsız, sayı/kod, eşleşmiyor\n\n` +
    `KRİTİK KURALLAR (ihlal → 0 puan, status=rejected):\n` +
    `1. Soru tek başına anlamlı Türkçe olmalı. Sayı/kod → 0.\n` +
    `2. Cevap anlamlı Türkçe kelime/özel isim olmalı. Rastgele harf → 0.\n` +
    `3. Soru metninde cevap kelimesi GEÇMEMELİ → issueCodes: ANSWER_LEAKED.\n` +
    `4. Cevap sorunun karşılığı olmalı → yoksa MISMATCH.\n\n` +
    `DİĞER KONTROLLER:\n` +
    `5. İçerik aile dostu mu? → OFFENSIVE\n` +
    `6. Çok belirsiz mi? → TOO_VAGUE\n` +
    `7. Çok açık, cevabı hemen ele veriyor mu? → TOO_OBVIOUS\n` +
    `8. Birden fazla doğru cevap olabilir mi? → MULTI_ANSWER\n` +
    `9. Faktüel hata riski var mı? → FACTUAL_RISK\n` +
    `10. Bulmaca stiline uygun mu (kısa, net)? → BAD_STYLE\n\n` +
    `STATUS KURALLARI:\n` +
    `- accepted: sorun yok\n` +
    `- auto_fix_candidate: küçük düzeltme ile kurtarılabilir (smallFixPossible=true ise fixedClue öner)\n` +
    `- needs_human_review: MULTI_ANSWER veya FACTUAL_RISK veya belirsiz sorun\n` +
    `- rejected: OFFENSIVE veya kural 1/2/4 ihlali veya score < 20\n\n` +
    `smallFixPossible=true SADECE: cevap sızıntısı giderilebiliyorsa veya küçük ifade düzeltmesi yeterliyse.\n` +
    `fixedClue: sadece smallFixPossible=true ve açık bir düzeltme varsa doldur. Değilse null.\n` +
    `AI cevabı asla değiştirmez.\n\n` +
    `SORULAR:\n${lines}`
  );
}

const HINT_SYSTEM_PROMPT =
  `Sen bir Türkçe bulmaca ipucu yazarısın. Kısa, yardımcı, aile dostu ipuçları üretirsin.\n` +
  `Her ipucu 1-2 cümle. Cevabı doğrudan verme. Cevap kelimesini ipucuna yazma.\n` +
  `İki stil kullanabilirsin: (a) daha basit alternatif tanım, (b) cevap gizlenmiş örnek cümle (cevap yerine .... yaz).`;

function buildHintUserPrompt(
  items: { id: string; question: string; answer: string }[],
): string {
  const lines = items
    .map((it) => `[${it.id}] Soru: "${it.question}" | Cevap: "${it.answer}"`)
    .join("\n");
  return `Her soru-cevap çifti için bir ipucu üret:\n${lines}`;
}

// ---------------------------------------------------------------------------
// JSON schemas for OpenAI structured output
// ---------------------------------------------------------------------------

const REVIEW_SCHEMA = {
  name: "puzzle_review",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      clues: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id:               { type: "string" },
            score:            { type: "integer" },
            status:           {
              type: "string",
              enum: ["accepted", "auto_fix_candidate", "needs_human_review", "rejected"],
            },
            issueCodes:       { type: "array", items: { type: "string" } },
            confidence:       { type: "number" },
            smallFixPossible: { type: "boolean" },
            fixedClue:        { anyOf: [{ type: "string" }, { type: "null" }] },
          },
          required: [
            "id", "score", "status", "issueCodes",
            "confidence", "smallFixPossible", "fixedClue",
          ],
        },
      },
    },
    required: ["clues"],
  },
};

const HINT_SCHEMA = {
  name: "hint_output",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      hints: {
        type: "object",
        additionalProperties: { type: "string" },
      },
    },
    required: ["hints"],
  },
};

// ---------------------------------------------------------------------------
// Phase 2: OpenAI advisory review
// ---------------------------------------------------------------------------

export interface OpenAIReviewConfig {
  apiKey:        string;
  model:         string;
  maxAutoFixes?: number;
  timeoutMs?:    number;
  /**
   * Phase 2 (future): human reviewer comments to inject into the prompt.
   * Leave undefined for Phase 1 behaviour.
   */
  humanComments?: string;
}

interface RawClueScore {
  id:               string;
  score:            number;
  status:           string;
  issueCodes:       string[];
  confidence:       number;
  smallFixPossible: boolean;
  fixedClue:        string | null;
}

/**
 * Run OpenAI advisory review on a puzzle.
 * Returns rich per-clue results and a code-enforced puzzle verdict.
 * The model never makes the pass/fail decision — thresholds live in code.
 */
export async function runOpenAIReview(
  clues: CluesJson,
  config: OpenAIReviewConfig,
): Promise<PuzzleReviewResult> {
  const maxAutoFixes = config.maxAutoFixes ?? DEFAULT_MAX_AUTO_FIXES;

  const items: { id: string; question: string; answer: string }[] = [];

  for (const c of clues?.across ?? []) {
    const answer = (c.answer ?? "").trim().toUpperCase();
    if (answer && c.question?.trim()) {
      items.push({ id: `${c.number}A`, question: c.question, answer });
    }
  }
  for (const c of clues?.down ?? []) {
    const answer = (c.answer ?? "").trim().toUpperCase();
    if (answer && c.question?.trim()) {
      items.push({ id: `${c.number}D`, question: c.question, answer });
    }
  }

  if (items.length === 0) {
    return {
      puzzleScore: 0,
      passed: false,
      autoFixCount: 0,
      maxAutoFixesAllowed: maxAutoFixes,
      needsHumanReview: true,
      summaryIssueCodes: ["NO_VALID_CLUES"],
      hintGenerationEnabled: false,
      items: [],
    };
  }

  // Build user prompt — inject human comments if provided (Phase 2 hook)
  let userPrompt = buildReviewUserPrompt(items);
  if (config.humanComments?.trim()) {
    userPrompt += `\n\nİNSAN İNCELEMESİ NOTU:\n${config.humanComments.trim()}`;
  }

  // ── Review call ────────────────────────────────────────────────────────────
  const rawReview = await callOpenAI<{ clues: RawClueScore[] }>({
    apiKey:    config.apiKey,
    model:     config.model,
    messages: [
      { role: "system", content: REVIEW_SYSTEM_PROMPT },
      { role: "user",   content: userPrompt },
    ],
    jsonSchema: REVIEW_SCHEMA,
    maxTokens:  REVIEW_MAX_TOKENS,
    timeoutMs:  config.timeoutMs ?? CALL_TIMEOUT_MS,
  });

  // Build a lookup map: clueId → raw result
  const rawMap = new Map<string, RawClueScore>();
  for (const r of rawReview.clues ?? []) {
    rawMap.set(r.id, r);
  }

  // ── Apply policy rules in code ─────────────────────────────────────────────
  let autoFixCount = 0;
  const reviewItems: ClueReview[] = [];
  const allIssueCodes = new Set<string>();

  for (const it of items) {
    const raw = rawMap.get(it.id);

    if (!raw) {
      // Model missed this clue — conservative fallback
      reviewItems.push({
        clueId: it.id, answer: it.answer, originalClue: it.question,
        status: "needs_human_review", issueCodes: ["MISSING_REVIEW"],
        confidence: 0, smallFixPossible: false, fixedClue: null,
        score: 50, hintEligible: false, hint: null,
      });
      continue;
    }

    const score      = Math.min(100, Math.max(0, Math.round(raw.score)));
    const confidence = Math.min(1, Math.max(0, raw.confidence));
    const issueCodes = Array.isArray(raw.issueCodes) ? [...raw.issueCodes] : [];
    let   status     = raw.status as ClueStatus;

    // Escalate to human review for ambiguous/risky issues
    if (
      issueCodes.includes("MULTI_ANSWER") ||
      issueCodes.includes("FACTUAL_RISK") ||
      confidence < 0.5
    ) {
      status = "needs_human_review";
    }

    // Attempt to apply auto-fix
    let fixedClue:    string | null = null;
    let appliedStatus               = status;

    if (
      status === "auto_fix_candidate" &&
      raw.smallFixPossible &&
      typeof raw.fixedClue === "string" &&
      raw.fixedClue.trim().length > 0
    ) {
      if (autoFixCount < maxAutoFixes) {
        // Safety: fixed clue must not reveal the answer
        const answerUpper = it.answer.toUpperCase();
        const fixUpper    = raw.fixedClue.toUpperCase();
        if (!fixUpper.includes(answerUpper)) {
          fixedClue    = raw.fixedClue.trim();
          appliedStatus = "auto_fixed";
          autoFixCount++;
        } else {
          // Fix still leaks answer — escalate to human
          appliedStatus = "needs_human_review";
          issueCodes.push("FIX_LEAKED_ANSWER");
        }
      } else {
        // Limit reached — remaining auto-fix candidates go to human review
        appliedStatus = "needs_human_review";
      }
    }

    for (const code of issueCodes) allIssueCodes.add(code);

    const hintEligible =
      (appliedStatus === "accepted" || appliedStatus === "auto_fixed") &&
      score >= LOW_SCORE_CUTOFF;

    reviewItems.push({
      clueId: it.id, answer: it.answer, originalClue: it.question,
      status: appliedStatus,
      issueCodes,
      confidence,
      smallFixPossible: raw.smallFixPossible,
      fixedClue,
      score,
      hintEligible,
      hint: null, // populated below if eligible
    });
  }

  const scores      = reviewItems.map((r) => r.score);
  const puzzleScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  const hasHumanReviewClues = reviewItems.some((r) => r.status === "needs_human_review");
  const needsHumanReview    =
    puzzleScore < HUMAN_REVIEW_SCORE_THRESHOLD ||
    autoFixCount > maxAutoFixes ||
    hasHumanReviewClues;

  const passed                = puzzleScore >= PUZZLE_PASS_THRESHOLD;
  const hintGenerationEnabled = puzzleScore > HINT_ELIGIBILITY_THRESHOLD;

  // ── Hint generation pass (conditional, non-fatal) ─────────────────────────
  if (hintGenerationEnabled) {
    const eligibleItems = reviewItems
      .filter((r) => r.hintEligible)
      .map((r) => ({
        id:       r.clueId,
        question: r.fixedClue ?? r.originalClue,
        answer:   r.answer,
      }));

    if (eligibleItems.length > 0) {
      try {
        const hintsRaw = await callOpenAI<{ hints: Record<string, string> }>({
          apiKey:    config.apiKey,
          model:     config.model,
          messages: [
            { role: "system", content: HINT_SYSTEM_PROMPT },
            { role: "user",   content: buildHintUserPrompt(eligibleItems) },
          ],
          jsonSchema: HINT_SCHEMA,
          maxTokens:  HINT_MAX_TOKENS,
          timeoutMs:  config.timeoutMs ?? CALL_TIMEOUT_MS,
        });

        const hintsMap = hintsRaw.hints ?? {};
        for (const r of reviewItems) {
          if (!r.hintEligible) continue;
          const raw = hintsMap[r.clueId];
          if (typeof raw === "string" && raw.trim().length > 0) {
            // Safety: hint must not contain the answer
            if (!raw.toUpperCase().includes(r.answer.toUpperCase())) {
              r.hint = raw.trim();
            }
          }
        }
      } catch (e) {
        // Hint generation is non-fatal — review result is still valid
        console.warn("[review] hint generation failed (non-fatal):", e);
      }
    }
  }

  return {
    puzzleScore,
    passed,
    autoFixCount,
    maxAutoFixesAllowed: maxAutoFixes,
    needsHumanReview,
    summaryIssueCodes: Array.from(allIssueCodes),
    hintGenerationEnabled,
    items: reviewItems,
  };
}

// ---------------------------------------------------------------------------
// Stand-alone hint generation (admin manual re-generate endpoint)
// ---------------------------------------------------------------------------

export async function runHintGeneration(
  eligibleClues: { id: string; question: string; answer: string }[],
  config: { apiKey: string; model: string; timeoutMs?: number },
): Promise<Record<string, string>> {
  if (eligibleClues.length === 0) return {};

  const raw = await callOpenAI<{ hints: Record<string, string> }>({
    apiKey:    config.apiKey,
    model:     config.model,
    messages: [
      { role: "system", content: HINT_SYSTEM_PROMPT },
      { role: "user",   content: buildHintUserPrompt(eligibleClues) },
    ],
    jsonSchema: HINT_SCHEMA,
    maxTokens:  HINT_MAX_TOKENS,
    timeoutMs:  config.timeoutMs ?? CALL_TIMEOUT_MS,
  });

  const out: Record<string, string> = {};
  for (const [id, hint] of Object.entries(raw.hints ?? {})) {
    if (typeof hint === "string" && hint.trim().length > 0) {
      out[id] = hint.trim();
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Final decision (updated for PuzzleReviewResult)
// ---------------------------------------------------------------------------

export interface ReviewDecision {
  passed:                boolean;
  score:                 number;
  deterministicFailures: string[];
  /** Kept for audit column compatibility (llm_clue_scores) */
  llmClueScores:         { dir: "across" | "down"; number: number; score: number }[] | null;
  /** Rich per-clue results from Phase 2 */
  puzzleReview:          PuzzleReviewResult | null;
  issues:                string[];
  feedback:              string;
  rejectedBy:            "deterministic" | "llm" | null;
  needsHumanReview:      boolean;
  autoFixCount:          number;
}

export function makeReviewDecision(
  det: DeterministicResult,
  review: PuzzleReviewResult | null,
): ReviewDecision {
  if (!det.passed) {
    return {
      passed: false,
      score: 0,
      deterministicFailures: det.failures,
      llmClueScores: null,
      puzzleReview: null,
      issues: det.failures,
      feedback:
        `Bulmaca yapısal doğrulama aşamasında başarısız oldu. ` +
        `${det.failures.length} sorun: ${det.failures.slice(0, 3).join("; ")}`,
      rejectedBy: "deterministic",
      needsHumanReview: false,
      autoFixCount: 0,
    };
  }

  if (!review) {
    return {
      passed: false,
      score: 0,
      deterministicFailures: [],
      llmClueScores: null,
      puzzleReview: null,
      issues: ["YZ değerlendirmesi yapılamadı"],
      feedback: "YZ değerlendirmesi sırasında beklenmeyen bir hata oluştu.",
      rejectedBy: "llm",
      needsHumanReview: true,
      autoFixCount: 0,
    };
  }

  const worstDetails = review.items
    .filter((r) => r.score < 50)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((r) => `[${r.clueId}] puan:${r.score}`);

  const feedback = review.passed
    ? `Bulmaca kalite değerlendirmesini geçti. Ortalama puan: ${review.puzzleScore}/100. ` +
      `${review.items.length} ipucu incelendi. Otomatik düzeltme: ${review.autoFixCount}.`
    : `Bulmaca kalite eşiğini geçemedi. Ortalama puan: ${review.puzzleScore}/100. ` +
      (worstDetails.length > 0 ? `Sorunlu: ${worstDetails.join("; ")}` : "");

  // Populate legacy llm_clue_scores column for audit compatibility
  const llmClueScores = review.items.map((r) => {
    const isAcross = r.clueId.endsWith("A");
    const numStr   = r.clueId.slice(0, -1);
    return {
      dir:    isAcross ? "across" as const : "down" as const,
      number: parseInt(numStr, 10),
      score:  r.score,
    };
  });

  return {
    passed: review.passed,
    score:  review.puzzleScore,
    deterministicFailures: [],
    llmClueScores,
    puzzleReview: review,
    issues: worstDetails,
    feedback,
    rejectedBy:       review.passed ? null : "llm",
    needsHumanReview: review.needsHumanReview,
    autoFixCount:     review.autoFixCount,
  };
}
