'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import AdminLayout from '@/components/AdminLayout';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  display_name: string;
  avatar_color: string;
  score: number;
  completion_time: number;
  mistakes: number;
  hints_used: number;
  created_at: string;
}

interface LeaderboardStats {
  total_entries: number;
  unique_players: number;
  avg_score: number;
  avg_completion_time: number;
  top_scorer: { display_name: string; score: number } | null;
}

type LeaderboardType = 'daily' | 'all_time' | 'puzzle';
type SortBy = 'score' | 'time';

// ─── Utility Functions ────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return `${Math.floor(diff / 60000)} dk önce`;
  if (hours < 24) return `${hours} saat önce`;
  return `${Math.floor(hours / 24)} gün önce`;
}

function exportToCSV(entries: LeaderboardEntry[]): void {
  const headers = ['Sıra', 'Kullanıcı', 'Puan', 'Süre (sn)', 'Hata', 'İpucu', 'Tarih'];
  const rows = entries.map((e) => [
    e.rank,
    e.display_name,
    e.score,
    e.completion_time,
    e.mistakes,
    e.hints_used,
    e.created_at,
  ]);
  const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `leaderboard-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-yellow-900/40 border border-yellow-700 text-base">
        🥇
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-zinc-700/40 border border-zinc-500 text-base">
        🥈
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-900/40 border border-orange-700 text-base">
        🥉
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-bg-elevated border border-border text-xs font-bold text-text-secondary">
      {rank}
    </span>
  );
}

function AvatarCircle({
  name,
  color,
}: {
  name: string;
  color: string;
}) {
  // Use avatar_color as background; fall back to accent blue if empty
  const bg = color || '#2a4a7f';
  return (
    <span
      className="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold text-white flex-shrink-0"
      style={{ backgroundColor: bg }}
    >
      {getInitials(name)}
    </span>
  );
}

// ─── Stats Card ───────────────────────────────────────────────────────────────

function StatsCards({ stats, loading }: { stats: LeaderboardStats | null; loading: boolean }) {
  const cards = [
    {
      title: 'Toplam Kayıt',
      value: loading ? '—' : (stats?.total_entries ?? '—'),
    },
    {
      title: 'Benzersiz Oyuncu',
      value: loading ? '—' : (stats?.unique_players ?? '—'),
    },
    {
      title: 'Ortalama Puan',
      value: loading
        ? '—'
        : stats?.avg_score != null
        ? Math.round(stats.avg_score).toLocaleString('tr-TR')
        : '—',
    },
    {
      title: 'Ortalama Süre',
      value: loading
        ? '—'
        : stats?.avg_completion_time != null
        ? formatTime(Math.round(stats.avg_completion_time))
        : '—',
    },
    {
      title: 'En Yüksek Skor',
      value: loading
        ? '—'
        : stats?.top_scorer
        ? `${stats.top_scorer.score.toLocaleString('tr-TR')}`
        : '—',
      subtitle:
        !loading && stats?.top_scorer ? stats.top_scorer.display_name : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardBody>
            <p className="text-sm text-text-secondary mb-2">{card.title}</p>
            <p className="text-2xl font-bold text-text-primary">{card.value}</p>
            {card.subtitle && (
              <p className="text-xs text-text-tertiary mt-1 truncate">{card.subtitle}</p>
            )}
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const { token } = useAuth();

  // Filter state
  const [type, setType] = useState<LeaderboardType>('all_time');
  const [sortBy, setSortBy] = useState<SortBy>('score');
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [levelId, setLevelId] = useState('');
  const [page, setPage] = useState(0);

  // Data state
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<LeaderboardStats | null>(null);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  const LIMIT = 50;
  const totalPages = Math.ceil(total / LIMIT);

  const getBaseUrl = () =>
    process.env.NEXT_PUBLIC_SUPABASE_URL
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`
      : '';

  const buildQuerySuffix = useCallback(() => {
    const parts: string[] = [];
    if (type === 'daily' && date) parts.push(`date=${encodeURIComponent(date)}`);
    if (type === 'puzzle' && levelId.trim()) parts.push(`level_id=${encodeURIComponent(levelId.trim())}`);
    return parts.length > 0 ? `&${parts.join('&')}` : '';
  }, [type, date, levelId]);

  const fetchStats = useCallback(async () => {
    if (!token) return;
    const base = getBaseUrl();
    if (!base) return;
    // puzzle type requires a level_id – skip the request if it's empty
    if (type === 'puzzle' && !levelId.trim()) {
      setStats(null);
      setStatsError(null);
      setLoadingStats(false);
      return;
    }
    setLoadingStats(true);
    setStatsError(null);
    try {
      const extra = buildQuerySuffix();
      const res = await fetch(`${base}/admin/leaderboard/stats?type=${type}${extra}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
            ? { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY }
            : {}),
        },
      });
      const raw = await res.json().catch(() => null);
      if (!res.ok) {
        setStatsError((raw as { error?: string })?.error ?? `HTTP ${res.status}`);
      } else {
        setStats(raw as LeaderboardStats);
      }
    } catch {
      setStatsError('Bağlantı hatası');
    } finally {
      setLoadingStats(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, type, levelId, buildQuerySuffix]);

  const fetchEntries = useCallback(async () => {
    if (!token) return;
    const base = getBaseUrl();
    if (!base) return;
    // puzzle type requires a level_id – skip the request if it's empty
    if (type === 'puzzle' && !levelId.trim()) {
      setEntries([]);
      setTotal(0);
      setError(null);
      setLoadingEntries(false);
      return;
    }
    setLoadingEntries(true);
    setError(null);
    try {
      const extra = buildQuerySuffix();
      const res = await fetch(
        `${base}/admin/leaderboard?type=${type}&sort_by=${sortBy}&limit=${LIMIT}&page=${page}${extra}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            ...(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
              ? { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY }
              : {}),
          },
        }
      );
      const raw = await res.json().catch(() => null);
      if (!res.ok) {
        setError((raw as { error?: string })?.error ?? `HTTP ${res.status}`);
      } else {
        const payload = raw as { entries: LeaderboardEntry[]; total: number };
        setEntries(payload.entries ?? []);
        setTotal(payload.total ?? 0);
      }
    } catch {
      setError('Bağlantı hatası');
    } finally {
      setLoadingEntries(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, type, levelId, sortBy, page, buildQuerySuffix]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleTypeChange = (newType: LeaderboardType) => {
    setType(newType);
    setPage(0);
  };

  const handleSortChange = (newSort: SortBy) => {
    setSortBy(newSort);
    setPage(0);
  };

  const handleRefresh = () => {
    fetchStats();
    fetchEntries();
  };

  const TYPE_TABS: { key: LeaderboardType; label: string }[] = [
    { key: 'all_time', label: 'Tüm Zamanlar' },
    { key: 'daily', label: 'Günlük' },
    { key: 'puzzle', label: 'Bulmaca Bazlı' },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏆</span>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">Lider Tablosu</h1>
              <p className="text-sm text-text-secondary mt-0.5">
                Oyuncu sıralamaları ve skor istatistikleri
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {entries.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => exportToCSV(entries)}
              >
                ↓ CSV İndir
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleRefresh}>
              ↻ Yenile
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <StatsCards stats={stats} loading={loadingStats} />
        {statsError && (
          <div className="px-4 py-3 rounded-lg bg-error-bg border border-error-border text-error text-sm">
            İstatistik hatası: {statsError}
          </div>
        )}

        {/* Filter Bar */}
        <Card>
          <CardBody className="flex flex-wrap items-end gap-4">
            {/* Type tabs */}
            <div className="flex flex-col gap-1">
              <p className="text-xs text-text-tertiary uppercase tracking-wide font-semibold">Tür</p>
              <div className="flex gap-1 bg-bg-base rounded-lg p-1 border border-border">
                {TYPE_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => handleTypeChange(tab.key)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 ${
                      type === tab.key
                        ? 'bg-accent text-white'
                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort */}
            <div className="flex flex-col gap-1">
              <p className="text-xs text-text-tertiary uppercase tracking-wide font-semibold">Sıralama</p>
              <div className="flex gap-1 bg-bg-base rounded-lg p-1 border border-border">
                <button
                  onClick={() => handleSortChange('score')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 ${
                    sortBy === 'score'
                      ? 'bg-accent text-white'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
                  }`}
                >
                  Puan
                </button>
                <button
                  onClick={() => handleSortChange('time')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 ${
                    sortBy === 'time'
                      ? 'bg-accent text-white'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
                  }`}
                >
                  Süre
                </button>
              </div>
            </div>

            {/* Date picker – only for daily */}
            {type === 'daily' && (
              <div className="flex flex-col gap-1">
                <p className="text-xs text-text-tertiary uppercase tracking-wide font-semibold">Tarih</p>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setPage(0);
                  }}
                  className="px-3 py-2 rounded-lg border border-border bg-bg-base text-text-primary text-sm focus:outline-none focus:border-border-focus"
                />
              </div>
            )}

            {/* Level ID input – only for puzzle */}
            {type === 'puzzle' && (
              <div className="flex flex-col gap-1">
                <p className="text-xs text-text-tertiary uppercase tracking-wide font-semibold">
                  Bulmaca ID
                </p>
                <input
                  type="text"
                  placeholder="UUID girin..."
                  value={levelId}
                  onChange={(e) => {
                    setLevelId(e.target.value);
                    setPage(0);
                  }}
                  className="px-3 py-2 rounded-lg border border-border bg-bg-base text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-border-focus w-72"
                />
              </div>
            )}
          </CardBody>
        </Card>

        {/* Error */}
        {error && (
          <div className="px-4 py-3 rounded-lg bg-error-bg border border-error-border text-error text-sm">
            {error}
          </div>
        )}

        {/* Table */}
        {loadingEntries ? (
          <div className="flex justify-center py-16">
            <Spinner className="w-8 h-8" />
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            title={type === 'puzzle' && !levelId.trim() ? 'Bulmaca ID girin' : 'Kayıt bulunamadı'}
            description={
              type === 'puzzle' && !levelId.trim()
                ? 'Yukarıdaki alana bir bulmaca UUID\'si girerek lider tablosunu görüntüleyin.'
                : 'Bu filtreler için henüz lider tablosu verisi yok.'
            }
          />
        ) : (
          <Card>
            <div className="divide-y divide-border">
              {/* Table Header */}
              <div className="grid grid-cols-7 px-4 py-3 bg-bg-elevated text-xs font-semibold text-text-secondary uppercase tracking-wide rounded-t-xl">
                <span>Sıra</span>
                <span className="col-span-2">Kullanıcı</span>
                <span className="text-right">Puan</span>
                <span className="text-right">Süre</span>
                <span className="text-right">Hata</span>
                <span className="text-right">İpucu / Tarih</span>
              </div>

              {/* Table Rows */}
              {entries.map((entry) => (
                <div
                  key={`${entry.user_id}-${entry.rank}`}
                  className="grid grid-cols-7 px-4 py-3.5 hover:bg-bg-elevated transition-colors items-center text-sm"
                >
                  {/* Rank */}
                  <div>
                    <RankBadge rank={entry.rank} />
                  </div>

                  {/* User */}
                  <div className="col-span-2 flex items-center gap-2.5 min-w-0">
                    <AvatarCircle name={entry.display_name} color={entry.avatar_color} />
                    <span className="text-text-primary font-medium truncate">
                      {entry.display_name}
                    </span>
                  </div>

                  {/* Score */}
                  <div className="text-right">
                    <span className="font-bold text-text-primary">
                      {entry.score.toLocaleString('tr-TR')}
                    </span>
                  </div>

                  {/* Time */}
                  <div className="text-right text-text-secondary font-mono">
                    {formatTime(entry.completion_time)}
                  </div>

                  {/* Mistakes */}
                  <div className="text-right">
                    <span
                      className={
                        entry.mistakes > 0 ? 'text-error font-semibold' : 'text-text-tertiary'
                      }
                    >
                      {entry.mistakes}
                    </span>
                  </div>

                  {/* Hints + Date */}
                  <div className="text-right flex flex-col items-end gap-0.5">
                    <span className="text-text-secondary">{entry.hints_used}</span>
                    <span className="text-text-tertiary text-xs">
                      {formatRelativeTime(entry.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">
              Sayfa {page + 1} / {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={page <= 0}
                onClick={() => setPage((p) => p - 1)}
              >
                &larr; Önceki
              </Button>
              <Button
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Sonraki &rarr;
              </Button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
