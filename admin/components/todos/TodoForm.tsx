'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { TodoStatus } from '@/lib/todos'

const STATUS_LABELS: Record<TodoStatus, string> = {
  backlog: 'Yapılacak',
  ideas: 'Fikirler',
  in_progress: 'Devam Eden',
  done: 'Tamamlandı',
  blocked: 'Beklemede',
}

interface TodoFormProps {
  defaultStatus?: TodoStatus
  onSubmit: (title: string, body: string, status: TodoStatus) => void | Promise<void>
  onCancel?: () => void
}

export function TodoForm({ defaultStatus = 'backlog', onSubmit, onCancel }: TodoFormProps) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [status, setStatus] = useState<TodoStatus>(defaultStatus)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    onSubmit(t, body.trim(), status)
    setTitle('')
    setBody('')
    setStatus(defaultStatus)
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-dashed border-border bg-bg-surface/50 p-4">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Başlık"
        required
        className="mb-3 w-full rounded-lg border border-[#333] bg-bg-surface px-3 py-2 text-base font-semibold text-text-primary placeholder-text-tertiary focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-accent"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Detay ekle..."
        rows={2}
        className="mb-3 min-h-[60px] w-full resize-y rounded-lg border border-[#333] bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-accent"
      />
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as TodoStatus)}
          className="rounded-lg border border-[#333] bg-bg-elevated px-3 py-1.5 text-sm text-text-primary"
        >
          {(Object.keys(STATUS_LABELS) as TodoStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="primary" disabled={!title.trim()}>
          Ekle
        </Button>
        {onCancel && (
          <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
            İptal
          </Button>
        )}
      </div>
    </form>
  )
}
