'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function LoginForm() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await signIn(email, password);
    setLoading(false);
    if (err) setError(err);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="E-posta"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="admin@bulmaca.local"
        required
        autoComplete="email"
      />
      <div className="flex flex-col gap-1">
        <label className="text-sm text-text-secondary">Şifre</label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full px-3 py-2.5 pr-10 rounded-lg border border-[#333] bg-bg-surface text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent focus:border-border-focus transition-colors duration-150"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors"
            aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
          >
            {showPassword ? '🙈' : '👁️'}
          </button>
        </div>
      </div>
      {error && (
        <div className="px-3 py-2 rounded-lg bg-error-bg border border-error-border text-error text-sm">
          {error}
        </div>
      )}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={loading}
        className="w-full mt-2"
      >
        {loading ? 'Giriş yapılıyor...' : 'Giriş yap'}
      </Button>
    </form>
  );
}
