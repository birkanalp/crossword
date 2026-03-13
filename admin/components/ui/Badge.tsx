import { cn } from './cn'

type BadgeVariant = 'ai_review' | 'pending' | 'approved' | 'rejected'

const variants: Record<BadgeVariant, string> = {
  ai_review: 'text-indigo-200 border border-indigo-700',
  pending: 'bg-warning-bg text-warning border border-warning-border',
  approved: 'bg-success-bg text-success border border-success-border',
  rejected: 'bg-error-bg text-error border border-error-border',
}

const labels: Record<BadgeVariant, string> = {
  ai_review: 'YZ İnceliyor',
  pending: 'Onay bekleyen',
  approved: 'Onaylı',
  rejected: 'Reddedilen',
}

export function Badge({ status }: { status: BadgeVariant }) {
  return (
    <span
      className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', variants[status])}
      style={status === 'ai_review' ? { backgroundColor: '#1e1b4b' } : undefined}
    >
      {labels[status]}
    </span>
  )
}
