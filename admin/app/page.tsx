'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import LoginForm from '@/components/LoginForm';
import { Spinner } from '@/components/ui/Spinner';
import { Card, CardBody } from '@/components/ui/Card';

export default function Home() {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user && isAdmin) router.replace('/dashboard');
  }, [user, isAdmin, loading, router]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-bg-base">
        <Spinner className="w-8 h-8" />
      </main>
    );
  }

  if (user && !isAdmin) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-bg-base">
        <Card className="w-full max-w-sm">
          <CardBody>
            <p className="text-error text-center">Admin yetkisi gerekli.</p>
          </CardBody>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-bg-base px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🧩</div>
          <h1 className="text-2xl font-bold text-text-primary">Bulmaca Admin</h1>
          <p className="text-sm text-text-secondary mt-1">Yönetim paneline hoş geldiniz</p>
        </div>

        <Card>
          <CardBody className="p-6">
            <LoginForm />
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
