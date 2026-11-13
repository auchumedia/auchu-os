// ══════════════════════════════════════════════════════════════════════════════
// Gabarit du rapport PDF Insight — rendu UNIQUEMENT côté serveur
// (@react-pdf/renderer, cf. route.tsx). Jamais importé par un composant
// client : ce fichier ne doit JAMAIS recevoir le champ "notes" (interne) —
// route.tsx ne lui transmet que les métriques chiffrées + meilleure
// publication, jamais la ligne brute de la base.
//
// Police : Helvetica standard (embarquée dans pdfkit, aucun fichier de
// police ni appel réseau à charger) plutôt que Bebas Neue/DM Sans — cf.
// route.tsx pour le raisonnement complet. La charte est respectée via les
// couleurs (noir/blanc/bleu #003DA5) et un traitement majuscule/espacé pour
// les titres, qui évoque la police condensée du site sans dépendre d'elle.
// ══════════════════════════════════════════════════════════════════════════════

import { Document, Page, View, Text, StyleSheet, Svg, Path, Circle } from '@react-pdf/renderer'
import {
  INSIGHT_PLATFORM_LABELS, totalInteractions, engagementRate, percentVariation, sumAcrossPlatforms,
  EMPTY_INSIGHT_METRICS, type InsightPlatform, type InsightMetrics,
} from '@/lib/insights'

const BLUE = '#003DA5'
const INK = '#0A0A0A'
const GRAY = '#6B7280'
const BORDER = '#E5E7EB'

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 60, fontSize: 10, color: INK, fontFamily: 'Helvetica' },

  coverPage: { padding: 0, backgroundColor: INK, color: '#FFFFFF' },
  coverInner: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  brand: { fontSize: 13, letterSpacing: 4, color: BLUE, marginBottom: 28, textTransform: 'uppercase', fontFamily: 'Helvetica-Bold' },
  coverTitle: { fontSize: 30, letterSpacing: 3, textTransform: 'uppercase', textAlign: 'center', marginBottom: 14, fontFamily: 'Helvetica-Bold' },
  coverSubtitle: { fontSize: 16, color: '#CBD5E1', textAlign: 'center' },
  coverMonth: { fontSize: 13, color: BLUE, marginTop: 28, textTransform: 'uppercase', letterSpacing: 2, fontFamily: 'Helvetica-Bold' },

  sectionTitle: {
    fontSize: 16, letterSpacing: 1.5, textTransform: 'uppercase', color: INK, marginBottom: 18,
    borderBottomWidth: 2, borderBottomColor: BLUE, paddingBottom: 8, fontFamily: 'Helvetica-Bold',
  },
  platformTitle: {
    fontSize: 18, letterSpacing: 1.5, textTransform: 'uppercase', color: '#FFFFFF',
    backgroundColor: BLUE, padding: 12, marginBottom: 18, fontFamily: 'Helvetica-Bold',
  },

  commentBox: { borderWidth: 1, borderColor: BLUE, borderRadius: 6, padding: 12, backgroundColor: '#F6F7FB', marginBottom: 20 },
  commentLabel: { fontSize: 8, color: BLUE, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, fontFamily: 'Helvetica-Bold' },

  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  kpiCard: { width: '31%', borderWidth: 1, borderColor: BORDER, borderRadius: 6, padding: 10 },
  kpiCardHalf: { width: '48%', borderWidth: 1, borderColor: BORDER, borderRadius: 6, padding: 12 },
  kpiLabel: { fontSize: 8, color: GRAY, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  kpiValue: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: INK },
  kpiValueLarge: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: INK },
  kpiVariation: { fontSize: 9, marginTop: 4 },

  chartCard: { borderWidth: 1, borderColor: BORDER, borderRadius: 6, padding: 12, marginBottom: 20 },
  chartLabel: { fontSize: 9, color: GRAY, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  noChartText: { fontSize: 9, color: '#9CA3AF' },

  topPostCard: { borderWidth: 1, borderColor: BORDER, borderRadius: 6, padding: 12, marginBottom: 20 },
  topPostTitleText: { fontFamily: 'Helvetica-Bold', fontSize: 12, marginBottom: 4 },
  topPostUrlText: { fontSize: 9, color: BLUE },

  footer: {
    position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 8, color: '#9CA3AF',
    flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 8,
  },
})

// ─── Mini graphique en ligne — mêmes primitives Svg que la version web
//     (MiniLineChart, InsightTab.tsx), recalculées ici côté serveur. ──────────
function buildSparklinePath(values: (number | null)[], width: number, height: number, pad = 8) {
  const nums = values.filter((v): v is number => v != null)
  if (nums.length === 0) return { path: '', dots: [] as { x: number; y: number }[] }
  const max = Math.max(...nums)
  const min = Math.min(...nums)
  const span = max - min || 1
  const innerW = width - pad * 2
  const innerH = height - pad * 2
  const stepX = values.length > 1 ? innerW / (values.length - 1) : 0
  const coords = values.map((v, i) => (
    v == null ? null : { x: pad + i * stepX, y: pad + innerH - ((v - min) / span) * innerH }
  ))
  const dots = coords.filter((c): c is { x: number; y: number } => c != null)
  const path = dots.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')
  return { path, dots }
}

function Sparkline({ values }: { values: (number | null)[] }) {
  const W = 480, H = 90
  const { path, dots } = buildSparklinePath(values, W, H)
  if (!path) return <Text style={styles.noChartText}>Pas assez de données pour un graphique.</Text>
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <Path d={path} stroke={BLUE} strokeWidth={2} fill="none" />
      {dots.map((d, i) => <Circle key={i} cx={d.x} cy={d.y} r={2.5} fill={BLUE} />)}
    </Svg>
  )
}

function formatNumber(n: number, decimals = 0): string {
  return decimals > 0 ? n.toFixed(decimals) : Math.round(n).toLocaleString('fr-CA')
}

function KpiBlock({
  label, value, previous, suffix, decimals, half,
}: {
  label: string
  value: number | null
  previous: number | null
  suffix?: string
  decimals?: number
  half?: boolean
}) {
  const pct = percentVariation(value, previous)
  const formatted = value == null ? '—' : `${formatNumber(value, decimals)}${suffix ?? ''}`
  const pctLabel = pct == null ? '—' : `${pct > 0 ? '+' : ''}${Math.round(pct)}% vs mois précédent`
  const pctColor = pct == null ? '#9CA3AF' : pct > 0 ? '#16A34A' : pct < 0 ? '#DC2626' : '#9CA3AF'
  return (
    <View style={half ? styles.kpiCardHalf : styles.kpiCard}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={half ? styles.kpiValueLarge : styles.kpiValue}>{formatted}</Text>
      <Text style={[styles.kpiVariation, { color: pctColor }]}>{pctLabel}</Text>
    </View>
  )
}

function PageFooter({ clientName, monthLabel }: { clientName: string; monthLabel: string }) {
  return (
    <View style={styles.footer}>
      <Text>AuchuMedia — Rapport Insight — {clientName}</Text>
      <Text>{monthLabel}</Text>
    </View>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PlatformReportData {
  platform: InsightPlatform
  row: InsightMetrics
  previousRow: InsightMetrics | null
  topPostTitle: string | null
  topPostUrl: string | null
  // Abonnés des 6 derniers mois (le mois du rapport inclus), du plus ancien
  // au plus récent — pour le mini graphique de cette page.
  followersHistory: (number | null)[]
}

export interface InsightReportProps {
  clientName: string
  monthLabel: string
  comment: string
  // Seulement les plateformes AVEC des données saisies ce mois-ci — jamais
  // une page vide (règle explicite du rapport).
  platforms: PlatformReportData[]
}

export default function InsightReportDocument({ clientName, monthLabel, comment, platforms }: InsightReportProps) {
  const summary = sumAcrossPlatforms(platforms.map(p => p.row))
  const prevSummary = sumAcrossPlatforms(platforms.map(p => p.previousRow ?? EMPTY_INSIGHT_METRICS))

  return (
    <Document title={`Insight — ${clientName} — ${monthLabel}`} author="AuchuMedia">
      {/* ── Couverture ─────────────────────────────────────────────────────── */}
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.coverInner}>
          <Text style={styles.brand}>AuchuMedia</Text>
          <Text style={styles.coverTitle}>Rapport Insight</Text>
          <Text style={styles.coverSubtitle}>{clientName}</Text>
          <Text style={styles.coverMonth}>{monthLabel}</Text>
        </View>
      </Page>

      {/* ── Résumé ─────────────────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Résumé</Text>

        {comment.trim() !== '' && (
          <View style={styles.commentBox}>
            <Text style={styles.commentLabel}>Commentaire</Text>
            <Text>{comment}</Text>
          </View>
        )}

        <View style={styles.kpiRow}>
          <KpiBlock half label="Vues — toutes plateformes" value={summary.views} previous={prevSummary.views} />
          <KpiBlock half label="Interactions — toutes plateformes" value={summary.interactions} previous={prevSummary.interactions} />
        </View>

        <Text style={{ fontSize: 9, color: GRAY, marginTop: 4 }}>
          Plateformes incluses dans ce rapport : {platforms.map(p => INSIGHT_PLATFORM_LABELS[p.platform]).join(', ')}.
        </Text>

        <PageFooter clientName={clientName} monthLabel={monthLabel} />
      </Page>

      {/* ── Une page par plateforme avec des données ─────────────────────────── */}
      {platforms.map(p => (
        <Page key={p.platform} size="A4" style={styles.page}>
          <Text style={styles.platformTitle}>{INSIGHT_PLATFORM_LABELS[p.platform]}</Text>

          <View style={styles.kpiRow}>
            <KpiBlock label="Abonnés"  value={p.row.followers} previous={p.previousRow?.followers ?? null} />
            <KpiBlock label="Vues"     value={p.row.views}     previous={p.previousRow?.views ?? null} />
            <KpiBlock label="Portée"  value={p.row.reach}     previous={p.previousRow?.reach ?? null} />
            <KpiBlock
              label="Interactions"
              value={totalInteractions(p.row)}
              previous={p.previousRow ? totalInteractions(p.previousRow) : null}
            />
            <KpiBlock
              label="Taux d'engagement"
              value={engagementRate(p.row)}
              previous={p.previousRow ? engagementRate(p.previousRow) : null}
              suffix="%"
              decimals={1}
            />
          </View>

          <View style={styles.chartCard}>
            <Text style={styles.chartLabel}>Évolution des abonnés (6 derniers mois)</Text>
            <Sparkline values={p.followersHistory} />
          </View>

          {(p.topPostTitle || p.topPostUrl) && (
            <View style={styles.topPostCard}>
              <Text style={styles.chartLabel}>Meilleure publication</Text>
              {p.topPostTitle && <Text style={styles.topPostTitleText}>{p.topPostTitle}</Text>}
              {p.topPostUrl && <Text style={styles.topPostUrlText}>{p.topPostUrl}</Text>}
            </View>
          )}

          <PageFooter clientName={clientName} monthLabel={monthLabel} />
        </Page>
      ))}
    </Document>
  )
}
