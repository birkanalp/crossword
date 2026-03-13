import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { spawn } from 'child_process';
import path from 'path';

const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert'] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

function isDifficulty(s: string): s is Difficulty {
  return DIFFICULTIES.includes(s as Difficulty);
}

async function requireAdmin(req: NextRequest): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!url || !anonKey) return null;

  const jwt = authHeader.slice(7);
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  const role = (user.app_metadata as Record<string, unknown>)?.role;
  if (role !== 'admin') return null;
  return { userId: user.id };
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
  }

  let body: { difficulty?: string; count?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const difficulty = body?.difficulty?.toLowerCase();
  if (!difficulty || !isDifficulty(difficulty)) {
    return NextResponse.json(
      { error: 'difficulty required: easy | medium | hard | expert' },
      { status: 400 }
    );
  }

  // count: 1–100, varsayılan 1
  const rawCount = body?.count;
  const count =
    rawCount === undefined || rawCount === null
      ? 1
      : Math.floor(Number(rawCount));
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    return NextResponse.json(
      { error: 'count must be an integer between 1 and 100' },
      { status: 400 }
    );
  }

  const projectRoot = path.resolve(process.cwd(), '..');
  const scriptPath = path.join(projectRoot, 'scripts', 'tr', 'generate-crossword.ts');

  // Batch mode (count > 1): fire-and-forget, return 202 immediately
  if (count > 1) {
    const child = spawn(
      'npx',
      ['tsx', scriptPath, '--difficulty', difficulty, '--count', String(count), '--json'],
      {
        cwd: projectRoot,
        env: { ...process.env },
        detached: true,
        stdio: 'ignore',
      }
    );
    child.unref();
    return NextResponse.json(
      { accepted: true, count, difficulty },
      { status: 202 }
    );
  }

  type GenResult = {
    success: boolean;
    level_id?: string | null;
    level_ids?: string[];
    difficulty?: string;
    error?: string;
  };

  const runGenerator = (): Promise<GenResult> =>
    new Promise((resolve, reject) => {
      const child = spawn(
        'npx',
        ['tsx', scriptPath, '--difficulty', difficulty, '--count', '1', '--json'],
        {
          cwd: projectRoot,
          env: { ...process.env },
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      );

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (chunk) => { stdout += chunk.toString(); });
      child.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });

      child.on('close', (code) => {
        const lines = stdout.trim().split('\n');
        const lastLine = lines[lines.length - 1];
        if (lastLine) {
          try {
            const parsed = JSON.parse(lastLine) as GenResult;
            resolve({
              success: !!parsed.success,
              level_id: parsed.level_id ?? null,
              level_ids: Array.isArray(parsed.level_ids) ? parsed.level_ids : undefined,
              difficulty: parsed.difficulty,
              error: parsed.error,
            });
            return;
          } catch {
            // fall through
          }
        }
        if (code !== 0) {
          resolve({ success: false, error: stderr.trim() || stdout.trim() || `Script exited with code ${code}` });
        } else {
          resolve({ success: false, error: 'Generation completed but no level_id(s) returned' });
        }
      });

      child.on('error', (err) => reject(err));
    });

  const MAX_RETRIES = 3;
  const RETRYABLE_ERROR = 'Failed to generate playable crossword';

  const runAiReview = async (levelId: string) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
    const adminJwt = req.headers.get('authorization')?.slice(7) ?? '';
    try {
      await fetch(`${supabaseUrl}/functions/v1/admin/puzzles/${levelId}/ai-review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminJwt}`,
          'apikey': anonKey,
        },
      });
    } catch {
      // AI review başarısız — bulmaca olduğu gibi kalır
    }
  };

  // Tekil üretim: mevcut retry mantığı korunuyor
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await runGenerator();
      if (result.success && result.level_id) {
        await runAiReview(result.level_id);
        return NextResponse.json({ level_id: result.level_id, difficulty });
      }
      const isRetryable = result.error?.includes(RETRYABLE_ERROR);
      if (!isRetryable || attempt === MAX_RETRIES) {
        return NextResponse.json({ error: result.error ?? 'Generation failed' }, { status: 500 });
      }
      // "Failed to generate playable crossword" durumunda tekrar dene (algoritma olasılıksal)
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        return NextResponse.json({ error: String((err as Error).message) }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ error: 'Generation failed after retries' }, { status: 500 });
}
