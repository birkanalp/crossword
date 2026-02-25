import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";

export const ROOT = resolve(process.cwd());
export const TOKEN_ACCEPT_REGEX = /^[a-zçğıöşü]+$/;

export function loadEnvFromDotenv(): Record<string, string> {
  const dotenvPath = resolve(ROOT, ".env");
  if (!existsSync(dotenvPath)) return {};

  const env: Record<string, string> = {};
  const lines = readFileSync(dotenvPath, "utf8").split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^"(.*)"$/, "$1");
    env[key] = value;
  }

  return env;
}

export function pickEnv(key: string, dotenv: Record<string, string>): string | undefined {
  return process.env[key] ?? dotenv[key];
}

export function normalizeTurkishWord(raw: string): string {
  return raw
    .normalize("NFKC")
    .toLocaleLowerCase("tr-TR")
    .replace(/[^a-zçğıöşü]/g, "");
}

export function createPool(): Pool {
  const dotenv = loadEnvFromDotenv();
  const connectionString = pickEnv("DATABASE_URL", dotenv);

  return connectionString
    ? new Pool({ connectionString })
    : new Pool({
        host: pickEnv("PGHOST", dotenv) ?? "127.0.0.1",
        port: Number.parseInt(pickEnv("PGPORT", dotenv) ?? pickEnv("POSTGRES_PORT", dotenv) ?? "54322", 10),
        database: pickEnv("PGDATABASE", dotenv) ?? pickEnv("POSTGRES_DB", dotenv) ?? "postgres",
        user: pickEnv("PGUSER", dotenv) ?? "postgres",
        password:
          pickEnv("PGPASSWORD", dotenv) ??
          pickEnv("POSTGRES_PASSWORD", dotenv) ??
          "your-super-secret-and-long-postgres-password",
      });
}

export function parseFrequencyCsv(freqPath: string): Map<string, number> {
  if (!existsSync(freqPath)) {
    throw new Error(`Missing frequency file: ${freqPath}`);
  }

  const lines = readFileSync(freqPath, "utf8").split(/\r?\n/);
  const map = new Map<string, number>();

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    if (i === 0 && line.toLowerCase() === "word,count") continue;

    const commaIndex = line.indexOf(",");
    if (commaIndex <= 0) continue;

    const rawWord = line.slice(0, commaIndex).trim();
    const rawCount = line.slice(commaIndex + 1).trim();
    const normalized = normalizeTurkishWord(rawWord);
    const count = Number.parseInt(rawCount, 10);

    if (!normalized) continue;
    if (!Number.isFinite(count) || count <= 0) continue;

    map.set(normalized, (map.get(normalized) ?? 0) + count);
  }

  return map;
}
