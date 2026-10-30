import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'

export default async function AgentsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  return (
    <div className="flex min-h-screen">
      <Sidebar
        agencyName={user.user_metadata?.agency_name}
        userName={user.user_metadata?.full_name}
      />
      <main className="flex-1 overflow-auto" style={{ marginLeft: 'var(--sidebar-width, 240px)' }}>
        <div className="max-w-4xl mx-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
