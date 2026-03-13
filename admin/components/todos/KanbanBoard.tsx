'use client'

import { useState, useCallback, useEffect } from 'react'
import { TodoCard } from './TodoCard'
import { TodoForm } from './TodoForm'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import {
  type Todo,
  type TodoStatus,
} from '@/lib/todos'
import { adminCreateTodo, adminDeleteTodo, adminListTodos, adminUpdateTodo } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'

const STATUS_ORDER: TodoStatus[] = ['backlog', 'ideas', 'in_progress', 'done', 'blocked']

const COLUMN_LABELS: Record<TodoStatus, string> = {
  backlog: 'Yapılacak',
  ideas: 'Fikirler',
  in_progress: 'Devam Eden',
  done: 'Tamamlandı',
  blocked: 'Beklemede',
}

const COLUMN_DESCRIPTIONS: Record<TodoStatus, string> = {
  backlog: 'Henüz başlanmadı',
  ideas: 'Oyunu eğlenceli yapacak yeni fikirler',
  in_progress: 'Aktif çalışılan',
  done: 'Biten işler',
  blocked: 'Başka bir şeye bağlı',
}

export function KanbanBoard() {
  const { token } = useAuth()
  const [todos, setTodos] = useState<Todo[]>([])
  const [showFormFor, setShowFormFor] = useState<TodoStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!token) {
      setTodos([])
      setLoading(false)
      return
    }

    setLoading(true)
    const result = await adminListTodos(token)
    if (result.error) {
      setError(result.error)
      setTodos([])
    } else {
      setError(null)
      setTodos(result.data?.todos ?? [])
    }
    setLoading(false)
  }, [token])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const handleUpdate = useCallback(
    async (id: string, patch: Partial<Pick<Todo, 'title' | 'body' | 'status'>>) => {
      if (!token) return
      const result = await adminUpdateTodo(token, id, patch)
      if (result.error) {
        setError(result.error)
        return
      }
      setError(null)
      await refresh()
    },
    [refresh, token]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      if (!token) return
      if (typeof window !== 'undefined' && window.confirm('Bu notu silmek istediğinize emin misiniz?')) {
        const result = await adminDeleteTodo(token, id)
        if (result.error) {
          setError(result.error)
          return
        }
        setError(null)
        await refresh()
      }
    },
    [refresh, token]
  )

  const handleCreate = useCallback(
    async (title: string, body: string, status: TodoStatus) => {
      if (!token) return
      const result = await adminCreateTodo(token, { title, body, status })
      if (result.error) {
        setError(result.error)
        return
      }
      setError(null)
      setShowFormFor(null)
      await refresh()
    },
    [refresh, token]
  )

  const todosByStatus = STATUS_ORDER.reduce(
    (acc, s) => {
      acc[s] = todos.filter((t) => t.status === s)
      return acc
    },
    {} as Record<TodoStatus, Todo[]>
  )

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!token) {
    return <EmptyState title="Oturum bulunamadı" description="Todo verileri için admin oturumu gerekli." />
  }

  return (
    <div>
      {error ? (
        <div className="mb-4 rounded-lg border border-error-border bg-error-bg px-4 py-3 text-sm text-error">
          {error}
        </div>
      ) : null}
      <div className="flex gap-6 overflow-x-auto pb-4">
        {STATUS_ORDER.map((status) => (
          <div
            key={status}
            className="flex w-72 shrink-0 flex-col rounded-xl border border-border bg-bg-base/50"
          >
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold text-text-primary">{COLUMN_LABELS[status]}</h2>
              <p className="mt-0.5 text-xs text-text-tertiary">{COLUMN_DESCRIPTIONS[status]}</p>
              <span className="mt-2 inline-block rounded-full bg-bg-elevated px-2 py-0.5 text-xs text-text-secondary">
                {todosByStatus[status].length}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
              {todosByStatus[status].map((todo) => (
                <TodoCard key={todo.id} todo={todo} onUpdate={handleUpdate} onDelete={handleDelete} />
              ))}
              {showFormFor === status ? (
                <TodoForm
                  defaultStatus={status}
                  onSubmit={handleCreate}
                  onCancel={() => setShowFormFor(null)}
                />
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-center border-dashed"
                  onClick={() => setShowFormFor(status)}
                >
                  + Yeni
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
