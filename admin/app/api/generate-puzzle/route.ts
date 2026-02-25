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

  let body: { difficulty?: string };
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

  const projectRoot = path.resolve(process.cwd(), '..');
  const scriptPath = path.join(projectRoot, 'scripts', 'tr', 'generate-crossword.ts');

  return new Promise<NextResponse>((resolve) => {
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

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      const lines = stdout.trim().split('\n');
      const lastLine = lines[lines.length - 1];
      if (lastLine) {
        try {
          const parsed = JSON.parse(lastLine) as { success?: boolean; level_id?: string | null; error?: string };
          if (parsed.success && parsed.level_id) {
            resolve(NextResponse.json({ level_id: parsed.level_id, difficulty }));
            return;
          }
          if (!parsed.success && parsed.error) {
            resolve(NextResponse.json({ error: parsed.error }, { status: 500 }));
            return;
          }
        } catch {
          // fall through to generic error
        }
      }

      if (code !== 0) {
        const errMsg = stderr.trim() || stdout.trim() || `Script exited with code ${code}`;
        resolve(NextResponse.json({ error: errMsg }, { status: 500 }));
        return;
      }

      resolve(NextResponse.json({ error: 'Generation completed but no level_id returned' }, { status: 500 }));
    });

    child.on('error', (err) => {
      resolve(NextResponse.json({ error: String(err.message) }, { status: 500 }));
    });
  });
}
