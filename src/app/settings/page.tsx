import { createClient }   from '@/lib/supabase/server'
import { getOrgContext, OrgPlan } from '@/lib/org'
import { PLAN_LIMITS }   from '@/lib/plans'
import { redirect }      from 'next/navigation'
import { cn }            from '@/lib/utils'
import { Check, Zap, Users, Building2, Crown } from 'lucide-react'
import SettingsClient    from './SettingsClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Paramètres' }

const PLANS: { id: OrgPlan; icon: React.ElementType; features: string[] }[] = [
  {
    id: 'free', icon: Zap,
    features: ['1 membre (vous)', 'Clients illimités', 'Contenu illimité', 'Portail client'],
  },
  {
    id: 'starter', icon: Users,
    features: ['Jusqu\'à 3 membres', 'Rôles équipe', 'Invitations par code', 'Tout du plan Free'],
  },
  {
    id: 'agence', icon: Building2,
    features: ['Jusqu\'à 8 membres', 'Rapports avancés', 'Priorité support', 'Tout du plan Starter'],
  },
  {
    id: 'pro', icon: Crown,
    features: ['Membres illimités', 'API access', 'SSO', 'Tout du plan Agence'],
  },
]

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

  const currentPlan = (ctx.org?.plan ?? 'free') as OrgPlan
  const planInfo    = PLAN_LIMITS[currentPlan]
  const activeCount = ctx.memberCount

  // ── Profil de facturation — tous les membres non-owner ────────────────────
  const isBillableMember = ['director', 'chef_equipe', 'stratege', 'monteur'].includes(ctx.role)
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
        <h1 className="text-2xl font-semibold text-gray-900">Paramètres</h1>
        <p className="text-sm text-gray-500 mt-0.5">
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

      {/* ── Facturation & plan — owner uniquement ────────────────────────────── */}
      {ctx.role === 'owner' && ctx.isOwner && ctx.org && (
        <section className="space-y-4">
          <div>
            <h2 className="font-semibold text-gray-900">Facturation & plan</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Plan actuel :{' '}
              <span className="font-semibold text-gray-900">{planInfo.label}</span>
              {planInfo.price > 0 && (
                <span className="text-gray-400 ml-1">· {planInfo.price}$/mois</span>
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {PLANS.map(({ id, icon: Icon, features }) => {
              const info      = PLAN_LIMITS[id]
              const isCurrent = currentPlan === id
              const isUpgrade =
                PLANS.findIndex(p => p.id === id) >
                PLANS.findIndex(p => p.id === currentPlan)
              return (
                <div
                  key={id}
                  className={cn(
                    'rounded-2xl border-2 p-4 flex flex-col gap-3 transition-all',
                    isCurrent
                      ? 'border-auchu-400 bg-auchu-50'
                      : 'border-gray-200 bg-white hover:border-gray-300',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center',
                      isCurrent ? 'bg-auchu-200' : 'bg-gray-100',
                    )}>
                      <Icon className={cn('w-4 h-4', isCurrent ? 'text-auchu-700' : 'text-gray-500')} />
                    </div>
                    {isCurrent && (
                      <span className="text-xs font-semibold text-auchu-700 bg-auchu-100 px-2 py-0.5 rounded-full">
                        Actuel
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{info.label}</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {info.price === 0 ? 'Gratuit' : `${info.price}$/mois`}
                    </p>
                  </div>
                  <ul className="space-y-1.5 flex-1">
                    {features.map(f => (
                      <li key={f} className="flex items-start gap-1.5 text-xs text-gray-600">
                        <Check className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {!isCurrent && (
                    <a
                      href={`mailto:raphael@auchumedia.com?subject=Upgrade AuchuOS ${info.label}&body=Bonjour, je souhaite upgrader mon plan AuchuOS vers ${info.label}.`}
                      className={cn(
                        'text-xs font-medium text-center py-2 rounded-lg transition-colors',
                        isUpgrade
                          ? 'bg-auchu-600 text-white hover:bg-auchu-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                      )}
                    >
                      {isUpgrade ? 'Upgrader →' : 'Downgrader'}
                    </a>
                  )}
                </div>
              )
            })}
          </div>

          <p className="text-xs text-gray-400">
            Pour changer de plan, contactez-nous à{' '}
            <a href="mailto:raphael@auchumedia.com" className="text-auchu-600 hover:underline">
              raphael@auchumedia.com
            </a>
            . Paiement sécurisé via Stripe.
          </p>
        </section>
      )}
    </div>
  )
}
