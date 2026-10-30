'use client'

import { useMemo, useState } from 'react'
import { Clock, Users, Briefcase, ListTodo, Download } from 'lucide-react'
import { cn, formatDuration, secondsToHours } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimeEntry {
  id: string
  member_id: string; member_name: string
  client_id: string | null; client_name: string | null
  task_id: string; task_title: string
  started_at: string; duration_seconds: number
}

interface Props {
  entries: TimeEntry[]
  members: { id: string; name: string }[]
  clients: { id: string; name: string }[]
}

const PERIODS = [
  { id: 'semaine', label: 'Cette semaine' },
  { id: 'mois',    label: 'Ce mois' },
  { id: 'dernier', label: 'Mois dernier' },
] as const
type Period = typeof PERIODS[number]['id']

// ─── Date range helpers ─────────────────────────────────────────────────────

function startOfWeek(d: Date) {
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1) - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function getRange(period: Period): { start: Date; end: Date } {
  const n = new Date()
  if (period === 'semaine') {
    const start = startOfWeek(n)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }
  if (period === 'dernier') {
    return {
      start: new Date(n.getFullYear(), n.getMonth() - 1, 1),
      end:   new Date(n.getFullYear(), n.getMonth(), 0, 23, 59, 59),
    }
  }
  return {
    start: new Date(n.getFullYear(), n.getMonth(), 1),
    end:   new Date(n.getFullYear(), n.getMonth() + 1, 0, 23, 59, 59),
  }
}

function csvCell(v: string | number) {
  return `"${String(v).replace(/"/g, '""')}"`
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map(r => r.map(csvCell).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RapportsTempsClient({ entries, members, clients }: Props) {
  const [period, setPeriod] = useState<Period>('mois')
  const [memberFilter, setMemberFilter] = useState('tous')
  const [clientFilter, setClientFilter] = useState('tous')

  const range = useMemo(() => getRange(period), [period])

  const filtered = useMemo(() => entries.filter(e => {
    const d = new Date(e.started_at)
    if (d < range.start || d > range.end) return false
    if (memberFilter !== 'tous' && e.member_id !== memberFilter) return false
    if (clientFilter !== 'tous' && e.client_id !== clientFilter) return false
    return true
  }), [entries, range, memberFilter, clientFilter])

  const totalSeconds = filtered.reduce((s, e) => s + e.duration_seconds, 0)

  const byMember = useMemo(() => {
    const groups = new Map<string, { name: string; seconds: number }>()
    for (const e of filtered) {
      const existing = groups.get(e.member_id)
      groups.set(e.member_id, { name: e.member_name, seconds: (existing?.seconds ?? 0) + e.duration_seconds })
    }
    return Array.from(groups.values()).sort((a, b) => b.seconds - a.seconds)
  }, [filtered])

  const byClient = useMemo(() => {
    const groups = new Map<string, { name: string; seconds: number }>()
    for (const e of filtered) {
      const key = e.client_id ?? 'none'
      const existing = groups.get(key)
      groups.set(key, { name: e.client_name ?? 'Sans client', seconds: (existing?.seconds ?? 0) + e.duration_seconds })
    }
    return Array.from(groups.values()).sort((a, b) => b.seconds - a.seconds)
  }, [filtered])

  const byTask = useMemo(() => {
    const groups = new Map<string, { title: string; client_name: string; members: Set<string>; seconds: number }>()
    for (const e of filtered) {
      const existing = groups.get(e.task_id)
      const members = existing?.members ?? new Set<string>()
      members.add(e.member_name)
      groups.set(e.task_id, {
        title: e.task_title,
        client_name: e.client_name ?? 'Sans client',
        members,
        seconds: (existing?.seconds ?? 0) + e.duration_seconds,
      })
    }
    return Array.from(groups.values())
      .map(t => ({ ...t, members: Array.from(t.members).join(', ') }))
      .sort((a, b) => b.seconds - a.seconds)
  }, [filtered])

  const exportCsv = () => {
    const periodLabel = PERIODS.find(p => p.id === period)!.label
    const rows: (string | number)[][] = [
      [`Rapport temps — ${periodLabel}`],
      [],
      ['Temps par membre'],
      ['Membre', 'Heures'],
      ...byMember.map(r => [r.name, secondsToHours(r.seconds)]),
      [],
      ['Temps par client'],
      ['Client', 'Heures'],
      ...byClient.map(r => [r.name, secondsToHours(r.seconds)]),
      [],
      ['Temps par tâche'],
      ['Tâche', 'Client', 'Membre(s)', 'Heures'],
      ...byTask.map(r => [r.title, r.client_name, r.members, secondsToHours(r.seconds)]),
    ]
    downloadCsv(`rapport-temps-${period}.csv`, rows)
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          {PERIODS.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                period === p.id ? 'bg-auchu-500 text-white border-auchu-500' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              )}
            >
              {p.label}
            </button>
          ))}
          <div className="flex-1" />
          <button onClick={exportCsv} className="btn-secondary text-xs py-1.5 gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Membre</label>
            <select value={memberFilter} onChange={e => setMemberFilter(e.target.value)} className="select text-sm py-1.5">
              <option value="tous">Tous les membres</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Client</label>
            <select value={clientFilter} onChange={e => setClientFilter(e.target.value)} className="select text-sm py-1.5">
              <option value="tous">Tous les clients</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Total */}
      <div className="card flex items-center gap-3 p-5">
        <div className="p-2 rounded-lg text-auchu-600 bg-auchu-50">
          <Clock className="w-4 h-4" />
        </div>
        <div>
          <p className="text-xs text-gray-500 font-medium">Temps total (période + filtres sélectionnés)</p>
          <p className="text-xl font-semibold text-gray-900 mt-0.5">{formatDuration(totalSeconds)}</p>
        </div>
      </div>

      {/* Par membre */}
      <ReportTable
        title="Temps par membre"
        icon={Users}
        rows={byMember.map(r => [r.name, formatDuration(r.seconds)])}
        headers={['Membre', 'Heures']}
        empty="Aucun temps enregistré pour cette sélection"
      />

      {/* Par client */}
      <ReportTable
        title="Temps par client"
        icon={Briefcase}
        rows={byClient.map(r => [r.name, formatDuration(r.seconds)])}
        headers={['Client', 'Heures']}
        empty="Aucun temps enregistré pour cette sélection"
      />

      {/* Par tâche */}
      <ReportTable
        title="Temps par tâche"
        icon={ListTodo}
        rows={byTask.map(r => [r.title, r.client_name, r.members, formatDuration(r.seconds)])}
        headers={['Tâche', 'Client', 'Membre(s)', 'Heures']}
        empty="Aucun temps enregistré pour cette sélection"
      />
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ReportTable({
  title, icon: Icon, headers, rows, empty,
}: {
  title: string; icon: React.ElementType; headers: string[]; rows: (string | number)[][]; empty: string
}) {
  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
        <Icon className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-sm text-gray-400">{empty}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                {headers.map((h, i) => (
                  <th key={h} className={i === headers.length - 1 ? 'text-right' : ''}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className={cn(
                        j === row.length - 1
                          ? 'text-right text-sm font-medium text-gray-900 tabular-nums'
                          : j === 0
                            ? 'text-sm text-gray-700'
                            : 'text-sm text-gray-500'
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
