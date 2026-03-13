'use client';

import { KanbanBoard } from '@/components/todos/KanbanBoard';

export default function TodosPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary">Notlarım</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Proje eksiklikleri, fikirler ve güvenlik maddeleri. Durum dropdown ile taşıyabilir, düzenle butonu ile not ekleyebilirsiniz.
      </p>
      <div className="mt-6">
        <KanbanBoard />
      </div>
    </div>
  );
}
