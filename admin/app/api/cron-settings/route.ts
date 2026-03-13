import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';

async function requireAdmin(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return false;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!url || !anonKey) return false;

  const jwt = authHeader.slice(7);
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return false;
  const role = (user.app_metadata as Record<string, unknown>)?.role;
  return role === 'admin';
}

function getDbPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (url) return new Pool({ connectionString: url });
  const host = process.env.PGHOST ?? '127.0.0.1';
  const port = Number(process.env.PGPORT ?? process.env.POSTGRES_PORT ?? '54322');
  const db = process.env.PGDATABASE ?? process.env.POSTGRES_DB ?? 'postgres';
  const user = process.env.PGUSER ?? 'postgres';
  const password = process.env.PGPASSWORD ?? process.env.POSTGRES_PASSWORD ?? 'your-super-secret-and-long-postgres-password';
  return new Pool({ host, port, database: db, user, password });
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
  }

  const pool = getDbPool();
  try {
    const { rows } = await pool.query(
      "SELECT value FROM app_settings WHERE key = 'puzzle_generation_cron_enabled'"
    );
    const v = rows[0]?.value;
    const enabled = v === true || v === 'true';
    return NextResponse.json({ enabled });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  } finally {
    await pool?.end();
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
  }

  let body: { enabled?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (typeof body?.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be boolean' }, { status: 400 });
  }

  const pool = getDbPool();
  try {
    await pool.query(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ('puzzle_generation_cron_enabled', $1::jsonb, now())
       ON CONFLICT (key) DO UPDATE SET value = $1::jsonb, updated_at = now()`,
      [body.enabled]
    );
    return NextResponse.json({ enabled: body.enabled });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  } finally {
    await pool?.end();
  }
}
