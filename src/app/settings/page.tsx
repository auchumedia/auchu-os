import { createClient } from '@/lib/supabase/server'
import { getOrgContext, OrgPlan } from '@/lib/org'
import { PLAN_LIMITS } from '@/lib/plans'
import { redirect } from 'next/navigation'
import { cn }       from '@/lib/utils'
import { Check, Zap, Users, Building2, Crown } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Paramètres' }

const PLANS: { id: OrgPlan; icon: React.ElementType; features: string[] }[] = [
  {
    id: 'free',
    icon: Zap,
    features: ['1 membre (vous)', 'Clients illimités', 'Contenu illimité', 'Portail client'],
  },
  {
    id: 'starter',
    icon: Users,
    features: ['Jusqu\'à 3 membres', 'Rôles équipe', 'Invitations par code', 'Tout du plan Free'],
  },
  {
    id: 'agence',
    icon: Building2,
    features: ['Jusqu\'à 8 membres', 'Rapports avancés', 'Priorité support', 'Tout du plan Starter'],
  },
  {
    id: 'pro',
    icon: Crown,
    features: ['Membres illimités', 'API access', 'SSO', 'Tout du plan Agence'],
  },
]

export default async function SettingsPage() {
  const ctx = await getOrgContext()
  if (!ctx) redirect('/auth/login')

  const supabase = await createClient()

  // Profil utilisateur
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, avatar_url')
    .eq('id', ctx.userId)
    .single()

  const currentPlan = (ctx.org?.plan ?? 'free') as OrgPlan
  const planInfo    = PLAN_LIMITS[currentPlan]
  const activeCount = ctx.memberCount

  const canManageBilling = ctx.isOwner

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Paramètres</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gérez votre compte et votre organisation</p>
      </div>

      {/* ── Profil ──────────────────────────────────────────────────────────── */}
      <section className="card space-y-4">
        <h2 className="font-semibold text-gray-900">Mon profil</h2>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-auchu-100 flex items-center justify-center text-auchu-700 font-bold text-lg flex-shrink-0">
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover" />
              : (profile?.full_name ?? ctx.userName).charAt(0).toUpperCase()
            }
          </div>
          <div>
            <p className="font-semibold text-gray-900">{profile?.full_name ?? ctx.userName}</p>
            <p className="text-sm text-gray-500">{profile?.email ?? ctx.userEmail}</p>
            <p className="text-xs text-gray-400 mt-0.5 capitalize">
              {ctx.org?.name ?? 'Aucune organisation'} · {
                ctx.role === 'owner' ? 'Propriétaire' :
                ctx.role === 'manager' ? 'Manager' :
                ctx.role === 'editor' ? 'Éditeur' : 'Observateur'
              }
            </p>
          </div>
        </div>
      </section>

      {/* ── Organisation ────────────────────────────────────────────────────── */}
      {ctx.org ? (
        <section className="card space-y-4">
          <h2 className="font-semibold text-gray-900">Organisation</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">{ctx.org.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {activeCount} / {ctx.org.max_members === 999 ? '∞' : ctx.org.max_members} membres actifs
              </p>
            </div>
            {canManageBilling && (
              <a href="/dashboard/equipe" className="btn-secondary text-sm">
                Gérer l'équipe →
              </a>
            )}
          </div>
          {ctx.isOwner && (
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-auchu-500 rounded-full transition-all"
                style={{
                  width: ctx.org.max_members === 999
                    ? '10%'
                    : `${Math.min(100, (activeCount / ctx.org.max_members) * 100)}%`,
                }}
              />
            </div>
          )}
        </section>
      ) : (
        <section className="card">
          <h2 className="font-semibold text-gray-900 mb-3">Créer votre organisation</h2>
          <p className="text-sm text-gray-500 mb-4">Vous n'avez pas encore d'organisation. Créez-en une pour inviter votre équipe.</p>
          <CreateOrgButton />
        </section>
      )}

      {/* ── Facturation ─────────────────────────────────────────────────────── */}
      {canManageBilling && (
        <section className="space-y-4">
          <div>
            <h2 className="font-semibold text-gray-900">Facturation & plan</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Plan actuel : <span className="font-semibold text-gray-900">{planInfo.label}</span>
              {planInfo.price > 0 && <span className="text-gray-400 ml-1">· {planInfo.price}$/mois</span>}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {PLANS.map(({ id, icon: Icon, features }) => {
              const info    = PLAN_LIMITS[id]
              const isCurrent = currentPlan === id
              const isUpgrade = PLANS.findIndex(p => p.id === id) > PLANS.findIndex(p => p.id === currentPlan)
              return (
                <div
                  key={id}
                  className={cn(
                    'rounded-2xl border-2 p-4 flex flex-col gap-3 transition-all',
                    isCurrent
                      ? 'border-auchu-400 bg-auchu-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center',
                      isCurrent ? 'bg-auchu-200' : 'bg-gray-100'
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
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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

// Client component pour la création d'org inline
function CreateOrgButton() {
  return (
    <a href="/auth/signup" className="btn-primary text-sm">
      Créer une organisation
    </a>
  )
}
