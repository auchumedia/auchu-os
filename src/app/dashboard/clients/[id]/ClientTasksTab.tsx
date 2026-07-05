'use client'

import { useState } from 'react'
import { Plus, Calendar, Trash2, X, Loader2, ListTodo, ArrowRight } from 'lucide-react'
import type { Task, TaskPriority, TaskStatus } from '@/types'
import { cn, formatDate, PRIORITY_LABELS, TASK_STATUS_LABELS } from '@/lib/utils'

interface MemberOption { id: string; name: string }

interface Props {
  clientId: string
  initialTasks: Task[]
  teamMembers: MemberOption[]
  canCreate: boolean
  currentUserId: string
  isOwnerOrDirector: boolean
}

const COLUMNS: TaskStatus[] = ['a_faire', 'en_cours', 'termine']

const PRIORITY_CHIP: Record<TaskPriority, string> = {
  basse:   'bg-gray-100  text-gray-500',
  normale: 'bg-blue-50   text-blue-600',
  haute:   'bg-amber-50  text-amber-600',
  urgente: 'bg-red-50    text-red-600',
}

const NEXT_STATUS: Record<TaskStatus, TaskStatus | null> = {
  a_faire: 'en_cours',
  en_cours: 'termine',
  termine: null,
}
const NEXT_STATUS_LABEL: Record<TaskStatus, string> = {
  a_faire: 'Démarrer',
  en_cours: 'Terminer',
  termine: '',
}

const EMPTY_FORM = { title: '', description: '', assigned_to: '', priority: 'normale' as TaskPriority, deadline: '' }

export default function ClientTasksTab({ clientId, initialTasks, teamMembers, canCreate, currentUserId, isOwnerOrDirector }: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const memberName = new Map(teamMembers.map(m => [m.id, m.name]))

  // Supprimer/modifier : créateur (assigned_by) ou owner/director seulement.
  // Changer le statut : idem, plus la personne assignée (cf. migration 035).
  const canEditTask         = (task: Task) => isOwnerOrDirector || task.assigned_by === currentUserId
  const canChangeStatusTask = (task: Task) => canEditTask(task) || task.assigned_to === currentUserId

  async function updateStatus(id: string, status: TaskStatus) {
    const prev = tasks
    setUpdatingId(id)
    setTasks(ts => ts.map(t => t.id === id ? { ...t, status } : t))
    const res = await fetch(`/api/taches/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    })
    if (!res.ok) setTasks(prev)
    setUpdatingId(null)
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    const res = await fetch(`/api/taches/${id}`, { method: 'DELETE' })
    if (res.ok) setTasks(ts => ts.filter(t => t.id !== id))
    setDeletingId(null)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    setFormError(null)

    const res = await fetch('/api/taches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title.trim(),
        description: form.description.trim() || null,
        assigned_to: form.assigned_to || null,
        client_id: clientId,
        priority: form.priority,
        deadline: form.deadline || null,
      }),
    })
    const json = await res.json()
    setSaving(false)

    if (!res.ok) {
      setFormError(json.error || 'Une erreur est survenue')
      return
    }
    setTasks(ts => [json.data, ...ts])
    setForm(EMPTY_FORM)
    setIsModalOpen(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{tasks.length} tâche{tasks.length !== 1 ? 's' : ''} liée{tasks.length !== 1 ? 's' : ''} à ce client</p>
        {canCreate && (
          <button onClick={() => setIsModalOpen(true)} className="btn-primary text-sm">
            <Plus className="w-3.5 h-3.5" />
            Nouvelle tâche
          </button>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="card text-center py-14">
          <ListTodo className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Aucune tâche liée à ce client pour l'instant.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {COLUMNS.map(status => {
            const list = tasks.filter(t => t.status === status)
            if (list.length === 0) return null
            return (
              <div key={status}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  {TASK_STATUS_LABELS[status]} · {list.length}
                </p>
                <div className="space-y-2">
                  {list.map(task => {
                    const isOverdue = task.deadline && new Date(task.deadline) < new Date(new Date().toDateString()) && task.status !== 'termine'
                    const next = NEXT_STATUS[task.status]
                    const assignee = task.assigned_to ? memberName.get(task.assigned_to) : undefined
                    return (
                      <div key={task.id} className={cn('flex items-center gap-3 bg-white border rounded-xl px-4 py-3', isOverdue ? 'border-red-200' : 'border-gray-100')}>
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-sm font-medium truncate', task.status === 'termine' ? 'text-gray-400 line-through' : 'text-gray-900')}>
                            {task.title}
                          </p>
                          {(assignee || task.description) && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate">{assignee}{assignee && task.description ? ' · ' : ''}{task.description}</p>
                          )}
                        </div>
                        {task.priority !== 'normale' && (
                          <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0', PRIORITY_CHIP[task.priority])}>
                            {PRIORITY_LABELS[task.priority]}
                          </span>
                        )}
                        {task.deadline && (
                          <span className={cn('flex items-center gap-1 text-xs flex-shrink-0', isOverdue ? 'text-red-500 font-medium' : 'text-gray-400')}>
                            <Calendar className="w-3 h-3" />
                            {formatDate(task.deadline)}
                          </span>
                        )}
                        {next && canChangeStatusTask(task) && (
                          <button
                            disabled={updatingId === task.id}
                            onClick={() => updateStatus(task.id, next)}
                            className="flex items-center gap-1 text-xs font-medium text-auchu-600 bg-auchu-50 hover:bg-auchu-100 rounded-md px-2 py-1 flex-shrink-0 disabled:opacity-50"
                          >
                            {updatingId === task.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <>{NEXT_STATUS_LABEL[task.status]}<ArrowRight className="w-3 h-3" /></>}
                          </button>
                        )}
                        {canEditTask(task) && (
                          <button
                            disabled={deletingId === task.id}
                            onClick={() => handleDelete(task.id)}
                            className="p-1 rounded text-gray-300 hover:text-red-400 hover:bg-red-50 flex-shrink-0 disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Nouvelle tâche</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-700 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-3 py-2">{formError}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Titre <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Nom de la tâche..."
                  className="input"
                  required
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Assigné à</label>
                  <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} className="select">
                    <option value="">Non assigné</option>
                    {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Priorité</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as TaskPriority }))} className="select">
                    {(['basse', 'normale', 'haute', 'urgente'] as TaskPriority[]).map(p => (
                      <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Deadline</label>
                <input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Description optionnelle..."
                  rows={2}
                  className="input resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">Annuler</button>
                <button type="submit" disabled={saving || !form.title.trim()} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Créer la tâche
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
