import Link from 'next/link'
import { Zap } from 'lucide-react'

export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      <nav className="px-8 py-5">
        <Link href="/" className="flex items-center gap-2 w-fit">
          <div className="w-7 h-7 bg-auchu-600 rounded-lg flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-gray-900 font-semibold text-base">AuchuOS</span>
        </Link>
      </nav>
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        {children}
      </div>
    </div>
  )
}
