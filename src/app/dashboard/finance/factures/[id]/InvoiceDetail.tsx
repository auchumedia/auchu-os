'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Printer, Send, CheckCircle, AlertCircle, Loader2,
} from 'lucide-react'
import { Invoice, InvoiceItem } from '@/types'
import { cn, formatCurrency, formatDate } from '@/lib/utils'

type InvoiceStatus = 'envoye' | 'paye' | 'en_retard'

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; class: string }> = {
  envoye:    { label: 'Envoyée',   class: 'badge-blue'  },
  paye:      { label: 'Payée',     class: 'badge-green' },
  en_retard: { label: 'En retard', class: 'badge-red'   },
}

interface OrgInfo {
  name:             string
  logo_url:         string | null
  primary_color:    string | null
  email:            string | null
  phone:            string | null
  website:          string | null
  address_street:   string | null
  address_city:     string | null
  address_province: string | null
  address_postal:   string | null
  address_country:  string | null
}

interface Props {
  invoice: Invoice & {
    client?: {
      id: string
      name: string
      email: string | null
      phone: string | null
      company: string | null
    } | null
  }
  org: OrgInfo | null
}

export default function InvoiceDetail({ invoice: initial, org }: Props) {
  const router = useRouter()
  const [invoice, setInvoice] = useState(initial)
  const [updating, setUpdating] = useState(false)

  const updateStatus = async (status: InvoiceStatus) => {
    setUpdating(true)
    const res = await fetch(`/api/factures/${invoice.id}`, {
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

  const sendEmail = () => {
    if (!invoice.client?.email) {
      alert('Aucun email associé à ce client.')
      return
    }
    const body = [
      'Bonjour,',
      '',
      `Veuillez trouver ci-joint votre facture ${invoice.invoice_number} d'un montant de ${formatCurrency(invoice.total)} TTC (TPS + TVQ incluses).`,
      invoice.due_date ? `Date d'échéance : ${formatDate(invoice.due_date)}.` : '',
      '',
      `Sous-total : ${formatCurrency(invoice.subtotal)}`,
      `TPS (5%) : ${formatCurrency(invoice.tps_amount ?? 0)}`,
      `TVQ (9,975%) : ${formatCurrency(invoice.tvq_amount ?? 0)}`,
      `Total : ${formatCurrency(invoice.total)}`,
      '',
      'Merci de votre confiance,',
    ].join('\n')

    window.open(
      `mailto:${invoice.client.email}?subject=Facture ${invoice.invoice_number}&body=${encodeURIComponent(body)}`
    )
  }

  const printInvoice = () => {
    const items       = (invoice.items as InvoiceItem[]) || []
    const brandColor  = org?.primary_color || '#4f46e5'
    const orgName     = org?.name || 'Votre agence'

    // Adresse de l'émetteur
    const orgAddressParts = [
      org?.address_street,
      [org?.address_city, org?.address_province].filter(Boolean).join(', '),
      org?.address_postal,
      org?.address_country,
    ].filter(Boolean)
    const orgAddressHtml = orgAddressParts.join('<br>')

    // Logo ou initiales
    const orgInitials = orgName.split(/\s+/).map((w: string) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
    const brandHeader = org?.logo_url
      ? `<img src="${org.logo_url}" alt="${orgName}" style="height:48px;width:auto;object-fit:contain;display:block;margin-bottom:6px">`
      : `<div style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:12px;background:${brandColor};color:white;font-size:18px;font-weight:800;margin-bottom:6px">${orgInitials}</div>`

    const html = `<!DOCTYPE html><html lang="fr"><head>
<meta charset="UTF-8"><title>Facture ${invoice.invoice_number}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; color: #111827; font-size: 13px; padding: 48px; background: white; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
  .brand-name { font-size: 18px; font-weight: 700; color: ${brandColor}; margin: 0; }
  .brand-detail { color: #6b7280; font-size: 11px; line-height: 1.6; margin-top: 4px; }
  .invoice-meta { text-align: right; }
  .invoice-number { font-size: 18px; font-weight: 600; margin-bottom: 4px; }
  .meta-row { color: #6b7280; font-size: 12px; margin-bottom: 2px; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; }
  .party-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af; margin-bottom: 8px; }
  .party-name { font-weight: 600; font-size: 14px; margin-bottom: 4px; }
  .party-detail { color: #6b7280; font-size: 12px; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead th { background: #f9fafb; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; border-bottom: 1px solid #e5e7eb; }
  thead th.right { text-align: right; }
  tbody td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; }
  tbody td.right { text-align: right; font-variant-numeric: tabular-nums; }
  .totals { width: 280px; margin-left: auto; }
  .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
  .totals-row.border-t { border-top: 1px solid #e5e7eb; margin-top: 8px; padding-top: 12px; }
  .totals-row.total { font-weight: 700; font-size: 15px; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; }
  .badge-green { background: #dcfce7; color: #166534; }
  .badge-blue  { background: #dbeafe; color: #1e40af; }
  .badge-gray  { background: #f3f4f6; color: #374151; }
  .badge-red   { background: #fee2e2; color: #991b1b; }
  .notes { margin-top: 24px; padding: 12px 16px; background: #f9fafb; border-radius: 8px; font-size: 12px; color: #6b7280; }
  .footer { margin-top: 48px; text-align: center; font-size: 11px; color: #d1d5db; }
  @media print { @page { margin: 0.5in; } }
</style></head><body>
<div class="header">
  <div>
    ${brandHeader}
    <div class="brand-name">${orgName}</div>
    ${orgAddressHtml ? `<div class="brand-detail">${orgAddressHtml}</div>` : ''}
    ${org?.email  ? `<div class="brand-detail">${org.email}</div>` : ''}
    ${org?.phone  ? `<div class="brand-detail">${org.phone}</div>` : ''}
    ${org?.website ? `<div class="brand-detail">${org.website}</div>` : ''}
  </div>
  <div class="invoice-meta">
    <div class="invoice-number">${invoice.invoice_number}</div>
    <div class="meta-row">Émise le ${formatDate(invoice.created_at)}</div>
    ${invoice.due_date ? `<div class="meta-row">Échéance : ${formatDate(invoice.due_date)}</div>` : ''}
    <div style="margin-top:8px">
      <span class="badge badge-${STATUS_CONFIG[invoice.status as InvoiceStatus]?.class?.replace('badge-', '') || 'gray'}">${STATUS_CONFIG[invoice.status as InvoiceStatus]?.label || invoice.status}</span>
    </div>
  </div>
</div>

<div class="parties">
  <div>
    <div class="party-label">De</div>
    <div class="party-name">${orgName}</div>
    ${orgAddressHtml ? `<div class="party-detail">${orgAddressHtml}</div>` : ''}
  </div>
  ${invoice.client ? `
  <div>
    <div class="party-label">Facturer à</div>
    <div class="party-name">${invoice.client.name}</div>
    <div class="party-detail">
      ${invoice.client.company ? invoice.client.company + '<br>' : ''}
      ${invoice.client.email ?? ''}
      ${invoice.client.phone ? '<br>' + invoice.client.phone : ''}
    </div>
  </div>` : ''}
</div>

<table>
  <thead>
    <tr>
      <th>Description</th>
      <th class="right">Qté</th>
      <th class="right">Prix unitaire</th>
      <th class="right">Total</th>
    </tr>
  </thead>
  <tbody>
    ${items.map(item => `
    <tr>
      <td>${item.description}</td>
      <td class="right">${item.quantity}</td>
      <td class="right">${formatCurrency(item.unit_price)}</td>
      <td class="right">${formatCurrency(item.total)}</td>
    </tr>`).join('')}
  </tbody>
</table>

<div class="totals">
  <div class="totals-row"><span>Sous-total</span><span>${formatCurrency(invoice.subtotal)}</span></div>
  <div class="totals-row" style="color:#6b7280"><span>TPS (5%)</span><span>${formatCurrency(invoice.tps_amount ?? 0)}</span></div>
  <div class="totals-row" style="color:#6b7280"><span>TVQ (9,975%)</span><span>${formatCurrency(invoice.tvq_amount ?? 0)}</span></div>
  <div class="totals-row border-t total"><span>Total TTC</span><span>${formatCurrency(invoice.total)}</span></div>
</div>

${invoice.notes ? `<div class="notes"><strong>Notes :</strong> ${invoice.notes}</div>` : ''}

<div class="footer">Généré via AuchuOS · TPS et TVQ applicables selon la réglementation québécoise</div>
</body></html>`

    const w = window.open('', '_blank', 'width=900,height=1100')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.print()
  }

  const cfg = STATUS_CONFIG[invoice.status as InvoiceStatus]
  const items = (invoice.items as InvoiceItem[]) || []

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/finance" className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-gray-900">{invoice.invoice_number}</h1>
              <span className={cn('badge', cfg?.class)}>{cfg?.label}</span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              Émise le {formatDate(invoice.created_at)}
              {invoice.due_date && ` · Échéance ${formatDate(invoice.due_date)}`}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {updating && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          <button onClick={printInvoice} className="btn-secondary gap-2">
            <Printer className="w-4 h-4" />
            PDF / Imprimer
          </button>
          <button onClick={sendEmail} className="btn-secondary gap-2">
            <Send className="w-4 h-4" />
            Envoyer par email
          </button>
          {(invoice.status === 'envoye' || invoice.status === 'en_retard') && (
            <button
              onClick={() => updateStatus('paye')}
              disabled={updating}
              className="btn-primary gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              Marquer payée
            </button>
          )}
          {invoice.status === 'envoye' && (
            <button
              onClick={() => updateStatus('en_retard')}
              disabled={updating}
              className="btn-secondary gap-2 text-amber-600 border-amber-200 hover:border-amber-300"
            >
              <AlertCircle className="w-4 h-4" />
              En retard
            </button>
          )}
        </div>
      </div>

      {/* Invoice card */}
      <div className="card space-y-6">
        {/* Parties */}
        <div className="grid grid-cols-2 gap-8 pb-6 border-b border-gray-100">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Votre agence</p>
            <p className="font-semibold text-gray-900">AuchuOS</p>
          </div>
          {invoice.client && (
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Facturer à</p>
              <p className="font-semibold text-gray-900">{invoice.client.name}</p>
              {invoice.client.company && <p className="text-sm text-gray-500">{invoice.client.company}</p>}
              {invoice.client.email && <p className="text-sm text-gray-500">{invoice.client.email}</p>}
              {invoice.client.phone && <p className="text-sm text-gray-500">{invoice.client.phone}</p>}
            </div>
          )}
        </div>

        {/* Items */}
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Description</th>
                <th className="text-center">Qté</th>
                <th className="text-right">Prix unitaire</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i}>
                  <td className="font-medium text-gray-900">{item.description}</td>
                  <td className="text-center text-gray-600">{item.quantity}</td>
                  <td className="text-right tabular-nums text-gray-600">{formatCurrency(item.unit_price)}</td>
                  <td className="text-right tabular-nums font-medium text-gray-900">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Sous-total</span>
              <span className="tabular-nums">{formatCurrency(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>TPS (5%)</span>
              <span className="tabular-nums">{formatCurrency(invoice.tps_amount ?? 0)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>TVQ (9,975%)</span>
              <span className="tabular-nums">{formatCurrency(invoice.tvq_amount ?? 0)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-gray-900 border-t border-gray-200 pt-2 mt-2">
              <span>Total TTC</span>
              <span className="tabular-nums text-auchu-600">{formatCurrency(invoice.total)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
            <p className="text-sm text-gray-700">{invoice.notes}</p>
          </div>
        )}

        {/* Paid info */}
        {invoice.status === 'paye' && invoice.paid_at && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 border border-green-200">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Payée le {formatDate(invoice.paid_at)}
          </div>
        )}
      </div>
    </div>
  )
}
