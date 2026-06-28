import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ClientDetail from './ClientDetail'

export const metadata = { title: 'Fiche client' }

export default async function ClientPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

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
      .eq('user_id', user!.id)
      .single(),

    supabase
      .from('invoices')
      .select('*')
      .eq('client_id', params.id)
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false }),

    supabase
      .from('content_pieces')
      .select('*')
      .eq('client_id', params.id)
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false }),

    supabase
      .from('calendar_events')
      .select('*')
      .eq('client_id', params.id)
      .eq('user_id', user!.id)
      .order('date', { ascending: true }),
  ])

  if (error || !client) notFound()

  return (
    <ClientDetail
      client={client}
      invoices={invoices ?? []}
      content={content ?? []}
      events={events ?? []}
      appUrl={process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}
    />
  )
}
