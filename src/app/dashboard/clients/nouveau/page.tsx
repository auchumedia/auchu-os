import { getOrgContext }    from '@/lib/org'
import { canCreateClients } from '@/lib/roles'
import { redirect }         from 'next/navigation'
import NouveauClientForm    from './NouveauClientForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Nouveau client' }

export default async function NouveauClientPage() {
  const ctx = await getOrgContext()
  if (!ctx) redirect('/auth/login')
  if (!canCreateClients(ctx.role)) redirect('/dashboard/clients')

  return <NouveauClientForm />
}
