'use client';

import Link from 'next/link';
import { Spinner } from '@/components/ui/Spinner';
import type { AdminPuzzleSummary } from '@/lib/api';

type ReviewStatus = 'generating' | 'ai_review' | 'pending' | 'approved' | 'rejected';

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Kolay',
  medium: 'Orta',
  hard: 'Zor',
  expert: 'Uzman',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#4caf50',
  medium: '#ff9800',
  hard: '#f44336',
  expert: '#9c27b0',
};

const COLUMN_CONFIG: { status: ReviewStatus; label: string; accent: string }[] = [
  { status: 'generating', label: 'Oluşturuluyor', accent: '#6b9fff' },
  { status: 'ai_review',  label: 'YZ İnceliyor',  accent: '#ff9800' },
  { status: 'pending',    label: 'Onay Bekliyor',  accent: '#e8e8ed' },
  { status: 'approved',   label: 'Onaylı',         accent: '#4caf50' },
  { status: 'rejected',   label: 'Reddedildi',     accent: '#f44336' },
];

export interface PuzzleKanbanBoardProps {
  columns: Record<ReviewStatus, AdminPuzzleSummary[]>;
  loading: boolean;
}

function relativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} dk önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.floor(hours / 24);
  return `${days} gün önce`;
}

function scoreColor(score: number): string {
  if (score >= 80) return '#4caf50';
  if (score >= 60) return '#ff9800';
  return '#f44336';
}

function StatusIcon({ status }: { status: ReviewStatus }) {
  if (status === 'generating') {
    return <Spinner className="w-4 h-4" />;
  }
  if (status === 'ai_review') {
    return <span title="YZ İnceliyor" style={{ fontSize: 14 }}>⏱</span>;
  }
  if (status === 'pending') {
    return <span title="Onay Bekliyor" style={{ fontSize: 14 }}>⌛</span>;
  }
  if (status === 'approved') {
    return (
      <span title="Onaylı" style={{ color: '#4caf50', fontWeight: 700, fontSize: 15 }}>✓</span>
    );
  }
  return (
    <span title="Reddedildi" style={{ color: '#f44336', fontWeight: 700, fontSize: 15 }}>✗</span>
  );
}

function PuzzleCard({ puzzle }: { puzzle: AdminPuzzleSummary }) {
  const diffColor = DIFFICULTY_COLORS[puzzle.difficulty] ?? '#e8e8ed';
  const diffLabel = DIFFICULTY_LABELS[puzzle.difficulty] ?? puzzle.difficulty;

  return (
    <Link
      href={`/puzzles/${puzzle.id}`}
      style={{
        display: 'block',
        width: '220px',
        borderRadius: '10px',
        backgroundColor: '#252530',
        border: '1px solid #333',
        padding: '12px',
        textDecoration: 'none',
        cursor: 'pointer',
        color: 'inherit',
        flexShrink: 0,
      }}
    >
      {/* Top row: difficulty badge + status icon */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: diffColor,
              flexShrink: 0,
              display: 'inline-block',
            }}
          />
          <span style={{ fontSize: '12px', color: diffColor, fontWeight: 600 }}>
            {diffLabel}
          </span>
        </div>
        <StatusIcon status={puzzle.review_status} />
      </div>

      {/* ID */}
      <div
        style={{
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#6b9fff',
          marginBottom: '8px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {puzzle.id.slice(0, 8)}&hellip;
      </div>

      {/* Bottom row: AI score + relative date */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
        {puzzle.ai_review_score !== null ? (
          <span
            style={{
              fontSize: '12px',
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color: scoreColor(puzzle.ai_review_score),
            }}
          >
            %{puzzle.ai_review_score}
          </span>
        ) : (
          <span style={{ fontSize: '12px', color: '#666' }}>—</span>
        )}
        <span style={{ fontSize: '11px', color: '#888' }}>
          {relativeDate(puzzle.created_at)}
        </span>
      </div>
    </Link>
  );
}

function KanbanColumn({
  status,
  label,
  accent,
  cards,
}: {
  status: ReviewStatus;
  label: string;
  accent: string;
  cards: AdminPuzzleSummary[];
}) {
  return (
    <div
      style={{
        width: '240px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        minHeight: '300px',
      }}
    >
      {/* Column header */}
      <div
        style={{
          borderBottom: `2px solid ${accent}`,
          paddingBottom: '8px',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '14px', color: '#e8e8ed' }}>{label}</span>
        <span
          style={{
            backgroundColor: '#2d2d3d',
            color: accent,
            borderRadius: '10px',
            padding: '1px 8px',
            fontSize: '12px',
            fontWeight: 700,
          }}
        >
          {cards.length}
        </span>
      </div>

      {/* Cards */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          overflowY: 'auto',
          maxHeight: 'calc(100vh - 300px)',
          paddingRight: '2px',
        }}
      >
        {cards.length === 0 ? (
          <span style={{ fontSize: '13px', color: '#555', fontStyle: 'italic' }}>Boş</span>
        ) : (
          cards.map((p) => <PuzzleCard key={p.id} puzzle={p} />)
        )}
      </div>
    </div>
  );
}

export function PuzzleKanbanBoard({ columns, loading }: PuzzleKanbanBoardProps) {
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: '16px',
        overflowX: 'auto',
        paddingBottom: '16px',
        alignItems: 'flex-start',
      }}
    >
      {COLUMN_CONFIG.map(({ status, label, accent }) => (
        <KanbanColumn
          key={status}
          status={status}
          label={label}
          accent={accent}
          cards={columns[status]}
        />
      ))}
    </div>
  );
}
