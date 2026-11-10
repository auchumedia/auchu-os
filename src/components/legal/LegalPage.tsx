import Link from 'next/link'

export default function LegalPage({
  title, updated, children,
}: {
  title: string
  updated: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="px-6 md:px-8 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 w-fit">
          <div className="w-7 h-7 bg-ink rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-xs">A</span>
          </div>
          <span className="font-display uppercase text-ink text-base">AuchuOS</span>
        </Link>
        <Link href="/auth/login" className="text-sm text-auchu-600 hover:underline font-medium">
          Connexion
        </Link>
      </nav>

      <main className="flex-1 max-w-2xl w-full mx-auto px-6 md:px-8 py-8 md:py-12">
        <h1 className="font-display uppercase text-3xl md:text-4xl text-ink leading-tight">{title}</h1>
        <p className="text-sm text-gray-400 mt-2">Dernière mise à jour : {updated}</p>

        <div className="card mt-8 space-y-7 text-sm text-gray-600 leading-relaxed">
          {children}
        </div>

        <div className="flex items-center gap-3 text-sm mt-8 text-gray-400">
          <Link href="/confidentialite" className="hover:text-auchu-600 hover:underline">Confidentialité</Link>
          <span>·</span>
          <Link href="/conditions" className="hover:text-auchu-600 hover:underline">Conditions</Link>
        </div>
      </main>
    </div>
  )
}
