import type { Metadata, Viewport } from 'next'
import { Bebas_Neue, DM_Sans } from 'next/font/google'
import '../styles/globals.css'

// Polices du site vitrine AuchuMedia (Nav.js / Home.js) : titres condensés
// majuscules en Bebas Neue, texte courant en DM Sans.
const bebasNeue = Bebas_Neue({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-bebas',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
})

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
    <html lang="fr" className={`${bebasNeue.variable} ${dmSans.variable}`}>
      <body>{children}</body>
    </html>
  )
}
