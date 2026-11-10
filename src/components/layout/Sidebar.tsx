'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { LogOut, Zap } from 'lucide-react'
import { buildNavSections } from '@/lib/nav'
import { roleLabel } from '@/lib/roles'
import type { OrgRole } from '@/types'

export default function Sidebar({
  agencyName, userName, role = 'owner',
}: {
  agencyName?: string
  userName?: string
  role?: OrgRole
}) {
  const pathname = usePathname()
  const router   = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const navSections = buildNavSections(role).filter(s => s.items.length > 0)
  const allItems = navSections.flatMap(s => s.items)
  const badge = roleLabel(role)

  return (
    <aside
      className="fixed left-4 top-4 bottom-4 bg-ink rounded-3xl flex-col z-10 hidden md:flex items-center shadow-xl"
      style={{ width: 'var(--sidebar-width, 72px)' }}
    >
      {/* Logo */}
      <div className="pt-5 pb-4 w-full flex items-center justify-center group relative">
        <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center flex-shrink-0">
          <Zap className="w-4.5 h-4.5 text-ink" />
        </div>
        <SidebarTooltip label={agencyName || 'AuchuOS'} sub={userName} />
      </div>

      <div className="w-8 h-px bg-white/10 mb-3" />

      {/* Nav — icônes seules, tooltip au survol */}
      <nav className="flex-1 overflow-y-auto w-full flex flex-col items-center gap-1 px-2">
        {allItems.map((item) => {
          const Icon = item.icon
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group relative w-11 h-11 flex items-center justify-center rounded-2xl transition-colors flex-shrink-0',
                isActive ? 'bg-auchu-500 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'
              )}
            >
              <Icon className="w-[18px] h-[18px]" />
              <SidebarTooltip label={item.label} />
            </Link>
          )
        })}
      </nav>

      <div className="w-8 h-px bg-white/10 my-3" />

      {/* Bottom */}
      <div className="pb-5 w-full flex flex-col items-center gap-1">
        {role !== 'owner' && (
          <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-medium mb-1', badge.cls)}>
            {badge.label}
          </span>
        )}
        <button
          onClick={handleLogout}
          className="group relative w-11 h-11 flex items-center justify-center rounded-2xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="w-[18px] h-[18px]" />
          <SidebarTooltip label="Déconnexion" />
        </button>
      </div>
    </aside>
  )
}

function SidebarTooltip({ label, sub }: { label: string; sub?: string }) {
  return (
    <div
      className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 z-20
                 bg-ink text-white text-xs font-medium whitespace-nowrap px-3 py-1.5 rounded-lg shadow-lg
                 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0
                 transition-all duration-150"
    >
      {label}
      {sub && <span className="block text-[10px] text-gray-400 font-normal">{sub}</span>}
    </div>
  )
}
