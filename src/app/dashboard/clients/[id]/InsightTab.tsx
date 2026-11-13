'use client'

import { useMemo, useRef, useState } from 'react'
import {
  BarChart3, ChevronLeft, ChevronRight, Copy, Loader2, FileDown,
  TrendingUp, TrendingDown, Minus,
} from 'lucide-react'
import type { ClientInsight } from '@/types'
import {
  INSIGHT_PLATFORMS, INSIGHT_PLATFORM_LABELS, percentVariation, totalInteractions,
  engagementRate, sumAcrossPlatforms, type InsightPlatform, type InsightMetrics,
} from '@/lib/insights'
import { cn } from '@/lib/utils'

// ─── Dates — mois toujours au 1er, jamais d'horloge dans les calculs purs
//     (cf. src/lib/insights.ts) ; ici seulement pour l'UI (sélecteur de mois,
//     fenêtre d'historique des graphiques). Même convention que
//     FinanceSection.tsx (ChevronLeft/ChevronRight + pilule). ─────────────────
function monthStart(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function shiftMonth(d: Date, delta: number) { return new Date(d.getFullYear(), d.getMonth() + delta, 1) }
function toMonthParam(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
function toMonthISO(d: Date) { return `${toMonthParam(d)}-01` }
function monthLabel(d: Date) {
  const label = d.toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}
function monthShortLabel(d: Date) {
  const label = d.toLocaleDateString('fr-CA', { month: 'short' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function findRow(list: ClientInsight[], platform: InsightPlatform, d: Date): ClientInsight | undefined {
  const iso = toMonthISO(d)
  return list.find(r => r.platform === platform && r.month.slice(0, 10) === iso)
}

const CHART_COLORS = { followers: '#003DA5', views: '#0d9488', interactions: '#f59e0b' }

const QUICK_FIELDS: { key: keyof InsightMetrics; label: string }[] = [
  { key: 'followers',        label: 'Abonnés' },
  { key: 'followers_gained', label: 'Abonnés gagnés' },
  { key: 'views',            label: 'Vues' },
  { key: 'reach',            label: 'Portée' },
  { key: 'profile_visits',   label: 'Visites profil' },
  { key: 'posts_published',  label: 'Publications' },
  { key: 'likes',            label: "J'aime" },
  { key: 'comments',         label: 'Commentaires' },
  { key: 'shares',           label: 'Partages' },
  { key: 'saves',            label: 'Enregistrements' },
]

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  clientId: string
  clientName: string
  initialInsights: ClientInsight[]
}

export default function InsightTab({ clientId, clientName, initialInsights }: Props) {
  const [insights, setInsights] = useState<ClientInsight[]>(initialInsights)
  const [monthDate, setMonthDate] = useState(() => monthStart(new Date()))
  const [platform, setPlatform] = useState<InsightPlatform | 'all'>('instagram')

  function handleSaved(row: ClientInsight) {
    setInsights(prev => {
      const idx = prev.findIndex(r => r.id === row.id)
      if (idx === -1) return [...prev, row]
      const next = [...prev]
      next[idx] = row
      return next
    })
  }

  const currentRow  = platform === 'all' ? null : (findRow(insights, platform, monthDate) ?? null)
  const previousRow = platform === 'all' ? null : (findRow(insights, platform, shiftMonth(monthDate, -1)) ?? null)

  // 12 derniers mois jusqu'au mois sélectionné inclus — les graphiques se
  // recalculent dès que `insights` change (sauvegarde) ou que le mois/la
  // plateforme change, sans requête réseau (tout l'historique du client est
  // déjà en mémoire depuis le chargement initial de la page).
  const history = useMemo(() => {
    if (platform === 'all') return []
    const months: Date[] = []
    for (let i = 11; i >= 0; i--) months.push(shiftMonth(monthDate, -i))
    return months.map(d => ({ month: d, row: findRow(insights, platform, d) }))
  }, [insights, platform, monthDate])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-auchu-500" />
          <h2 className="font-semibold text-gray-900">Insight</h2>
        </div>
        <div className="flex items-center gap-0.5 border border-gray-200 bg-white rounded-full px-1 py-1">
          <button onClick={() => setMonthDate(d => shiftMonth(d, -1))} aria-label="Mois précédent" className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-700 font-medium w-32 text-center">{monthLabel(monthDate)}</span>
          <button onClick={() => setMonthDate(d => shiftMonth(d, 1))} aria-label="Mois suivant" className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {INSIGHT_PLATFORMS.map(p => (
          <button key={p} type="button" onClick={() => setPlatform(p)} className={cn('tab-pill', platform === p && 'active-blue')}>
            {INSIGHT_PLATFORM_LABELS[p]}
          </button>
        ))}
        <button type="button" onClick={() => setPlatform('all')} className={cn('tab-pill', platform === 'all' && 'active-blue')}>
          Toutes les plateformes
        </button>
      </div>

      {platform === 'all' ? (
        <AllPlatformsView insights={insights} monthDate={monthDate} />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard label="Abonnés"  value={currentRow?.followers ?? null} previous={previousRow?.followers ?? null} />
            <KpiCard label="Vues"     value={currentRow?.views ?? null}     previous={previousRow?.views ?? null} />
            <KpiCard label="Portée"   value={currentRow?.reach ?? null}     previous={previousRow?.reach ?? null} />
            <KpiCard
              label="Interactions"
              value={currentRow ? totalInteractions(currentRow) : null}
              previous={previousRow ? totalInteractions(previousRow) : null}
            />
            <KpiCard
              label="Taux d'engagement"
              value={currentRow ? engagementRate(currentRow) : null}
              previous={previousRow ? engagementRate(previousRow) : null}
              formatter={n => n.toFixed(1)}
              suffix="%"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MiniLineChart label="Abonnés"      color={CHART_COLORS.followers}    points={history.map(h => ({ month: h.month, value: h.row?.followers ?? null }))} />
            <MiniLineChart label="Vues"         color={CHART_COLORS.views}        points={history.map(h => ({ month: h.month, value: h.row?.views ?? null }))} />
            <MiniLineChart label="Interactions" color={CHART_COLORS.interactions} points={history.map(h => ({ month: h.month, value: h.row ? totalInteractions(h.row) : null }))} />
          </div>

          <QuickEntryForm
            key={`${platform}-${toMonthParam(monthDate)}`}
            clientId={clientId}
            platform={platform}
            monthISO={toMonthISO(monthDate)}
            initialRow={currentRow}
            previousRow={previousRow}
            onSaved={handleSaved}
          />
        </>
      )}

      <ReportSection clientId={clientId} clientName={clientName} monthDate={monthDate} insights={insights} />
    </div>
  )
}

// ─── Vue "Toutes les plateformes" ─────────────────────────────────────────────

function AllPlatformsView({ insights, monthDate }: { insights: ClientInsight[]; monthDate: Date }) {
  const rowsThisMonth = INSIGHT_PLATFORMS.map(p => findRow(insights, p, monthDate)).filter((r): r is ClientInsight => !!r)
  const rowsPrevMonth = INSIGHT_PLATFORMS.map(p => findRow(insights, p, shiftMonth(monthDate, -1))).filter((r): r is ClientInsight => !!r)
  const current  = sumAcrossPlatforms(rowsThisMonth)
  const previous = sumAcrossPlatforms(rowsPrevMonth)

  if (current.views == null && current.interactions == null) {
    return (
      <div className="card text-center py-12">
        <BarChart3 className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">Aucune statistique saisie pour {monthLabel(monthDate).toLowerCase()}.</p>
        <p className="text-xs text-gray-400 mt-1">Choisissez une plateforme ci-dessus pour commencer la saisie.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <KpiCard label="Vues — toutes plateformes"        value={current.views}        previous={previous.views} large />
      <KpiCard label="Interactions — toutes plateformes" value={current.interactions} previous={previous.interactions} large />
    </div>
  )
}

// ─── Carte KPI ────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, previous, formatter, suffix, large,
}: {
  label: string
  value: number | null
  previous: number | null
  formatter?: (n: number) => string
  suffix?: string
  large?: boolean
}) {
  const pct = percentVariation(value, previous)
  const fmt = formatter ?? ((n: number) => Math.round(n).toLocaleString('fr-CA'))
  return (
    <div className={cn('card-sm', large && 'p-5')}>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={cn('font-semibold text-gray-900', large ? 'text-2xl' : 'text-lg')}>
        {value != null ? `${fmt(value)}${suffix ?? ''}` : '—'}
      </p>
      <VariationBadge pct={pct} />
    </div>
  )
}

function VariationBadge({ pct }: { pct: number | null }) {
  if (pct == null) return <p className="text-[11px] text-gray-400 mt-1">—</p>
  const isFlat = Math.round(pct) === 0
  const isUp = pct > 0
  const Icon = isFlat ? Minus : isUp ? TrendingUp : TrendingDown
  const color = isFlat ? 'text-gray-400' : isUp ? 'text-green-600' : 'text-red-500'
  return (
    <p className={cn('text-[11px] mt-1 flex items-center gap-1', color)}>
      <Icon className="w-3 h-3" />
      {isFlat ? 'stable' : `${pct > 0 ? '+' : ''}${Math.round(pct)}%`}
    </p>
  )
}

// ─── Mini graphique SVG (sans dépendance) ─────────────────────────────────────
// "Graphiques simples" (cf. demande) : un tracé minimal maison plutôt qu'une
// librairie de charts — rien n'en justifiait l'ajout pour 3 courbes/mois.

function MiniLineChart({ label, color, points }: { label: string; color: string; points: { month: Date; value: number | null }[] }) {
  const W = 280, H = 70, PAD = 6
  const values = points.map(p => p.value).filter((v): v is number => v != null)
  const hasData = values.length > 0
  const max = hasData ? Math.max(...values) : 1
  const min = hasData ? Math.min(...values) : 0
  const span = max - min || 1
  const stepX = points.length > 1 ? (W - PAD * 2) / (points.length - 1) : 0

  const coords = points.map((p, i) => ({
    x: PAD + i * stepX,
    y: p.value == null ? null : H - PAD - ((p.value - min) / span) * (H - PAD * 2),
  }))
  const linePoints = coords.filter((c): c is { x: number; y: number } => c.y != null)
  const path = linePoints.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')

  return (
    <div className="card-sm">
      <p className="text-xs text-gray-400 mb-2">{label}</p>
      {hasData ? (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16" preserveAspectRatio="none">
          <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          {coords.map((c, i) => c.y != null && <circle key={i} cx={c.x} cy={c.y} r={2.5} fill={color} />)}
        </svg>
      ) : (
        <div className="h-16 flex items-center justify-center text-xs text-gray-300">Pas encore de données</div>
      )}
      <div className="flex justify-between text-[10px] text-gray-400 mt-1">
        <span>{monthShortLabel(points[0].month)}</span>
        <span>{monthShortLabel(points[points.length - 1].month)}</span>
      </div>
    </div>
  )
}

// ─── Formulaire de saisie rapide ───────────────────────────────────────────────
// Remonté (via `key` côté parent) à chaque changement de plateforme/mois —
// state local initialisé une fois depuis `initialRow`, pas de synchronisation
// manuelle. Chaque champ sauvegarde indépendamment (upsert partiel côté API),
// donc aucune obligation de tout remplir. L'ordre des champs dans le DOM
// (grille) détermine l'ordre de tabulation — comportement natif du navigateur.

type FieldStatus = 'idle' | 'saving' | 'saved' | 'error'

function QuickEntryForm({
  clientId, platform, monthISO, initialRow, previousRow, onSaved,
}: {
  clientId: string
  platform: InsightPlatform
  monthISO: string
  initialRow: ClientInsight | null
  previousRow: ClientInsight | null
  onSaved: (row: ClientInsight) => void
}) {
  const [values, setValues] = useState<Record<string, string>>(() => ({
    ...Object.fromEntries(QUICK_FIELDS.map(f => [f.key, initialRow?.[f.key] != null ? String(initialRow[f.key]) : ''])),
    top_post_title: initialRow?.top_post_title ?? '',
    top_post_url: initialRow?.top_post_url ?? '',
    notes: initialRow?.notes ?? '',
  }))
  const [status, setStatus] = useState<Record<string, FieldStatus>>({})
  const [errorMsg, setErrorMsg] = useState<Record<string, string>>({})
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const isTextField = (field: string) => field === 'top_post_title' || field === 'top_post_url' || field === 'notes'

  function handleChange(field: string, raw: string) {
    setValues(v => ({ ...v, [field]: raw }))
    if (timers.current[field]) clearTimeout(timers.current[field])
    timers.current[field] = setTimeout(() => save(field, raw), isTextField(field) ? 800 : 700)
  }

  async function save(field: string, raw: string) {
    let payloadValue: number | string | null
    if (isTextField(field)) {
      payloadValue = raw.trim() === '' ? null : raw
    } else {
      const trimmed = raw.trim()
      if (trimmed === '') {
        payloadValue = null
      } else {
        const n = Number(trimmed)
        const allowNegative = field === 'followers_gained'
        if (!Number.isInteger(n) || (!allowNegative && n < 0)) {
          setStatus(s => ({ ...s, [field]: 'error' }))
          setErrorMsg(e => ({ ...e, [field]: allowNegative ? 'Nombre entier requis' : 'Entier positif requis' }))
          return
        }
        payloadValue = n
      }
    }

    setStatus(s => ({ ...s, [field]: 'saving' }))
    setErrorMsg(e => ({ ...e, [field]: '' }))
    const res = await fetch(`/api/clients/${clientId}/insights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, month: monthISO, [field]: payloadValue }),
    })
    if (res.ok) {
      const { data } = await res.json()
      onSaved(data)
      setStatus(s => ({ ...s, [field]: 'saved' }))
      setTimeout(() => setStatus(s => ({ ...s, [field]: 'idle' })), 1500)
    } else {
      const json = await res.json().catch(() => null)
      setStatus(s => ({ ...s, [field]: 'error' }))
      setErrorMsg(e => ({ ...e, [field]: json?.error ?? 'Erreur de sauvegarde' }))
    }
  }

  function copyFromPrevious() {
    if (!previousRow) return
    for (const f of QUICK_FIELDS) {
      const raw = previousRow[f.key] != null ? String(previousRow[f.key]) : ''
      setValues(v => ({ ...v, [f.key]: raw }))
      save(f.key, raw)
    }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-gray-900">Saisie rapide — {INSIGHT_PLATFORM_LABELS[platform]}</h3>
        <button
          type="button"
          onClick={copyFromPrevious}
          disabled={!previousRow}
          className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40 disabled:cursor-not-allowed"
          title={previousRow ? undefined : 'Aucune donnée le mois précédent'}
        >
          <Copy className="w-3.5 h-3.5" /> Copier du mois précédent
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {QUICK_FIELDS.map(f => (
          <div key={f.key}>
            <label className="label text-xs">{f.label}</label>
            <input
              type="number"
              step={1}
              value={values[f.key]}
              onChange={e => handleChange(f.key, e.target.value)}
              className="input text-sm"
              placeholder="—"
            />
            <div className="h-4 mt-1">
              {status[f.key] === 'saving' && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
              {status[f.key] === 'saved'  && <span className="text-[11px] text-green-600">Enregistré</span>}
              {status[f.key] === 'error'  && <span className="text-[11px] text-red-600">{errorMsg[f.key]}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 pt-4 border-t border-gray-100">
        <div>
          <label className="label text-xs">Meilleure publication — titre</label>
          <input
            type="text"
            value={values.top_post_title}
            onChange={e => handleChange('top_post_title', e.target.value)}
            className="input text-sm"
            placeholder="Optionnel"
          />
        </div>
        <div>
          <label className="label text-xs">Meilleure publication — lien</label>
          <input
            type="url"
            value={values.top_post_url}
            onChange={e => handleChange('top_post_url', e.target.value)}
            className="input text-sm"
            placeholder="https://…"
          />
        </div>
      </div>

      <div className="mt-3">
        <label className="label text-xs">Notes internes — jamais incluses dans le rapport PDF ni visibles du contact</label>
        <textarea
          value={values.notes}
          onChange={e => handleChange('notes', e.target.value)}
          className="textarea text-sm"
          rows={2}
          placeholder="Optionnel"
        />
      </div>
    </div>
  )
}

// ─── Rapport PDF ──────────────────────────────────────────────────────────────

function ReportSection({
  clientId, clientName, monthDate, insights,
}: {
  clientId: string
  clientName: string
  monthDate: Date
  insights: ClientInsight[]
}) {
  const [comment, setComment] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasAnyDataThisMonth = INSIGHT_PLATFORMS.some(p => findRow(insights, p, monthDate))

  async function generate() {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch(`/api/clients/${clientId}/insights/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: toMonthISO(monthDate), comment }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error ?? 'Erreur lors de la génération du rapport')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Insight - ${clientName} - ${monthLabel(monthDate)}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la génération du rapport')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Rapport PDF Insight — {monthLabel(monthDate)}</h3>
      <label className="label text-xs">Commentaire du rapport (visible dans le PDF, modifiable avant génération)</label>
      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        className="textarea text-sm"
        rows={3}
        placeholder="Un mot sur ce mois pour le contact — n'apparaît que dans ce rapport, n'est jamais sauvegardé."
      />
      {!hasAnyDataThisMonth && (
        <p className="text-xs text-amber-600 mt-2">Aucune statistique saisie pour ce mois — le rapport n'aurait aucune page de plateforme.</p>
      )}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      <button
        type="button"
        onClick={generate}
        disabled={generating || !hasAnyDataThisMonth}
        className="btn-primary mt-3 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
        Générer le rapport PDF Insight
      </button>
    </div>
  )
}
