'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  adminListPuzzles,
  adminGeneratePuzzle,
  adminGetCronEnabled,
  adminSetCronEnabled,
  adminTriggerAiReview,
  adminStartAllAiReview,
  adminGetAiReviewCronEnabled,
  adminSetAiReviewCronEnabled,
  type AdminPuzzleSummary,
  type GeneratePuzzleDifficulty,
} from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Input } from '@/components/ui/Input';
import { PuzzleKanbanBoard } from '@/components/PuzzleKanbanBoard';

const DIFFICULTIES: GeneratePuzzleDifficulty[] = ['easy', 'medium', 'hard', 'expert'];
const DIFFICULTY_LABELS: Record<GeneratePuzzleDifficulty, string> = {
  easy: 'Kolay', medium: 'Orta', hard: 'Zor', expert: 'Uzman',
};

type ReviewStatus = 'generating' | 'ai_review' | 'pending' | 'approved' | 'rejected';

export default function PuzzlesPage() {
  const { token } = useAuth();
  const [columns, setColumns] = useState<Record<ReviewStatus, AdminPuzzleSummary[]>>({
    generating: [], ai_review: [], pending: [], approved: [], rejected: [],
  });
  const [totalCount, setTotalCount] = useState(0);
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
  const [aiReviewCronEnabled, setAiReviewCronEnabled] = useState<boolean | null>(null);
  const [aiReviewCronToggling, setAiReviewCronToggling] = useState(false);
  const [startingAll, setStartingAll] = useState(false);
  const [startAllResult, setStartAllResult] = useState<string | null>(null);

  const loadCronStatus = useCallback(() => {
    if (!token) return;
    setCronError(null);
    adminGetCronEnabled(token).then(({ data, error: err }) => {
      if (err) setCronError(err);
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
    const { data, error: err } = await adminSetCronEnabled(token, nextEnabled);
    setCronToggling(false);
    if (err) {
      setCronEnabled(cronEnabled);
      setCronError(err);
    } else if (data) {
      setCronEnabled(data.enabled);
    }
  };

  const loadPuzzles = useCallback(() => {
    if (!token) return;
    setLoading(true);
    const statuses: ReviewStatus[] = ['generating', 'ai_review', 'pending', 'approved', 'rejected'];
    Promise.all(
      statuses.map((s) => adminListPuzzles(token, { status: s, limit: 100 })),
    ).then((results) => {
      setLoading(false);
      const next: Record<ReviewStatus, AdminPuzzleSummary[]> = {
        generating: [], ai_review: [], pending: [], approved: [], rejected: [],
      };
      let count = 0;
      results.forEach((res, i) => {
        if (res.data) {
          next[statuses[i]!] = res.data.items;
          count += res.data.total;
        }
        if (res.error) setError(res.error);
      });
      setColumns(next);
      setTotalCount(count);
    });
  }, [token]);

  useEffect(() => { loadPuzzles(); }, [loadPuzzles]);

  // Auto-refresh while puzzles are generating or under AI review
  useEffect(() => {
    const hasActive = columns.generating.length > 0 || columns.ai_review.length > 0;
    if (!hasActive) return;
    const id = setInterval(loadPuzzles, 5000);
    return () => clearInterval(id);
  }, [columns.generating.length, columns.ai_review.length, loadPuzzles]);

  const handleGenerate = async () => {
    if (!token || generating) return;
    setGenerating(true);
    setGenerateError(null);
    const { data, error: err } = await adminGeneratePuzzle(token, generateDifficulty, generateCount);
    setGenerating(false);
    if (err) { setGenerateError(err); return; }
    if (data?.accepted) {
      setSidebarOpen(false);
      loadPuzzles();
    }
  };

  const handleAiReviewCronToggle = async () => {
    if (!token || aiReviewCronToggling || aiReviewCronEnabled === null) return;
    const nextEnabled = !aiReviewCronEnabled;
    setAiReviewCronEnabled(nextEnabled);
    setAiReviewCronToggling(true);
    const { data, error: err } = await adminSetAiReviewCronEnabled(token, nextEnabled);
    setAiReviewCronToggling(false);
    if (err) {
      setAiReviewCronEnabled(aiReviewCronEnabled);
      setError(err);
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

  // Kept for potential use from kanban card actions
  const handleTriggerAiReview = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!token) return;
    const { error: err } = await adminTriggerAiReview(token, id);
    if (!err) loadPuzzles();
  };
  void handleTriggerAiReview; // suppress unused warning until wired to cards

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Bulmacalar</h1>
          <p className="text-sm text-text-secondary mt-1">{totalCount} bulmaca</p>
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

      {/* Kanban board */}
      <PuzzleKanbanBoard columns={columns} loading={loading} />
    </div>
  );
}
