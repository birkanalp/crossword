'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import LoginForm from '@/components/LoginForm';

export default function Home() {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user && isAdmin) router.replace('/dashboard');
  }, [user, isAdmin, loading, router]);

  if (loading) {
    return (
      <main style={{ padding: 48, textAlign: 'center' }}>
        <p>Yükleniyor...</p>
      </main>
    );
  }

  if (user && !isAdmin) {
    return (
      <main style={{ padding: 48, textAlign: 'center' }}>
        <p>Admin yetkisi gerekli.</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 48, maxWidth: 400, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 24 }}>Bulmaca Admin</h1>
      <LoginForm />
    </main>
  );
}
