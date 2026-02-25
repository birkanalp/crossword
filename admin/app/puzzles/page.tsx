'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { adminListPuzzles, adminGeneratePuzzle, type AdminPuzzleSummary, type GeneratePuzzleDifficulty } from '@/lib/api';

const DIFFICULTIES: GeneratePuzzleDifficulty[] = ['easy', 'medium', 'hard', 'expert'];

export default function PuzzlesPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [items, setItems] = useState<AdminPuzzleSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<string>('pending');
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generateDifficulty, setGenerateDifficulty] = useState<GeneratePuzzleDifficulty>('medium');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const loadPuzzles = useCallback(() => {
    if (!token) return;
    setLoading(true);
    adminListPuzzles(token, { status: status || undefined, page, limit: 20 }).then(
      ({ data, error: err }) => {
        setLoading(false);
        if (err) setError(err);
        else if (data) {
          setItems(data.items);
          setTotal(data.total);
        }
      }
    );
  }, [token, status, page]);

  useEffect(() => {
    loadPuzzles();
  }, [loadPuzzles]);

  const handleGenerate = async () => {
    if (!token || generating) return;
    setGenerating(true);
    setGenerateError(null);
    const { data, error: err } = await adminGeneratePuzzle(token, generateDifficulty);
    setGenerating(false);
    if (err) {
      setGenerateError(err);
      return;
    }
    if (data?.level_id) {
      loadPuzzles();
      router.push(`/puzzles/${data.level_id}`);
    }
  };

  if (error) {
    return <p style={{ color: '#f87171' }}>{error}</p>;
  }

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Bulmacalar</h1>
      <div style={{ marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <span>Yeni bulmaca:</span>
        <select
          value={generateDifficulty}
          onChange={(e) => setGenerateDifficulty(e.target.value as GeneratePuzzleDifficulty)}
          disabled={generating}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid #444',
            background: '#1a1a22',
            color: '#e8e8ed',
          }}
        >
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {d === 'easy' ? 'Kolay' : d === 'medium' ? 'Orta' : d === 'hard' ? 'Zor' : 'Uzman'}
            </option>
          ))}
        </select>
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: '1px solid #6b9fff',
            background: '#1e3a5f',
            color: '#6b9fff',
            cursor: generating ? 'not-allowed' : 'pointer',
          }}
        >
          {generating ? 'Oluşturuluyor...' : 'Oluştur'}
        </button>
        {generateError && (
          <span style={{ color: '#f87171', fontSize: 14 }}>{generateError}</span>
        )}
      </div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
        <span>Durum:</span>
        {(['pending', 'approved', 'rejected'] as const).map((s) => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(1); }}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: status === s ? '1px solid #6b9fff' : '1px solid #444',
              background: status === s ? '#1e3a5f' : 'transparent',
              color: status === s ? '#6b9fff' : '#a0a0b0',
            }}
          >
            {s === 'pending' ? 'Onay bekleyen' : s === 'approved' ? 'Onaylı' : 'Reddedilen'}
          </button>
        ))}
      </div>
      {loading ? (
        <p>Yükleniyor...</p>
      ) : (
        <>
          <p style={{ marginBottom: 16, color: '#a0a0b0' }}>
            Toplam {total} bulmaca
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((p) => (
              <Link
                key={p.id}
                href={`/puzzles/${p.id}`}
                style={{
                  padding: 16,
                  borderRadius: 8,
                  background: '#1a1a22',
                  border: '1px solid #2a2a35',
                  color: '#e8e8ed',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>{p.id.slice(0, 8)}...</span>
                <span>{p.difficulty}</span>
                <span>{p.language}</span>
                <span
                  style={{
                    padding: '4px 8px',
                    borderRadius: 6,
                    background:
                      p.review_status === 'pending'
                        ? '#3d3d00'
                        : p.review_status === 'approved'
                        ? '#0d3d0d'
                        : '#3d0d0d',
                  }}
                >
                  {p.review_status}
                </span>
                <span style={{ fontSize: 12, color: '#a0a0b0' }}>
                  {new Date(p.created_at).toLocaleDateString('tr-TR')}
                </span>
              </Link>
            ))}
          </div>
          {total > 20 && (
            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid #444',
                  background: 'transparent',
                  color: '#a0a0b0',
                }}
              >
                Önceki
              </button>
              <span style={{ alignSelf: 'center' }}>
                Sayfa {page} / {Math.ceil(total / 20)}
              </span>
              <button
                disabled={page >= Math.ceil(total / 20)}
                onClick={() => setPage((p) => p + 1)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid #444',
                  background: 'transparent',
                  color: '#a0a0b0',
                }}
              >
                Sonraki
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
