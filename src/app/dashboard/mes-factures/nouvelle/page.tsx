import { createClient }  from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { redirect }      from 'next/navigation'
import NouvelleFactureMembre from './NouvelleFactureMembre'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Générer une facture' }

const BILLABLE_ROLES = ['director', 'chef_equipe', 'stratege', 'monteur']

export default async function NouvelleFactureMembrePage() {
  const ctx = await getOrgContext()
  if (!ctx) redirect('/auth/login')
  if (!BILLABLE_ROLES.includes(ctx.role)) redirect('/dashboard')

  const supabase = await createClient()

  const { data: config } = await supabase
    .from('member_billing_config')
    .select('billing_mode, hourly_rate, fixed_rate, currency, period, payment_info')
    .eq('user_id', ctx.userId)
    .maybeSingle()

  if (!config) redirect('/settings')

  // ── Source de données selon le mode de facturation ──────────────────────────
  let hourlyEntries: {
    task_id: string; started_at: string; ended_at: string | null; duration_seconds: number | null
    task: { title: string; client: { name: string } | null } | null
  }[] = []
  let fixedDeliverables: {
    task_id: string; title: string; approved_at: string | null
    client: { name: string } | null
  }[] = []

  if (config.billing_mode === 'hourly') {
    const { data } = await supabase
      .from('time_entries')
      .select('task_id, started_at, ended_at, duration_seconds, task:tasks(title, client:clients(name))')
      .eq('user_id', ctx.userId)
      .not('duration_seconds', 'is', null)
      .order('started_at', { ascending: false })
      .limit(500)
    hourlyEntries = (data ?? []) as any
  } else {
    const { data } = await supabase
      .from('tasks')
      .select('id, title, approved_at, client:clients(name)')
      .eq('assigned_to', ctx.userId)
      .eq('status', 'approuve')
      .order('approved_at', { ascending: false })
      .limit(500)
    fixedDeliverables = (data ?? []).map((t: any) => ({
      task_id: t.id, title: t.title, approved_at: t.approved_at, client: t.client,
    }))
  }

  return (
    <div className="space-y-6">
      <NouvelleFactureMembre
        config={config}
        hourlyEntries={hourlyEntries}
        fixedDeliverables={fixedDeliverables}
      />
    </div>
  )
}
