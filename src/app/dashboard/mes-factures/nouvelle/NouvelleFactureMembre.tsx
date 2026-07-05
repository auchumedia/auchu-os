'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Clock, FileCheck } from 'lucide-react'
import { formatCurrency, formatDuration, secondsToHours } from '@/lib/utils'

interface Config {
  billing_mode: 'hourly' | 'fixed'
  hourly_rate:  number | null
  fixed_rate:   number | null
  currency:     string
  period:       'weekly' | 'biweekly' | 'monthly'
  payment_info: string | null
}

interface HourlyEntry {
  task_id: string
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  task: { title: string; client: { name: string } | null } | null
}

interface FixedDeliverable {
  task_id: string
  title: string
  approved_at: string | null
  client: { name: string } | null
}

interface Props {
  config: Config
  hourlyEntries: HourlyEntry[]
  fixedDeliverables: FixedDeliverable[]
}

function defaultRange(period: Config['period']) {
  const end = new Date()
  const start = new Date()
  if (period === 'weekly') start.setDate(start.getDate() - 6)
  else if (period === 'biweekly') start.setDate(start.getDate() - 13)
  else start.setDate(1)
  const toStr = (d: Date) => d.toISOString().split('T')[0]
  return { start: toStr(start), end: toStr(end) }
}

function inRange(dateStr: string, start: string, end: string) {
  const d = new Date(dateStr).getTime()
  return d >= new Date(start).getTime() && d <= new Date(`${end}T23:59:59`).getTime()
}

function r2(n: number) { return Math.round(n * 100) / 100 }

interface InvoiceItemPreview {
  task_id: string
  description: string
  amount: number
  hours?: number
  rate?: number
}

export default function NouvelleFactureMembre({ config, hourlyEntries, fixedDeliverables }: Props) {
  const router = useRouter()
  const initial = defaultRange(config.period)
  const [periodStart, setPeriodStart] = useState(initial.start)
  const [periodEnd, setPeriodEnd]     = useState(initial.end)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const rate = config.billing_mode === 'hourly' ? (config.hourly_rate ?? 0) : (config.fixed_rate ?? 0)

  const items = useMemo<InvoiceItemPreview[]>(() => {
    if (config.billing_mode === 'hourly') {
      const byTask = new Map<string, { description: string; seconds: number }>()
      for (const e of hourlyEntries) {
        if (!e.ended_at || !inRange(e.started_at, periodStart, periodEnd)) continue
        const existing = byTask.get(e.task_id)
        const client = e.task?.client?.name
        const description = e.task?.title ? `${e.task.title}${client ? ` — ${client}` : ''}` : 'Tâche supprimée'
        byTask.set(e.task_id, {
          description,
          seconds: (existing?.seconds ?? 0) + (e.duration_seconds ?? 0),
        })
      }
      return Array.from(byTask.entries()).map(([task_id, v]) => {
        const hours = secondsToHours(v.seconds)
        return { task_id, description: v.description, hours, rate, amount: r2(hours * rate) }
      })
    }

    return fixedDeliverables
      .filter(d => d.approved_at && inRange(d.approved_at, periodStart, periodEnd))
      .map(d => ({
        task_id: d.task_id,
        description: `${d.title}${d.client?.name ? ` — ${d.client.name}` : ''}`,
        amount: rate,
      }))
  }, [config.billing_mode, hourlyEntries, fixedDeliverables, periodStart, periodEnd, rate])

  const total = r2(items.reduce((s, i) => s + i.amount, 0))

  const handleSubmit = async () => {
    if (items.length === 0) {
      setError('Aucune donnée à facturer pour cette période.')
      return
    }
    setSaving(true)
    setError(null)

    const res = await fetch('/api/member-invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        period_start: periodStart,
        period_end:   periodEnd,
        items,
        total,
        billing_mode: config.billing_mode,
        rate,
        currency:     config.currency,
        payment_info: config.payment_info,
      }),
    })

    const json = await res.json()
    setSaving(false)

    if (!res.ok) {
      setError(json.error ?? 'Une erreur est survenue')
      return
    }

    router.push(`/dashboard/mes-factures/${json.data.id}`)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/mes-factures" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Générer une facture</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {config.billing_mode === 'hourly'
              ? `Taux horaire : ${formatCurrency(rate, config.currency)}/h`
              : `Montant fixe : ${formatCurrency(rate, config.currency)}/livrable`}
          </p>
        </div>
      </div>

      <section className="card space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Période</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Du</label>
            <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Au</label>
            <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="input" />
          </div>
        </div>
      </section>

      <section className="card p-0 overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-gray-100">
          {config.billing_mode === 'hourly' ? <Clock className="w-4 h-4 text-gray-400" /> : <FileCheck className="w-4 h-4 text-gray-400" />}
          <h2 className="text-sm font-semibold text-gray-900">
            {config.billing_mode === 'hourly' ? 'Tâches avec temps enregistré' : 'Livrables approuvés'}
          </h2>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">Rien à facturer pour cette période</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map(item => (
              <div key={item.task_id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-gray-900 truncate">{item.description}</p>
                  {item.hours != null && (
                    <p className="text-xs text-gray-400 mt-0.5">{formatDuration(item.hours * 3600)} · {item.hours}h</p>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-900 tabular-nums flex-shrink-0">
                  {formatCurrency(item.amount, config.currency)}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-t border-gray-100">
          <p className="text-sm font-semibold text-gray-900">Total</p>
          <p className="text-lg font-semibold text-auchu-600 tabular-nums">{formatCurrency(total, config.currency)}</p>
        </div>
      </section>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-3 py-2">{error}</div>
      )}

      <button
        onClick={handleSubmit}
        disabled={saving || items.length === 0}
        className="btn-primary w-full justify-center disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        Créer la facture (brouillon)
      </button>
    </div>
  )
}
