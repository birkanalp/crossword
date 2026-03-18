import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { spawn } from 'child_process';
import path from 'path';
import { randomUUID } from 'crypto';

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

  let body: { difficulty?: string; count?: number; daily?: boolean };
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

  const isDaily = body?.daily === true;

  // Create service-role client for inserting placeholder records
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Server misconfiguration: missing Supabase service credentials' },
      { status: 500 }
    );
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Pre-allocate UUIDs and pick difficulty for each puzzle
  const ids: string[] = Array.from({ length: count }, () => randomUUID());
  const difficulties: Difficulty[] = Array.from({ length: count }, () => difficulty);

  // Batch INSERT placeholder rows
  const placeholders = ids.map((id, i) => ({
    id,
    target_difficulty: difficulties[i],
    difficulty: difficulties[i],
    language: 'tr',
    review_status: 'generating',
    version: 1,
    auto_generated: true,
    clues_json: { across: [], down: [] },
    grid_json: { rows: 0, cols: 0, cells: [] },
    answer_hash: '',
    solution_hash: '',
    word_count: 0,
    grid_size: 0,
    generator_version: 'placeholder',
    is_premium: false,
    difficulty_multiplier: 1.0,
  }));

  const { error: insertError } = await serviceClient
    .from('levels')
    .insert(placeholders);

  if (insertError) {
    return NextResponse.json(
      { error: `Failed to create placeholder records: ${insertError.message}` },
      { status: 500 }
    );
  }

  const projectRoot = path.resolve(process.cwd(), '..');
  const scriptPath = path.join(projectRoot, 'scripts', 'tr', 'generate-crossword.ts');

  const scriptArgs = [
    'tsx',
    scriptPath,
    '--ids', ids.join(','),
    '--difficulties', difficulties.join(','),
    '--json',
  ];
  if (isDaily) {
    scriptArgs.push('--daily');
  }

  const child = spawn('npx', scriptArgs, {
    cwd: projectRoot,
    env: { ...process.env },
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  return NextResponse.json(
    { accepted: true, count, difficulty, placeholder_ids: ids },
    { status: 202 }
  );
}
