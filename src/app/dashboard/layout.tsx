import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getOrgContext } from '@/lib/org'
import Sidebar from '@/components/layout/Sidebar'
import BottomNav from '@/components/layout/BottomNav'
import { TimerProvider } from '@/lib/timer/TimerContext'
import ActiveTimerBanner from '@/components/timer/ActiveTimerBanner'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const ctx = await getOrgContext()

  // Chrono actif de l'utilisateur — chargé ici (une fois, côté serveur) pour
  // que la bannière s'affiche sans flash dès le premier rendu de n'importe
  // quelle page du dashboard, pas seulement /dashboard/taches.
  let initialActiveEntry = null
  if (ctx) {
    const { data } = await supabase
      .from('time_entries')
      .select('id, task_id, accumulated_seconds, segment_started_at, task:tasks(title)')
      .eq('user_id', ctx.userId)
      .is('ended_at', null)
      .maybeSingle()

    if (data) {
      const task = data.task as unknown as { title: string } | { title: string }[] | null
      initialActiveEntry = {
        id: data.id,
        task_id: data.task_id,
        task_title: Array.isArray(task) ? (task[0]?.title ?? null) : (task?.title ?? null),
        accumulated_seconds: data.accumulated_seconds,
        segment_started_at: data.segment_started_at,
      }
    }
  }

  return (
    <TimerProvider initialActiveEntry={initialActiveEntry}>
      <div className="flex min-h-screen">
        <Sidebar
          agencyName={ctx?.org?.name || user.user_metadata?.agency_name || 'Mon agence'}
          userName={ctx?.userName || user.email || ''}
          role={ctx?.role || 'owner'}
        />
        <main className="flex-1 overflow-auto md:ml-[240px]">
          <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 pb-24 md:pb-8">
            <ActiveTimerBanner />
            {children}
          </div>
        </main>
        <BottomNav role={ctx?.role || 'owner'} />
      </div>
    </TimerProvider>
  )
}
