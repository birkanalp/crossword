import { cn } from './cn'
import { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm text-text-secondary">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'w-full px-3 py-2.5 rounded-lg border bg-bg-surface text-text-primary placeholder-text-tertiary',
          'transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-accent focus:border-border-focus',
          error ? 'border-error' : 'border-[#333]',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  )
}
