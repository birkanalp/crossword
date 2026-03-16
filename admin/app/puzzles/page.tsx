'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { adminListPuzzles, adminGeneratePuzzle, adminGetCronEnabled, adminSetCronEnabled, adminTriggerAiReview, adminStartAllAiReview, adminGetAiReviewCronEnabled, adminSetAiReviewCronEnabled, adminUpdatePuzzleSortOrder, type AdminPuzzleSummary, type GeneratePuzzleDifficulty } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';

const DIFFICULTIES: GeneratePuzzleDifficulty[] = ['easy', 'medium', 'hard', 'expert'];
const DIFFICULTY_LABELS: Record<GeneratePuzzleDifficulty, string> = {
  easy: 'Kolay', medium: 'Orta', hard: 'Zor', expert: 'Uzman',
};

type StatusFilter = 'ai_review' | 'pending' | 'approved' | 'rejected';
const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'ai_review', label: 'YZ İnceliyor' },
  { key: 'pending', label: 'Onay bekleyen' },
  { key: 'approved', label: 'Onaylı' },
  { key: 'rejected', label: 'Reddedilen' },
];

export default function PuzzlesPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<AdminPuzzleSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<StatusFilter>('ai_review');
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [generateDifficulty, setGenerateDifficulty] = useState<GeneratePuzzleDifficulty>('medium');
  const [generateCount, setGenerateCount] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [cronEnabled, setCronEnabled] = useState<boolean | null>(null);
  const [cronToggling, setCronToggling] = useState(false);
  const [cronError, setCronError] = useState<string | null>(null);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [aiReviewCronEnabled, setAiReviewCronEnabled] = useState<boolean | null>(null);
  const [aiReviewCronToggling, setAiReviewCronToggling] = useState(false);
  const [startingAll, setStartingAll] = useState(false);
  const [startAllResult, setStartAllResult] = useState<string | null>(null);
  const [editingSortOrder, setEditingSortOrder] = useState<{ id: string; value: number } | null>(null);
  const [sortOrderLoading, setSortOrderLoading] = useState(false);

  const loadCronStatus = useCallback(() => {
    if (!token) return;
    setCronError(null);
    adminGetCronEnabled(token).then(({ data, error }) => {
      if (error) setCronError(error);
      else if (data) setCronEnabled(data.enabled);
    });
    adminGetAiReviewCronEnabled(token).then(({ data }) => {
      if (data) setAiReviewCronEnabled(data.enabled);
    });
  }, [token]);

  useEffect(() => { loadCronStatus(); }, [loadCronStatus]);

  const handleCronToggle = async () => {
    if (!token || cronToggling || cronEnabled === null) return;
    setCronError(null);
    const nextEnabled = !cronEnabled;
    setCronEnabled(nextEnabled);
    setCronToggling(true);
    const { data, error } = await adminSetCronEnabled(token, nextEnabled);
    setCronToggling(false);
    if (error) {
      setCronEnabled(cronEnabled);
      setCronError(error);
    } else if (data) {
      setCronEnabled(data.enabled);
    }
  };

  const loadPuzzles = useCallback(() => {
    if (!token) return;
    setLoading(true);
    adminListPuzzles(token, { status, page, limit: 20 }).then(({ data, error: err }) => {
      setLoading(false);
      if (err) setError(err);
      else if (data) { setItems(data.items); setTotal(data.total); }
    });
  }, [token, status, page]);

  useEffect(() => { loadPuzzles(); }, [loadPuzzles]);

  const handleGenerate = async () => {
    if (!token || generating) return;
    setGenerating(true);
    setGenerateError(null);
    const { data, error: err } = await adminGeneratePuzzle(token, generateDifficulty, generateCount);
    setGenerating(false);
    if (err) { setGenerateError(err); return; }
    if (data) {
      loadPuzzles();
      setSidebarOpen(false);
      // Batch mode (202): no level_ids yet, puzzles appear as script generates
      if (data.accepted) {
        // Poll list so new puzzles appear as they're created
        const interval = setInterval(loadPuzzles, 5000);
        setTimeout(() => clearInterval(interval), 120000);
      }
      // No redirect — user stays on list, sees new puzzles via loadPuzzles / polling
    }
  };

  const handleAiReviewCronToggle = async () => {
    if (!token || aiReviewCronToggling || aiReviewCronEnabled === null) return;
    const nextEnabled = !aiReviewCronEnabled;
    setAiReviewCronEnabled(nextEnabled);
    setAiReviewCronToggling(true);
    const { data, error } = await adminSetAiReviewCronEnabled(token, nextEnabled);
    setAiReviewCronToggling(false);
    if (error) {
      setAiReviewCronEnabled(aiReviewCronEnabled);
      setError(error);
    } else if (data) {
      setAiReviewCronEnabled(data.enabled);
    }
  };

  const handleStartAllAiReview = async () => {
    if (!token || startingAll) return;
    setStartingAll(true);
    setStartAllResult(null);
    setError(null);
    const { data, error: err } = await adminStartAllAiReview(token);
    setStartingAll(false);
    if (err) { setError(err); return; }
    if (data) {
      setStartAllResult(`${data.updated} bulmaca incelemeye alındı`);
      loadPuzzles();
    }
  };

  const handleTriggerAiReview = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!token || triggeringId) return;
    setTriggeringId(id);
    const { error } = await adminTriggerAiReview(token, id);
    setTriggeringId(null);
    if (!error) loadPuzzles();
  };

  const handleSortOrderSave = async (id: string, newOrder: number) => {
    if (!token) return;
    setSortOrderLoading(true);
    try {
      await adminUpdatePuzzleSortOrder(token, id, newOrder);
      setEditingSortOrder(null);
      void loadPuzzles();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSortOrderLoading(false);
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Bulmacalar</h1>
          <p className="text-sm text-text-secondary mt-1">{total} bulmaca</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {cronError && (
            <span className="text-error text-sm" title={cronError}>Cron: {cronError}</span>
          )}
          {startAllResult && (
            <span className="text-success text-sm">{startAllResult}</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCronToggle}
            disabled={cronToggling || cronEnabled === null}
            title={cronEnabled ? 'Otomatik bulmaca üretimi açık. Tıklayarak kapat.' : 'Otomatik bulmaca üretimi kapalı. Tıklayarak aç.'}
            className={`flex items-center gap-2 ${cronEnabled ? 'text-success' : 'text-text-tertiary'}`}
          >
            {cronToggling ? (
              <Spinner className="w-4 h-4" />
            ) : cronEnabled ? (
              <>● Cron: Aktif</>
            ) : (
              <>○ Cron: Pasif</>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAiReviewCronToggle}
            disabled={aiReviewCronToggling || aiReviewCronEnabled === null}
            title={aiReviewCronEnabled ? 'YZ inceleme cron\'u açık. Tıklayarak kapat.' : 'YZ inceleme cron\'u kapalı. Tıklayarak aç.'}
            className={`flex items-center gap-2 ${aiReviewCronEnabled ? 'text-success' : 'text-text-tertiary'}`}
          >
            {aiReviewCronToggling ? (
              <Spinner className="w-4 h-4" />
            ) : aiReviewCronEnabled ? (
              <>● YZ Cron: Aktif</>
            ) : (
              <>○ YZ Cron: Pasif</>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleStartAllAiReview}
            disabled={startingAll}
            title="Tüm bekleyen bulmacaları YZ incelemesine gönder"
          >
            {startingAll ? (
              <><Spinner className="w-4 h-4" /> Gönderiliyor...</>
            ) : (
              'Tümünü YZ\'ye Gönder'
            )}
          </Button>
          <Button variant="ghost" onClick={() => setSidebarOpen(true)}>
            + Yeni Bulmaca
          </Button>
        </div>
      </div>

      {/* Sidebar */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-200 ease-out"
            aria-hidden="true"
            onClick={() => {
              if (!generating) {
                setSidebarOpen(false);
                setGenerateError(null);
              }
            }}
          />
          <aside
            className="fixed top-0 right-0 h-full w-[320px] bg-bg-surface border-l border-border z-50 shadow-xl flex flex-col animate-slide-in-right"
          >
            <div className="p-6 flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-text-primary">Yeni Bulmaca Üret</h2>
                <button
                  type="button"
                  onClick={() => {
                    if (!generating) {
                      setSidebarOpen(false);
                      setGenerateError(null);
                    }
                  }}
                  className="text-text-tertiary hover:text-text-primary p-1 rounded transition-colors"
                  aria-label="Kapat"
                >
                  ×
                </button>
              </div>

              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-sm text-text-secondary mb-3">Zorluk</p>
                  <div className="flex flex-col gap-2">
                    {DIFFICULTIES.map((d) => (
                      <label
                        key={d}
                        className={`flex items-center gap-3 cursor-pointer py-2 px-3 rounded-lg border bg-[#1a1a22] hover:bg-bg-elevated transition-colors ${
                          generateDifficulty === d ? 'border-accent ring-1 ring-accent' : 'border-[#333]'
                        }`}
                      >
                        <input
                          type="radio"
                          name="difficulty"
                          value={d}
                          checked={generateDifficulty === d}
                          onChange={() => setGenerateDifficulty(d)}
                          disabled={generating}
                          className="w-4 h-4 accent-accent"
                        />
                        <span className="text-sm text-text-primary">{DIFFICULTY_LABELS[d]}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <Input
                  label="Kaç adet üretilecek?"
                  type="number"
                  min={1}
                  max={100}
                  value={String(generateCount)}
                  onChange={(e) => {
                    const v = Math.floor(Number(e.target.value));
                    if (!Number.isNaN(v)) setGenerateCount(Math.min(100, Math.max(1, v)));
                  }}
                  disabled={generating}
                />

                {generateError && (
                  <div className="px-3 py-2 rounded-lg bg-error-bg border border-error-border text-error text-sm">
                    {generateError}
                  </div>
                )}

                <Button
                  variant="primary"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="w-full"
                >
                  {generating ? (
                    <>
                      <Spinner className="w-4 h-4" />
                      Oluşturuluyor...
                    </>
                  ) : (
                    'Üret'
                  )}
                </Button>
              </div>
            </div>
          </aside>
        </>
      )}

      {error && (
        <div className="px-4 py-3 rounded-lg bg-error-bg border border-error-border text-error text-sm">
          {error}
        </div>
      )}

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-border">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setStatus(tab.key); setPage(1); }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-150 -mb-px ${
              status === tab.key
                ? 'border-accent text-accent'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="w-8 h-8" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="Bulmaca bulunamadı" description="Bu kategoride henüz bulmaca yok." />
      ) : (
        <Card>
          <div className="divide-y divide-border">
            {/* Table header */}
            <div className="grid grid-cols-7 px-4 py-3 bg-bg-elevated text-xs font-semibold text-text-secondary uppercase tracking-wide rounded-t-xl">
              <span>Sort</span>
              <span>ID</span>
              <span>Zorluk</span>
              <span>Dil</span>
              <span>Durum</span>
              <span>AI İnceleme</span>
              <span>Tarih</span>
            </div>
            {items.map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-7 px-4 py-3.5 hover:bg-bg-elevated transition-colors items-center text-sm"
              >
                <span className="text-text-secondary text-xs">
                  {editingSortOrder?.id === p.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        className="w-16 bg-bg-elevated border border-border rounded px-2 py-1 text-sm text-text-primary focus:outline-none focus:border-accent"
                        value={editingSortOrder.value}
                        onChange={e => setEditingSortOrder({ id: p.id, value: Number(e.target.value) })}
                        onKeyDown={e => {
                          if (e.key === 'Enter') void handleSortOrderSave(p.id, editingSortOrder.value);
                          if (e.key === 'Escape') setEditingSortOrder(null);
                        }}
                        autoFocus
                      />
                      <button
                        onClick={() => void handleSortOrderSave(p.id, editingSortOrder.value)}
                        disabled={sortOrderLoading}
                        className="text-xs text-accent hover:underline"
                      >
                        {sortOrderLoading ? '...' : 'Kaydet'}
                      </button>
                    </div>
                  ) : (
                    <button
                      className="hover:text-text-primary cursor-pointer"
                      onClick={() => setEditingSortOrder({ id: p.id, value: p.sort_order })}
                    >
                      {p.sort_order}
                    </button>
                  )}
                </span>
                <Link href={`/puzzles/${p.id}`} className="font-mono text-accent text-xs">{p.id.slice(0, 8)}&hellip;</Link>
                <Link href={`/puzzles/${p.id}`} className="text-text-secondary">{DIFFICULTY_LABELS[p.difficulty as GeneratePuzzleDifficulty] ?? p.difficulty}</Link>
                <Link href={`/puzzles/${p.id}`} className="text-text-secondary uppercase text-xs">{p.language}</Link>
                <Link href={`/puzzles/${p.id}`}><Badge status={p.review_status as 'ai_review' | 'pending' | 'approved' | 'rejected'} /></Link>
                <span className="text-text-secondary text-xs">
                  {p.ai_reviewed_at === null ? (
                    p.review_status === 'ai_review' ? (
                      <span className="text-text-tertiary italic">İnceleniyor…</span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleTriggerAiReview(e, p.id)}
                        disabled={!!triggeringId}
                        className="text-accent hover:underline disabled:opacity-50"
                      >
                        {triggeringId === p.id ? <Spinner className="w-4 h-4 inline" /> : 'Başlat'}
                      </button>
                    )
                  ) : p.ai_review_score !== null ? (
                    <span
                      className={`font-semibold tabular-nums ${
                        p.ai_review_score >= 80
                          ? 'text-success'
                          : p.ai_review_score >= 60
                          ? 'text-warning'
                          : 'text-error'
                      }`}
                    >
                      %{p.ai_review_score}
                    </span>
                  ) : (
                    <span className="text-text-tertiary">—</span>
                  )}
                </span>
                <Link href={`/puzzles/${p.id}`} className="text-text-tertiary text-xs">
                  {new Date(p.created_at).toLocaleDateString('tr-TR')}
                </Link>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-secondary">
            Sayfa {page} / {totalPages}
          </p>
          <div className="flex gap-2">
            <Button size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              &larr; Önceki
            </Button>
            <Button size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Sonraki &rarr;
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
