'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Users, CalendarDays, Brain,
  MoreHorizontal, FileText, Receipt, UsersRound,
  UserCircle, Settings, LogOut, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OrgRole } from '@/types'

interface Props {
  role?: OrgRole
  canManageTeam?: boolean
}

const NAV_ITEMS = [
  { href: '/dashboard',              icon: LayoutDashboard, label: 'Dashboard'  },
  { href: '/dashboard/clients',      icon: Users,           label: 'Clients'    },
  { href: '/dashboard/calendrier',   icon: CalendarDays,    label: 'Calendrier' },
  { href: '/agents/productivite',    icon: Brain,           label: 'Agent'      },
]

export default function BottomNav({ role = 'owner', canManageTeam = false }: Props) {
  const pathname = usePathname()
  const router   = useRouter()
  const [open, setOpen] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const isPartner = role === 'partner'

  const menuItems = [
    { href: '/dashboard/contenu',    icon: FileText,    label: 'Contenu'     },
    ...(canManageTeam ? [
      { href: '/dashboard/finance',  icon: Receipt,     label: 'Finance'     },
      { href: '/dashboard/equipe',   icon: UsersRound,  label: 'Équipe'      },
    ] : []),
    ...(role !== 'owner' ? [
      { href: '/dashboard/mon-espace', icon: UserCircle, label: 'Mon espace' },
    ] : []),
    ...(!isPartner ? [
      { href: '/settings',           icon: Settings,    label: 'Paramètres'  },
    ] : []),
  ]

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)

  return (
    <>
      {/* Bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden bg-white border-t border-gray-100 safe-area-inset-bottom">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors',
              isActive(href) ? 'text-auchu-600' : 'text-gray-400'
            )}
          >
            <Icon className={cn('w-5 h-5', isActive(href) ? 'text-auchu-600' : 'text-gray-400')} />
            {label}
          </Link>
        ))}

        {/* Menu button */}
        <button
          onClick={() => setOpen(true)}
          className={cn(
            'flex-1 flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors',
            open ? 'text-auchu-600' : 'text-gray-400'
          )}
        >
          <MoreHorizontal className="w-5 h-5" />
          Menu
        </button>
      </nav>

      {/* Bottom sheet overlay */}
      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-50 md:hidden"
            onClick={() => setOpen(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white rounded-t-2xl shadow-2xl pb-safe">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <p className="font-semibold text-gray-900 text-sm">Menu</p>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="p-3 space-y-1">
              {menuItems.map(({ href, icon: Icon, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                    isActive(href)
                      ? 'bg-auchu-50 text-auchu-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  )}
                >
                  <Icon className="w-4.5 h-4.5 w-[18px] h-[18px]" />
                  {label}
                </Link>
              ))}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Déconnexion
              </button>
            </div>
            <div className="h-6" />
          </div>
        </>
      )}
    </>
  )
}
