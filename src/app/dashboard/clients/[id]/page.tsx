import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { notFound } from 'next/navigation'
import ClientDetail from './ClientDetail'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Fiche client' }

export default async function ClientPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const ctx = await getOrgContext()

  const ownerId = ctx?.dataOwnerId
  if (!ownerId) notFound()

  const [
    { data: client, error },
    { data: invoices },
    { data: content },
    { data: events },
  ] = await Promise.all([
    supabase
      .from('clients')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', ownerId)
      .single(),

    supabase
      .from('invoices')
      .select('*')
      .eq('client_id', params.id)
      .eq('user_id', ownerId)
      .order('created_at', { ascending: false }),

    supabase
      .from('content_pieces')
      .select('*')
      .eq('client_id', params.id)
      .eq('user_id', ownerId)
      .order('position', { ascending: true })
      .order('created_at', { ascending: false }),

    supabase
      .from('calendar_events')
      .select('*')
      .eq('client_id', params.id)
      .eq('user_id', ownerId)
      .order('date', { ascending: true }),
  ])

  if (error || !client) notFound()

  return (
    <ClientDetail
      client={client}
      invoices={invoices ?? []}
      content={content ?? []}
      events={events ?? []}
    />
  )
}
