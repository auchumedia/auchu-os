'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Wallet, TrendingUp, TrendingDown, Plus, X, Loader2, Trash2, AlertTriangle, CheckCircle2, Link2Off, RefreshCw, ChevronLeft, ChevronRight, LifeBuoy } from 'lucide-react'
import { cn, formatCurrency, formatDate, formatDatetime } from '@/lib/utils'
import { EXPENSE_CATEGORIES, type ExpenseCategory } from '@/lib/finance'

interface Revenue {
  id: string
  client_id: string | null
  amount: number
  entry_date: string
  description: string | null
  source: string
  client?: { name: string } | { name: string }[] | null
}

interface Expense {
  id: string
  category: string
  amount: number
  entry_date: string
  description: string | null
  source: string
}

interface ContactOption { id: string; name: string }

const BUBBLE_COLORS = [
  'bg-auchu-500', 'bg-purple-500', 'bg-amber-500', 'bg-teal-500',
  'bg-rose-500', 'bg-indigo-500', 'bg-lime-500', 'bg-slate-500',
]

// Toujours le 1er du mois — jamais une saisie libre, donc jamais de valeur
// partielle/invalide (cf. toMonthParam, strictement YYYY-MM).
function currentMonthDate() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function toMonthParam(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(d: Date) {
  const label = d.toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

type QboStatus = 'loading' | 'disconnected' | 'reconnect_required' | 'connected'
interface QboState {
  status: QboStatus
  companyName: string | null
  environment: 'sandbox' | 'production' | null
  lastSyncAt: string | null
  lastSyncStatus: string | null
}

const AUTO_SYNC_AFTER_MS = 60 * 60 * 1000 // 1h

export default function FinanceSection({ isOwner }: { isOwner: boolean }) {
  const [monthDate, setMonthDate] = useState(currentMonthDate())
  const monthParam = toMonthParam(monthDate)
  const [revenues, setRevenues] = useState<Revenue[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [contacts, setContacts] = useState<ContactOption[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState<'revenue' | 'expense' | null>(null)
  const [qbo, setQbo]           = useState<QboState>({ status: 'loading', companyName: null, environment: null, lastSyncAt: null, lastSyncStatus: null })
  const [syncing, setSyncing]   = useState(false)
  const autoSyncTried           = useRef(false)

  function fetchMonthData() {
    setLoading(true)
    setError(null)
    return Promise.all([
      fetch(`/api/finance/revenus?month=${monthParam}`).then(r => r.json()),
      fetch(`/api/finance/depenses?month=${monthParam}`).then(r => r.json()),
    ]).then(([rev, exp]) => {
      if (rev.error || exp.error) { setError(rev.error || exp.error); return }
      setRevenues(rev.data ?? [])
      setExpenses(exp.data ?? [])
    }).catch(() => setError('Erreur de chargement'))
      .finally(() => setLoading(false))
  }

  async function refreshQboStatus() {
    try {
      const res = await fetch('/api/quickbooks/status')
      const json = await res.json()
      if (!res.ok) { setQbo(s => ({ ...s, status: 'disconnected' })); return }
      setQbo({
        status: json.status ?? 'disconnected',
        companyName: json.companyName ?? null,
        environment: json.environment ?? null,
        lastSyncAt: json.lastSyncAt ?? null,
        lastSyncStatus: json.lastSyncStatus ?? null,
      })
    } catch {
      // Panne réseau / route indisponible — jamais planter la section
      // Finances pour ça, on retombe simplement sur "déconnecté".
      setQbo(s => ({ ...s, status: 'disconnected' }))
    }
  }

  async function runSync() {
    setSyncing(true)
    // reconnect_required est déjà couvert par la bannière dédiée (dès que
    // refreshQboStatus() ci-dessous a rafraîchi qbo.status) — message
    // d'erreur générique seulement pour les échecs qui n'ont pas déjà leur
    // propre affichage, pour qu'une synchro ratée ne reste jamais silencieuse.
    let syncErrorMessage: string | null = null
    try {
      const res = await fetch('/api/quickbooks/sync', { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok && json.error !== 'reconnect_required') {
        syncErrorMessage = json.error === 'not_connected'
          ? 'QuickBooks ne semble plus connecté.'
          : 'La synchronisation QuickBooks a rencontré une erreur. Réessayez dans quelques minutes.'
      }
    } catch {
      syncErrorMessage = 'La synchronisation QuickBooks a échoué (panne réseau). Réessayez dans quelques minutes.'
    } finally {
      setSyncing(false)
      await refreshQboStatus()
      await fetchMonthData()
      // Après fetchMonthData(), qui efface error au démarrage de son propre
      // appel — sinon ce message serait aussitôt effacé.
      if (syncErrorMessage) setError(syncErrorMessage)
    }
  }

  useEffect(() => { refreshQboStatus() }, [])

  // Synchro automatique si connecté et dernière synchro absente ou > 1h —
  // déclenchée en arrière-plan, sans jamais bloquer l'affichage de la page.
  useEffect(() => {
    if (autoSyncTried.current) return
    if (qbo.status !== 'connected') return
    const last = qbo.lastSyncAt ? new Date(qbo.lastSyncAt).getTime() : 0
    if (Date.now() - last < AUTO_SYNC_AFTER_MS) return
    autoSyncTried.current = true
    runSync()
  }, [qbo.status, qbo.lastSyncAt])

  useEffect(() => {
    let cancelled = false
    fetchMonthData().then(() => { if (cancelled) return })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthParam])

  function shiftMonth(delta: number) {
    setMonthDate(d => new Date(d.getFullYear(), d.getMonth() + delta, 1))
  }

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(j => setContacts(j.data ?? [])).catch(() => {})
  }, [])

  const totalRevenue  = useMemo(() => revenues.reduce((s, r) => s + Number(r.amount), 0), [revenues])
  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount), 0), [expenses])
  const profit         = totalRevenue - totalExpenses

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of expenses) map.set(e.category, (map.get(e.category) ?? 0) + Number(e.amount))
    return Array.from(map.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
  }, [expenses])

  const maxCategory = byCategory.length > 0 ? Math.max(...byCategory.map(c => c.amount)) : 0

  async function removeEntry(kind: 'revenue' | 'expense', id: string) {
    if (!confirm('Supprimer cette entrée ?')) return
    const path = kind === 'revenue' ? 'revenus' : 'depenses'
    const res = await fetch(`/api/finance/${path}?id=${id}`, { method: 'DELETE' })
    if (!res.ok) return
    if (kind === 'revenue') setRevenues(rs => rs.filter(r => r.id !== id))
    else setExpenses(es => es.filter(e => e.id !== id))
  }

  const recent = useMemo(() => {
    const items = [
      ...revenues.map(r => ({
        kind: 'revenue' as const, id: r.id, amount: r.amount, date: r.entry_date, source: r.source,
        label: r.description || (Array.isArray(r.client) ? r.client[0]?.name : r.client?.name) || 'Revenu',
      })),
      ...expenses.map(e => ({
        kind: 'expense' as const, id: e.id, amount: e.amount, date: e.entry_date, source: e.source,
        label: e.description || e.category,
      })),
    ]
    return items.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 10)
  }, [revenues, expenses])

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-auchu-500" />
          <h2 className="font-semibold text-gray-900">Finances</h2>
          <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
            Owner / Director
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 border border-gray-200 rounded-full px-1 py-1">
            <button
              onClick={() => shiftMonth(-1)}
              aria-label="Mois précédent"
              className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-700 font-medium w-28 text-center">{monthLabel(monthDate)}</span>
            <button
              onClick={() => shiftMonth(1)}
              aria-label="Mois suivant"
              className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <QuickBooksControl
            qbo={qbo} isOwner={isOwner} syncing={syncing}
            onSync={runSync}
            onDisconnected={() => { refreshQboStatus(); fetchMonthData() }}
          />
        </div>
      </div>

      {/* Visible dès que QuickBooks a été connecté au moins une fois —
          connecté, en erreur (lastSyncStatus/degraded) ou à reconnecter —
          jamais avant la première connexion. */}
      {(qbo.status === 'connected' || qbo.status === 'reconnect_required') && (
        <a
          href="mailto:raphael@auchumedia.com?subject=Support%20AuchuOS%20%2F%20QuickBooks"
          className="text-xs text-gray-400 hover:text-auchu-600 hover:underline inline-flex items-center gap-1.5 -mt-2"
        >
          <LifeBuoy className="w-3.5 h-3.5" />
          Besoin d'aide ? Contacter le support
        </a>
      )}

      {qbo.status === 'reconnect_required' && <QuickBooksReconnectBanner />}

      {error && (
        <div className="card border-red-200 bg-red-50 text-red-700 text-sm p-4">{error}</div>
      )}

      {/* Cartes CA / Dépenses / Profit */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 bg-auchu-50 text-auchu-600">
            <TrendingUp className="w-5 h-5" />
          </div>
          <p className="text-2xl font-semibold text-gray-900">{loading ? '—' : formatCurrency(totalRevenue)}</p>
          <p className="text-xs text-gray-400 mt-1">Chiffre d'affaires du mois</p>
        </div>
        <div className="card p-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 bg-red-50 text-red-600">
            <TrendingDown className="w-5 h-5" />
          </div>
          <p className="text-2xl font-semibold text-gray-900">{loading ? '—' : formatCurrency(totalExpenses)}</p>
          <p className="text-xs text-gray-400 mt-1">Dépenses du mois</p>
        </div>
        <div className="card p-5">
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-4', profit >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600')}>
            <Wallet className="w-5 h-5" />
          </div>
          <p className={cn('text-2xl font-semibold', profit >= 0 ? 'text-green-600' : 'text-red-600')}>
            {loading ? '—' : formatCurrency(profit)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Profit</p>
        </div>
      </div>

      {/* Ligne de calcul */}
      <div className="card py-3 px-5 flex items-center justify-center gap-2 text-sm text-gray-500 flex-wrap">
        <span className="font-medium text-gray-700">{formatCurrency(totalRevenue)}</span>
        <span>−</span>
        <span className="font-medium text-gray-700">{formatCurrency(totalExpenses)}</span>
        <span>=</span>
        <span className={cn('font-semibold', profit >= 0 ? 'text-green-600' : 'text-red-600')}>{formatCurrency(profit)}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bulles dépenses par catégorie */}
        <div className="card">
          <p className="text-sm font-semibold text-gray-900 mb-4">Dépenses par catégorie</p>
          {byCategory.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Aucune dépense ce mois-ci.</p>
          ) : (
            <div className="flex items-end justify-center gap-3 flex-wrap py-4 min-h-[140px]">
              {byCategory.map((c, i) => {
                const size = maxCategory > 0 ? 40 + Math.round(70 * Math.sqrt(c.amount / maxCategory)) : 40
                return (
                  <div key={c.category} className="flex flex-col items-center gap-1.5" title={formatCurrency(c.amount)}>
                    <div
                      className={cn('rounded-full flex items-center justify-center text-white text-xs font-semibold shadow-sm', BUBBLE_COLORS[i % BUBBLE_COLORS.length])}
                      style={{ width: size, height: size }}
                    >
                      {formatCurrency(c.amount)}
                    </div>
                    <span className="text-[11px] text-gray-500 text-center max-w-[80px] truncate">{c.category}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Liste récente */}
        <div className="card p-0 overflow-hidden">
          <p className="text-sm font-semibold text-gray-900 px-5 pt-4 pb-2">Entrées récentes</p>
          {recent.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Aucune entrée ce mois-ci.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {recent.map(item => {
                const isSynced = item.source === 'quickbooks'
                return (
                  <div key={`${item.kind}-${item.id}`} className="flex items-center gap-3 px-5 py-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm text-gray-800 truncate">{item.label}</p>
                        {isSynced && (
                          <span className="text-[9px] font-medium uppercase tracking-wide text-green-700 bg-green-50 rounded-full px-1.5 py-0.5 flex-shrink-0">
                            QuickBooks
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">{formatDate(item.date)}</p>
                    </div>
                    <span className={cn('text-sm font-medium flex-shrink-0', item.kind === 'revenue' ? 'text-green-600' : 'text-red-500')}>
                      {item.kind === 'revenue' ? '+' : '−'}{formatCurrency(item.amount)}
                    </span>
                    {/* Les entrées importées de QuickBooks ne sont jamais
                        supprimables à la main — seules les manuelles le sont. */}
                    {isSynced ? (
                      <span className="w-[26px] flex-shrink-0" aria-hidden />
                    ) : (
                      <button
                        onClick={() => removeEntry(item.kind, item.id)}
                        className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setFormOpen('revenue')} className="btn-primary text-sm">
          <Plus className="w-4 h-4" /> Revenu
        </button>
        <button onClick={() => setFormOpen('expense')} className="btn-secondary text-sm">
          <Plus className="w-4 h-4" /> Dépense
        </button>
      </div>

      {formOpen && (
        <EntryForm
          kind={formOpen}
          contacts={contacts}
          onClose={() => setFormOpen(null)}
          onCreated={(kind, entry) => {
            if (kind === 'revenue') setRevenues(rs => [entry as Revenue, ...rs])
            else setExpenses(es => [entry as Expense, ...es])
            setFormOpen(null)
          }}
        />
      )}
    </section>
  )
}

function EntryForm({
  kind, contacts, onClose, onCreated,
}: {
  kind: 'revenue' | 'expense'
  contacts: ContactOption[]
  onClose: () => void
  onCreated: (kind: 'revenue' | 'expense', entry: Revenue | Expense) => void
}) {
  const [amount, setAmount]           = useState('')
  const [entryDate, setEntryDate]     = useState(new Date().toISOString().split('T')[0])
  const [category, setCategory]       = useState<ExpenseCategory>(EXPENSE_CATEGORIES[0])
  const [clientId, setClientId]       = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const path = kind === 'revenue' ? 'revenus' : 'depenses'
    const body = kind === 'revenue'
      ? { amount, entry_date: entryDate, client_id: clientId || null, description }
      : { amount, entry_date: entryDate, category, description }

    const res = await fetch(`/api/finance/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { setError(json.error || 'Erreur'); return }
    onCreated(kind, json.data)
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">{kind === 'revenue' ? 'Nouveau revenu' : 'Nouvelle dépense'}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">Montant</label>
            <input type="number" step="0.01" min="0" required value={amount} onChange={e => setAmount(e.target.value)} className="input" placeholder="0.00" />
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" required value={entryDate} onChange={e => setEntryDate(e.target.value)} className="input" />
          </div>
          {kind === 'revenue' ? (
            <div>
              <label className="label">Contact (optionnel)</label>
              <select value={clientId} onChange={e => setClientId(e.target.value)} className="select">
                <option value="">Aucun</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="label">Catégorie</label>
              <select value={category} onChange={e => setCategory(e.target.value as ExpenseCategory)} className="select">
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label">Description (optionnel)</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="input" />
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Annuler</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Contrôle compact dans l'en-tête — connecter / synchroniser / déconnecter /
// reconnecter. La connexion (consentement Intuit) exige une vraie navigation
// de page (pas un fetch) : <a href="/api/quickbooks/connect"> suit la
// redirection vers l'écran de consentement QuickBooks. Connecter/déconnecter
// sont réservés au propriétaire (isOwner) — director voit le statut et peut
// synchroniser, mais ne gère pas la connexion elle-même.
function QuickBooksControl({
  qbo, isOwner, syncing, onSync, onDisconnected,
}: {
  qbo: QboState
  isOwner: boolean
  syncing: boolean
  onSync: () => void
  onDisconnected: () => void
}) {
  const [disconnecting, setDisconnecting] = useState(false)
  const [showDisconnectModal, setShowDisconnectModal] = useState(false)

  async function disconnect(deleteImportedData: boolean) {
    setShowDisconnectModal(false)
    setDisconnecting(true)
    try {
      await fetch('/api/quickbooks/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteImportedData }),
      })
    } catch {
      // Le nettoyage local côté serveur a lieu même si la révocation réseau
      // échoue (cf. api/quickbooks/disconnect/route.ts) — on rafraîchit le
      // statut dans tous les cas plutôt que de bloquer l'UI.
    } finally {
      setDisconnecting(false)
      // Rafraîchit le statut QuickBooks ET l'affichage financier (chiffres,
      // bulles, entrées récentes) — la déconnexion a pu supprimer des
      // entrées importées.
      onDisconnected()
    }
  }

  const sandboxBadge = qbo.environment === 'sandbox' && (
    <span className="text-[9px] font-medium uppercase tracking-wide text-amber-700 bg-amber-50 rounded-full px-1.5 py-0.5">
      Sandbox
    </span>
  )

  if (qbo.status === 'loading') {
    return <Loader2 className="w-4 h-4 text-gray-300 animate-spin" />
  }

  if (qbo.status === 'connected') {
    return (
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-end">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-full px-3 py-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {qbo.companyName ? `Connecté à ${qbo.companyName}` : 'QuickBooks connecté'}
            {sandboxBadge}
          </span>
          <span className="text-[10px] text-gray-400 mt-0.5">
            {qbo.lastSyncAt ? `Dernière synchro : ${formatDatetime(qbo.lastSyncAt)}` : 'Pas encore synchronisé'}
          </span>
        </div>
        <button
          onClick={onSync}
          disabled={syncing}
          title="Synchroniser avec QuickBooks"
          className="p-1.5 rounded-full text-gray-400 hover:text-auchu-600 hover:bg-auchu-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')} />
        </button>
        {isOwner && (
          <button
            onClick={() => setShowDisconnectModal(true)}
            disabled={disconnecting}
            title="Déconnecter QuickBooks"
            className="p-1.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2Off className="w-3.5 h-3.5" />}
          </button>
        )}
        {showDisconnectModal && (
          <DisconnectConfirmModal
            onCancel={() => setShowDisconnectModal(false)}
            onConfirm={disconnect}
          />
        )}
      </div>
    )
  }

  // 'disconnected' ou 'reconnect_required' (ce dernier a déjà la bannière
  // pleine largeur ci-dessous — ici on garde juste le bouton d'action).
  if (!isOwner) {
    return (
      <span className="text-xs text-gray-400">
        {qbo.status === 'reconnect_required'
          ? 'QuickBooks doit être reconnecté par le propriétaire'
          : 'Connexion QuickBooks gérée par le propriétaire'}
        {sandboxBadge}
      </span>
    )
  }

  return (
    <a href="/api/quickbooks/connect" className="btn-secondary text-xs py-1.5 px-3">
      {qbo.status === 'reconnect_required' ? 'Reconnecter QuickBooks' : 'Connecter QuickBooks'}
    </a>
  )
}

// Confirmation de déconnexion — case "supprimer les données importées"
// cochée par défaut. Les entrées manuelles ne sont jamais supprimées,
// qu'elle soit cochée ou non (cf. api/quickbooks/disconnect/route.ts, qui
// filtre toujours source = 'quickbooks').
function DisconnectConfirmModal({
  onCancel, onConfirm,
}: {
  onCancel: () => void
  onConfirm: (deleteImportedData: boolean) => void
}) {
  const [deleteImportedData, setDeleteImportedData] = useState(true)

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Déconnecter QuickBooks ?</h3>
          <button onClick={onCancel} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Le jeton sera révoqué chez Intuit. Les entrées saisies à la main ne sont jamais supprimées.
        </p>
        <label className="flex items-start gap-2.5 mb-5 cursor-pointer">
          <input
            type="checkbox"
            checked={deleteImportedData}
            onChange={e => setDeleteImportedData(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-auchu-600 focus:ring-auchu-500"
          />
          <span className="text-sm text-gray-700">
            Supprimer aussi les données importées de QuickBooks (revenus et dépenses)
          </span>
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="btn-secondary flex-1">Annuler</button>
          <button
            type="button"
            onClick={() => onConfirm(deleteImportedData)}
            className="flex-1 justify-center inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-full transition-colors"
          >
            Déconnecter
          </button>
        </div>
      </div>
    </div>
  )
}

// Bannière pleine largeur — affichée uniquement quand le refresh token est
// expiré/révoqué (invalid_grant) : message clair + bouton Reconnecter,
// jamais une erreur brute ni une page cassée (point 4 du questionnaire).
function QuickBooksReconnectBanner() {
  return (
    <div className="card border-amber-200 bg-amber-50 flex items-center gap-3 py-3 px-4">
      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
      <p className="text-sm text-amber-800 flex-1">
        QuickBooks doit être reconnecté — la connexion a expiré ou a été révoquée côté Intuit.
      </p>
      <a href="/api/quickbooks/connect" className="btn-primary text-xs py-1.5 px-3 flex-shrink-0">
        Reconnecter
      </a>
    </div>
  )
}
