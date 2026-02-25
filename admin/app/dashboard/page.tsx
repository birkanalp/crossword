'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  adminMetricsOverview,
  adminMetricsDaily,
  type MetricsOverview,
  type DailyMetricsPoint,
} from '@/lib/api';

export default function DashboardPage() {
  const { token } = useAuth();
  const [overview, setOverview] = useState<MetricsOverview | null>(null);
  const [series, setSeries] = useState<DailyMetricsPoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    adminMetricsOverview(token).then(({ data, error: err }) => {
      if (err) setError(err);
      else if (data) setOverview(data);
    });
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 13);
    const fromStr = from.toISOString().slice(0, 10);
    const toStr = to.toISOString().slice(0, 10);
    adminMetricsDaily(token, fromStr, toStr).then(({ data, error: err }) => {
      if (err) setError(err);
      else if (data) setSeries(data.series);
    });
  }, [token]);

  if (error) {
    return <p style={{ color: '#f87171' }}>{error}</p>;
  }

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Dashboard</h1>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <MetricCard title="Günlük oynanma" value={overview?.daily_plays ?? '—'} />
        <MetricCard title="Toplam kullanıcı" value={overview?.total_users ?? '—'} />
        <MetricCard title="Ücretli kullanıcı" value={overview?.paid_users ?? '—'} />
        <MetricCard
          title="Son 15 dk aktif"
          value={overview?.active_users_15min ?? '—'}
        />
      </div>
      <h2 style={{ marginBottom: 16 }}>Son 14 gün</h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 8,
          maxWidth: 800,
        }}
      >
        {series.map((s) => (
          <div
            key={s.date}
            style={{
              padding: 12,
              borderRadius: 8,
              background: '#1a1a22',
              border: '1px solid #2a2a35',
            }}
          >
            <div style={{ fontSize: 12, color: '#a0a0b0', marginBottom: 4 }}>
              {s.date}
            </div>
            <div>Oynanma: {s.plays}</div>
            <div>Tamamlanan: {s.completions}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) {
  return (
    <div
      style={{
        padding: 20,
        borderRadius: 12,
        background: '#1a1a22',
        border: '1px solid #2a2a35',
      }}
    >
      <div style={{ fontSize: 14, color: '#a0a0b0', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
