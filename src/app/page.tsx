import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-auchu-950 via-auchu-900 to-auchu-800 flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-auchu-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">A</span>
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">AuchuOS</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/auth/login"
            className="text-sm text-auchu-200 hover:text-white transition-colors px-4 py-2"
          >
            Connexion
          </Link>
          <Link
            href="/auth/signup"
            className="text-sm bg-white text-auchu-900 font-medium px-4 py-2 rounded-lg hover:bg-auchu-50 transition-colors"
          >
            Démarrer gratuitement
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center py-20">
        <div className="inline-flex items-center gap-2 bg-auchu-800/60 border border-auchu-700/50 rounded-full px-4 py-1.5 mb-8">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-auchu-200 text-sm">Agents IA intégrés · Bêta privée</span>
        </div>

        <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight max-w-3xl mb-6">
          La plateforme de ton
          <span className="text-auchu-400"> agence</span>,
          <br />tout en un.
        </h1>

        <p className="text-auchu-300 text-lg max-w-xl mb-10 leading-relaxed">
          Clients, projets, contenu, équipe et finance — centralisés.
          Des agents IA qui rédigent, priorisent et planifient à ta place.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/auth/signup"
            className="px-8 py-3.5 bg-auchu-500 hover:bg-auchu-600 text-white font-medium rounded-xl transition-colors text-sm"
          >
            Créer mon espace agence
          </Link>
          <Link
            href="/auth/login"
            className="px-8 py-3.5 bg-white/10 hover:bg-white/15 text-white font-medium rounded-xl transition-colors text-sm border border-white/20"
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
              className="bg-auchu-800/40 border border-auchu-700/40 rounded-xl p-4 text-left"
            >
              <span className="text-2xl mb-2 block">{m.icon}</span>
              <span className="text-auchu-200 text-sm font-medium">{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="px-8 py-5 text-center text-auchu-600 text-xs">
        © 2025 AuchuMedia · Tous droits réservés
      </footer>
    </main>
  )
}
