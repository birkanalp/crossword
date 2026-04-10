// =============================================================================
// _shared/openai.ts
//
// Minimal OpenAI Chat Completions provider for Deno Edge Functions.
// Uses native fetch — no SDK dependency.
//
// Supports structured JSON output via OpenAI's response_format JSON schema mode.
// All callers receive a parsed, typed object — never raw strings.
// =============================================================================

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

export interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenAICallConfig {
  apiKey: string;
  model: string;
  messages: OpenAIMessage[];
  /** JSON Schema object for structured output. Must be strict-compatible. */
  jsonSchema: {
    name: string;
    schema: Record<string, unknown>;
  };
  maxTokens?: number;
  timeoutMs?: number;
}

/**
 * Call OpenAI Chat Completions with structured JSON output.
 * Returns the parsed response object typed as T.
 * Throws on HTTP error or JSON parse failure.
 */
export async function callOpenAI<T>(config: OpenAICallConfig): Promise<T> {
  const {
    apiKey,
    model,
    messages,
    jsonSchema,
    maxTokens = 1200,
    timeoutMs = 60_000,
  } = config;

  const body = {
    model,
    messages,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: jsonSchema.name,
        strict: true,
        schema: jsonSchema.schema,
      },
    },
    temperature: 0,
    max_tokens: maxTokens,
  };

  const res = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "(unreadable)");
    throw new Error(`OpenAI HTTP ${res.status}: ${errText.slice(0, 400)}`);
  }

  const data = await res.json() as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };

  if (data.error?.message) {
    throw new Error(`OpenAI error: ${data.error.message}`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error(`OpenAI: empty response content`);
  }

  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error(
      `OpenAI: failed to parse JSON response: ${content.slice(0, 300)}`,
    );
  }
}
