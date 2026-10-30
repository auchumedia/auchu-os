'use client'

import { useState } from 'react'
import { Plus, Calendar, Trash2, X, Loader2, FolderKanban } from 'lucide-react'
import { Client, ProjectStatus, ProjectPriority } from '@/types'
import { cn, formatDate } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientSummary {
  id: string
  name: string
  company: string | null
}

interface ProjectRow {
  id: string
  title: string
  description: string | null
  status: ProjectStatus
  priority: ProjectPriority
  deadline: string | null
  tags: string[]
  client_id: string | null
  client?: ClientSummary | null
  created_at: string
}

interface KanbanBoardProps {
  initialProjects: ProjectRow[]
  clients: Pick<Client, 'id' | 'name' | 'company'>[]
}

// ─── Config ───────────────────────────────────────────────────────────────────

const COLUMNS: {
  id: ProjectStatus
  label: string
  headerColor: string
  bg: string
  border: string
  dotColor: string
  ringColor: string
  emptyText: string
}[] = [
  {
    id: 'todo',
    label: 'À faire',
    headerColor: 'text-gray-700',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    dotColor: 'bg-gray-400',
    ringColor: 'ring-gray-300',
    emptyText: 'Glisse un projet ici',
  },
  {
    id: 'en_cours',
    label: 'En cours',
    headerColor: 'text-blue-700',
    bg: 'bg-blue-50/40',
    border: 'border-blue-200',
    dotColor: 'bg-blue-500',
    ringColor: 'ring-blue-300',
    emptyText: 'Glisse un projet ici',
  },
  {
    id: 'review',
    label: 'Révision',
    headerColor: 'text-amber-700',
    bg: 'bg-amber-50/40',
    border: 'border-amber-200',
    dotColor: 'bg-amber-500',
    ringColor: 'ring-amber-300',
    emptyText: 'Glisse un projet ici',
  },
  {
    id: 'termine',
    label: 'Terminé',
    headerColor: 'text-green-700',
    bg: 'bg-green-50/40',
    border: 'border-green-200',
    dotColor: 'bg-green-500',
    ringColor: 'ring-green-300',
    emptyText: 'Glisse un projet ici',
  },
]

const PRIORITIES: { value: ProjectPriority; label: string; chipClass: string }[] = [
  { value: 'basse',   label: 'Basse',   chipClass: 'bg-gray-100  text-gray-500' },
  { value: 'normale', label: 'Normale', chipClass: 'bg-blue-50   text-blue-600' },
  { value: 'haute',   label: 'Haute',   chipClass: 'bg-amber-50  text-amber-600' },
  { value: 'urgente', label: 'Urgente', chipClass: 'bg-red-50    text-red-600' },
]

// ─── Main Component ───────────────────────────────────────────────────────────

export default function KanbanBoard({ initialProjects, clients }: KanbanBoardProps) {
  const [projects, setProjects] = useState<ProjectRow[]>(initialProjects)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<ProjectStatus | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<{
    title: string
    description: string
    client_id: string
    priority: ProjectPriority
    status: ProjectStatus
    deadline: string
    tags: string
  }>({
    title: '',
    description: '',
    client_id: '',
    priority: 'normale',
    status: 'todo',
    deadline: '',
    tags: '',
  })

  const openModal = (defaultStatus: ProjectStatus = 'todo') => {
    setForm({
      title: '',
      description: '',
      client_id: '',
      priority: 'normale',
      status: defaultStatus,
      deadline: '',
      tags: '',
    })
    setIsModalOpen(true)
  }

  // ─── Drag & Drop ───────────────────────────────────────────────────────────

  const handleDragStart = (e: React.DragEvent, projectId: string) => {
    e.dataTransfer.setData('projectId', projectId)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingId(projectId)
  }

  const handleDragEnd = () => {
    setDraggingId(null)
    setDragOverColumn(null)
  }

  const handleDragOver = (e: React.DragEvent, columnId: ProjectStatus) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(columnId)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (!(e.currentTarget as Element).contains(e.relatedTarget as Node)) {
      setDragOverColumn(null)
    }
  }

  const handleDrop = async (e: React.DragEvent, newStatus: ProjectStatus) => {
    e.preventDefault()
    const projectId = e.dataTransfer.getData('projectId')
    setDraggingId(null)
    setDragOverColumn(null)

    const project = projects.find(p => p.id === projectId)
    if (!project || project.status === newStatus) return

    // Optimistic update
    setProjects(prev =>
      prev.map(p => p.id === projectId ? { ...p, status: newStatus } : p)
    )

    const res = await fetch(`/api/projets/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })

    if (!res.ok) {
      // Revert on error
      setProjects(prev =>
        prev.map(p => p.id === projectId ? { ...p, status: project.status } : p)
      )
    }
  }

  // ─── Create ────────────────────────────────────────────────────────────────

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)

    const tags = form.tags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)

    const res = await fetch('/api/projets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title.trim(),
        description: form.description.trim() || null,
        client_id: form.client_id || null,
        priority: form.priority,
        status: form.status,
        deadline: form.deadline || null,
        tags,
      }),
    })

    const json = await res.json()
    setSaving(false)

    if (res.ok && json.data) {
      setProjects(prev => [json.data, ...prev])
      setIsModalOpen(false)
    }
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async (projectId: string) => {
    setDeletingId(projectId)
    const res = await fetch(`/api/projets/${projectId}`, { method: 'DELETE' })
    if (res.ok) {
      setProjects(prev => prev.filter(p => p.id !== projectId))
    }
    setDeletingId(null)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const totalActive = projects.filter(p => p.status !== 'termine').length

  return (
    <>
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Projets</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {projects.length === 0
              ? 'Aucun projet pour l\'instant'
              : `${totalActive} actif${totalActive !== 1 ? 's' : ''} · ${projects.length} au total`}
          </p>
        </div>
        <button onClick={() => openModal('todo')} className="btn-primary">
          <Plus className="w-4 h-4" />
          Nouveau projet
        </button>
      </div>

      {/* Kanban grid */}
      {projects.length === 0 ? (
        <div className="card text-center py-20">
          <FolderKanban className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <h3 className="text-sm font-medium text-gray-700 mb-1">Aucun projet encore</h3>
          <p className="text-xs text-gray-400 mb-4">Crée ton premier projet pour commencer</p>
          <button onClick={() => openModal('todo')} className="btn-primary inline-flex">
            <Plus className="w-4 h-4" />
            Créer un projet
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-3" style={{ minHeight: 540 }}>
          {COLUMNS.map(col => {
            const colProjects = projects.filter(p => p.status === col.id)
            const isOver = dragOverColumn === col.id

            return (
              <div
                key={col.id}
                className={cn(
                  'flex flex-col rounded-xl border transition-all duration-150',
                  col.bg,
                  col.border,
                  isOver && `ring-2 ${col.ringColor} ring-offset-1`
                )}
                onDragOver={e => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, col.id)}
              >
                {/* Column header */}
                <div className={cn('flex items-center justify-between px-3 py-2.5 border-b', col.border)}>
                  <div className="flex items-center gap-2">
                    <span className={cn('w-2 h-2 rounded-full flex-shrink-0', col.dotColor)} />
                    <span className={cn('text-xs font-semibold tracking-wide', col.headerColor)}>
                      {col.label}
                    </span>
                    <span className="text-xs text-gray-400 bg-white border border-gray-100 rounded-full px-1.5 leading-5 font-medium">
                      {colProjects.length}
                    </span>
                  </div>
                  <button
                    onClick={() => openModal(col.id)}
                    className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-white/80 transition-colors"
                    title={`Ajouter dans ${col.label}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Cards */}
                <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                  {colProjects.length === 0 ? (
                    <div className="py-10 text-center">
                      <p className="text-xs text-gray-300 select-none">{col.emptyText}</p>
                    </div>
                  ) : (
                    colProjects.map(project => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        isDragging={draggingId === project.id}
                        isDeleting={deletingId === project.id}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onDelete={handleDelete}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* New project modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)}
          />

          {/* Panel */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Nouveau projet</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Titre <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Nom du projet..."
                  className="input"
                  required
                  autoFocus
                />
              </div>

              {/* Client + Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Client</label>
                  <select
                    value={form.client_id}
                    onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
                    className="select"
                  >
                    <option value="">Aucun client</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Colonne</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as ProjectStatus }))}
                    className="select"
                  >
                    {COLUMNS.map(col => (
                      <option key={col.id} value={col.id}>{col.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Priority + Deadline */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Priorité</label>
                  <select
                    value={form.priority}
                    onChange={e => setForm(f => ({ ...f, priority: e.target.value as ProjectPriority }))}
                    className="select"
                  >
                    {PRIORITIES.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
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

              {/* Description */}
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

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Tags{' '}
                  <span className="text-gray-400 font-normal text-xs">(séparés par virgule)</span>
                </label>
                <input
                  type="text"
                  value={form.tags}
                  onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                  placeholder="design, contenu, réseaux..."
                  className="input"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving || !form.title.trim()}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Plus className="w-4 h-4" />}
                  Créer le projet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Project Card ─────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  isDragging,
  isDeleting,
  onDragStart,
  onDragEnd,
  onDelete,
}: {
  project: ProjectRow
  isDragging: boolean
  isDeleting: boolean
  onDragStart: (e: React.DragEvent, id: string) => void
  onDragEnd: () => void
  onDelete: (id: string) => void
}) {
  const priority = PRIORITIES.find(p => p.value === project.priority)
  const isOverdue =
    project.deadline &&
    new Date(project.deadline) < new Date() &&
    project.status !== 'termine'

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, project.id)}
      onDragEnd={onDragEnd}
      className={cn(
        'group relative bg-white rounded-lg border border-gray-200 p-3',
        'shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing select-none',
        'transition-all duration-150',
        isDragging && 'opacity-40 rotate-1 scale-[1.03] shadow-lg',
        isDeleting && 'opacity-40 pointer-events-none'
      )}
    >
      {/* Delete button */}
      <button
        onClick={e => { e.stopPropagation(); onDelete(project.id) }}
        className={cn(
          'absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100',
          'text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all'
        )}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {/* Title */}
      <p className="text-sm font-medium text-gray-900 leading-snug pr-6">{project.title}</p>

      {/* Client */}
      {project.client && (
        <p className="text-xs text-gray-400 mt-0.5 truncate">{project.client.name}</p>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
        {priority && project.priority !== 'normale' && (
          <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', priority.chipClass)}>
            {priority.label}
          </span>
        )}
        {project.deadline && (
          <span className={cn(
            'flex items-center gap-1 text-xs',
            isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'
          )}>
            <Calendar className="w-3 h-3 flex-shrink-0" />
            {formatDate(project.deadline)}
          </span>
        )}
      </div>

      {/* Tags */}
      {project.tags && project.tags.length > 0 && (
        <div className="flex gap-1 mt-2 flex-wrap">
          {project.tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-xs text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">
              {tag}
            </span>
          ))}
          {project.tags.length > 3 && (
            <span className="text-xs text-gray-400 py-0.5">+{project.tags.length - 3}</span>
          )}
        </div>
      )}
    </div>
  )
}
