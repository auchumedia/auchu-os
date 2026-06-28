import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getOrgContext } from '@/lib/org'
import Sidebar from '@/components/layout/Sidebar'
import BottomNav from '@/components/layout/BottomNav'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const ctx = await getOrgContext()

  return (
    <div className="flex min-h-screen">
      <Sidebar
        agencyName={ctx?.org?.name || user.user_metadata?.agency_name || 'Mon agence'}
        userName={ctx?.userName || user.email || ''}
        role={ctx?.role || 'owner'}
      />
      <main className="flex-1 overflow-auto md:ml-[240px]">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 pb-24 md:pb-8">
          {children}
        </div>
      </main>
      <BottomNav role={ctx?.role || 'owner'} canManageTeam={ctx?.canManageTeam ?? false} />
    </div>
  )
}
