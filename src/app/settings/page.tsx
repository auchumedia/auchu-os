import { createClient }   from '@/lib/supabase/server'
import { getOrgContext }  from '@/lib/org'
import { redirect }       from 'next/navigation'
import SettingsClient     from './SettingsClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Paramètres' }

export default async function SettingsPage() {
  const ctx = await getOrgContext()
  if (!ctx) redirect('/auth/login')

  const supabase = await createClient()

  // ── Profil complet (avec title) ────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, avatar_url, title')
    .eq('id', ctx.userId)
    .single()

  // ── Organisation complète (owners only, avec nouvelles colonnes) ───────────
  let orgData = null
  if (ctx.isOwner && ctx.org) {
    const { data: org } = await supabase
      .from('organizations')
      .select([
        'id', 'name', 'logo_url',
        'primary_color', 'secondary_color',
        'email', 'phone', 'website',
        'address_street', 'address_city', 'address_province',
        'address_postal', 'address_country',
      ].join(', '))
      .eq('owner_id', ctx.userId)
      .single()
    orgData = org as any
  }

  // ── Profil de facturation — tous les membres non-owner ────────────────────
  const isBillableMember = ['director', 'stratege', 'monteur'].includes(ctx.role)
  let billingConfig = null
  if (isBillableMember) {
    const { data } = await supabase
      .from('member_billing_config')
      .select('billing_mode, hourly_rate, fixed_rate, currency, period, payment_info')
      .eq('user_id', ctx.userId)
      .maybeSingle()
    billingConfig = data
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">

      <div>
        <h1 className="page-title">Paramètres</h1>
        <p className="page-subtitle">
          Gérez votre profil et votre organisation
        </p>
      </div>

      {/* ── Sections éditables (client component) ───────────────────────────── */}
      <SettingsClient
        userId={ctx.userId}
        isOwner={ctx.isOwner}
        org={orgData}
        profile={{
          full_name:  profile?.full_name  ?? ctx.userName,
          email:      profile?.email      ?? ctx.userEmail,
          avatar_url: profile?.avatar_url ?? null,
          title:      (profile as any)?.title ?? null,
        }}
        billingConfig={isBillableMember ? {
          billing_mode: (billingConfig?.billing_mode ?? 'hourly') as 'hourly' | 'fixed',
          hourly_rate:  billingConfig?.hourly_rate  ?? null,
          fixed_rate:   billingConfig?.fixed_rate   ?? null,
          currency:     billingConfig?.currency     ?? 'CAD',
          period:       (billingConfig?.period ?? 'monthly') as 'weekly' | 'biweekly' | 'monthly',
          payment_info: billingConfig?.payment_info ?? null,
        } : null}
      />
    </div>
  )
}
