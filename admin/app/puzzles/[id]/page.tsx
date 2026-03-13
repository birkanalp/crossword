'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import {
  adminGetPuzzle,
  adminPatchClue,
  adminPuzzleDecision,
  adminTriggerAiReview,
  adminGenerateHints,
  type AdminLevel,
} from '@/lib/api';
import PuzzleGrid from '@/components/PuzzleGrid';
import {
  buildCluesFromLevel,
  cellKey,
  getCellsForClue,
  type ClueForDisplay,
} from '@/lib/puzzle-utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';

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
  const [saveSuccess, setSaveSuccess] = useState(false);

  const clues = useMemo(
    () => (level ? buildCluesFromLevel(level) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [level?.id, level?.clues_json]
  );

  const fillAll = useCallback(() => {
    if (!level) return;
    const cells: Record<string, string> = {};
    for (const c of clues) {
      const letters = c.answer.split('');
      const positions = getCellsForClue(c);
      positions.forEach((pos, i) => { cells[cellKey(pos.row, pos.col)] = letters[i] ?? ''; });
    }
    setFilledCells(cells);
    setShowAnswers(true);
  }, [level, clues]);

  const clearAll = useCallback(() => { setFilledCells({}); setShowAnswers(false); }, []);

  const fillClue = useCallback((clue: ClueForDisplay) => {
    const cells = { ...filledCells };
    const letters = clue.answer.split('');
    const positions = getCellsForClue(clue);
    positions.forEach((pos, i) => { cells[cellKey(pos.row, pos.col)] = letters[i] ?? ''; });
    setFilledCells(cells);
    setShowAnswers(true);
  }, [filledCells]);

  const clearClue = useCallback((clue: ClueForDisplay) => {
    setFilledCells((prev) => {
      const next = { ...prev };
      for (const pos of getCellsForClue(clue)) delete next[cellKey(pos.row, pos.col)];
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
    const { error: err } = await adminPatchClue(token, level.id, editingClue.id, {
      text: editForm.text, answer: editForm.answer, hint: editForm.hint,
    });
    setSubmitting(false);
    if (err) { setError(err); return; }
    setEditingClue(null);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
    const { data } = await adminGetPuzzle(token, level.id);
    if (data) setLevel(data.level);
  };

  const handleApprove = async () => {
    if (!token || !level) return;
    setSubmitting(true);
    const { error: err } = await adminPuzzleDecision(token, level.id, { action: 'approve' });
    setSubmitting(false);
    if (err) setError(err);
    else router.push('/puzzles');
  };

  const handleReject = async () => {
    if (!token || !level || !rejectNotes.trim()) return;
    setSubmitting(true);
    const { error: err } = await adminPuzzleDecision(token, level.id, {
      action: 'reject', review_notes: rejectNotes.trim(),
    });
    setSubmitting(false);
    if (err) setError(err);
    else router.push('/puzzles');
  };

  const handleGenerateHints = async () => {
    if (!token || !level) return;
    setSubmitting(true);
    setError(null);
    const { data, error: err } = await adminGenerateHints(token, level.id);
    setSubmitting(false);
    if (err) setError(err);
    else if (data) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      const { data: refetch } = await adminGetPuzzle(token, level.id);
      if (refetch) setLevel(refetch.level);
    }
  };

  const canGenerateHints =
    level &&
    ['pending', 'approved'].includes(level.review_status) &&
    clues.some((c) => !(c.hint ?? '').trim());

  useEffect(() => {
    if (!token || !id) return;
    adminGetPuzzle(token, String(id))
      .then(({ data, error: err }) => {
        setLoading(false);
        if (err) setError(err);
        else if (data?.level) setLevel(data.level);
        else setError('Bulmaca verisi alınamadı');
      })
      .catch((e) => { setLoading(false); setError(e?.message ?? 'Bağlantı hatası'); });
  }, [token, id]);

  useEffect(() => { if (level) fillAll(); }, [level?.id, fillAll]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }
  if (error && !level) {
    return (
      <div className="px-4 py-3 rounded-lg bg-error-bg border border-error-border text-error text-sm">
        {error}
      </div>
    );
  }
  if (!level) return null;

  const acrossClues = clues.filter((c) => c.direction === 'across');
  const downClues = clues.filter((c) => c.direction === 'down');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/puzzles" className="text-accent hover:underline text-sm">
          &larr; Listeye dön
        </Link>
        <h1 className="text-xl font-bold text-text-primary">
          Bulmaca <span className="font-mono text-text-secondary text-base">{level.id.slice(0, 8)}&hellip;</span>
        </h1>
        <Badge status={level.review_status as 'ai_review' | 'pending' | 'approved' | 'rejected'} />
      </div>

      {/* Save success toast */}
      {saveSuccess && (
        <div className="px-4 py-3 rounded-lg bg-success-bg border border-success-border text-success text-sm">
          ✓ Soru kaydedildi
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-lg bg-error-bg border border-error-border text-error text-sm">
          {error}
        </div>
      )}

      {/* Action bar */}
      <div className="flex gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={fillAll}>Tüm cevapları doldur</Button>
        <Button variant="secondary" size="sm" onClick={clearAll}>Tümünü boşalt</Button>
        {canGenerateHints && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleGenerateHints}
            disabled={submitting}
          >
            {submitting ? <Spinner className="w-3 h-3" /> : 'İpuçlarını Üret (YZ)'}
          </Button>
        )}
      </div>

      {/* Main content: grid + clues */}
      <div className="flex gap-6 flex-wrap xl:flex-nowrap">
        {/* Grid */}
        <div className="flex-shrink-0">
          <PuzzleGrid
            level={level}
            filledCells={filledCells}
            showAnswers={showAnswers}
            selectedClueId={selectedClueId}
            cellSize={38}
          />
        </div>

        {/* Clues split into Across / Down */}
        <div className="flex-1 min-w-[320px] space-y-4">
          {[{ title: 'Yatay', clues: acrossClues }, { title: 'Dikey', clues: downClues }].map(
            ({ title, clues: group }) => (
              <Card key={title}>
                <CardHeader className="py-3">
                  <h3 className="text-sm font-semibold text-text-primary">{title} ({group.length})</h3>
                </CardHeader>
                <CardBody className="p-0">
                  <div className="divide-y divide-border">
                    {group.map((clue) => (
                      <div
                        key={clue.id}
                        className={`px-4 py-3 transition-colors ${
                          selectedClueId === clue.id ? 'bg-bg-active' : 'hover:bg-bg-elevated'
                        }`}
                      >
                        {editingClue?.id === clue.id ? (
                          <div className="space-y-2">
                            <input
                              placeholder="Soru"
                              value={editForm.text}
                              onChange={(e) => setEditForm((f) => ({ ...f, text: e.target.value }))}
                              className="w-full px-2.5 py-2 rounded-lg border border-[#444] bg-bg-base text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                            />
                            <input
                              placeholder="Cevap"
                              value={editForm.answer}
                              onChange={(e) => setEditForm((f) => ({ ...f, answer: e.target.value }))}
                              className="w-full px-2.5 py-2 rounded-lg border border-[#444] bg-bg-base text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                            />
                            <input
                              placeholder="İpucu"
                              value={editForm.hint}
                              onChange={(e) => setEditForm((f) => ({ ...f, hint: e.target.value }))}
                              className="w-full px-2.5 py-2 rounded-lg border border-[#444] bg-bg-base text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                            />
                            <div className="flex gap-2">
                              <Button size="sm" variant="primary" onClick={saveEdit} disabled={submitting}>
                                {submitting ? <Spinner className="w-3 h-3" /> : 'Kaydet'}
                              </Button>
                              <Button size="sm" variant="secondary" onClick={() => setEditingClue(null)}>
                                İptal
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-start gap-2 mb-1">
                              <button
                                onClick={() => setSelectedClueId(clue.id)}
                                className="font-bold text-accent text-sm shrink-0 hover:underline"
                              >
                                {clue.number}{clue.direction === 'across' ? 'A' : 'D'}
                              </button>
                              <span className="text-sm text-text-primary leading-snug">{clue.text}</span>
                            </div>
                            <div className="text-xs text-text-secondary mb-2">
                              Cevap: <span className="text-text-primary font-mono">{clue.answer}</span>
                              {clue.hint && <> &middot; İpucu: {clue.hint}</>}
                            </div>
                            <div className="flex gap-1.5">
                              <Button size="sm" variant="secondary" onClick={() => fillClue(clue)}>Doldur</Button>
                              <Button size="sm" variant="secondary" onClick={() => clearClue(clue)}>Boşalt</Button>
                              <Button size="sm" variant="ghost" onClick={() => startEdit(clue)}>Düzenle</Button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            )
          )}
        </div>
      </div>

      {/* AI Review In-Progress Indicator */}
      {level.review_status === 'ai_review' && (
        <Card>
          <CardBody className="flex items-center gap-3 py-5">
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                border: '3px solid #6b9fff',
                borderTopColor: 'transparent',
                animation: 'spin 0.8s linear infinite',
                flexShrink: 0,
              }}
            />
            <span className="text-text-secondary text-sm">Yapay Zeka İnceliyor...</span>
          </CardBody>
        </Card>
      )}

      {/* AI Notes Panel */}
      {level.ai_review_notes && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-text-primary">Yapay Zeka Değerlendirmesi</h3>
              {level.ai_review_score != null && (
                <span
                  className="text-sm font-mono font-semibold px-2 py-0.5 rounded"
                  style={{ backgroundColor: '#1e1b4b', color: '#a5b4fc' }}
                >
                  {level.ai_review_score}/100
                </span>
              )}
            </div>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-text-secondary whitespace-pre-wrap">{level.ai_review_notes}</p>
          </CardBody>
        </Card>
      )}

      {/* Approve / Reject panel — only shown for pending puzzles */}
      {level.review_status === 'pending' && (
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-text-primary">Onay / Red</h3>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">
                Red notu <span className="text-text-tertiary">(reddetmek için zorunlu)</span>
              </label>
              <textarea
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="Red sebebini yazın..."
                rows={3}
                className="w-full max-w-lg px-3 py-2.5 rounded-lg border border-[#444] bg-bg-base text-text-primary text-sm placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent resize-none"
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="primary"
                size="lg"
                onClick={handleApprove}
                disabled={submitting}
                className="bg-success border-transparent hover:bg-green-700"
              >
                {submitting ? <Spinner className="w-4 h-4" /> : '✓ Onayla'}
              </Button>
              <Button
                variant="danger"
                size="lg"
                onClick={handleReject}
                disabled={submitting || !rejectNotes.trim()}
              >
                {submitting ? <Spinner className="w-4 h-4" /> : '✕ Reddet'}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
