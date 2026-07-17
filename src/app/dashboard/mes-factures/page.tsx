import { createClient }  from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { redirect }      from 'next/navigation'
import MesFacturesClient from './MesFacturesClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Mes factures' }

const BILLABLE_ROLES = ['director', 'chef_equipe', 'stratege', 'monteur']

export default async function MesFacturesPage() {
  const ctx = await getOrgContext()
  if (!ctx) redirect('/auth/login')
  if (!BILLABLE_ROLES.includes(ctx.role)) redirect('/dashboard')

  const supabase = await createClient()

  const [{ data: invoices }, { data: config }] = await Promise.all([
    supabase
      .from('member_invoices')
      .select('*')
      .eq('member_id', ctx.userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('member_billing_config')
      .select('billing_mode, hourly_rate, fixed_rate, currency, period, payment_info')
      .eq('user_id', ctx.userId)
      .maybeSingle(),
  ])

  return (
    <div className="space-y-6">
      <MesFacturesClient
        initialInvoices={invoices ?? []}
        hasBillingConfig={!!config}
      />
    </div>
  )
}
