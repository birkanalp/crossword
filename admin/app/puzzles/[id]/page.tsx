'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import {
  adminGetPuzzle,
  adminPatchClue,
  adminPuzzleDecision,
  type AdminLevel,
} from '@/lib/api';
import PuzzleGrid from '@/components/PuzzleGrid';
import {
  buildCluesFromLevel,
  cellKey,
  getCellsForClue,
  type ClueForDisplay,
} from '@/lib/puzzle-utils';

export default function PuzzleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const [level, setLevel] = useState<AdminLevel | null>(null);
  const [filledCells, setFilledCells] = useState<Record<string, string>>({});
  const [showAnswers, setShowAnswers] = useState(true);
  const [selectedClueId, setSelectedClueId] = useState<string | null>(null);
  const [editingClue, setEditingClue] = useState<ClueForDisplay | null>(null);
  const [editForm, setEditForm] = useState({ text: '', answer: '', hint: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');

  const clues = useMemo(
    () => (level ? buildCluesFromLevel(level) : []),
    [level?.id, level?.clues_json]
  );

  const fillAll = useCallback(() => {
    if (!level) return;
    const cells: Record<string, string> = {};
    for (const c of clues) {
      const letters = c.answer.split('');
      const positions = getCellsForClue(c);
      positions.forEach((pos, i) => {
        cells[cellKey(pos.row, pos.col)] = letters[i] ?? '';
      });
    }
    setFilledCells(cells);
    setShowAnswers(true);
  }, [level, clues]);

  const clearAll = useCallback(() => {
    setFilledCells({});
    setShowAnswers(false);
  }, []);

  const fillClue = useCallback(
    (clue: ClueForDisplay) => {
      const cells = { ...filledCells };
      const letters = clue.answer.split('');
      const positions = getCellsForClue(clue);
      positions.forEach((pos, i) => {
        cells[cellKey(pos.row, pos.col)] = letters[i] ?? '';
      });
      setFilledCells(cells);
      setShowAnswers(true);
    },
    [filledCells]
  );

  const clearClue = useCallback((clue: ClueForDisplay) => {
    setFilledCells((prev) => {
      const next = { ...prev };
      for (const pos of getCellsForClue(clue)) {
        delete next[cellKey(pos.row, pos.col)];
      }
      return next;
    });
  }, []);

  const startEdit = (clue: ClueForDisplay) => {
    setEditingClue(clue);
    setEditForm({ text: clue.text, answer: clue.answer, hint: clue.hint });
  };

  const saveEdit = async () => {
    if (!token || !level || !editingClue) return;
    setSubmitting(true);
    const clueKey = editingClue.id;
    const { error: err } = await adminPatchClue(token, level.id, clueKey, {
      text: editForm.text,
      answer: editForm.answer,
      hint: editForm.hint,
    });
    setSubmitting(false);
    if (err) {
      setError(err);
      return;
    }
    setEditingClue(null);
    const { data } = await adminGetPuzzle(token, level.id);
    if (data) setLevel(data.level);
  };

  const handleApprove = async () => {
    if (!token || !level) return;
    setSubmitting(true);
    const { error: err } = await adminPuzzleDecision(token, level.id, {
      action: 'approve',
    });
    setSubmitting(false);
    if (err) setError(err);
    else router.push('/puzzles');
  };

  const handleReject = async () => {
    if (!token || !level || !rejectNotes.trim()) return;
    setSubmitting(true);
    const { error: err } = await adminPuzzleDecision(token, level.id, {
      action: 'reject',
      review_notes: rejectNotes.trim(),
    });
    setSubmitting(false);
    if (err) setError(err);
    else router.push('/puzzles');
  };

  useEffect(() => {
    if (!token || !id) return;
    adminGetPuzzle(token, String(id))
      .then(({ data, error: err }) => {
        setLoading(false);
        if (err) setError(err);
        else if (data?.level) setLevel(data.level);
        else setError('Bulmaca verisi alınamadı');
      })
      .catch((e) => {
        setLoading(false);
        setError(e?.message ?? 'Bağlantı hatası');
      });
  }, [token, id]);

  useEffect(() => {
    if (level) fillAll();
  }, [level?.id, fillAll]);

  if (loading) return <p>Yükleniyor...</p>;
  if (error && !level) return <p style={{ color: '#f87171' }}>{error}</p>;
  if (!level) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link href="/puzzles" style={{ color: '#6b9fff' }}>
          ← Listeye dön
        </Link>
        <h1>Bulmaca: {level.id.slice(0, 8)}...</h1>
        <span
          style={{
            padding: '4px 12px',
            borderRadius: 8,
            background:
              level.review_status === 'pending'
                ? '#3d3d00'
                : level.review_status === 'approved'
                ? '#0d3d0d'
                : '#3d0d0d',
          }}
        >
          {level.review_status}
        </span>
      </div>

      {error && <p style={{ color: '#f87171' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <button
          onClick={fillAll}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: '1px solid #444',
            background: '#1e3a5f',
            color: '#6b9fff',
          }}
        >
          Tüm cevapları doldur
        </button>
        <button
          onClick={clearAll}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: '1px solid #444',
            background: 'transparent',
            color: '#a0a0b0',
          }}
        >
          Tümünü boşalt
        </button>
      </div>

      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
        <div>
          <PuzzleGrid
            level={level}
            filledCells={filledCells}
            showAnswers={showAnswers}
            selectedClueId={selectedClueId}
            cellSize={40}
          />
        </div>

        <div style={{ flex: 1, minWidth: 320 }}>
          <h3 style={{ marginBottom: 12 }}>Sorular</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {clues.map((clue) => (
              <div
                key={clue.id}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background:
                    selectedClueId === clue.id ? '#2a3a4a' : '#1a1a22',
                  border:
                    selectedClueId === clue.id
                      ? '1px solid #6b9fff'
                      : '1px solid #2a2a35',
                }}
              >
                {editingClue?.id === clue.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input
                      placeholder="Soru"
                      value={editForm.text}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, text: e.target.value }))
                      }
                      style={{
                        padding: 8,
                        borderRadius: 6,
                        border: '1px solid #444',
                        background: '#0f0f14',
                        color: '#e8e8ed',
                      }}
                    />
                    <input
                      placeholder="Cevap"
                      value={editForm.answer}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, answer: e.target.value }))
                      }
                      style={{
                        padding: 8,
                        borderRadius: 6,
                        border: '1px solid #444',
                        background: '#0f0f14',
                        color: '#e8e8ed',
                      }}
                    />
                    <input
                      placeholder="İpucu"
                      value={editForm.hint}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, hint: e.target.value }))
                      }
                      style={{
                        padding: 8,
                        borderRadius: 6,
                        border: '1px solid #444',
                        background: '#0f0f14',
                        color: '#e8e8ed',
                      }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={saveEdit}
                        disabled={submitting}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: 'none',
                          background: '#6b9fff',
                          color: '#fff',
                        }}
                      >
                        Kaydet
                      </button>
                      <button
                        onClick={() => setEditingClue(null)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: '1px solid #444',
                          background: 'transparent',
                          color: '#a0a0b0',
                        }}
                      >
                        İptal
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 700,
                          color: '#6b9fff',
                          cursor: 'pointer',
                        }}
                        onClick={() => setSelectedClueId(clue.id)}
                      >
                        {clue.number}
                        {clue.direction === 'across' ? 'A' : 'D'}
                      </span>
                      <span style={{ color: '#a0a0b0' }}>—</span>
                      <span>{clue.text}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#a0a0b0', marginBottom: 8 }}>
                      Cevap: {clue.answer} | İpucu: {clue.hint}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => fillClue(clue)}
                        style={{
                          padding: '4px 10px',
                          fontSize: 12,
                          borderRadius: 6,
                          border: '1px solid #444',
                          background: 'transparent',
                          color: '#a0a0b0',
                        }}
                      >
                        Doldur
                      </button>
                      <button
                        onClick={() => clearClue(clue)}
                        style={{
                          padding: '4px 10px',
                          fontSize: 12,
                          borderRadius: 6,
                          border: '1px solid #444',
                          background: 'transparent',
                          color: '#a0a0b0',
                        }}
                      >
                        Boşalt
                      </button>
                      <button
                        onClick={() => startEdit(clue)}
                        style={{
                          padding: '4px 10px',
                          fontSize: 12,
                          borderRadius: 6,
                          border: '1px solid #6b9fff',
                          background: 'transparent',
                          color: '#6b9fff',
                        }}
                      >
                        Düzenle
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {level.review_status === 'pending' && (
        <div
          style={{
            padding: 20,
            borderRadius: 12,
            background: '#1a1a22',
            border: '1px solid #2a2a35',
          }}
        >
          <h3 style={{ marginBottom: 12 }}>Onay / Red</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>
                Red notu (reddetmek için zorunlu)
              </label>
              <textarea
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="Red sebebini yazın..."
                rows={3}
                style={{
                  width: '100%',
                  maxWidth: 400,
                  padding: 10,
                  borderRadius: 8,
                  border: '1px solid #444',
                  background: '#0f0f14',
                  color: '#e8e8ed',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={handleApprove}
                disabled={submitting}
                style={{
                  padding: '12px 24px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#16a34a',
                  color: '#fff',
                  fontWeight: 600,
                }}
              >
                Onayla
              </button>
              <button
                onClick={handleReject}
                disabled={submitting || !rejectNotes.trim()}
                style={{
                  padding: '12px 24px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#dc2626',
                  color: '#fff',
                  fontWeight: 600,
                }}
              >
                Reddet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
