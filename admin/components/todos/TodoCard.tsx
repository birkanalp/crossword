'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/components/ui/cn'
import { Button } from '@/components/ui/Button'
import type { Todo, TodoStatus } from '@/lib/todos-storage'

const STATUS_LABELS: Record<TodoStatus, string> = {
  backlog: 'Yapılacak',
  ideas: 'Fikirler',
  in_progress: 'Devam Eden',
  done: 'Tamamlandı',
  blocked: 'Beklemede',
}

const STATUS_STYLES: Record<TodoStatus, string> = {
  backlog: 'bg-bg-elevated text-text-secondary border-border',
  ideas: 'bg-indigo-900/30 text-indigo-200 border-indigo-700',
  in_progress: 'bg-accent-dark text-accent border-accent-border',
  done: 'bg-success-bg text-success border-success-border',
  blocked: 'bg-warning-bg text-warning border-warning-border',
}

interface TodoCardProps {
  todo: Todo
  onUpdate: (id: string, patch: Partial<Pick<Todo, 'title' | 'body' | 'status'>>) => void
  onDelete: (id: string) => void
}

export function TodoCard({ todo, onUpdate, onDelete }: TodoCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(todo.title)
  const [body, setBody] = useState(todo.body)
  const [status, setStatus] = useState<TodoStatus>(todo.status)

  const handleSave = useCallback(() => {
    onUpdate(todo.id, { title, body, status })
    setIsEditing(false)
  }, [todo.id, title, body, status, onUpdate])

  const handleCancel = useCallback(() => {
    setTitle(todo.title)
    setBody(todo.body)
    setStatus(todo.status)
    setIsEditing(false)
  }, [todo.title, todo.body, todo.status])

  const handleStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newStatus = e.target.value as TodoStatus
      setStatus(newStatus)
      onUpdate(todo.id, { status: newStatus })
    },
    [todo.id, onUpdate]
  )

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  if (isEditing) {
    return (
      <div className="rounded-xl border border-border bg-bg-surface p-4 transition-colors hover:bg-bg-elevated">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Başlık"
          className="mb-3 w-full rounded-lg border border-[#333] bg-bg-surface px-3 py-2 text-base font-semibold text-text-primary placeholder-text-tertiary focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Detay ekle..."
          rows={3}
          className="mb-3 min-h-[80px] w-full resize-y rounded-lg border border-[#333] bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-accent"
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
          <Button size="sm" variant="primary" onClick={handleSave}>
            Kaydet
          </Button>
          <Button size="sm" variant="secondary" onClick={handleCancel}>
            İptal
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'group rounded-xl border border-border bg-bg-surface p-4 transition-colors duration-150',
        'hover:bg-bg-elevated hover:border-border-hover'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-text-primary">{todo.title}</h3>
          {todo.body && (
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-text-secondary">{todo.body}</p>
          )}
          <p className="mt-2 text-xs text-text-tertiary">{formatDate(todo.updatedAt)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => setIsEditing(true)}
            className="rounded p-1.5 text-text-tertiary hover:bg-bg-active hover:text-accent"
            aria-label="Düzenle"
          >
            ✏️
          </button>
          <button
            onClick={() => onDelete(todo.id)}
            className="rounded p-1.5 text-text-tertiary hover:bg-error-bg hover:text-error"
            aria-label="Sil"
          >
            🗑️
          </button>
        </div>
      </div>
      <div className="mt-3">
        <select
          value={todo.status}
          onChange={handleStatusChange}
          className={cn(
            'rounded-md border px-2 py-1 text-xs font-medium transition-colors',
            STATUS_STYLES[todo.status]
          )}
        >
          {(Object.keys(STATUS_LABELS) as TodoStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
