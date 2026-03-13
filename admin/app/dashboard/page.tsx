'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  adminMetricsOverview,
  adminMetricsDaily,
  type MetricsOverview,
  type DailyMetricsPoint,
} from '@/lib/api';
import { MetricCard } from '@/components/ui/MetricCard';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';

export default function DashboardPage() {
  const { token } = useAuth();
  const [overview, setOverview] = useState<MetricsOverview | null>(null);
  const [series, setSeries] = useState<DailyMetricsPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let resolved = 0;
    const done = () => { resolved++; if (resolved === 2) setLoading(false); };

    adminMetricsOverview(token).then(({ data, error: err }) => {
      if (err) setError(err);
      else if (data) setOverview(data);
      done();
    });
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 13);
    adminMetricsDaily(token, from.toISOString().slice(0, 10), to.toISOString().slice(0, 10)).then(
      ({ data, error: err }) => {
        if (err) setError(err);
        else if (data) setSeries(data.series);
        done();
      }
    );
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-3 rounded-lg bg-error-bg border border-error-border text-error text-sm">
        {error}
      </div>
    );
  }

  const maxPlays = Math.max(...series.map((s) => s.plays), 1);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-sm text-text-secondary mt-1">Genel bakış ve metrikler</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <MetricCard title="Günlük oynanma" value={overview?.daily_plays ?? '—'} />
        <MetricCard title="Toplam kullanıcı" value={overview?.total_users ?? '—'} />
        <MetricCard title="Ücretli kullanıcı" value={overview?.paid_users ?? '—'} />
        <MetricCard title="Son 15 dk aktif" value={overview?.active_users_15min ?? '—'} />
        <MetricCard title="Bugün izlenen reklam" value={overview?.ads_watched_today ?? '—'} />
      </div>

      {/* Daily chart */}
      {series.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-text-primary">Son 14 gün</h2>
          </CardHeader>
          <CardBody>
            <div className="flex items-end gap-2 h-40">
              {series.map((s) => {
                const barHeight = Math.round((s.plays / maxPlays) * 100);
                const date = new Date(s.date);
                const label = date.toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' });
                return (
                  <div key={s.date} className="flex flex-col items-center gap-1 flex-1 group">
                    <div className="relative w-full flex flex-col items-center">
                      {/* Tooltip on hover */}
                      <div className="hidden group-hover:flex absolute -top-14 left-1/2 -translate-x-1/2 bg-bg-elevated border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary whitespace-nowrap z-10 flex-col gap-0.5">
                        <span>Oynanma: {s.plays}</span>
                        <span className="text-text-secondary">Tamamlanan: {s.completions}</span>
                      </div>
                      {/* Bar */}
                      <div
                        className="w-full rounded-t bg-accent opacity-80 hover:opacity-100 transition-opacity"
                        style={{ height: `${Math.max(barHeight, 4)}%`, minHeight: '4px', maxHeight: '100%' }}
                      />
                    </div>
                    <span className="text-[10px] text-text-tertiary">{label}</span>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
