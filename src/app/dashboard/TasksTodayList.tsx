'use client'

import { useState } from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'
import type { TaskPriority, TaskStatus } from '@/types'
import { cn, formatDate, PRIORITY_LABELS } from '@/lib/utils'

interface TaskRow {
  id: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  deadline: string | null
  client: { name: string } | null
}

const PRIORITY_DOT: Record<TaskPriority, string> = {
  basse:   'bg-gray-300',
  normale: 'bg-blue-400',
  haute:   'bg-amber-400',
  urgente: 'bg-red-500',
}

export default function TasksTodayList({ initialTasks }: { initialTasks: TaskRow[] }) {
  const [tasks, setTasks] = useState(initialTasks)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  async function updateStatus(id: string, status: TaskStatus) {
    const prev = tasks
    setUpdatingId(id)
    setTasks(ts => status === 'termine' ? ts.filter(t => t.id !== id) : ts.map(t => t.id === id ? { ...t, status } : t))

    const res = await fetch(`/api/taches/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })

    if (!res.ok) setTasks(prev)
    setUpdatingId(null)
  }

  if (tasks.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
        <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
        <p className="text-sm text-gray-400">Aucune tâche en attente — profites-en !</p>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {tasks.map(t => {
        const isOverdue = !!t.deadline && new Date(t.deadline) < new Date(new Date().toDateString())
        const isUpdating = updatingId === t.id
        return (
          <div
            key={t.id}
            className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3.5 transition-shadow hover:shadow-md"
          >
            <span className={cn('w-2 h-2 rounded-full flex-shrink-0', PRIORITY_DOT[t.priority])} />

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-400">
                {t.client?.name && <span className="truncate">{t.client.name}</span>}
                {t.deadline && (
                  <>
                    {t.client?.name && <span>·</span>}
                    <span className={cn(isOverdue && 'text-red-500 font-medium')}>
                      {isOverdue ? 'En retard · ' : ''}{formatDate(t.deadline)}
                    </span>
                  </>
                )}
              </div>
            </div>

            {t.priority !== 'normale' && (
              <span className="hidden sm:inline text-xs font-medium text-gray-400 flex-shrink-0">
                {PRIORITY_LABELS[t.priority]}
              </span>
            )}

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {t.status === 'a_faire' && (
                <button
                  disabled={isUpdating}
                  onClick={() => updateStatus(t.id, 'en_cours')}
                  className="text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-50"
                >
                  En cours
                </button>
              )}
              <button
                disabled={isUpdating}
                onClick={() => updateStatus(t.id, 'termine')}
                className="text-xs font-medium text-auchu-600 bg-auchu-50 hover:bg-auchu-100 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Terminé'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
