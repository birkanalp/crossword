#!/usr/bin/env npx tsx
/**
 * Creates an admin user for local development.
 * Uses Supabase service role to create user and set app_metadata.role = 'admin'.
 *
 * Usage: npm run admin:create-user
 *
 * Loads .env from project root. Falls back to local defaults.
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.API_EXTERNAL_URL ?? 'http://localhost:54321';
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hj04zWl196z2-SBc0';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@bulmaca.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin123!';

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existing } = await supabase.auth.admin.listUsers();
  const found = existing?.users?.find((u) => u.email === ADMIN_EMAIL);

  if (found) {
    await supabase.auth.admin.updateUserById(found.id, {
      app_metadata: { role: 'admin' },
    });
    console.log('Admin user already exists. Updated app_metadata.role = admin.');
    console.log('');
    console.log('--- Admin Login Bilgileri ---');
    console.log('E-posta:', ADMIN_EMAIL);
    console.log('Şifre:', ADMIN_PASSWORD);
    console.log('Admin Panel: http://localhost:3001');
    console.log('');
    return;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    app_metadata: { role: 'admin' },
  });

  if (error) {
    console.error('Hata:', error.message);
    process.exit(1);
  }

  console.log('Admin kullanıcı oluşturuldu.');
  console.log('');
  console.log('--- Admin Login Bilgileri ---');
  console.log('E-posta:', ADMIN_EMAIL);
  console.log('Şifre:', ADMIN_PASSWORD);
  console.log('Admin Panel: http://localhost:3001');
  console.log('');
}

main();
