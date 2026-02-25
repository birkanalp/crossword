import { once } from "node:events";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

type CliOptions = {
  inputPath: string;
  outputPath: string;
  limitPages: number;
  maxBytes?: number;
};

type Stats = {
  pagesSeen: number;
  pagesWritten: number;
  outputBytes: number;
  startedAt: number;
  droppedEmpty: number;
  droppedNamespaceTitle: number;
  droppedNoRevisionText: number;
  droppedByReason: {
    entity: number;
    fileExt: number;
    namespaceArtifact: number;
  };
};

const ROOT = resolve(process.cwd());
const DEFAULT_IN = "data/trwiki-latest-pages-articles.xml.bz2";
const DEFAULT_OUT = "data/tr_corpus.txt";
const DEFAULT_LIMIT_PAGES = 20_000;
const MEDIA_EXTENSION_PATTERN =
  /\.(?:jpg|jpeg|png|svg|gif|webp|pdf|ogg|mp3|mp4|webm|bmp|tif|tiff|ico)(?=$|[\s)\]}.,;:!?])/gi;
const MEDIA_EXTENSION_TOKEN_PATTERN = /\b(?:jpg|jpeg|png|svg|gif|webp|pdf|ogg|mp3|mp4|webm|bmp|tif|tiff|ico)\b/gi;
const NAMESPACE_ARTIFACT_PATTERN = /\b(?:file|dosya|category|kategori)\s*:\s*[^\s|<>{}\]]+/gi;

const BLOCKED_NAMESPACES = new Set(
  [
    "category",
    "kategori",
    "file",
    "dosya",
    "image",
    "template",
    "şablon",
    "help",
    "yardım",
    "wikipedia",
    "portal",
    "module",
    "modül",
    "special",
    "özel",
    "media",
    "talk",
    "tartışma",
    "user",
    "kullanıcı",
    "draft",
  ].map((ns) => ns.toLocaleLowerCase("tr-TR")),
);

function parsePositiveInt(raw: string, flag: string): number {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer. Received: ${raw}`);
  }
  return parsed;
}

function parseArgs(argv: string[]): CliOptions {
  let inArg = DEFAULT_IN;
  let outArg = DEFAULT_OUT;
  let limitPages = DEFAULT_LIMIT_PAGES;
  let maxBytes: number | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--in") {
      const value = argv[i + 1];
      if (!value) throw new Error("--in requires a value.");
      inArg = value;
      i += 1;
      continue;
    }
    if (arg === "--out") {
      const value = argv[i + 1];
      if (!value) throw new Error("--out requires a value.");
      outArg = value;
      i += 1;
      continue;
    }
    if (arg === "--limitPages") {
      const value = argv[i + 1];
      if (!value) throw new Error("--limitPages requires a value.");
      limitPages = parsePositiveInt(value, "--limitPages");
      i += 1;
      continue;
    }
    if (arg === "--maxBytes") {
      const value = argv[i + 1];
      if (!value) throw new Error("--maxBytes requires a value.");
      maxBytes = parsePositiveInt(value, "--maxBytes");
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    inputPath: resolve(ROOT, inArg),
    outputPath: resolve(ROOT, outArg),
    limitPages,
    maxBytes,
  };
}

function decodeXmlEntities(input: string, droppedByReason: Stats["droppedByReason"]): string {
  const decoded = input.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos|nbsp);/g, (entity, code) => {
    if (code === "amp") return "&";
    if (code === "lt") return "<";
    if (code === "gt") return ">";
    if (code === "quot") return '"';
    if (code === "apos") return "'";
    if (code === "nbsp") return " ";
    if (code.startsWith("#x")) {
      const value = Number.parseInt(code.slice(2), 16);
      if (!Number.isFinite(value)) return entity;
      try {
        return String.fromCodePoint(value);
      } catch {
        return entity;
      }
    }
    if (code.startsWith("#")) {
      const value = Number.parseInt(code.slice(1), 10);
      if (!Number.isFinite(value)) return entity;
      try {
        return String.fromCodePoint(value);
      } catch {
        return entity;
      }
    }
    return entity;
  });

  const residualEntities = decoded.match(/&[a-zA-Z][a-zA-Z0-9]+;/g) ?? [];
  droppedByReason.entity += (input.match(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos|nbsp);/g) ?? []).length;
  droppedByReason.entity += residualEntities.length;
  return decoded.replace(/&[a-zA-Z][a-zA-Z0-9]+;/g, " ");
}

function stripTemplates(input: string): string {
  let depth = 0;
  let out = "";

  for (let i = 0; i < input.length; i += 1) {
    const a = input[i];
    const b = input[i + 1];

    if (a === "{" && b === "{") {
      depth += 1;
      i += 1;
      continue;
    }

    if (a === "}" && b === "}" && depth > 0) {
      depth -= 1;
      i += 1;
      continue;
    }

    if (depth === 0) out += a;
  }

  return out;
}

function startsWithBlockedNamespace(value: string): boolean {
  const normalized = value.replace(/^:/, "").trim();
  const match = normalized.match(/^([^:]+):/);
  if (!match) return false;
  return BLOCKED_NAMESPACES.has(match[1].trim().toLocaleLowerCase("tr-TR"));
}

function normalizeWikiLink(linkBody: string): string {
  const parts = linkBody.split("|");
  const target = (parts[0] ?? "").trim();
  const display = (parts.length > 1 ? parts[parts.length - 1] : parts[0] ?? "").trim();
  const source = display || target;
  return source.replace(/#.*$/, "").trim();
}

function cleanWikiText(rawText: string, droppedByReason: Stats["droppedByReason"]): string {
  let text = decodeXmlEntities(rawText, droppedByReason);
  text = stripTemplates(text);

  text = text.replace(/<ref\b[^>]*\/\s*>/gi, " ");
  text = text.replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, " ");
  text = text.replace(/<!--[\s\S]*?-->/g, " ");

  text = text.replace(/\[\[([^[\]]+)\]\]/g, (_full, body: string) => {
    const trimmed = body.trim();
    if (!trimmed) return " ";
    if (startsWithBlockedNamespace(trimmed)) return " ";
    return normalizeWikiLink(trimmed) || " ";
  });

  text = text.replace(/\[(https?:\/\/[^\s\]]+)\s+([^\]]+)\]/gi, "$2");
  text = text.replace(/\[(https?:\/\/[^\]]+)\]/gi, " ");
  text = text.replace(/\{\|[\s\S]*?\|\}/g, " ");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/'{2,}/g, "");
  text = text.replace(/__[^_]+__/g, " ");
  text = text.replace(/^\s*=+\s*(.*?)\s*=+\s*$/gm, "$1");
  const namespaceArtifacts = text.match(NAMESPACE_ARTIFACT_PATTERN) ?? [];
  const mediaByExtension = text.match(MEDIA_EXTENSION_PATTERN) ?? [];
  const mediaExtTokens = text.match(MEDIA_EXTENSION_TOKEN_PATTERN) ?? [];
  droppedByReason.namespaceArtifact += namespaceArtifacts.length;
  droppedByReason.fileExt += mediaByExtension.length + mediaExtTokens.length;
  text = text.replace(NAMESPACE_ARTIFACT_PATTERN, " ");
  text = text.replace(MEDIA_EXTENSION_PATTERN, " ");
  text = text.replace(MEDIA_EXTENSION_TOKEN_PATTERN, " ");

  return text.replace(/\s+/g, " ").trim();
}

function extractTitle(pageXml: string): string {
  const match = pageXml.match(/<title>([\s\S]*?)<\/title>/i);
  if (!match) return "";
  return decodeXmlEntities(match[1], { entity: 0, fileExt: 0, namespaceArtifact: 0 }).trim();
}

function extractRevisionText(pageXml: string): string {
  const match = pageXml.match(/<revision[\s\S]*?<text\b[^>]*>([\s\S]*?)<\/text>/i);
  if (!match) return "";
  return match[1] ?? "";
}

async function writeWithBackpressure(stream: ReturnType<typeof createWriteStream>, chunk: string): Promise<void> {
  if (!chunk) return;
  if (stream.write(chunk)) return;
  await once(stream, "drain");
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (!existsSync(options.inputPath)) {
    throw new Error(`Input file not found: ${options.inputPath}`);
  }

  mkdirSync(dirname(options.outputPath), { recursive: true });
  const output = createWriteStream(options.outputPath, { encoding: "utf8" });

  const stats: Stats = {
    pagesSeen: 0,
    pagesWritten: 0,
    outputBytes: 0,
    startedAt: Date.now(),
    droppedEmpty: 0,
    droppedNamespaceTitle: 0,
    droppedNoRevisionText: 0,
    droppedByReason: {
      entity: 0,
      fileExt: 0,
      namespaceArtifact: 0,
    },
  };

  const bz2 = spawn("bzip2", ["-dc", options.inputPath], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const closePromise = once(bz2, "close") as Promise<[number | null, NodeJS.Signals | null]>;

  let stderr = "";
  bz2.stderr.setEncoding("utf8");
  bz2.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  bz2.stdout.setEncoding("utf8");
  let buffer = "";
  let stopReason: string | null = null;

  for await (const chunk of bz2.stdout) {
    buffer += chunk;

    while (true) {
      const pageStart = buffer.indexOf("<page>");
      if (pageStart < 0) {
        if (buffer.length > 1_000_000) {
          buffer = buffer.slice(-200_000);
        }
        break;
      }

      if (pageStart > 0) {
        buffer = buffer.slice(pageStart);
      }

      const pageEnd = buffer.indexOf("</page>");
      if (pageEnd < 0) break;

      const pageXml = buffer.slice(0, pageEnd + "</page>".length);
      buffer = buffer.slice(pageEnd + "</page>".length);

      const nextPageCount = stats.pagesSeen + 1;
      if (nextPageCount > options.limitPages) {
        stopReason = `limitPages reached (${options.limitPages})`;
        break;
      }
      stats.pagesSeen = nextPageCount;

      if (stats.pagesSeen % 1000 === 0) {
        console.log(
          `Progress: pages=${stats.pagesSeen}, written=${stats.pagesWritten}, bytes=${stats.outputBytes.toLocaleString("en-US")}`,
        );
      }

      const title = extractTitle(pageXml);
      if (startsWithBlockedNamespace(title)) {
        stats.droppedNamespaceTitle += 1;
        continue;
      }

      const rawText = extractRevisionText(pageXml);
      if (!rawText.trim()) {
        stats.droppedNoRevisionText += 1;
        continue;
      }

      const cleaned = cleanWikiText(rawText, stats.droppedByReason);
      if (!cleaned) {
        stats.droppedEmpty += 1;
        continue;
      }

      let line = `${cleaned}\n`;
      if (options.maxBytes !== undefined) {
        const remaining = options.maxBytes - stats.outputBytes;
        if (remaining <= 0) {
          stopReason = `maxBytes reached (${options.maxBytes})`;
          break;
        }
        if (Buffer.byteLength(line, "utf8") > remaining) {
          while (line.length > 0 && Buffer.byteLength(line, "utf8") > remaining) {
            line = line.slice(0, -1);
          }
          stopReason = `maxBytes reached (${options.maxBytes})`;
        }
      }

      if (!line.trim()) {
        if (stopReason) break;
        continue;
      }

      await writeWithBackpressure(output, line);
      stats.outputBytes += Buffer.byteLength(line, "utf8");
      stats.pagesWritten += 1;

      if (stopReason) break;
    }

    if (stopReason) {
      bz2.kill("SIGTERM");
      break;
    }
  }

  output.end();
  await once(output, "finish");

  const [exitCode, signal] = await closePromise;
  const expectedEarlyStop = stopReason !== null && signal === "SIGTERM";
  if (!expectedEarlyStop && exitCode !== 0) {
    throw new Error(`bzip2 failed with code=${exitCode}, signal=${signal}, stderr=${stderr.trim()}`);
  }

  const elapsedMs = Date.now() - stats.startedAt;
  console.log("Extraction complete.");
  console.log(`Input: ${options.inputPath.replace(`${ROOT}/`, "")}`);
  console.log(`Output: ${options.outputPath.replace(`${ROOT}/`, "")}`);
  console.log(`Pages seen: ${stats.pagesSeen}`);
  console.log(`Pages written: ${stats.pagesWritten}`);
  console.log(`Output bytes: ${stats.outputBytes.toLocaleString("en-US")}`);
  console.log(`Elapsed: ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log(`Dropped pages (blocked namespace title): ${stats.droppedNamespaceTitle}`);
  console.log(`Dropped pages (no revision text): ${stats.droppedNoRevisionText}`);
  console.log(`Dropped pages (empty after cleanup): ${stats.droppedEmpty}`);
  console.log(
    `Dropped segments by reason -> entity:${stats.droppedByReason.entity}, file-ext:${stats.droppedByReason.fileExt}, namespace-artifact:${stats.droppedByReason.namespaceArtifact}`,
  );
  if (stopReason) console.log(`Stopped early: ${stopReason}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`TR wiki extraction failed: ${message}`);
  process.exit(1);
});
