'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Plus, TrendingUp, TrendingDown, CreditCard, Clock, Trash2,
  CheckCircle, Send, AlertCircle, FileText, Loader2, X,
  ChevronDown, Printer, Download, Users,
} from 'lucide-react'
import { Invoice, Expense, Client, ExpenseCategory, MemberInvoice } from '@/types'
import { cn, formatCurrency, formatDate, formatDuration, secondsToHours, MEMBER_INVOICE_STATUS_LABELS, MEMBER_INVOICE_STATUS_COLORS } from '@/lib/utils'

// ─── Constants ────────────────────────────────────────────────────────────────

const TPS_RATE = 0.05
const TVQ_RATE = 0.09975
const QUARTERS = [
  { q: 1, label: 'T1', months: 'Jan – Mar' },
  { q: 2, label: 'T2', months: 'Avr – Jun' },
  { q: 3, label: 'T3', months: 'Jul – Sep' },
  { q: 4, label: 'T4', months: 'Oct – Déc' },
] as const

const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string; color: string }[] = [
  { value: 'logiciels',    label: 'Logiciels & Outils',       color: 'text-violet-600 bg-violet-50' },
  { value: 'publicite',    label: 'Publicité & Marketing',    color: 'text-pink-600   bg-pink-50'   },
  { value: 'equipement',   label: 'Équipement',               color: 'text-blue-600   bg-blue-50'   },
  { value: 'deplacements', label: 'Déplacements',             color: 'text-amber-600  bg-amber-50'  },
  { value: 'formation',    label: 'Formation',                color: 'text-green-600  bg-green-50'  },
  { value: 'services',     label: 'Services professionnels',  color: 'text-indigo-600 bg-indigo-50' },
  { value: 'loyer',        label: 'Loyer & Bureau',           color: 'text-orange-600 bg-orange-50' },
  { value: 'telephone',    label: 'Téléphone & Internet',     color: 'text-sky-600    bg-sky-50'    },
  { value: 'autre',        label: 'Autre',                    color: 'text-gray-600   bg-gray-100'  },
]

const INVOICE_STATUS_CONFIG = {
  draft:     { label: 'Brouillon',  class: 'badge-gray',  icon: FileText },
  envoye:    { label: 'Envoyé',     class: 'badge-blue',  icon: Send },
  paye:      { label: 'Payé',       class: 'badge-green', icon: CheckCircle },
  en_retard: { label: 'En retard',  class: 'badge-red',   icon: AlertCircle },
  annule:    { label: 'Annulé',     class: 'badge-gray',  icon: X },
}

type Tab = 'apercu' | 'factures' | 'depenses' | 'rapport' | 'membres'
type InvoiceStatus = 'draft' | 'envoye' | 'paye' | 'en_retard' | 'annule'

function r2(n: number) { return Math.round(n * 100) / 100 }

interface MemberTimeEntry {
  member_id: string; member_name: string
  client_id: string | null; client_name: string | null
  started_at: string; duration_seconds: number
}

const TIME_PERIODS = [
  { id: 'mois',     label: 'Ce mois' },
  { id: 'dernier',  label: 'Mois dernier' },
  { id: 'trimestre', label: 'Ce trimestre' },
  { id: 'tout',     label: 'Tout' },
] as const
type TimePeriod = typeof TIME_PERIODS[number]['id']

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  initialInvoices: (Invoice & { client?: { id: string; name: string; email: string | null } | null })[]
  initialExpenses: (Expense & { client?: { id: string; name: string } | null })[]
  clients: Pick<Client, 'id' | 'name' | 'email'>[]
  currentMonth: { revenue: number; expenses: number; pending: number; pendingCount: number }
  memberInvoices: MemberInvoice[]
  memberTimeEntries: MemberTimeEntry[]
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FinanceModule({
  initialInvoices,
  initialExpenses,
  clients,
  currentMonth,
  memberInvoices: initialMemberInvoices,
  memberTimeEntries,
}: Props) {
  const [tab, setTab] = useState<Tab>('apercu')
  const [invoices, setInvoices] = useState(initialInvoices)
  const [expenses, setExpenses] = useState(initialExpenses)
  const [memberInvoices, setMemberInvoices] = useState(initialMemberInvoices)
  const [memberInvoiceBusyId, setMemberInvoiceBusyId] = useState<string | null>(null)
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('mois')
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'tout'>('tout')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Quarter report
  const now = new Date()
  const [reportYear, setReportYear]   = useState(now.getFullYear())
  const [reportQuarter, setReportQuarter] = useState<1|2|3|4>(
    Math.floor(now.getMonth() / 3) + 1 as 1|2|3|4
  )

  // Expense form
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [expenseForm, setExpenseForm] = useState({
    title: '', amount: '', category: 'autre' as ExpenseCategory,
    date: now.toISOString().split('T')[0], client_id: '', notes: '',
  })
  const [savingExpense, setSavingExpense] = useState(false)

  // ─── Invoice actions ────────────────────────────────────────────────────────

  const updateStatus = async (id: string, status: InvoiceStatus) => {
    setUpdatingId(id)
    const res = await fetch(`/api/factures/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      const { data } = await res.json()
      setInvoices(prev => prev.map(inv => inv.id === id ? data : inv))
    }
    setUpdatingId(null)
  }

  const deleteInvoice = async (id: string) => {
    setDeletingId(id)
    const res = await fetch(`/api/factures/${id}`, { method: 'DELETE' })
    if (res.ok) setInvoices(prev => prev.filter(inv => inv.id !== id))
    setDeletingId(null)
  }

  const sendEmail = (invoice: typeof invoices[0]) => {
    const client = invoice.client
    if (!client?.email) { alert('Aucun email pour ce client.'); return }

    const body = `Bonjour,\n\nVeuillez trouver ci-joint votre facture ${invoice.invoice_number} d'un montant de ${formatCurrency(invoice.total)} (TPS + TVQ incluses), échéance le ${invoice.due_date ? formatDate(invoice.due_date) : 'N/A'}.\n\nMerci de votre confiance,`
    const mailto = `mailto:${client.email}?subject=Facture ${invoice.invoice_number}&body=${encodeURIComponent(body)}`
    window.open(mailto)
    if (invoice.status === 'draft') updateStatus(invoice.id, 'envoye')
  }

  // ─── Expense actions ────────────────────────────────────────────────────────

  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!expenseForm.title || !expenseForm.amount) return
    setSavingExpense(true)

    const res = await fetch('/api/depenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(expenseForm),
    })
    if (res.ok) {
      const { data } = await res.json()
      setExpenses(prev => [data, ...prev])
      setExpenseForm({ title: '', amount: '', category: 'autre', date: now.toISOString().split('T')[0], client_id: '', notes: '' })
      setShowExpenseForm(false)
    }
    setSavingExpense(false)
  }

  const deleteExpense = async (id: string) => {
    const res = await fetch(`/api/depenses/${id}`, { method: 'DELETE' })
    if (res.ok) setExpenses(prev => prev.filter(e => e.id !== id))
  }

  // ─── Member invoices actions ────────────────────────────────────────────────

  const updateMemberInvoiceStatus = async (id: string, status: 'approuvee' | 'payee') => {
    setMemberInvoiceBusyId(id)
    const res = await fetch(`/api/member-invoices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      const { data } = await res.json()
      setMemberInvoices(prev => prev.map(inv => inv.id === id ? data : inv))
    }
    setMemberInvoiceBusyId(null)
  }

  // ─── Temps par membre : filtre par période + agrégation ────────────────────

  const timeRange = useMemo(() => {
    const n = new Date()
    if (timePeriod === 'mois') return { start: new Date(n.getFullYear(), n.getMonth(), 1), end: new Date(n.getFullYear(), n.getMonth() + 1, 0, 23, 59, 59) }
    if (timePeriod === 'dernier') return { start: new Date(n.getFullYear(), n.getMonth() - 1, 1), end: new Date(n.getFullYear(), n.getMonth(), 0, 23, 59, 59) }
    if (timePeriod === 'trimestre') { const q = Math.floor(n.getMonth() / 3); return { start: new Date(n.getFullYear(), q * 3, 1), end: new Date(n.getFullYear(), q * 3 + 3, 0, 23, 59, 59) } }
    return { start: new Date(2000, 0, 1), end: new Date(2100, 0, 1) }
  }, [timePeriod])

  const filteredTimeEntries = useMemo(() => memberTimeEntries.filter(e => {
    const d = new Date(e.started_at)
    return d >= timeRange.start && d <= timeRange.end
  }), [memberTimeEntries, timeRange])

  const timeByMember = useMemo(() => {
    const groups = new Map<string, { member_name: string; client_name: string; seconds: number }>()
    for (const e of filteredTimeEntries) {
      const key = `${e.member_id}::${e.client_id ?? 'none'}`
      const existing = groups.get(key)
      groups.set(key, {
        member_name: e.member_name,
        client_name: e.client_name ?? 'Sans client',
        seconds: (existing?.seconds ?? 0) + e.duration_seconds,
      })
    }
    return Array.from(groups.values()).sort((a, b) => b.seconds - a.seconds)
  }, [filteredTimeEntries])

  const exportTimeCsv = () => {
    const rows = [['Membre', 'Client', 'Heures'], ...timeByMember.map(r => [r.member_name, r.client_name, String(secondsToHours(r.seconds))])]
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `temps-par-membre-${timePeriod}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ─── KPI calculations ───────────────────────────────────────────────────────

  const profit = r2(currentMonth.revenue - currentMonth.expenses)
  const tpsCollected  = r2(currentMonth.revenue * TPS_RATE)
  const tvqCollected  = r2(currentMonth.revenue * TVQ_RATE)

  // ─── Quarter report ─────────────────────────────────────────────────────────

  const qStart = new Date(reportYear, (reportQuarter - 1) * 3, 1)
  const qEnd   = new Date(reportYear, reportQuarter * 3, 0, 23, 59, 59)

  const qInvoices = invoices.filter(inv => {
    if (inv.status !== 'paye' || !inv.paid_at) return false
    const d = new Date(inv.paid_at)
    return d >= qStart && d <= qEnd
  })

  const qExpenses = expenses.filter(exp => {
    const d = new Date(exp.date)
    return d >= qStart && d <= qEnd
  })

  const qRevenue   = r2(qInvoices.reduce((s, inv) => s + inv.subtotal, 0))
  const qTPS       = r2(qRevenue * TPS_RATE)
  const qTVQ       = r2(qRevenue * TVQ_RATE)
  const qExpTotal  = r2(qExpenses.reduce((s, e) => s + e.amount, 0))
  const qRtiTPS    = r2(qExpTotal * TPS_RATE)
  const qRtiTVQ    = r2(qExpTotal * TVQ_RATE)
  const qNetTPS    = r2(qTPS - qRtiTPS)
  const qNetTVQ    = r2(qTVQ - qRtiTVQ)

  const printReport = () => {
    const q = QUARTERS.find(x => x.q === reportQuarter)!
    const html = `<!DOCTYPE html><html lang="fr"><head>
<meta charset="UTF-8"><title>Rapport fiscal ${q.label} ${reportYear}</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 40px; color: #111; font-size: 14px; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .sub { color: #666; margin-bottom: 32px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 8px 12px; background: #f3f4f6; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
  td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
  .amount { text-align: right; font-variant-numeric: tabular-nums; }
  .section { margin-bottom: 24px; }
  .section-title { font-weight: 600; font-size: 13px; color: #374151; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 2px solid #e5e7eb; }
  .highlight { background: #f0fdf4; font-weight: 600; }
  .total-row td { font-weight: 700; border-top: 2px solid #111; }
  .footer { margin-top: 40px; font-size: 12px; color: #9ca3af; }
  @media print { button { display: none; } }
</style></head><body>
<h1>Rapport fiscal — ${q.label} ${reportYear} (${q.months})</h1>
<p class="sub">Généré le ${new Date().toLocaleDateString('fr-CA')} · TPS 5% · TVQ 9,975%</p>

<div class="section">
<div class="section-title">Revenus (factures payées)</div>
<table>
  <tr><th>Description</th><th class="amount">Montant</th></tr>
  <tr><td>Sous-total (avant taxes)</td><td class="amount">${formatCurrency(qRevenue)}</td></tr>
  <tr class="highlight"><td>TPS collectée (5%)</td><td class="amount">${formatCurrency(qTPS)}</td></tr>
  <tr class="highlight"><td>TVQ collectée (9,975%)</td><td class="amount">${formatCurrency(qTVQ)}</td></tr>
</table></div>

<div class="section">
<div class="section-title">Dépenses d'entreprise</div>
<table>
  <tr><th>Description</th><th class="amount">Montant</th></tr>
  <tr><td>Total dépenses</td><td class="amount">${formatCurrency(qExpTotal)}</td></tr>
  <tr><td>RTI — TPS payée (5%)</td><td class="amount">(${formatCurrency(qRtiTPS)})</td></tr>
  <tr><td>RTI — TVQ payée (9,975%)</td><td class="amount">(${formatCurrency(qRtiTVQ)})</td></tr>
</table></div>

<div class="section">
<div class="section-title">Montants nets à remettre</div>
<table>
  <tr><th>Taxe</th><th class="amount">Montant</th></tr>
  <tr><td>TPS nette</td><td class="amount">${formatCurrency(qNetTPS)}</td></tr>
  <tr><td>TVQ nette</td><td class="amount">${formatCurrency(qNetTVQ)}</td></tr>
  <tr class="total-row"><td>Total à remettre</td><td class="amount">${formatCurrency(r2(qNetTPS + qNetTVQ))}</td></tr>
</table></div>

<p class="footer">* Les RTI (Remboursements de la Taxe sur les Intrants) sont estimés à 100% des dépenses. Consultez votre comptable pour valider l'admissibilité de chaque dépense.</p>
</body></html>`

    const w = window.open('', '_blank', 'width=800,height=900')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.print()
  }

  // ─── Filtered invoices ──────────────────────────────────────────────────────

  const filteredInvoices = statusFilter === 'tout'
    ? invoices
    : invoices.filter(inv => inv.status === statusFilter)

  // ─── Render ─────────────────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string }[] = [
    { id: 'apercu',   label: 'Aperçu' },
    { id: 'factures', label: `Factures (${invoices.length})` },
    { id: 'depenses', label: `Dépenses (${expenses.length})` },
    { id: 'rapport',  label: 'Rapport fiscal' },
    { id: 'membres',  label: `Factures membres (${memberInvoices.length})` },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Finance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Factures, dépenses et taxes</p>
        </div>
        <Link href="/dashboard/finance/factures/nouvelle" className="btn-primary">
          <Plus className="w-4 h-4" />
          Nouvelle facture
        </Link>
      </div>

      {/* Tab nav */}
      <div className="border-b border-gray-200 overflow-x-auto scrollbar-hide">
        <nav className="flex gap-1 -mb-px min-w-max">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                tab === t.id
                  ? 'border-auchu-500 text-auchu-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ─── Tab: Aperçu ─────────────────────────────────────────────────────── */}
      {tab === 'apercu' && (
        <div className="space-y-6">
          {/* KPI row 1 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Revenus ce mois"
              value={formatCurrency(currentMonth.revenue)}
              icon={TrendingUp}
              iconColor="text-green-500 bg-green-50"
              sub="Factures payées"
            />
            <KpiCard
              label="Dépenses ce mois"
              value={formatCurrency(currentMonth.expenses)}
              icon={TrendingDown}
              iconColor="text-red-500 bg-red-50"
              sub="Total décaissements"
            />
            <KpiCard
              label="Profit net"
              value={formatCurrency(profit)}
              icon={CreditCard}
              iconColor={profit >= 0 ? 'text-auchu-600 bg-auchu-50' : 'text-red-500 bg-red-50'}
              sub={profit >= 0 ? 'Positif' : 'Négatif'}
            />
            <KpiCard
              label="En attente"
              value={formatCurrency(currentMonth.pending)}
              icon={Clock}
              iconColor="text-amber-500 bg-amber-50"
              sub={`${currentMonth.pendingCount} facture${currentMonth.pendingCount !== 1 ? 's' : ''}`}
            />
          </div>

          {/* KPI row 2 — taxes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">TPS collectée (5%)</p>
              <p className="text-xl font-semibold text-gray-900 mt-1">{formatCurrency(tpsCollected)}</p>
              <p className="text-xs text-gray-400 mt-0.5">Ce mois · à remettre</p>
            </div>
            <div className="card">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">TVQ collectée (9,975%)</p>
              <p className="text-xl font-semibold text-gray-900 mt-1">{formatCurrency(tvqCollected)}</p>
              <p className="text-xs text-gray-400 mt-0.5">Ce mois · à remettre</p>
            </div>
            <div className="card bg-auchu-50 border-auchu-200">
              <p className="text-xs font-medium text-auchu-700 uppercase tracking-wide">Total taxes ce mois</p>
              <p className="text-xl font-semibold text-auchu-800 mt-1">{formatCurrency(r2(tpsCollected + tvqCollected))}</p>
              <p className="text-xs text-auchu-600 mt-0.5">TPS + TVQ combinées</p>
            </div>
          </div>

          {/* Recent invoices */}
          <div className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Factures récentes</h3>
              <button onClick={() => setTab('factures')} className="text-xs text-auchu-600 hover:underline">Voir toutes →</button>
            </div>
            <InvoiceTable
              invoices={invoices.slice(0, 6)}
              updatingId={updatingId}
              deletingId={deletingId}
              onUpdateStatus={updateStatus}
              onDelete={deleteInvoice}
              onSendEmail={sendEmail}
              compact
            />
          </div>
        </div>
      )}

      {/* ─── Tab: Factures ───────────────────────────────────────────────────── */}
      {tab === 'factures' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            {(['tout', 'draft', 'envoye', 'paye', 'en_retard', 'annule'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                  statusFilter === s
                    ? 'bg-auchu-500 text-white border-auchu-500'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                )}
              >
                {s === 'tout' ? 'Tout' : INVOICE_STATUS_CONFIG[s as InvoiceStatus]?.label}
                {s !== 'tout' && (
                  <span className="ml-1.5 opacity-70">
                    {invoices.filter(i => i.status === s).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {filteredInvoices.length === 0 ? (
            <div className="card text-center py-12">
              <FileText className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Aucune facture dans cette catégorie</p>
            </div>
          ) : (
            <div className="card p-0 overflow-hidden">
              <InvoiceTable
                invoices={filteredInvoices}
                updatingId={updatingId}
                deletingId={deletingId}
                onUpdateStatus={updateStatus}
                onDelete={deleteInvoice}
                onSendEmail={sendEmail}
              />
            </div>
          )}
        </div>
      )}

      {/* ─── Tab: Dépenses ───────────────────────────────────────────────────── */}
      {tab === 'depenses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {expenses.length} dépense{expenses.length !== 1 ? 's' : ''} ·{' '}
              <span className="font-medium text-gray-700">
                {formatCurrency(r2(expenses.reduce((s, e) => s + e.amount, 0)))} total
              </span>
            </p>
            <button onClick={() => setShowExpenseForm(v => !v)} className="btn-primary">
              <Plus className="w-4 h-4" />
              Ajouter une dépense
            </button>
          </div>

          {/* Add expense form */}
          {showExpenseForm && (
            <form onSubmit={addExpense} className="card space-y-4 border-auchu-200 bg-auchu-50/30">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Nouvelle dépense</h3>
                <button type="button" onClick={() => setShowExpenseForm(false)} className="text-gray-400 hover:text-gray-700">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Titre *</label>
                  <input
                    type="text"
                    required
                    value={expenseForm.title}
                    onChange={e => setExpenseForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Ex : Abonnement Adobe"
                    className="input text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Montant *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={expenseForm.amount}
                      onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))}
                      className="input text-sm pl-7"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Catégorie</label>
                  <select
                    value={expenseForm.category}
                    onChange={e => setExpenseForm(f => ({ ...f, category: e.target.value as ExpenseCategory }))}
                    className="select text-sm"
                  >
                    {EXPENSE_CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={expenseForm.date}
                    onChange={e => setExpenseForm(f => ({ ...f, date: e.target.value }))}
                    className="input text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Client (optionnel)</label>
                  <select
                    value={expenseForm.client_id}
                    onChange={e => setExpenseForm(f => ({ ...f, client_id: e.target.value }))}
                    className="select text-sm"
                  >
                    <option value="">Aucun client</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                  <input
                    type="text"
                    value={expenseForm.notes}
                    onChange={e => setExpenseForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Optionnel..."
                    className="input text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowExpenseForm(false)} className="btn-secondary text-sm py-1.5">
                  Annuler
                </button>
                <button type="submit" disabled={savingExpense} className="btn-primary text-sm py-1.5 disabled:opacity-50">
                  {savingExpense ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Ajouter
                </button>
              </div>
            </form>
          )}

          {/* Expenses list */}
          {expenses.length === 0 ? (
            <div className="card text-center py-12">
              <TrendingDown className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Aucune dépense enregistrée</p>
            </div>
          ) : (
            <div className="card p-0 overflow-hidden">
              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-gray-100">
                {expenses.map(exp => {
                  const cat = EXPENSE_CATEGORIES.find(c => c.value === exp.category)
                  return (
                    <div key={exp.id} className="px-4 py-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm">{exp.title}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={cn('badge text-xs', cat?.color ?? 'badge-gray')}>{cat?.label ?? exp.category}</span>
                          <span className="text-xs text-gray-400">{formatDate(exp.date)}</span>
                          {exp.client?.name && <span className="text-xs text-gray-400">{exp.client.name}</span>}
                        </div>
                        {exp.notes && <p className="text-xs text-gray-400 mt-0.5">{exp.notes}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-medium text-gray-900">{formatCurrency(exp.amount)}</span>
                        <button onClick={() => deleteExpense(exp.id)} className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
              {/* Desktop table */}
              <table className="table hidden md:table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Titre</th>
                    <th>Catégorie</th>
                    <th>Client</th>
                    <th className="text-right">Montant</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(exp => {
                    const cat = EXPENSE_CATEGORIES.find(c => c.value === exp.category)
                    return (
                      <tr key={exp.id}>
                        <td className="text-gray-500 text-xs">{formatDate(exp.date)}</td>
                        <td>
                          <p className="font-medium text-gray-900 text-sm">{exp.title}</p>
                          {exp.notes && <p className="text-xs text-gray-400">{exp.notes}</p>}
                        </td>
                        <td>
                          <span className={cn('badge text-xs', cat?.color ?? 'badge-gray')}>
                            {cat?.label ?? exp.category}
                          </span>
                        </td>
                        <td className="text-gray-500 text-sm">{exp.client?.name ?? '—'}</td>
                        <td className="text-right font-medium text-gray-900 text-sm">
                          {formatCurrency(exp.amount)}
                        </td>
                        <td>
                          <button
                            onClick={() => deleteExpense(exp.id)}
                            className="text-gray-300 hover:text-red-400 transition-colors p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Tab: Rapport fiscal ─────────────────────────────────────────────── */}
      {tab === 'rapport' && (
        <div className="space-y-6">
          {/* Quarter selector */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Période fiscale</h3>
              <div className="flex items-center gap-2">
                <select
                  value={reportYear}
                  onChange={e => setReportYear(Number(e.target.value))}
                  className="select text-sm py-1.5"
                >
                  {[now.getFullYear() - 1, now.getFullYear()].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {QUARTERS.map(({ q, label, months }) => (
                <button
                  key={q}
                  onClick={() => setReportQuarter(q as 1|2|3|4)}
                  className={cn(
                    'py-3 rounded-lg border text-center transition-all',
                    reportQuarter === q
                      ? 'bg-auchu-500 border-auchu-500 text-white'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-auchu-300'
                  )}
                >
                  <div className="text-sm font-semibold">{label}</div>
                  <div className="text-xs opacity-70 mt-0.5">{months}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Report breakdown */}
          <div className="grid grid-cols-2 gap-4">
            {/* Revenue block */}
            <div className="card space-y-3">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Revenus — factures payées
              </h4>
              <ReportRow label="Sous-total (HT)" value={qRevenue} />
              <ReportRow label="TPS collectée (5%)" value={qTPS} highlight="green" />
              <ReportRow label="TVQ collectée (9,975%)" value={qTVQ} highlight="green" />
              <div className="border-t border-gray-100 pt-3">
                <ReportRow label="Total avec taxes" value={r2(qRevenue + qTPS + qTVQ)} bold />
              </div>
              <p className="text-xs text-gray-400">
                {qInvoices.length} facture{qInvoices.length !== 1 ? 's' : ''} payée{qInvoices.length !== 1 ? 's' : ''} ce trimestre
              </p>
            </div>

            {/* Expenses block */}
            <div className="card space-y-3">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Dépenses & RTI admissibles
              </h4>
              <ReportRow label="Total dépenses" value={qExpTotal} />
              <ReportRow label="RTI — TPS (5%)" value={qRtiTPS} highlight="blue" negate />
              <ReportRow label="RTI — TVQ (9,975%)" value={qRtiTVQ} highlight="blue" negate />
              <div className="border-t border-gray-100 pt-3">
                <ReportRow label="Total RTI" value={r2(qRtiTPS + qRtiTVQ)} bold negate />
              </div>
              <p className="text-xs text-gray-400">
                {qExpenses.length} dépense{qExpenses.length !== 1 ? 's' : ''} ce trimestre
              </p>
            </div>
          </div>

          {/* Net to remit */}
          <div className="card bg-gradient-to-br from-auchu-50 to-white border-auchu-200 space-y-3">
            <h4 className="text-sm font-semibold text-auchu-900">Montants nets à remettre</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-lg border border-auchu-100 p-4">
                <p className="text-xs text-gray-500 mb-1">TPS nette</p>
                <p className={cn('text-xl font-semibold', qNetTPS >= 0 ? 'text-gray-900' : 'text-green-600')}>
                  {formatCurrency(Math.abs(qNetTPS))}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {qNetTPS >= 0 ? 'À remettre à l\'ARC' : 'Remboursement dû'}
                </p>
              </div>
              <div className="bg-white rounded-lg border border-auchu-100 p-4">
                <p className="text-xs text-gray-500 mb-1">TVQ nette</p>
                <p className={cn('text-xl font-semibold', qNetTVQ >= 0 ? 'text-gray-900' : 'text-green-600')}>
                  {formatCurrency(Math.abs(qNetTVQ))}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {qNetTVQ >= 0 ? 'À remettre à Revenu Québec' : 'Remboursement dû'}
                </p>
              </div>
              <div className="bg-auchu-500 rounded-lg p-4 text-white">
                <p className="text-xs text-auchu-200 mb-1">Total à remettre</p>
                <p className="text-xl font-semibold">{formatCurrency(r2(qNetTPS + qNetTVQ))}</p>
                <p className="text-xs text-auchu-200 mt-0.5">TPS + TVQ combinées</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 pt-1">
              * Les RTI sont estimés sur 100% des dépenses. Consultez votre comptable pour valider l'admissibilité.
            </p>
          </div>

          <button
            onClick={printReport}
            className="btn-secondary gap-2"
          >
            <Printer className="w-4 h-4" />
            Générer rapport PDF pour comptable
          </button>
        </div>
      )}

      {/* ─── Tab: Factures membres ───────────────────────────────────────────── */}
      {tab === 'membres' && (
        <div className="space-y-6">
          {/* Factures soumises par les membres */}
          <div className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Factures soumises par les membres</h3>
            </div>
            {memberInvoices.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Aucune facture de membre pour l'instant</p>
              </div>
            ) : (
              <>
                <table className="table hidden md:table">
                  <thead>
                    <tr>
                      <th>Membre</th>
                      <th>Période</th>
                      <th>Mode</th>
                      <th className="text-right">Total</th>
                      <th>Statut</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberInvoices.map(inv => (
                      <tr key={inv.id}>
                        <td className="text-sm text-gray-700">{inv.member?.full_name || inv.member?.email || 'Membre'}</td>
                        <td>
                          <Link href={`/dashboard/mes-factures/${inv.id}`} className="text-sm font-medium text-auchu-600 hover:underline">
                            {formatDate(inv.period_start)} – {formatDate(inv.period_end)}
                          </Link>
                        </td>
                        <td className="text-sm text-gray-600">{inv.billing_mode === 'hourly' ? 'Taux horaire' : 'Montant fixe'}</td>
                        <td className="text-right text-sm font-medium text-gray-900 tabular-nums">{formatCurrency(inv.total, inv.currency)}</td>
                        <td>
                          <span className={cn('badge', MEMBER_INVOICE_STATUS_COLORS[inv.status])}>
                            {MEMBER_INVOICE_STATUS_LABELS[inv.status]}
                          </span>
                        </td>
                        <td>
                          {memberInvoiceBusyId === inv.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                          ) : (
                            <div className="flex items-center gap-1">
                              {inv.status === 'envoyee' && (
                                <ActionBtn onClick={() => updateMemberInvoiceStatus(inv.id, 'approuvee')} title="Approuver" icon={CheckCircle} colorClass="hover:text-amber-500" />
                              )}
                              {inv.status === 'approuvee' && (
                                <ActionBtn onClick={() => updateMemberInvoiceStatus(inv.id, 'payee')} title="Marquer payée" icon={CreditCard} colorClass="hover:text-green-500" />
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="md:hidden divide-y divide-gray-100">
                  {memberInvoices.map(inv => (
                    <div key={inv.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{inv.member?.full_name || inv.member?.email || 'Membre'}</p>
                          <Link href={`/dashboard/mes-factures/${inv.id}`} className="text-xs text-auchu-600 hover:underline">
                            {formatDate(inv.period_start)} – {formatDate(inv.period_end)}
                          </Link>
                        </div>
                        <p className="text-sm font-medium text-gray-900 tabular-nums">{formatCurrency(inv.total, inv.currency)}</p>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className={cn('badge', MEMBER_INVOICE_STATUS_COLORS[inv.status])}>
                          {MEMBER_INVOICE_STATUS_LABELS[inv.status]}
                        </span>
                        {memberInvoiceBusyId === inv.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                        ) : (
                          <div className="flex items-center gap-1">
                            {inv.status === 'envoyee' && (
                              <ActionBtn onClick={() => updateMemberInvoiceStatus(inv.id, 'approuvee')} title="Approuver" icon={CheckCircle} colorClass="hover:text-amber-500" size="md" />
                            )}
                            {inv.status === 'approuvee' && (
                              <ActionBtn onClick={() => updateMemberInvoiceStatus(inv.id, 'payee')} title="Marquer payée" icon={CreditCard} colorClass="hover:text-green-500" size="md" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Vue temps par membre */}
          <div className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-wrap gap-3">
              <h3 className="text-sm font-semibold text-gray-900">Temps par membre</h3>
              <div className="flex items-center gap-2 flex-wrap">
                {TIME_PERIODS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setTimePeriod(p.id)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                      timePeriod === p.id ? 'bg-auchu-500 text-white border-auchu-500' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    )}
                  >
                    {p.label}
                  </button>
                ))}
                <button onClick={exportTimeCsv} className="btn-secondary text-xs py-1.5 gap-1.5">
                  <Download className="w-3.5 h-3.5" />
                  Export CSV
                </button>
              </div>
            </div>

            {timeByMember.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Aucun temps enregistré pour cette période</p>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Membre</th>
                    <th>Client</th>
                    <th className="text-right">Heures</th>
                  </tr>
                </thead>
                <tbody>
                  {timeByMember.map((row, i) => (
                    <tr key={i}>
                      <td className="text-sm text-gray-700">{row.member_name}</td>
                      <td className="text-sm text-gray-500">{row.client_name}</td>
                      <td className="text-right text-sm font-medium text-gray-900 tabular-nums">{formatDuration(row.seconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label, value, icon: Icon, iconColor, sub,
}: {
  label: string; value: string; icon: React.ElementType; iconColor: string; sub: string
}) {
  return (
    <div className="card flex items-start gap-3 p-5">
      <div className={cn('p-2 rounded-lg', iconColor)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-xl font-semibold text-gray-900 mt-0.5">{value}</p>
        <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
      </div>
    </div>
  )
}

function ReportRow({
  label, value, highlight, bold, negate,
}: {
  label: string; value: number; highlight?: 'green' | 'blue'; bold?: boolean; negate?: boolean
}) {
  return (
    <div className={cn('flex items-center justify-between text-sm', bold && 'font-semibold')}>
      <span className={cn(
        'text-gray-600',
        highlight === 'green' && 'text-green-700',
        highlight === 'blue' && 'text-blue-700',
      )}>
        {label}
      </span>
      <span className={cn(
        'font-medium tabular-nums',
        highlight === 'green' && 'text-green-700',
        highlight === 'blue' && 'text-blue-700',
        negate && 'text-blue-600',
      )}>
        {negate ? '(' : ''}{formatCurrency(value)}{negate ? ')' : ''}
      </span>
    </div>
  )
}

function InvoiceTable({
  invoices, updatingId, deletingId, onUpdateStatus, onDelete, onSendEmail, compact,
}: {
  invoices: (Invoice & { client?: { id: string; name: string; email: string | null } | null })[]
  updatingId: string | null
  deletingId: string | null
  onUpdateStatus: (id: string, s: InvoiceStatus) => void
  onDelete: (id: string) => void
  onSendEmail: (inv: Invoice & { client?: { id: string; name: string; email: string | null } | null }) => void
  compact?: boolean
}) {
  return (
    <>
      {/* Mobile : cartes empilées */}
      <div className="md:hidden divide-y divide-gray-100">
        {invoices.map(inv => {
          const cfg = INVOICE_STATUS_CONFIG[inv.status as InvoiceStatus]
          const isUpdating = updatingId === inv.id
          const isDeleting = deletingId === inv.id
          const isOverdue = inv.status === 'envoye' && inv.due_date && new Date(inv.due_date) < new Date()

          return (
            <div key={inv.id} className={cn('px-4 py-3', isDeleting && 'opacity-40')}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/dashboard/finance/factures/${inv.id}`}
                    className="text-sm font-medium text-auchu-600 hover:underline"
                  >
                    {inv.invoice_number}
                  </Link>
                  <p className="text-xs text-gray-500 mt-0.5">{inv.client?.name ?? '—'}</p>
                  {!compact && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDate(inv.created_at)}
                      {inv.due_date && ` · échéance ${formatDate(inv.due_date)}`}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-medium text-gray-900 tabular-nums">{formatCurrency(inv.total)}</p>
                  <p className="text-xs text-gray-400 tabular-nums">HT {formatCurrency(inv.subtotal)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 mt-2">
                <div className="flex items-center gap-1 flex-wrap">
                  <span className={cn('badge', cfg?.class)}>{cfg?.label}</span>
                  {isOverdue && <span className="badge badge-red">En retard</span>}
                </div>
                {isUpdating ? (
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400 flex-shrink-0" />
                ) : (
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {inv.status === 'draft' && (
                      <ActionBtn onClick={() => onSendEmail(inv)} title="Envoyer par email" icon={Send} colorClass="hover:text-blue-500" size="md" />
                    )}
                    {(inv.status === 'envoye' || inv.status === 'en_retard') && (
                      <ActionBtn onClick={() => onUpdateStatus(inv.id, 'paye')} title="Marquer payé" icon={CheckCircle} colorClass="hover:text-green-500" size="md" />
                    )}
                    {inv.status === 'envoye' && (
                      <ActionBtn onClick={() => onUpdateStatus(inv.id, 'en_retard')} title="Marquer en retard" icon={AlertCircle} colorClass="hover:text-amber-500" size="md" />
                    )}
                    <ActionBtn onClick={() => onDelete(inv.id)} title="Supprimer" icon={Trash2} colorClass="hover:text-red-400" size="md" />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop : tableau */}
      <table className="table hidden md:table">
        <thead>
          <tr>
            <th>N° Facture</th>
            <th>Client</th>
            {!compact && <th>Date</th>}
            <th className="text-right">HT</th>
            <th className="text-right">TTC</th>
            <th>Statut</th>
            {!compact && <th>Échéance</th>}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {invoices.map(inv => {
            const cfg = INVOICE_STATUS_CONFIG[inv.status as InvoiceStatus]
            const isUpdating = updatingId === inv.id
            const isDeleting = deletingId === inv.id
            const isOverdue = inv.status === 'envoye' && inv.due_date && new Date(inv.due_date) < new Date()

            return (
              <tr key={inv.id} className={cn(isDeleting && 'opacity-40')}>
                <td>
                  <Link
                    href={`/dashboard/finance/factures/${inv.id}`}
                    className="text-sm font-medium text-auchu-600 hover:underline"
                  >
                    {inv.invoice_number}
                  </Link>
                </td>
                <td className="text-sm text-gray-700">{inv.client?.name ?? '—'}</td>
                {!compact && (
                  <td className="text-xs text-gray-400">{formatDate(inv.created_at)}</td>
                )}
                <td className="text-right text-sm text-gray-600 tabular-nums">
                  {formatCurrency(inv.subtotal)}
                </td>
                <td className="text-right text-sm font-medium text-gray-900 tabular-nums">
                  {formatCurrency(inv.total)}
                </td>
                <td>
                  <span className={cn('badge', cfg?.class)}>
                    {cfg?.label}
                  </span>
                  {isOverdue && (
                    <span className="badge badge-red ml-1">En retard</span>
                  )}
                </td>
                {!compact && (
                  <td className="text-xs text-gray-400">
                    {inv.due_date ? formatDate(inv.due_date) : '—'}
                  </td>
                )}
                <td>
                  {isUpdating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                  ) : (
                    <div className="flex items-center gap-1">
                      {inv.status === 'draft' && (
                        <ActionBtn
                          onClick={() => onSendEmail(inv)}
                          title="Envoyer par email"
                          icon={Send}
                          colorClass="hover:text-blue-500"
                        />
                      )}
                      {(inv.status === 'envoye' || inv.status === 'en_retard') && (
                        <ActionBtn
                          onClick={() => onUpdateStatus(inv.id, 'paye')}
                          title="Marquer payé"
                          icon={CheckCircle}
                          colorClass="hover:text-green-500"
                        />
                      )}
                      {inv.status === 'envoye' && (
                        <ActionBtn
                          onClick={() => onUpdateStatus(inv.id, 'en_retard')}
                          title="Marquer en retard"
                          icon={AlertCircle}
                          colorClass="hover:text-amber-500"
                        />
                      )}
                      <ActionBtn
                        onClick={() => onDelete(inv.id)}
                        title="Supprimer"
                        icon={Trash2}
                        colorClass="hover:text-red-400"
                      />
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </>
  )
}

function ActionBtn({
  onClick, title, icon: Icon, colorClass, size = 'sm',
}: {
  onClick: () => void; title: string; icon: React.ElementType; colorClass: string; size?: 'sm' | 'md'
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'rounded-lg text-gray-300 transition-colors',
        size === 'md' ? 'p-2.5 min-h-[40px] min-w-[40px]' : 'p-1',
        colorClass,
      )}
    >
      <Icon className={size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
    </button>
  )
}
