import type { Metadata, Viewport } from 'next'
import '../styles/globals.css'

export const metadata: Metadata = {
  title: {
    default: 'AuchuOS — Plateforme agence tout-en-un',
    template: '%s | AuchuOS',
  },
  description: 'Gérez vos clients, projets, contenu et équipe avec des agents IA intégrés.',
  icons: { icon: '/favicon.ico' },
}

// viewportFit: 'cover' est requis pour que env(safe-area-inset-bottom) renvoie
// une vraie valeur sur iOS (sinon 0, et le bottom nav se fait manger par la
// home indicator sur iPhone X+).
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
