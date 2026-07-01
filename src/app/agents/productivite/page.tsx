'use client'

import { useState } from 'react'
import { Brain, Plus, X, Calendar } from 'lucide-react'

interface ClientRow {
  id: string
  name: string
  deliverable: string
  priority: 'urgent' | 'semaine' | 'mois'
}

interface DayBlock {
  heure: string
  duree: string
  titre: string
  client: string
  detail: string
  priorite: 'haute' | 'moyenne' | 'basse'
  type: 'creation' | 'admin' | 'reunion' | 'review' | 'pause'
}

const TYPE_CONFIG = {
  creation: { label: 'Création', color: 'badge-blue' },
  admin:    { label: 'Admin',    color: 'badge-gray' },
  reunion:  { label: 'Réunion',  color: 'badge-amber' },
  review:   { label: 'Révision', color: 'badge-purple' },
  pause:    { label: 'Pause',    color: 'badge-gray' },
}

const PRIORITY_DOT = {
  haute:   'bg-red-400',
  moyenne: 'bg-amber-400',
  basse:   'bg-green-400',
}

export default function AgentProductivitePage() {
  const [clients, setClients] = useState<ClientRow[]>([
    { id: '1', name: '', deliverable: '', priority: 'semaine' },
  ])
  const [notes, setNotes] = useState('')
  const [startTime, setStartTime] = useState('9h00')
  const [workStyle, setWorkStyle] = useState('Équilibré')
  const [loading, setLoading] = useState(false)
  const [plan, setPlan] = useState<{ stats: any; blocs: DayBlock[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  function addClient() {
    setClients((prev) => [...prev, { id: Date.now().toString(), name: '', deliverable: '', priority: 'semaine' }])
  }

  function removeClient(id: string) {
    if (clients.length > 1) setClients((prev) => prev.filter((c) => c.id !== id))
  }

  function updateClient(id: string, field: keyof ClientRow, value: string) {
    setClients((prev) => prev.map((c) => c.id === id ? { ...c, [field]: value } : c))
  }

  async function generatePlan() {
    const validClients = clients.filter((c) => c.name.trim() || c.deliverable.trim())
    setError(null)
    setLoading(true)
    setPlan(null)

    try {
      const res = await fetch('/api/agents/productivite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clients: validClients, notes, startTime, workStyle }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPlan(data.plan)
    } catch (e: any) {
      setError(e.message || 'Erreur lors de la génération.')
    }
    setLoading(false)
  }

  const today = new Date().toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
            <Brain className="w-4 h-4 text-amber-600" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Agent productivité</h1>
        </div>
        <p className="text-sm text-gray-500 capitalize">{today}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          {/* Clients + livrables */}
          <div className="card space-y-3">
            <label className="label">Clients et livrables en attente</label>

            {clients.map((client) => (
              <div key={client.id} className="flex flex-col sm:flex-row gap-2 pb-3 sm:pb-0 border-b border-gray-100 sm:border-0 last:border-0 last:pb-0">
                <input
                  className="input text-sm w-full sm:w-[130px] sm:flex-none"
                  placeholder="Client"
                  value={client.name}
                  onChange={(e) => updateClient(client.id, 'name', e.target.value)}
                />
                <input
                  className="input text-sm w-full sm:flex-1"
                  placeholder="Livrable(s) attendu(s)"
                  value={client.deliverable}
                  onChange={(e) => updateClient(client.id, 'deliverable', e.target.value)}
                />
                <div className="flex gap-2">
                  <select
                    className="select text-xs flex-1 sm:flex-none sm:w-[110px]"
                    value={client.priority}
                    onChange={(e) => updateClient(client.id, 'priority', e.target.value as any)}
                  >
                    <option value="urgent">Urgent</option>
                    <option value="semaine">Cette semaine</option>
                    <option value="mois">Ce mois</option>
                  </select>
                  <button
                    onClick={() => removeClient(client.id)}
                    className="p-2 min-h-[44px] min-w-[44px] text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 flex-shrink-0"
                    aria-label="Retirer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            <button onClick={addClient} className="btn-ghost text-xs w-full border border-dashed border-gray-200">
              <Plus className="w-3.5 h-3.5" />
              Ajouter un client
            </button>
          </div>

          {/* Notes */}
          <div className="card">
            <label className="label">Notes / contexte du jour</label>
            <textarea
              className="textarea"
              rows={3}
              placeholder="ex: réunion à 14h, deadline vendredi pour client X, besoin de terminer les rapports mensuels..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button onClick={generatePlan} disabled={loading} className="btn-primary w-full justify-center py-3">
            {loading ? <span className="spinner" /> : <Calendar className="w-4 h-4" />}
            {loading ? 'L\'agent planifie...' : 'Planifier ma journée'}
          </button>
        </div>

        {/* Préférences */}
        <div className="space-y-3">
          <div className="card">
            <label className="label">Début de journée</label>
            <select className="select" value={startTime} onChange={(e) => setStartTime(e.target.value)}>
              <option>7h00</option>
              <option>8h00</option>
              <option>9h00</option>
              <option>10h00</option>
            </select>
          </div>

          <div className="card">
            <label className="label">Style de travail</label>
            <div className="space-y-1.5">
              {['Deep focus (blocs longs)', 'Équilibré', 'Multitâche (petits blocs)'].map((s) => (
                <button
                  key={s}
                  onClick={() => setWorkStyle(s)}
                  className={`w-full text-left px-3 py-2 min-h-[44px] rounded-lg text-xs transition-colors ${
                    workStyle === s
                      ? 'bg-amber-50 text-amber-800 font-medium border border-amber-200'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Plan généré */}
      {plan && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { val: plan.stats?.clients, label: 'Clients' },
              { val: plan.stats?.blocs, label: 'Blocs' },
              { val: `${Math.round(plan.stats?.heures_focus || 0)}h`, label: 'Focus' },
            ].map((s) => (
              <div key={s.label} className="card-sm text-center">
                <p className="text-xl font-semibold text-gray-900">{s.val}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Timeline */}
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Plan de journée</h2>
            <div className="space-y-0">
              {plan.blocs.map((bloc, i) => {
                const typeConf = TYPE_CONFIG[bloc.type] || TYPE_CONFIG.admin
                const dotColor = PRIORITY_DOT[bloc.priorite] || 'bg-gray-300'
                return (
                  <div key={i} className="flex gap-3 pb-4 last:pb-0">
                    <div className="flex flex-col items-center">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${dotColor}`} />
                      {i < plan.blocs.length - 1 && (
                        <div className="w-0.5 bg-gray-100 flex-1 mt-1" />
                      )}
                    </div>
                    <div className="flex-1 pb-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">{bloc.heure} · {bloc.duree}</p>
                          <p className="text-sm font-medium text-gray-900">{bloc.titre}</p>
                          {bloc.client && (
                            <p className="text-xs text-auchu-600 font-medium">{bloc.client}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{bloc.detail}</p>
                        </div>
                        <span className={`badge text-xs flex-shrink-0 ${typeConf.color}`}>
                          {typeConf.label}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
