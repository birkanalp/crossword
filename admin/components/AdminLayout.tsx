'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@/components/ui/Spinner';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/puzzles', label: 'Bulmacalar', icon: '🧩' },
  { href: '/leaderboard', label: 'Lider Tablosu', icon: '🏆' },
  { href: '/shop', label: 'Magaza', icon: '🛍️' },
  { href: '/todos', label: 'Notlarim', icon: '📝' },
]

type AdminLayoutProps = {
  children: React.ReactNode;
  fullWidth?: boolean;
};

export default function AdminLayout({ children, fullWidth = false }: AdminLayoutProps) {
  const { user, isAdmin, loading, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user || !isAdmin) router.replace('/');
  }, [user, isAdmin, loading, router]);

  if (loading || !user || !isAdmin) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-bg-base">
        <Spinner className="w-8 h-8" />
      </main>
    );
  }

  return (
    <div className="min-h-screen flex bg-bg-base">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-bg-surface border-r border-border flex flex-col">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-border">
          <span className="text-lg font-bold text-text-primary">🧩 Bulmaca</span>
          <p className="text-xs text-text-secondary mt-0.5">Admin Panel</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150 ${
                  isActive
                    ? 'bg-bg-active text-accent border-l-[3px] border-accent pl-2.5'
                    : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
                }`}
              >
                <span>{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User + Logout */}
        <div className="px-3 py-4 border-t border-border">
          <div className="px-3 py-2 mb-2">
            <p className="text-xs text-text-tertiary">Giriş yapıldı</p>
            <p className="text-sm text-text-secondary truncate">{user.email}</p>
          </div>
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-text-secondary hover:bg-bg-elevated hover:text-error transition-colors duration-150"
          >
            <span>🚪</span>
            <span>Çıkış yap</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className={fullWidth ? 'w-full p-6' : 'max-w-6xl mx-auto p-6'}>
          {children}
        </div>
      </main>
    </div>
  );
}
