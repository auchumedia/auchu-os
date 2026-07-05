'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Printer, Send, CheckCircle, CreditCard, Loader2 } from 'lucide-react'
import type { MemberInvoice, MemberInvoiceItem } from '@/types'
import { cn, formatCurrency, formatDate, MEMBER_INVOICE_STATUS_LABELS, MEMBER_INVOICE_STATUS_COLORS } from '@/lib/utils'

interface OrgInfo {
  name: string
  logo_url: string | null
  primary_color: string | null
  email: string | null
  phone: string | null
  website: string | null
  address_street: string | null
  address_city: string | null
  address_province: string | null
  address_postal: string | null
  address_country: string | null
}

interface Props {
  invoice: MemberInvoice
  org: OrgInfo | null
  member: { full_name: string | null; email: string | null } | null
  viewerIsSelf: boolean
  viewerCanApprove: boolean
}

export default function InvoiceMembreDetail({ invoice: initial, org, member, viewerIsSelf, viewerCanApprove }: Props) {
  const [invoice, setInvoice] = useState(initial)
  const [updating, setUpdating] = useState(false)

  const updateStatus = async (status: string) => {
    setUpdating(true)
    const res = await fetch(`/api/member-invoices/${invoice.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      const { data } = await res.json()
      setInvoice(data)
    }
    setUpdating(false)
  }

  const printInvoice = () => {
    const items = (invoice.items as MemberInvoiceItem[]) || []
    const brandColor = org?.primary_color || '#4f46e5'
    const orgName    = org?.name || 'Votre agence'
    const memberName = member?.full_name || member?.email || 'Membre'

    const orgAddressParts = [
      org?.address_street,
      [org?.address_city, org?.address_province].filter(Boolean).join(', '),
      org?.address_postal,
      org?.address_country,
    ].filter(Boolean)

    const html = `<!DOCTYPE html><html lang="fr"><head>
<meta charset="UTF-8"><title>Facture — ${memberName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; color: #111827; font-size: 13px; padding: 48px; background: white; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
  .brand-name { font-size: 18px; font-weight: 700; color: ${brandColor}; }
  .brand-detail { color: #6b7280; font-size: 11px; line-height: 1.6; margin-top: 4px; }
  .meta { text-align: right; }
  .meta-row { color: #6b7280; font-size: 12px; margin-bottom: 2px; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; }
  .party-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af; margin-bottom: 8px; }
  .party-name { font-weight: 600; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead th { background: #f9fafb; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280; border-bottom: 1px solid #e5e7eb; }
  thead th.right { text-align: right; }
  tbody td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; }
  tbody td.right { text-align: right; font-variant-numeric: tabular-nums; }
  .totals { width: 260px; margin-left: auto; }
  .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
  .totals-row.total { font-weight: 700; font-size: 15px; border-top: 1px solid #e5e7eb; margin-top: 8px; padding-top: 12px; }
  .notes { margin-top: 24px; padding: 12px 16px; background: #f9fafb; border-radius: 8px; font-size: 12px; color: #6b7280; }
  .footer { margin-top: 48px; text-align: center; font-size: 11px; color: #d1d5db; }
  @media print { @page { margin: 0.5in; } }
</style></head><body>
<div class="header">
  <div>
    <div class="brand-name">${orgName}</div>
    ${orgAddressParts.length ? `<div class="brand-detail">${orgAddressParts.join('<br>')}</div>` : ''}
    ${org?.email ? `<div class="brand-detail">${org.email}</div>` : ''}
  </div>
  <div class="meta">
    <div class="meta-row" style="font-size:16px;font-weight:600;color:#111">Facture — ${memberName}</div>
    <div class="meta-row">Période : ${formatDate(invoice.period_start)} – ${formatDate(invoice.period_end)}</div>
    <div class="meta-row">Émise le ${formatDate(invoice.created_at)}</div>
  </div>
</div>

<div class="parties">
  <div>
    <div class="party-label">De</div>
    <div class="party-name">${memberName}</div>
    ${invoice.payment_info ? `<div class="brand-detail">${invoice.payment_info.replace(/\n/g, '<br>')}</div>` : ''}
  </div>
  <div>
    <div class="party-label">Facturer à</div>
    <div class="party-name">${orgName}</div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>Description</th>
      ${invoice.billing_mode === 'hourly' ? '<th class="right">Heures</th><th class="right">Taux</th>' : ''}
      <th class="right">Montant</th>
    </tr>
  </thead>
  <tbody>
    ${items.map(item => `
    <tr>
      <td>${item.description}</td>
      ${invoice.billing_mode === 'hourly' ? `<td class="right">${item.hours ?? ''}</td><td class="right">${formatCurrency(item.rate ?? 0, invoice.currency)}</td>` : ''}
      <td class="right">${formatCurrency(item.amount, invoice.currency)}</td>
    </tr>`).join('')}
  </tbody>
</table>

<div class="totals">
  <div class="totals-row total"><span>Total</span><span>${formatCurrency(invoice.total, invoice.currency)}</span></div>
</div>

<div class="footer">Généré via AuchuOS</div>
</body></html>`

    const w = window.open('', '_blank', 'width=900,height=1100')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.print()
  }

  const items = (invoice.items as MemberInvoiceItem[]) || []
  const backHref = viewerIsSelf ? '/dashboard/mes-factures' : '/dashboard/finance'

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href={backHref} className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-gray-900">
                {formatDate(invoice.period_start)} – {formatDate(invoice.period_end)}
              </h1>
              <span className={cn('badge', MEMBER_INVOICE_STATUS_COLORS[invoice.status])}>
                {MEMBER_INVOICE_STATUS_LABELS[invoice.status]}
              </span>
            </div>
            {!viewerIsSelf && (
              <p className="text-sm text-gray-500 mt-0.5">{member?.full_name || member?.email}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {updating && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          <button onClick={printInvoice} className="btn-secondary gap-2">
            <Printer className="w-4 h-4" />
            PDF / Imprimer
          </button>
          {viewerIsSelf && invoice.status === 'brouillon' && (
            <button onClick={() => updateStatus('envoyee')} disabled={updating} className="btn-primary gap-2 disabled:opacity-50">
              <Send className="w-4 h-4" />
              Envoyer
            </button>
          )}
          {viewerCanApprove && invoice.status === 'envoyee' && (
            <button onClick={() => updateStatus('approuvee')} disabled={updating} className="btn-primary gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50">
              <CheckCircle className="w-4 h-4" />
              Approuver
            </button>
          )}
          {viewerCanApprove && invoice.status === 'approuvee' && (
            <button onClick={() => updateStatus('payee')} disabled={updating} className="btn-primary gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50">
              <CreditCard className="w-4 h-4" />
              Marquer payée
            </button>
          )}
        </div>
      </div>

      <div className="card space-y-6">
        <div className="grid grid-cols-2 gap-8 pb-6 border-b border-gray-100">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Mode de facturation</p>
            <p className="font-semibold text-gray-900">{invoice.billing_mode === 'hourly' ? 'Taux horaire' : 'Montant fixe'}</p>
            {invoice.rate != null && (
              <p className="text-sm text-gray-500">{formatCurrency(invoice.rate, invoice.currency)}{invoice.billing_mode === 'hourly' ? '/h' : '/livrable'}</p>
            )}
          </div>
          {invoice.payment_info && (
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Infos de paiement</p>
              <p className="text-sm text-gray-700 whitespace-pre-line">{invoice.payment_info}</p>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Description</th>
                {invoice.billing_mode === 'hourly' && <th className="text-right">Heures</th>}
                {invoice.billing_mode === 'hourly' && <th className="text-right">Taux</th>}
                <th className="text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i}>
                  <td className="font-medium text-gray-900">{item.description}</td>
                  {invoice.billing_mode === 'hourly' && <td className="text-right text-gray-600">{item.hours}</td>}
                  {invoice.billing_mode === 'hourly' && <td className="text-right tabular-nums text-gray-600">{formatCurrency(item.rate ?? 0, invoice.currency)}</td>}
                  <td className="text-right tabular-nums font-medium text-gray-900">{formatCurrency(item.amount, invoice.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <div className="w-64 flex justify-between text-base font-semibold text-gray-900 border-t border-gray-200 pt-3">
            <span>Total</span>
            <span className="tabular-nums text-auchu-600">{formatCurrency(invoice.total, invoice.currency)}</span>
          </div>
        </div>

        {invoice.status === 'payee' && invoice.paid_at && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 border border-green-200">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Payée le {formatDate(invoice.paid_at)}
          </div>
        )}
      </div>
    </div>
  )
}
