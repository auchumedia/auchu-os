import { createClient } from '@/lib/supabase/server'
import KanbanBoard from './KanbanBoard'

export const metadata = { title: 'Projets' }

export default async function ProjetsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: projects }, { data: clients }] = await Promise.all([
    supabase
      .from('projects')
      .select('*, client:clients(id, name, company)')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('clients')
      .select('id, name, company')
      .eq('user_id', user!.id)
      .order('name'),
  ])

  return (
    <div className="space-y-6">
      <KanbanBoard
        initialProjects={projects ?? []}
        clients={clients ?? []}
      />
    </div>
  )
}
