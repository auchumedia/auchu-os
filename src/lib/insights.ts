// ══════════════════════════════════════════════════════════════════════════════
// Insight — calculs PURS et testables pour les statistiques sociales
// saisies à la main (Instagram / Facebook / TikTok). Aucune dépendance :
// pas de Supabase, pas d'horloge système.
//
// Règles :
//  - Tous les compteurs sont optionnels (null = pas saisi). Une valeur
//    manquante ne doit jamais s'afficher comme "0" — elle doit rester
//    absente ("—" côté UI).
//  - Interactions totales = j'aime + commentaires + partages + enregistrements,
//    en traitant les champs manquants comme 0 (total partiel autorisé) —
//    sauf si AUCUN des 4 n'est renseigné, où le total reste indéterminé (null).
//  - Taux d'engagement = interactions totales ÷ abonnés × 100.
//  - Variation en % = (actuel − précédent) ÷ précédent × 100 ; indéterminée
//    (null) si l'une des deux valeurs manque OU si précédent = 0 (division
//    par zéro évitée).
//
// Testé par scripts/test-insights.mts.
// ══════════════════════════════════════════════════════════════════════════════

export type InsightPlatform = 'instagram' | 'facebook' | 'tiktok'

export const INSIGHT_PLATFORMS: InsightPlatform[] = ['instagram', 'facebook', 'tiktok']

export const INSIGHT_PLATFORM_LABELS: Record<InsightPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
}

export interface InsightMetrics {
  followers: number | null
  followers_gained: number | null
  views: number | null
  reach: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saves: number | null
  profile_visits: number | null
  posts_published: number | null
}

export const EMPTY_INSIGHT_METRICS: InsightMetrics = {
  followers: null, followers_gained: null, views: null, reach: null,
  likes: null, comments: null, shares: null, saves: null,
  profile_visits: null, posts_published: null,
}

export interface InsightRow extends InsightMetrics {
  id: string
  client_id: string
  platform: InsightPlatform
  month: string // 'YYYY-MM-DD', toujours le 1er du mois
  top_post_title: string | null
  top_post_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// Variation en % entre deux valeurs. null si l'une des deux manque ou si
// `previous` = 0 (division par zéro) — l'UI affiche "—" dans ce cas.
export function percentVariation(
  current: number | null | undefined,
  previous: number | null | undefined,
): number | null {
  if (current == null || previous == null) return null
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}

// Interactions totales = j'aime + commentaires + partages + enregistrements.
// Les champs manquants comptent pour 0 (total partiel autorisé), SAUF si
// aucun des 4 n'est renseigné : alors le total lui-même est indéterminé.
export function totalInteractions(m: Pick<InsightMetrics, 'likes' | 'comments' | 'shares' | 'saves'>): number | null {
  const { likes, comments, shares, saves } = m
  if (likes == null && comments == null && shares == null && saves == null) return null
  return (likes ?? 0) + (comments ?? 0) + (shares ?? 0) + (saves ?? 0)
}

// Taux d'engagement (%) = interactions totales ÷ abonnés × 100. null si les
// interactions sont indéterminées, ou si les abonnés manquent ou valent 0
// (division par zéro évitée).
export function engagementRate(
  m: Pick<InsightMetrics, 'likes' | 'comments' | 'shares' | 'saves' | 'followers'>,
): number | null {
  const interactions = totalInteractions(m)
  if (interactions == null || m.followers == null || m.followers === 0) return null
  return (interactions / m.followers) * 100
}

// Somme des vues et des interactions totales à travers plusieurs plateformes
// pour un même mois ("vue Toutes les plateformes") — null si aucune des
// lignes fournies n'a de valeur pour cette métrique, sinon la somme de
// celles qui en ont (total partiel autorisé, comme totalInteractions).
export function sumAcrossPlatforms(rows: InsightMetrics[]): { views: number | null; interactions: number | null } {
  const viewValues = rows.map(r => r.views).filter((v): v is number => v != null)
  const interactionValues = rows.map(r => totalInteractions(r)).filter((v): v is number => v != null)
  return {
    views: viewValues.length > 0 ? viewValues.reduce((a, b) => a + b, 0) : null,
    interactions: interactionValues.length > 0 ? interactionValues.reduce((a, b) => a + b, 0) : null,
  }
}
