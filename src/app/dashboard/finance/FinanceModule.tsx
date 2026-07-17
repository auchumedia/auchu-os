'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Plus, CreditCard, Trash2,
  CheckCircle, Send, AlertCircle, FileText, Loader2,
  Users,
} from 'lucide-react'
import { Invoice, MemberInvoice } from '@/types'
import { cn, formatCurrency, formatDate, MEMBER_INVOICE_STATUS_LABELS, MEMBER_INVOICE_STATUS_COLORS } from '@/lib/utils'

// ─── Constants ────────────────────────────────────────────────────────────────

const INVOICE_STATUS_CONFIG = {
  envoye:    { label: 'Envoyée', class: 'badge-blue',  icon: Send },
  paye:      { label: 'Payée',   class: 'badge-green', icon: CheckCircle },
  en_retard: { label: 'En retard', class: 'badge-red', icon: AlertCircle },
}

type Tab = 'factures' | 'membres'
type InvoiceStatus = 'envoye' | 'paye' | 'en_retard'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  initialInvoices: (Invoice & { client?: { id: string; name: string; email: string | null } | null })[]
  currentMonth: { pending: number; pendingCount: number }
  memberInvoices: MemberInvoice[]
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FinanceModule({
  initialInvoices,
  currentMonth,
  memberInvoices: initialMemberInvoices,
}: Props) {
  const [tab, setTab] = useState<Tab>('factures')
  const [invoices, setInvoices] = useState(initialInvoices)
  const [memberInvoices, setMemberInvoices] = useState(initialMemberInvoices)
  const [memberInvoiceBusyId, setMemberInvoiceBusyId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'tout'>('tout')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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

  // ─── Filtered invoices ──────────────────────────────────────────────────────

  const filteredInvoices = statusFilter === 'tout'
    ? invoices
    : invoices.filter(inv => inv.status === statusFilter)

  // ─── Render ─────────────────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string }[] = [
    { id: 'factures', label: `Factures (${invoices.length})` },
    { id: 'membres',  label: `Factures membres (${memberInvoices.length})` },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Finance</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {currentMonth.pendingCount} facture{currentMonth.pendingCount !== 1 ? 's' : ''} en attente
            {currentMonth.pendingCount > 0 && ` · ${formatCurrency(currentMonth.pending)}`}
          </p>
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

      {/* ─── Tab: Factures ───────────────────────────────────────────────────── */}
      {tab === 'factures' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            {(['tout', 'envoye', 'paye', 'en_retard'] as const).map(s => (
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

      {/* ─── Tab: Factures membres ───────────────────────────────────────────── */}
      {tab === 'membres' && (
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
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InvoiceTable({
  invoices, updatingId, deletingId, onUpdateStatus, onDelete, onSendEmail,
}: {
  invoices: (Invoice & { client?: { id: string; name: string; email: string | null } | null })[]
  updatingId: string | null
  deletingId: string | null
  onUpdateStatus: (id: string, s: InvoiceStatus) => void
  onDelete: (id: string) => void
  onSendEmail: (inv: Invoice & { client?: { id: string; name: string; email: string | null } | null }) => void
}) {
  return (
    <>
      {/* Mobile : cartes empilées */}
      <div className="md:hidden divide-y divide-gray-100">
        {invoices.map(inv => {
          const cfg = INVOICE_STATUS_CONFIG[inv.status as InvoiceStatus]
          const isUpdating = updatingId === inv.id
          const isDeleting = deletingId === inv.id

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
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDate(inv.created_at)}
                    {inv.due_date && ` · échéance ${formatDate(inv.due_date)}`}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-medium text-gray-900 tabular-nums">{formatCurrency(inv.total)}</p>
                  <p className="text-xs text-gray-400 tabular-nums">HT {formatCurrency(inv.subtotal)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 mt-2">
                <span className={cn('badge', cfg?.class)}>{cfg?.label}</span>
                {isUpdating ? (
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400 flex-shrink-0" />
                ) : (
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <ActionBtn onClick={() => onSendEmail(inv)} title="Envoyer par email" icon={Send} colorClass="hover:text-blue-500" size="md" />
                    {(inv.status === 'envoye' || inv.status === 'en_retard') && (
                      <ActionBtn onClick={() => onUpdateStatus(inv.id, 'paye')} title="Marquer payée" icon={CheckCircle} colorClass="hover:text-green-500" size="md" />
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
            <th>Date</th>
            <th className="text-right">HT</th>
            <th className="text-right">TTC</th>
            <th>Statut</th>
            <th>Échéance</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {invoices.map(inv => {
            const cfg = INVOICE_STATUS_CONFIG[inv.status as InvoiceStatus]
            const isUpdating = updatingId === inv.id
            const isDeleting = deletingId === inv.id

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
                <td className="text-xs text-gray-400">{formatDate(inv.created_at)}</td>
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
                </td>
                <td className="text-xs text-gray-400">
                  {inv.due_date ? formatDate(inv.due_date) : '—'}
                </td>
                <td>
                  {isUpdating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                  ) : (
                    <div className="flex items-center gap-1">
                      <ActionBtn
                        onClick={() => onSendEmail(inv)}
                        title="Envoyer par email"
                        icon={Send}
                        colorClass="hover:text-blue-500"
                      />
                      {(inv.status === 'envoye' || inv.status === 'en_retard') && (
                        <ActionBtn
                          onClick={() => onUpdateStatus(inv.id, 'paye')}
                          title="Marquer payée"
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
