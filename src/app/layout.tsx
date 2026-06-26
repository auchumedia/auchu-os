import type { Metadata } from 'next'
import '../styles/globals.css'

export const metadata: Metadata = {
  title: {
    default: 'AuchuOS — Plateforme agence tout-en-un',
    template: '%s | AuchuOS',
  },
  description: 'Gérez vos clients, projets, contenu et équipe avec des agents IA intégrés.',
  icons: { icon: '/favicon.ico' },
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
