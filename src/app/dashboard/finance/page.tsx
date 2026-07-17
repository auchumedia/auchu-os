import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { redirect }      from 'next/navigation'
import FinanceModule from './FinanceModule'

export const metadata = { title: 'Finance' }

export default async function FinancePage() {
  const ctx = await getOrgContext()
  if (!ctx) redirect('/auth/login')
  // Finance : owner uniquement — factures clients de l'agence.
  if (!ctx.isOwner) redirect('/dashboard')

  const supabase = await createClient()
  const ownerId  = ctx.dataOwnerId

  const [
    { data: invoices },
    { data: pendingInvoices },
    { data: memberInvoicesRaw },
  ] = await Promise.all([
    supabase
      .from('invoices')
      .select('*, client:clients(id, name, email, company)')
      .eq('user_id', ownerId)
      .order('created_at', { ascending: false }),

    supabase
      .from('invoices')
      .select('total')
      .eq('user_id', ownerId)
      .in('status', ['envoye', 'en_retard']),

    ctx.org
      ? supabase
          .from('member_invoices')
          .select('*')
          .eq('org_id', ctx.org.id)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
  ])

  const pending = (pendingInvoices ?? []).reduce((s, r) => s + (r.total ?? 0), 0)

  // ── Factures membres : profils non embarquables par FK (member_id → auth.users,
  //    pas profiles) — deuxième aller-retour ciblé, même raison que taches/page.tsx. ──
  const memberIds = Array.from(new Set((memberInvoicesRaw ?? []).map(m => m.member_id)))
  const { data: memberProfiles } = memberIds.length > 0
    ? await supabase.from('profiles').select('id, full_name, email').in('id', memberIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] }
  const profileById = new Map((memberProfiles ?? []).map(p => [p.id, p]))

  const memberInvoices = (memberInvoicesRaw ?? []).map(inv => ({
    ...inv,
    member: profileById.get(inv.member_id)
      ? { id: inv.member_id, full_name: profileById.get(inv.member_id)!.full_name, email: profileById.get(inv.member_id)!.email }
      : null,
  }))

  return (
    <div className="space-y-6">
      <FinanceModule
        initialInvoices={invoices ?? []}
        currentMonth={{
          pending: Math.round(pending * 100) / 100,
          pendingCount: pendingInvoices?.length ?? 0,
        }}
        memberInvoices={memberInvoices as any}
      />
    </div>
  )
}
