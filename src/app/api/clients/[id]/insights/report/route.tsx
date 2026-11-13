// ══════════════════════════════════════════════════════════════════════════════
// Génération du rapport PDF Insight — @react-pdf/renderer, rendu 100% côté
// serveur (Node, aucun navigateur headless). Choisi plutôt que Puppeteer/
// Chromium pour rester léger et fiable sur une fonction serverless : pas de
// binaire Chromium à embarquer (gros, lent à démarrer), rendu déterministe
// pur-JS, mêmes résultats partout. La police reste Helvetica standard
// (embarquée dans pdfkit) plutôt que Bebas Neue/DM Sans : embarquer ces
// polices demanderait soit un appel réseau à chaque génération (fragile),
// soit des fichiers WOFF/WOFF2 dont le décodage par le moteur de police de
// react-pdf (fontkit) est moins fiable que TTF/OTF — un choix qui irait
// contre "la solution la plus légère et fiable". La charte reste respectée
// via les couleurs (noir/blanc/bleu #003DA5) et un traitement typographique
// (majuscules, espacement) qui évoque la police du site sans en dépendre.
// ══════════════════════════════════════════════════════════════════════════════

import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { canAccessInsight } from '@/lib/roles'
import { INSIGHT_PLATFORMS, type InsightMetrics } from '@/lib/insights'
import { renderToBuffer } from '@react-pdf/renderer'
import InsightReportDocument, { type PlatformReportData } from './InsightReportDocument'
import { NextResponse } from 'next/server'

function monthLabelFr(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  const label = d.toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function addMonthsISO(iso: string, delta: number): string {
  const [y, m] = iso.split('-').map(Number)
  const total = y * 12 + (m - 1) + delta
  const year = Math.floor(total / 12)
  const month = (total % 12) + 1
  return `${year}-${String(month).padStart(2, '0')}-01`
}

// Ne garde QUE les champs chiffrés — jamais `notes` (interne), jamais aucun
// autre champ brut de la ligne DB. C'est la seule fonction qui traverse la
// frontière vers le gabarit PDF (InsightReportDocument), donc la seule
// garantie nécessaire contre une fuite de note interne dans le rapport.
function toMetrics(row: Record<string, unknown> | undefined | null): InsightMetrics | null {
  if (!row) return null
  return {
    followers: (row.followers as number | null) ?? null,
    followers_gained: (row.followers_gained as number | null) ?? null,
    views: (row.views as number | null) ?? null,
    reach: (row.reach as number | null) ?? null,
    likes: (row.likes as number | null) ?? null,
    comments: (row.comments as number | null) ?? null,
    shares: (row.shares as number | null) ?? null,
    saves: (row.saves as number | null) ?? null,
    profile_visits: (row.profile_visits as number | null) ?? null,
    posts_published: (row.posts_published as number | null) ?? null,
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccessInsight(ctx.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const month: string | undefined = body?.month
  const comment: string = typeof body?.comment === 'string' ? body.comment.slice(0, 2000) : ''

  if (!month || !/^\d{4}-\d{2}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'Mois invalide (attendu YYYY-MM-DD)' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, name')
    .eq('id', params.id)
    .eq('user_id', ctx.dataOwnerId)
    .maybeSingle()
  if (clientError) return NextResponse.json({ error: clientError.message }, { status: 500 })
  if (!client) return NextResponse.json({ error: 'Contact introuvable' }, { status: 404 })

  // Le mois choisi + les 5 précédents (pour le mini graphique "6 derniers
  // mois" de chaque page plateforme) — un seul aller-retour DB.
  const earliestMonth = addMonthsISO(month, -5)
  const { data: rows, error: rowsError } = await supabase
    .from('client_insights')
    .select('*')
    .eq('client_id', params.id)
    .eq('user_id', ctx.dataOwnerId)
    .gte('month', earliestMonth)
    .lte('month', month)
    .order('month', { ascending: true })
  if (rowsError) return NextResponse.json({ error: rowsError.message }, { status: 500 })

  const allRows = rows ?? []
  const monthsWindow: string[] = []
  for (let i = 5; i >= 0; i--) monthsWindow.push(addMonthsISO(month, -i))
  const previousMonth = addMonthsISO(month, -1)

  // Seulement les plateformes avec des données CE mois-ci — jamais de page
  // vide dans le rapport (règle explicite).
  const platforms: PlatformReportData[] = []
  for (const platform of INSIGHT_PLATFORMS) {
    const rawRow = allRows.find(r => r.platform === platform && r.month.slice(0, 10) === month)
    const metrics = toMetrics(rawRow)
    if (!metrics) continue

    const rawPrevious = allRows.find(r => r.platform === platform && r.month.slice(0, 10) === previousMonth)
    const followersHistory = monthsWindow.map(m => {
      const r = allRows.find(x => x.platform === platform && x.month.slice(0, 10) === m)
      return (r?.followers as number | null | undefined) ?? null
    })

    platforms.push({
      platform,
      row: metrics,
      previousRow: toMetrics(rawPrevious),
      topPostTitle: (rawRow?.top_post_title as string | null | undefined) ?? null,
      topPostUrl: (rawRow?.top_post_url as string | null | undefined) ?? null,
      followersHistory,
    })
  }

  if (platforms.length === 0) {
    return NextResponse.json(
      { error: 'Aucune donnée saisie pour ce mois — rien à inclure dans le rapport' },
      { status: 400 }
    )
  }

  const monthLabel = monthLabelFr(month)
  const buffer = await renderToBuffer(
    <InsightReportDocument
      clientName={client.name}
      monthLabel={monthLabel}
      comment={comment}
      platforms={platforms}
    />
  )

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Insight - ${client.name} - ${monthLabel}.pdf"`,
    },
  })
}
