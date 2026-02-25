'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user || !isAdmin) router.replace('/');
  }, [user, isAdmin, loading, router]);

  if (loading || !user || !isAdmin) {
    return (
      <main style={{ padding: 48, textAlign: 'center' }}>
        <p>Yükleniyor...</p>
      </main>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid #2a2a35',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <nav style={{ display: 'flex', gap: 24 }}>
          <Link
            href="/dashboard"
            style={{ color: pathname === '/dashboard' ? '#6b9fff' : '#a0a0b0' }}
          >
            Dashboard
          </Link>
          <Link
            href="/puzzles"
            style={{ color: pathname.startsWith('/puzzles') ? '#6b9fff' : '#a0a0b0' }}
          >
            Bulmacalar
          </Link>
        </nav>
        <button
          onClick={() => signOut()}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: '1px solid #444',
            background: 'transparent',
            color: '#a0a0b0',
          }}
        >
          Çıkış
        </button>
      </header>
      <main style={{ flex: 1, padding: 24 }}>{children}</main>
    </div>
  );
}
