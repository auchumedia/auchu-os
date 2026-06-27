'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Trash2, Loader2, Calculator,
} from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'

const TPS_RATE = 0.05
const TVQ_RATE = 0.09975

function r2(n: number) { return Math.round(n * 100) / 100 }

interface LineItem {
  description: string
  quantity: number
  unit_price: number
}

interface ClientOption {
  id: string
  name: string
  email: string | null
}

function generateInvoiceNumber() {
  const now = new Date()
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const rand   = String(Math.floor(Math.random() * 900) + 100)
  return `FACT-${yyyymm}-${rand}`
}

export default function NouvelleFacturePage() {
  const router = useRouter()

  const [clients, setClients]       = useState<ClientOption[]>([])
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const [form, setForm] = useState({
    client_id:      '',
    invoice_number: generateInvoiceNumber(),
    due_date:       '',
    notes:          '',
    status:         'draft' as 'draft' | 'envoye',
  })

  const [items, setItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unit_price: 0 },
  ])

  // Load clients
  useEffect(() => {
    fetch('/api/clients')
      .then(r => r.json())
      .then(({ data }) => setClients(data ?? []))
  }, [])

  // ─── Item helpers ─────────────────────────────────────────────────────────

  const updateItem = (index: number, field: keyof LineItem, raw: string) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item
      if (field === 'description') return { ...item, description: raw }
      const num = parseFloat(raw) || 0
      return { ...item, [field]: num }
    }))
  }

  const addItem = () =>
    setItems(prev => [...prev, { description: '', quantity: 1, unit_price: 0 }])

  const removeItem = (index: number) =>
    setItems(prev => prev.filter((_, i) => i !== index))

  // ─── Totals ───────────────────────────────────────────────────────────────

  const subtotal   = r2(items.reduce((s, i) => s + i.quantity * i.unit_price, 0))
  const tps_amount = r2(subtotal * TPS_RATE)
  const tvq_amount = r2(subtotal * TVQ_RATE)
  const total      = r2(subtotal + tps_amount + tvq_amount)

  // ─── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async (status: 'draft' | 'envoye') => {
    if (!items.some(i => i.description.trim())) {
      setError('Au moins un article avec une description est requis.')
      return
    }
    setError(null)
    setSaving(true)

    const validItems = items.filter(i => i.description.trim())

    const res = await fetch('/api/factures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:      form.client_id || null,
        invoice_number: form.invoice_number,
        due_date:       form.due_date || null,
        notes:          form.notes || null,
        items:          validItems,
        status,
      }),
    })

    const json = await res.json()
    setSaving(false)

    if (!res.ok) {
      setError(json.error ?? 'Une erreur est survenue.')
      return
    }

    // If sending, open mailto
    if (status === 'envoye' && json.data?.client?.email) {
      const body = `Bonjour,\n\nVeuillez trouver votre facture ${json.data.invoice_number} d'un montant de ${formatCurrency(json.data.total)} TTC.\n\nMerci de votre confiance,`
      window.open(`mailto:${json.data.client.email}?subject=Facture ${json.data.invoice_number}&body=${encodeURIComponent(body)}`)
    }

    router.push('/dashboard/finance')
    router.refresh()
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/finance" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Nouvelle facture</h1>
          <p className="text-sm text-gray-500 mt-0.5">TPS 5% · TVQ 9,975% · Québec</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* ─── Left column (2/3) ─────────────────────────────────────────── */}
        <div className="col-span-2 space-y-5">
          {/* Header info */}
          <section className="card space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Client</label>
                <select
                  value={form.client_id}
                  onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
                  className="select"
                >
                  <option value="">Aucun client</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">N° de facture</label>
                <input
                  type="text"
                  value={form.invoice_number}
                  onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))}
                  className="input font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Date d'échéance</label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                  className="input"
                />
              </div>
            </div>
          </section>

          {/* Line items */}
          <section className="card space-y-3 p-0 overflow-hidden">
            <div className="px-5 pt-4 pb-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Articles & services</h2>
            </div>

            {/* Header row */}
            <div className="grid px-5" style={{ gridTemplateColumns: '1fr 80px 110px 100px 32px' }}>
              {['Description', 'Qté', 'Prix unitaire', 'Total', ''].map(h => (
                <p key={h} className="text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</p>
              ))}
            </div>

            {/* Item rows */}
            <div className="px-5 space-y-2">
              {items.map((item, idx) => {
                const lineTotal = r2(item.quantity * item.unit_price)
                return (
                  <div
                    key={idx}
                    className="grid items-center gap-2"
                    style={{ gridTemplateColumns: '1fr 80px 110px 100px 32px' }}
                  >
                    <input
                      type="text"
                      value={item.description}
                      onChange={e => updateItem(idx, 'description', e.target.value)}
                      placeholder="Description du service..."
                      className="input text-sm"
                    />
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={item.quantity || ''}
                      onChange={e => updateItem(idx, 'quantity', e.target.value)}
                      className="input text-sm text-center"
                    />
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price || ''}
                        onChange={e => updateItem(idx, 'unit_price', e.target.value)}
                        className="input text-sm pl-6"
                        placeholder="0.00"
                      />
                    </div>
                    <p className="text-sm font-medium text-gray-900 tabular-nums text-right pr-1">
                      {formatCurrency(lineTotal)}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      disabled={items.length === 1}
                      className="p-1 text-gray-300 hover:text-red-400 disabled:opacity-30 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>

            <div className="px-5 pb-4">
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1.5 text-sm text-auchu-600 hover:text-auchu-700 font-medium mt-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter un article
              </button>
            </div>
          </section>

          {/* Notes */}
          <section className="card">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Conditions de paiement, informations supplémentaires..."
              rows={3}
              className="input resize-none"
            />
          </section>
        </div>

        {/* ─── Right column (1/3) ────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Tax summary */}
          <section className="card space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-gray-400" />
              Récapitulatif
            </h3>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Sous-total</span>
                <span className="tabular-nums font-medium text-gray-900">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-500 text-xs">
                <span>TPS (5%)</span>
                <span className="tabular-nums">{formatCurrency(tps_amount)}</span>
              </div>
              <div className="flex justify-between text-gray-500 text-xs">
                <span>TVQ (9,975%)</span>
                <span className="tabular-nums">{formatCurrency(tvq_amount)}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between font-semibold text-gray-900">
                <span>Total TTC</span>
                <span className="tabular-nums text-auchu-600">{formatCurrency(total)}</span>
              </div>
            </div>
          </section>

          {/* Tax note */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 space-y-1">
            <p className="font-medium">Taxes québécoises</p>
            <p>TPS : 5% → remise à l'ARC</p>
            <p>TVQ : 9,975% → remise à Revenu Québec</p>
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSubmit('draft')}
              className="w-full btn-secondary justify-center disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Sauvegarder brouillon
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSubmit('envoye')}
              className="w-full btn-primary justify-center disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Créer et envoyer
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center">
            "Créer et envoyer" ouvre votre client email avec un message pré-rempli
          </p>
        </div>
      </div>
    </div>
  )
}
