import { cn } from './cn'

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn('inline-block w-5 h-5 border-2 border-border border-t-accent rounded-full animate-spin', className)} />
  )
}
