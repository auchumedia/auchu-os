'use client'

import { useMemo, useState } from 'react'
import { Plus, Calendar, Trash2, X, Loader2, ListTodo, ArrowRight, Pencil, CheckCheck } from 'lucide-react'
import type { Task, TaskPriority, TaskStatus } from '@/types'
import { cn, formatDate, PRIORITY_LABELS, TASK_STATUS_LABELS } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MemberOption { id: string; name: string }
interface ClientOption { id: string; name: string }

interface TachesBoardProps {
  view: 'org' | 'team' | 'perso'
  currentUserId: string
  canCreate: boolean
  initialTasks: Task[]
  members: MemberOption[]
  clients: ClientOption[]
}

// ─── Config ───────────────────────────────────────────────────────────────────

const COLUMNS: { id: TaskStatus; dotColor: string; bg: string; border: string; ringColor: string }[] = [
  { id: 'a_faire',  dotColor: 'bg-gray-400',  bg: 'bg-gray-50',      border: 'border-gray-200',  ringColor: 'ring-gray-300'  },
  { id: 'en_cours', dotColor: 'bg-blue-500',  bg: 'bg-blue-50/40',   border: 'border-blue-200',  ringColor: 'ring-blue-300'  },
  { id: 'termine',  dotColor: 'bg-green-500', bg: 'bg-green-50/40',  border: 'border-green-200', ringColor: 'ring-green-300' },
]

const PRIORITIES: { value: TaskPriority; chipClass: string }[] = [
  { value: 'basse',   chipClass: 'bg-gray-100  text-gray-500' },
  { value: 'normale', chipClass: 'bg-blue-50   text-blue-600' },
  { value: 'haute',   chipClass: 'bg-amber-50  text-amber-600' },
  { value: 'urgente', chipClass: 'bg-red-50    text-red-600' },
]

// 'approuve' n'avance jamais via ce bouton générique — c'est une action
// dédiée ("Approuver"), pas une étape du cycle a_faire → en_cours → termine.
const NEXT_STATUS: Record<TaskStatus, TaskStatus | null> = {
  a_faire: 'en_cours',
  en_cours: 'termine',
  termine: null,
  approuve: null,
}
const NEXT_STATUS_LABEL: Record<TaskStatus, string> = {
  a_faire: 'Démarrer',
  en_cours: 'Terminer',
  termine: '',
  approuve: '',
}

type FormState = {
  title: string
  description: string
  assigned_to: string
  client_id: string
  priority: TaskPriority
  status: TaskStatus
  deadline: string
}

const EMPTY_FORM: FormState = {
  title: '', description: '', assigned_to: '', client_id: '',
  priority: 'normale', status: 'a_faire', deadline: '',
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TachesBoard({ view, currentUserId, canCreate, initialTasks, members, clients }: TachesBoardProps) {
  const [tasks, setTasks]       = useState<Task[]>(initialTasks)
  const [draggingId, setDraggingId]         = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null)
  const [deletingId, setDeletingId]         = useState<string | null>(null)

  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all')
  const [memberFilter, setMemberFilter]     = useState<'all' | string>('all')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const memberName = useMemo(() => new Map(members.map(m => [m.id, m.name])), [members])

  const openCreateModal = (defaultStatus: TaskStatus = 'a_faire') => {
    setEditingTask(null)
    setForm({ ...EMPTY_FORM, status: defaultStatus })
    setFormError(null)
    setIsModalOpen(true)
  }

  const openEditModal = (task: Task) => {
    setEditingTask(task)
    setForm({
      title: task.title,
      description: task.description ?? '',
      assigned_to: task.assigned_to ?? '',
      client_id: task.client_id ?? '',
      priority: task.priority,
      status: task.status,
      deadline: task.deadline ?? '',
    })
    setFormError(null)
    setIsModalOpen(true)
  }

  // ─── Filtrage + regroupement ─────────────────────────────────────────────

  const filteredTasks = tasks.filter(t => {
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
    if (memberFilter !== 'all' && t.assigned_to !== memberFilter) return false
    return true
  })

  // ─── Drag & Drop ───────────────────────────────────────────────────────────

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingId(taskId)
  }
  const handleDragEnd = () => { setDraggingId(null); setDragOverColumn(null) }
  const handleDragOver = (e: React.DragEvent, columnId: TaskStatus) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(columnId)
  }
  const handleDragLeave = (e: React.DragEvent) => {
    if (!(e.currentTarget as Element).contains(e.relatedTarget as Node)) setDragOverColumn(null)
  }

  async function updateStatus(taskId: string, newStatus: TaskStatus) {
    const task = tasks.find(t => t.id === taskId)
    if (!task || task.status === newStatus) return

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))

    const res = await fetch(`/api/taches/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })

    if (!res.ok) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: task.status } : t))
    }
  }

  const handleDrop = async (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('taskId')
    setDraggingId(null)
    setDragOverColumn(null)
    await updateStatus(taskId, newStatus)
  }

  // ─── Create / Update ───────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    setFormError(null)

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      assigned_to: form.assigned_to || null,
      client_id: form.client_id || null,
      priority: form.priority,
      status: form.status,
      deadline: form.deadline || null,
    }

    const res = editingTask
      ? await fetch(`/api/taches/${editingTask.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
      : await fetch('/api/taches', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })

    const json = await res.json()
    setSaving(false)

    if (!res.ok) {
      setFormError(json.error || 'Une erreur est survenue')
      return
    }

    if (editingTask) {
      setTasks(prev => prev.map(t => t.id === editingTask.id ? json.data : t))
    } else {
      setTasks(prev => [json.data, ...prev])
    }
    setIsModalOpen(false)
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async (taskId: string) => {
    setDeletingId(taskId)
    const res = await fetch(`/api/taches/${taskId}`, { method: 'DELETE' })
    if (res.ok) setTasks(prev => prev.filter(t => t.id !== taskId))
    setDeletingId(null)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const totalActive = tasks.filter(t => t.status !== 'termine' && t.status !== 'approuve').length
  const showMemberFilter = view !== 'perso' && members.length > 0
  const groupByMember = view === 'org'

  // Édition complète (titre/description/priorité/deadline/assigné à) :
  // réservée au créateur (assigned_by) ou owner/director (cf. migration 035).
  // Changer le statut : créateur, owner/director, OU la personne assignée.
  // Supprimer : édition complète OU (tâche approuvée ET on est l'assigné —
  // migration 036). Approuver : édition complète OU (vue équipe ET tâche
  // "terminée" — un chef_equipe gère l'approbation de son équipe, la RLS
  // fait le vrai filtrage précis par tâche/membre).
  const isOwnerOrDirector = view === 'org'
  const canEditTask         = (task: Task) => isOwnerOrDirector || task.assigned_by === currentUserId
  const canChangeStatusTask = (task: Task) => canEditTask(task) || task.assigned_to === currentUserId
  const canDeleteTask       = (task: Task) => canEditTask(task) || (task.status === 'approuve' && task.assigned_to === currentUserId)
  const canApproveTask      = (task: Task) => task.status === 'termine' && (isOwnerOrDirector || view === 'team')

  const title = view === 'org' ? 'Tâches' : view === 'team' ? 'Tâches de l\'équipe' : 'Mes tâches'

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {tasks.length === 0
              ? 'Aucune tâche pour l\'instant'
              : `${totalActive} active${totalActive !== 1 ? 's' : ''} · ${tasks.length} au total`}
          </p>
        </div>
        {canCreate && (
          <button onClick={() => openCreateModal('a_faire')} className="btn-primary">
            <Plus className="w-4 h-4" />
            Nouvelle tâche
          </button>
        )}
      </div>

      {/* Filtres */}
      {(tasks.length > 0) && (
        <div className="flex items-center gap-2 flex-wrap">
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value as any)} className="select w-auto text-sm">
            <option value="all">Toutes priorités</option>
            {PRIORITIES.map(p => <option key={p.value} value={p.value}>{PRIORITY_LABELS[p.value]}</option>)}
          </select>
          {showMemberFilter && (
            <select value={memberFilter} onChange={e => setMemberFilter(e.target.value)} className="select w-auto text-sm">
              <option value="all">Tous les membres</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          )}
        </div>
      )}

      {/* Kanban */}
      {tasks.length === 0 ? (
        <div className="card text-center py-20">
          <ListTodo className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <h3 className="text-sm font-medium text-gray-700 mb-1">Aucune tâche encore</h3>
          <p className="text-xs text-gray-400 mb-4">
            {canCreate ? 'Crée la première tâche pour commencer' : 'Aucune tâche ne t\'est assignée pour l\'instant'}
          </p>
          {canCreate && (
            <button onClick={() => openCreateModal('a_faire')} className="btn-primary inline-flex">
              <Plus className="w-4 h-4" />
              Créer une tâche
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3" style={{ minHeight: 540 }}>
          {COLUMNS.map(col => {
            // Une tâche 'approuve' reste dans la colonne "Terminé" — pas de
            // 4e colonne (cf. migration 036).
            const colTasks = filteredTasks.filter(t =>
              t.status === col.id || (col.id === 'termine' && t.status === 'approuve')
            )
            const isOver = dragOverColumn === col.id

            const grouped = groupByMember
              ? groupTasksByMember(colTasks, memberName)
              : [{ key: '__all__', label: null, tasks: colTasks }]

            return (
              <div
                key={col.id}
                className={cn(
                  'flex flex-col rounded-xl border transition-all duration-150',
                  col.bg, col.border,
                  isOver && `ring-2 ${col.ringColor} ring-offset-1`
                )}
                onDragOver={e => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, col.id)}
              >
                <div className={cn('flex items-center justify-between px-3 py-2.5 border-b', col.border)}>
                  <div className="flex items-center gap-2">
                    <span className={cn('w-2 h-2 rounded-full flex-shrink-0', col.dotColor)} />
                    <span className="text-xs font-semibold tracking-wide text-gray-700">{TASK_STATUS_LABELS[col.id]}</span>
                    <span className="text-xs text-gray-400 bg-white border border-gray-100 rounded-full px-1.5 leading-5 font-medium">
                      {colTasks.length}
                    </span>
                  </div>
                  {canCreate && (
                    <button
                      onClick={() => openCreateModal(col.id)}
                      className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-white/80 transition-colors"
                      title={`Ajouter dans ${TASK_STATUS_LABELS[col.id]}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex-1 p-2 space-y-3 overflow-y-auto">
                  {colTasks.length === 0 ? (
                    <div className="py-10 text-center">
                      <p className="text-xs text-gray-300 select-none">Glisse une tâche ici</p>
                    </div>
                  ) : (
                    grouped.map(group => (
                      <div key={group.key} className="space-y-2">
                        {group.label && (
                          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-1">
                            {group.label}
                          </p>
                        )}
                        <div className="space-y-2">
                          {group.tasks.map(task => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              assigneeName={task.assigned_to ? memberName.get(task.assigned_to) : undefined}
                              canEdit={canEditTask(task)}
                              canDelete={canDeleteTask(task)}
                              canChangeStatus={canChangeStatusTask(task)}
                              canApprove={canApproveTask(task)}
                              isDragging={draggingId === task.id}
                              isDeleting={deletingId === task.id}
                              onDragStart={handleDragStart}
                              onDragEnd={handleDragEnd}
                              onDelete={handleDelete}
                              onEdit={openEditModal}
                              onAdvance={updateStatus}
                              onApprove={() => updateStatus(task.id, 'approuve')}
                            />
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">
                {editingTask ? 'Modifier la tâche' : 'Nouvelle tâche'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-700 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-3 py-2">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Titre <span className="text-red-400">*</span>
                </label>
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
                  <select
                    value={form.assigned_to}
                    onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                    className="select"
                  >
                    <option value="">Non assigné</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Client lié</label>
                  <select
                    value={form.client_id}
                    onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
                    className="select"
                  >
                    <option value="">Aucun client</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Priorité</label>
                  <select
                    value={form.priority}
                    onChange={e => setForm(f => ({ ...f, priority: e.target.value as TaskPriority }))}
                    className="select"
                  >
                    {PRIORITIES.map(p => <option key={p.value} value={p.value}>{PRIORITY_LABELS[p.value]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Colonne</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as TaskStatus }))}
                    className="select"
                  >
                    {COLUMNS.map(col => <option key={col.id} value={col.id}>{TASK_STATUS_LABELS[col.id]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Deadline</label>
                  <input
                    type="date"
                    value={form.deadline}
                    onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                    className="input"
                  />
                </div>
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
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving || !form.title.trim()}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {editingTask ? 'Sauvegarder' : 'Créer la tâche'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Regroupement par membre ────────────────────────────────────────────────

function groupTasksByMember(tasks: Task[], memberName: Map<string, string>) {
  const groups = new Map<string, Task[]>()
  for (const t of tasks) {
    const key = t.assigned_to ?? '__unassigned__'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(t)
  }
  const entries = Array.from(groups.entries()).map(([key, list]) => ({
    key,
    label: key === '__unassigned__' ? 'Non assigné' : (memberName.get(key) ?? 'Membre'),
    tasks: list,
  }))
  entries.sort((a, b) => {
    if (a.key === '__unassigned__') return 1
    if (b.key === '__unassigned__') return -1
    return a.label.localeCompare(b.label)
  })
  return entries
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  task, assigneeName, canEdit, canDelete, canChangeStatus, canApprove, isDragging, isDeleting,
  onDragStart, onDragEnd, onDelete, onEdit, onAdvance, onApprove,
}: {
  task: Task
  assigneeName?: string
  canEdit: boolean
  canDelete: boolean
  canChangeStatus: boolean
  canApprove: boolean
  isDragging: boolean
  isDeleting: boolean
  onDragStart: (e: React.DragEvent, id: string) => void
  onDragEnd: () => void
  onDelete: (id: string) => void
  onEdit: (task: Task) => void
  onAdvance: (id: string, status: TaskStatus) => void
  onApprove: () => void
}) {
  const priority = PRIORITIES.find(p => p.value === task.priority)
  const isDone = task.status === 'termine' || task.status === 'approuve'
  const isOverdue = task.deadline && new Date(task.deadline) < new Date(new Date().toDateString()) && !isDone
  const next = NEXT_STATUS[task.status]

  return (
    <div
      draggable={canChangeStatus}
      onDragStart={e => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      className={cn(
        'group relative bg-white rounded-lg border border-gray-200 p-3',
        'shadow-sm hover:shadow-md select-none',
        canChangeStatus ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
        'transition-all duration-150',
        isDragging && 'opacity-40 rotate-1 scale-[1.03] shadow-lg',
        isDeleting && 'opacity-40 pointer-events-none'
      )}
    >
      {(canEdit || canDelete) && (
        <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
          {canEdit && (
            <button onClick={e => { e.stopPropagation(); onEdit(task) }} className="p-1 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-50">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {canDelete && (
            <button onClick={e => { e.stopPropagation(); onDelete(task.id) }} className="p-1 rounded text-gray-300 hover:text-red-400 hover:bg-red-50">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      <p className="text-sm font-medium text-gray-900 leading-snug pr-10">{task.title}</p>

      {(task.client?.name || assigneeName) && (
        <p className="text-xs text-gray-400 mt-0.5 truncate">
          {task.client?.name}{task.client?.name && assigneeName ? ' · ' : ''}{assigneeName}
        </p>
      )}

      <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
        {priority && task.priority !== 'normale' && (
          <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', priority.chipClass)}>
            {PRIORITY_LABELS[task.priority]}
          </span>
        )}
        {task.deadline && (
          <span className={cn('flex items-center gap-1 text-xs', isOverdue ? 'text-red-500 font-medium' : 'text-gray-400')}>
            <Calendar className="w-3 h-3 flex-shrink-0" />
            {formatDate(task.deadline)}
          </span>
        )}
        {task.status === 'termine' && (
          <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-amber-50 text-amber-600">
            En attente d'approbation
          </span>
        )}
        {task.status === 'approuve' && (
          <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium bg-green-50 text-green-700">
            <CheckCheck className="w-3 h-3" />
            Approuvé
          </span>
        )}
      </div>

      {next && canChangeStatus && (
        <button
          onClick={e => { e.stopPropagation(); onAdvance(task.id, next) }}
          className="mt-2.5 w-full flex items-center justify-center gap-1 text-xs font-medium text-auchu-600 bg-auchu-50 hover:bg-auchu-100 rounded-md py-1.5 transition-colors"
        >
          {NEXT_STATUS_LABEL[task.status]}
          <ArrowRight className="w-3 h-3" />
        </button>
      )}

      {canApprove && (
        <button
          onClick={e => { e.stopPropagation(); onApprove() }}
          className="mt-2.5 w-full flex items-center justify-center gap-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-md py-1.5 transition-colors"
        >
          <CheckCheck className="w-3 h-3" />
          Approuver
        </button>
      )}
    </div>
  )
}
