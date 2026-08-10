import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#1a1a1a] rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">A</span>
          </div>
          <span className="text-[#1a1a1a] font-semibold text-lg tracking-tight">AuchuOS</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/auth/login"
            className="text-sm text-gray-500 hover:text-[#1a1a1a] transition-colors px-4 py-2"
          >
            Connexion
          </Link>
          <Link
            href="/auth/signup"
            className="text-sm bg-[#1a1a1a] text-white font-medium px-4 py-2 rounded-lg hover:bg-black transition-colors"
          >
            Démarrer gratuitement
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center py-20">
        <div className="inline-flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-full px-4 py-1.5 mb-8">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-gray-600 text-sm">Agents IA intégrés · Bêta privée</span>
        </div>

        <h1 className="text-5xl md:text-6xl font-bold text-[#1a1a1a] leading-tight max-w-3xl mb-6">
          La plateforme de ton
          <span className="text-gray-400"> agence</span>,
          <br />tout en un.
        </h1>

        <p className="text-gray-500 text-lg max-w-xl mb-10 leading-relaxed">
          Clients, projets, contenu, équipe et finance — centralisés.
          Des agents IA qui rédigent, priorisent et planifient à ta place.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/auth/signup"
            className="px-8 py-3.5 bg-[#1a1a1a] hover:bg-black text-white font-medium rounded-xl transition-colors text-sm"
          >
            Créer mon espace agence
          </Link>
          <Link
            href="/auth/login"
            className="px-8 py-3.5 bg-white hover:bg-gray-50 text-[#1a1a1a] font-medium rounded-xl transition-colors text-sm border border-gray-200"
          >
            J'ai déjà un compte
          </Link>
        </div>

        {/* Modules grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-16 max-w-2xl w-full">
          {[
            { icon: '👥', label: 'CRM clients' },
            { icon: '📋', label: 'Projets & livrables' },
            { icon: '✍️', label: 'Agent contenu IA' },
            { icon: '📅', label: 'Agent productivité IA' },
            { icon: '💰', label: 'Facturation' },
            { icon: '📊', label: 'Reporting' },
          ].map((m) => (
            <div
              key={m.label}
              className="bg-white border border-gray-100 rounded-xl p-4 text-left"
            >
              <span className="text-2xl mb-2 block">{m.icon}</span>
              <span className="text-gray-600 text-sm font-medium">{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="px-8 py-5 text-center text-gray-400 text-xs">
        © 2025 AuchuMedia · Tous droits réservés
      </footer>
    </main>
  )
}
