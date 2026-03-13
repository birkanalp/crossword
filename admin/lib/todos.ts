export const TODO_STATUSES = ['backlog', 'ideas', 'in_progress', 'done', 'blocked'] as const;

export type TodoStatus = (typeof TODO_STATUSES)[number];

export interface Todo {
  id: string;
  title: string;
  body: string;
  status: TodoStatus;
  createdAt: string;
  updatedAt: string;
}
