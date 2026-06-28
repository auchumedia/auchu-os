import { getOrgContext } from '@/lib/org'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CalendrierClient from './CalendrierClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Calendrier' }

export default async function CalendrierPage() {
  const ctx = await getOrgContext()
  if (!ctx) redirect('/auth/login')

  const supabase = await createClient()
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name')
    .eq('user_id', ctx.dataOwnerId)
    .order('name')

  return (
    <CalendrierClient
      userId={ctx.userId}
      role={ctx.role}
      dataOwnerId={ctx.dataOwnerId}
      canManageTeam={ctx.canManageTeam}
      initialClients={clients ?? []}
    />
  )
}
