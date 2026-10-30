'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, FileText, Send, Loader2, Trash2, AlertTriangle } from 'lucide-react'
import type { MemberInvoice } from '@/types'
import { cn, formatCurrency, formatDate, MEMBER_INVOICE_STATUS_LABELS, MEMBER_INVOICE_STATUS_COLORS } from '@/lib/utils'

interface Props {
  initialInvoices: MemberInvoice[]
  hasBillingConfig: boolean
}

export default function MesFacturesClient({ initialInvoices, hasBillingConfig }: Props) {
  const [invoices, setInvoices]   = useState(initialInvoices)
  const [busyId, setBusyId]       = useState<string | null>(null)

  const sendInvoice = async (id: string) => {
    setBusyId(id)
    const res = await fetch(`/api/member-invoices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'envoyee' }),
    })
    if (res.ok) {
      const { data } = await res.json()
      setInvoices(prev => prev.map(inv => inv.id === id ? data : inv))
    }
    setBusyId(null)
  }

  const deleteDraft = async (id: string) => {
    setBusyId(id)
    const res = await fetch(`/api/member-invoices/${id}`, { method: 'DELETE' })
    if (res.ok) setInvoices(prev => prev.filter(inv => inv.id !== id))
    setBusyId(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Mes factures</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {invoices.length === 0 ? 'Aucune facture pour l\'instant' : `${invoices.length} facture${invoices.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Link href="/dashboard/mes-factures/nouvelle" className="btn-primary">
          <Plus className="w-4 h-4" />
          Générer une facture
        </Link>
      </div>

      {!hasBillingConfig && (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>
            Configure ton profil de facturation avant de générer une facture —{' '}
            <Link href="/settings" className="font-medium underline">va dans Paramètres</Link>.
          </p>
        </div>
      )}

      {invoices.length === 0 ? (
        <div className="card text-center py-20">
          <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <h3 className="text-sm font-medium text-gray-700 mb-1">Aucune facture encore</h3>
          <p className="text-xs text-gray-400">Génère ta première facture à partir de ton temps chronométré ou de tes livrables complétés</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="table hidden md:table">
            <thead>
              <tr>
                <th>Période</th>
                <th>Mode</th>
                <th className="text-right">Total</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id}>
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
                    {busyId === inv.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                    ) : (
                      <div className="flex items-center gap-1">
                        {inv.status === 'brouillon' && (
                          <>
                            <button onClick={() => sendInvoice(inv.id)} title="Envoyer" className="p-1 rounded text-gray-300 hover:text-blue-500 hover:bg-blue-50">
                              <Send className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => deleteDraft(inv.id)} title="Supprimer" className="p-1 rounded text-gray-300 hover:text-red-400 hover:bg-red-50">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {invoices.map(inv => (
              <div key={inv.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/dashboard/mes-factures/${inv.id}`} className="text-sm font-medium text-auchu-600 hover:underline">
                    {formatDate(inv.period_start)} – {formatDate(inv.period_end)}
                  </Link>
                  <span className="text-sm font-medium text-gray-900 tabular-nums">{formatCurrency(inv.total, inv.currency)}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className={cn('badge', MEMBER_INVOICE_STATUS_COLORS[inv.status])}>
                    {MEMBER_INVOICE_STATUS_LABELS[inv.status]}
                  </span>
                  {inv.status === 'brouillon' && busyId !== inv.id && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => sendInvoice(inv.id)} className="p-1.5 rounded text-gray-300 hover:text-blue-500 hover:bg-blue-50">
                        <Send className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteDraft(inv.id)} className="p-1.5 rounded text-gray-300 hover:text-red-400 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  {busyId === inv.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
