import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ClientDetail from './ClientDetail'

export const metadata = { title: 'Fiche client' }

export default async function ClientPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const now   = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

  const [
    { data: client, error },
    { data: projects },
    { data: invoices },
    { data: content },
  ] = await Promise.all([
    supabase
      .from('clients')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user!.id)
      .single(),

    supabase
      .from('projects')
      .select('*')
      .eq('client_id', params.id)
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false }),

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
      .gte('scheduled_at', start)
      .lte('scheduled_at', end)
      .order('scheduled_at', { ascending: true }),
  ])

  if (error || !client) notFound()

  return (
    <ClientDetail
      client={client}
      projects={projects ?? []}
      invoices={invoices ?? []}
      content={content ?? []}
      appUrl={process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}
    />
  )
}
