import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { redirect }      from 'next/navigation'
import FinanceModule from './FinanceModule'

export const metadata = { title: 'Finance' }

export default async function FinancePage() {
  const ctx = await getOrgContext()
  if (!ctx) redirect('/auth/login')
  if (!ctx.canAccessFinance) redirect('/dashboard') // FINANCE-GATE: owner-only pour l'instant

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

  const [
    { data: invoices },
    { data: expenses },
    { data: clients },
    { data: paidThisMonth },
    { data: expensesThisMonth },
    { data: pendingInvoices },
  ] = await Promise.all([
    supabase
      .from('invoices')
      .select('*, client:clients(id, name, email, company)')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false }),

    supabase
      .from('expenses')
      .select('*, client:clients(id, name)')
      .eq('user_id', user!.id)
      .order('date', { ascending: false }),

    supabase
      .from('clients')
      .select('id, name, email')
      .eq('user_id', user!.id)
      .order('name'),

    supabase
      .from('invoices')
      .select('subtotal')
      .eq('user_id', user!.id)
      .eq('status', 'paye')
      .gte('paid_at', monthStart)
      .lte('paid_at', monthEnd),

    supabase
      .from('expenses')
      .select('amount')
      .eq('user_id', user!.id)
      .gte('date', monthStart.split('T')[0])
      .lte('date', monthEnd.split('T')[0]),

    supabase
      .from('invoices')
      .select('total')
      .eq('user_id', user!.id)
      .in('status', ['envoye', 'en_retard']),
  ])

  const revenue       = (paidThisMonth ?? []).reduce((s, r) => s + (r.subtotal ?? 0), 0)
  const expensesTotal = (expensesThisMonth ?? []).reduce((s, r) => s + (r.amount ?? 0), 0)
  const pending       = (pendingInvoices ?? []).reduce((s, r) => s + (r.total ?? 0), 0)

  return (
    <div className="space-y-6">
      <FinanceModule
        initialInvoices={invoices ?? []}
        initialExpenses={expenses ?? []}
        clients={clients ?? []}
        currentMonth={{
          revenue: Math.round(revenue * 100) / 100,
          expenses: Math.round(expensesTotal * 100) / 100,
          pending: Math.round(pending * 100) / 100,
          pendingCount: pendingInvoices?.length ?? 0,
        }}
      />
    </div>
  )
}
