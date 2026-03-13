'use client'

import { useState, useCallback, useEffect } from 'react'
import { TodoCard } from './TodoCard'
import { TodoForm } from './TodoForm'
import {
  getTodos,
  updateTodo,
  createTodo,
  deleteTodo,
  type Todo,
  type TodoStatus,
} from '@/lib/todos-storage'
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
  const [todos, setTodos] = useState<Todo[]>([])
  const [showFormFor, setShowFormFor] = useState<TodoStatus | null>(null)

  const refresh = useCallback(() => {
    setTodos(getTodos())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleUpdate = useCallback(
    (id: string, patch: Partial<Pick<Todo, 'title' | 'body' | 'status'>>) => {
      const updated = updateTodo(id, patch)
      if (updated) refresh()
    },
    [refresh]
  )

  const handleDelete = useCallback(
    (id: string) => {
      if (typeof window !== 'undefined' && window.confirm('Bu notu silmek istediğinize emin misiniz?')) {
        deleteTodo(id)
        refresh()
      }
    },
    [refresh]
  )

  const handleCreate = useCallback(
    (title: string, body: string, status: TodoStatus) => {
      createTodo({ title, body, status })
      setShowFormFor(null)
      refresh()
    },
    [refresh]
  )

  const todosByStatus = STATUS_ORDER.reduce(
    (acc, s) => {
      acc[s] = todos.filter((t) => t.status === s)
      return acc
    },
    {} as Record<TodoStatus, Todo[]>
  )

  return (
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
  )
}
