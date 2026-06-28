import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { redirect }      from 'next/navigation'
import { formatDate, cn } from '@/lib/utils'
import { FileText, Calendar, Clock, CheckCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Mon espace' }

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  idee:         { label: 'Idée',         cls: 'bg-gray-100  text-gray-600'   },
  en_redaction: { label: 'En rédaction', cls: 'bg-blue-100  text-blue-700'   },
  pret:         { label: 'Prêt',         cls: 'bg-amber-100 text-amber-700'  },
  approuve:     { label: 'Approuvé',     cls: 'bg-green-100 text-green-700'  },
  refuse:       { label: 'Refusé',       cls: 'bg-red-100   text-red-700'    },
  draft:        { label: 'Brouillon',    cls: 'bg-gray-100  text-gray-600'   },
  review:       { label: 'En révision',  cls: 'bg-purple-100 text-purple-700'},
  publie:       { label: 'Publié',       cls: 'bg-green-100 text-green-700'  },
}
const PRIORITY_CFG: Record<string, { label: string; cls: string }> = {
  basse:   { label: 'Basse',   cls: 'text-gray-400'  },
  normale: { label: 'Normale', cls: 'text-blue-500'  },
  haute:   { label: 'Haute',   cls: 'text-amber-500' },
  urgente: { label: 'Urgente', cls: 'text-red-500'   },
}
const MONTHS_FR = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

export default async function MonEspacePage() {
  const ctx = await getOrgContext()
  if (!ctx) redirect('/auth/login')

  const supabase  = await createClient()
  const userId    = ctx.userId
  const ownerId   = ctx.dataOwnerId

  // Contenus assignés à ce membre
  const { data: contents } = await supabase
    .from('content_pieces')
    .select('id, title, type, platform, status, scheduled_at, client:clients(name)')
    .eq('user_id', ownerId)
    .eq('assigned_user_id', userId)
    .not('status', 'in', '(approuve,publie)')
    .order('created_at', { ascending: false })

  // Projets assignés à ce membre (via assigned_to texte)
  const { data: projects } = await supabase
    .from('projects')
    .select('id, title, status, priority, deadline, client:clients(name)')
    .eq('user_id', ownerId)
    .not('status', 'in', '(termine,annule)')
    .order('deadline', { ascending: true, nullsFirst: false })
    .limit(20)

  // Événements calendrier à venir (tournages / publications)
  const today = new Date().toISOString().split('T')[0]
  const { data: events } = await supabase
    .from('calendar_events')
    .select('id, title, type, date, location, platform')
    .eq('user_id', ownerId)
    .gte('date', today)
    .order('date', { ascending: true })
    .limit(10)

  const done    = (contents ?? []).filter(c => c.status === 'approuve' || c.status === 'publie').length
  const pending = (contents ?? []).length

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Mon espace</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Bonjour {ctx.userName} — voici vos tâches assignées
        </p>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{pending}</p>
          <p className="text-xs text-gray-500 mt-0.5">Contenus à produire</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{(projects ?? []).filter(p => p.priority === 'urgente' || p.priority === 'haute').length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Tâches prioritaires</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{(events ?? []).length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Événements à venir</p>
        </div>
      </div>

      {/* ── Contenus assignés ──────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-auchu-500" />
          <h2 className="font-semibold text-gray-900">Mes contenus à produire</h2>
          <span className="text-xs text-gray-400 ml-auto">{pending} en cours</span>
        </div>

        {(contents ?? []).length === 0 ? (
          <div className="card text-center py-10">
            <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Aucun contenu assigné pour l'instant.</p>
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Titre</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Client</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Statut</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Planifié</th>
                </tr>
              </thead>
              <tbody>
                {(contents ?? []).map(c => {
                  const sc = STATUS_CFG[c.status] ?? STATUS_CFG.draft
                  const client = c.client as unknown as { name: string } | null
                  return (
                    <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900">{c.title}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{client?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', sc.cls)}>
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {c.scheduled_at ? formatDate(c.scheduled_at) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Événements à venir ─────────────────────────────────────────────── */}
      {(events ?? []).length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-auchu-500" />
            <h2 className="font-semibold text-gray-900">Calendrier à venir</h2>
          </div>
          <div className="space-y-2">
            {(events ?? []).map(ev => {
              const d   = new Date(ev.date)
              const isTournage = ev.type === 'tournage'
              return (
                <div
                  key={ev.id}
                  className="flex items-center gap-4 bg-white border border-gray-100 rounded-xl px-4 py-3"
                >
                  <div className={cn(
                    'w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 font-semibold',
                    isTournage ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-coral-600'
                  )} style={!isTournage ? { color: '#f95640' } : undefined}>
                    <span className="text-xs uppercase tracking-wide">{MONTHS_FR[d.getMonth()]}</span>
                    <span className="text-lg leading-none">{d.getDate()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{ev.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn(
                        'text-xs font-medium',
                        isTournage ? 'text-blue-600' : 'text-gray-500'
                      )} style={!isTournage ? { color: '#f95640' } : undefined}>
                        {isTournage ? 'Tournage' : 'Publication'}
                      </span>
                      {ev.location && <span className="text-xs text-gray-400">· {ev.location}</span>}
                      {ev.platform && <span className="text-xs text-gray-400">· {ev.platform}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                    <Clock className="w-3 h-3" />
                    {formatDate(ev.date)}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Projets (en cours) ─────────────────────────────────────────────── */}
      {(projects ?? []).length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-auchu-500" />
            <h2 className="font-semibold text-gray-900">Projets en cours</h2>
          </div>
          <div className="space-y-2">
            {(projects ?? []).map(p => {
              const client = p.client as unknown as { name: string } | null
              const pc = PRIORITY_CFG[p.priority] ?? PRIORITY_CFG.normale
              const isUrgent = p.priority === 'urgente' || p.priority === 'haute'
              return (
                <div
                  key={p.id}
                  className={cn(
                    'flex items-center gap-4 bg-white border rounded-xl px-4 py-3',
                    isUrgent ? 'border-amber-200' : 'border-gray-100'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{p.title}</p>
                    {client && <p className="text-xs text-gray-400 mt-0.5">{client.name}</p>}
                  </div>
                  <span className={cn('text-xs font-semibold flex-shrink-0', pc.cls)}>{pc.label}</span>
                  {p.deadline && (
                    <span className={cn(
                      'text-xs flex-shrink-0',
                      new Date(p.deadline) < new Date() ? 'text-red-500 font-medium' : 'text-gray-400'
                    )}>
                      {formatDate(p.deadline)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
