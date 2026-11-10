'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Search, MoreHorizontal, ExternalLink, Copy, Check,
  Users, UserCheck, ListChecks, Film,
} from 'lucide-react'
import { cn, formatDate, getInitials, avatarColorFromName } from '@/lib/utils'

export interface ContactRow {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  logo_url: string | null
  status: string
  target: number
  delivered: number
  lastContent: { title: string; date: string } | null
  createdAt: string
  portalUrl: string | null
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  actif:    { label: 'Actif',    cls: 'badge-green' },
  prospect: { label: 'Prospect', cls: 'badge-blue'  },
  inactif:  { label: 'Inactif',  cls: 'badge-gray'  },
}

const STAT_ICONS = [Users, UserCheck, ListChecks, Film]

type Tab = 'tous' | 'actif' | 'inactif'

export default function ContactsTable({
  rows, stats,
}: {
  rows: ContactRow[]
  stats: { label: string; value: number }[]
}) {
  const [search, setSearch] = useState('')
  const [tab, setTab]       = useState<Tab>('tous')
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const counts = useMemo(() => ({
    tous:    rows.length,
    actif:   rows.filter(r => r.status === 'actif').length,
    inactif: rows.filter(r => r.status === 'inactif').length,
  }), [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (tab !== 'tous' && r.status !== tab) return false
      if (!q) return true
      return (
        r.name.toLowerCase().includes(q) ||
        (r.company ?? '').toLowerCase().includes(q) ||
        (r.email ?? '').toLowerCase().includes(q)
      )
    })
  }, [rows, tab, search])

  async function copyPortal(id: string, url: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${url}`)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {
      // Clipboard indisponible (contexte non sécurisé, permission refusée) —
      // pas bloquant, l'utilisateur peut toujours ouvrir le lien.
    }
    setOpenMenu(null)
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s, i) => {
          const Icon = STAT_ICONS[i] ?? Users
          return (
            <div key={s.label} className="card p-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 bg-auchu-50 text-auchu-600">
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-semibold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-400 mt-1">{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* Recherche + onglets */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un nom, une entreprise, un courriel…"
            className="input pl-9"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {([
            ['tous', 'Tous'], ['actif', 'Actifs'], ['inactif', 'Inactifs'],
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn('tab-pill', tab === key && 'active-blue')}
            >
              {label} <span className="opacity-60">({counts[key]})</span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-sm text-gray-400">Aucun contact ne correspond à cette recherche.</p>
        </div>
      ) : (
        <>
          {/* Mobile : cartes empilées */}
          <div className="md:hidden space-y-2">
            {filtered.map(r => (
              <ContactMobileCard key={r.id} row={r} />
            ))}
          </div>

          {/* Desktop : tableau */}
          {/* Pas de .table-wrapper (overflow-x-auto) : le menu "…" ouvre un
              dropdown en position absolue qui serait rogné par le scroll. */}
          <div className="hidden md:block border border-border-soft rounded-2xl bg-white shadow-sm">
            <table className="table">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Coordonnées</th>
                  <th>Statut</th>
                  <th>Progression du mois</th>
                  <th>Dernier contenu</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE.inactif
                  const pct = r.target > 0 ? Math.min(100, Math.round((r.delivered / r.target) * 100)) : 0
                  const complete = r.target > 0 && r.delivered >= r.target
                  return (
                    <tr key={r.id} className="relative">
                      <td>
                        <Link href={`/dashboard/clients/${r.id}`} className="flex items-center gap-3 group">
                          {r.logo_url ? (
                            <img src={r.logo_url} alt={r.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0', avatarColorFromName(r.name))}>
                              {getInitials(r.name)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 group-hover:text-auchu-600 truncate">{r.name}</p>
                            {r.company && <p className="text-xs text-gray-400 truncate">{r.company}</p>}
                          </div>
                        </Link>
                      </td>
                      <td>
                        <p className="text-gray-700 truncate max-w-[200px]">{r.email || '—'}</p>
                        <p className="text-xs text-gray-400">{r.phone || '—'}</p>
                      </td>
                      <td>
                        <span className={cn('badge', badge.cls)}>{badge.label}</span>
                      </td>
                      <td className="min-w-[140px]">
                        {r.target > 0 ? (
                          <div className="space-y-1">
                            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden w-28">
                              <div
                                className={cn('h-full rounded-full transition-all', complete ? 'bg-green-500' : 'bg-auchu-500')}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <p className="text-xs text-gray-500">{r.delivered} / {r.target}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Aucun objectif</span>
                        )}
                      </td>
                      <td>
                        {r.lastContent ? (
                          <>
                            <p className="text-gray-700 truncate max-w-[180px]">{r.lastContent.title}</p>
                            <p className="text-xs text-gray-400">{formatDate(r.lastContent.date)}</p>
                          </>
                        ) : (
                          <p className="text-xs text-gray-400">Créé le {formatDate(r.createdAt)}</p>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="relative inline-block">
                          <button
                            onClick={() => setOpenMenu(m => m === r.id ? null : r.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          {openMenu === r.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                              <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-border-soft shadow-lg rounded-xl py-1 w-48 text-left">
                                <Link
                                  href={`/dashboard/clients/${r.id}`}
                                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                  onClick={() => setOpenMenu(null)}
                                >
                                  Voir la fiche
                                </Link>
                                {r.portalUrl && (
                                  <>
                                    <button
                                      onClick={() => copyPortal(r.id, r.portalUrl!)}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                    >
                                      {copiedId === r.id ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                                      Copier le lien portail
                                    </button>
                                    <a
                                      href={r.portalUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      Ouvrir le portail
                                    </a>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function ContactMobileCard({ row: r }: { row: ContactRow }) {
  const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE.inactif
  const pct = r.target > 0 ? Math.min(100, Math.round((r.delivered / r.target) * 100)) : 0
  const complete = r.target > 0 && r.delivered >= r.target

  return (
    <Link href={`/dashboard/clients/${r.id}`} className="card block p-4 active:bg-gray-50 transition-colors">
      <div className="flex items-start gap-3">
        {r.logo_url ? (
          <img src={r.logo_url} alt={r.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0', avatarColorFromName(r.name))}>
            {getInitials(r.name)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-gray-900 truncate">{r.name}</p>
              {r.company && <p className="text-xs text-gray-400 truncate">{r.company}</p>}
            </div>
            <span className={cn('badge flex-shrink-0', badge.cls)}>{badge.label}</span>
          </div>
          <p className="text-xs text-gray-400 truncate mt-1">{r.email || r.phone || '—'}</p>
          {r.target > 0 ? (
            <div className="mt-2 space-y-1">
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div className={cn('h-full rounded-full', complete ? 'bg-green-500' : 'bg-auchu-500')} style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-gray-500">{r.delivered} / {r.target} ce mois</p>
            </div>
          ) : (
            <p className="text-xs text-gray-400 mt-2">Aucun objectif défini</p>
          )}
        </div>
      </div>
    </Link>
  )
}
