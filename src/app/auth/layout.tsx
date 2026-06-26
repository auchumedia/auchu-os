import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="px-8 py-5">
        <Link href="/" className="flex items-center gap-2 w-fit">
          <div className="w-7 h-7 bg-auchu-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xs">A</span>
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
