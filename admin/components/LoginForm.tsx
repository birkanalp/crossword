'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginForm() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>E-posta</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            width: '100%',
            padding: 10,
            borderRadius: 8,
            border: '1px solid #333',
            background: '#1a1a22',
            color: '#e8e8ed',
          }}
        />
      </div>
      <div>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>Şifre</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            width: '100%',
            padding: 10,
            borderRadius: 8,
            border: '1px solid #333',
            background: '#1a1a22',
            color: '#e8e8ed',
          }}
        />
      </div>
      {error && <p style={{ color: '#f87171', fontSize: 14 }}>{error}</p>}
      <button
        type="submit"
        disabled={loading}
        style={{
          padding: 12,
          borderRadius: 8,
          border: 'none',
          background: '#6b9fff',
          color: '#fff',
          fontWeight: 600,
        }}
      >
        {loading ? 'Giriş yapılıyor...' : 'Giriş yap'}
      </button>
    </form>
  );
}
