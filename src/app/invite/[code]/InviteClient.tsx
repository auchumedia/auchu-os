'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Building2, Loader2, CheckCircle2, Users, AlertTriangle, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

const ROLE_CONFIG: Record<string, { label: string; desc: string; cls: string }> = {
  manager: {
    label: 'Manager',
    desc:  'Gère les clients, projets, calendrier et l\'équipe',
    cls:   'bg-blue-100 text-blue-700',
  },
  partner: {
    label: 'Partenaire',
    desc:  'Accès aux clients assignés, contenu et calendrier',
    cls:   'bg-orange-100 text-orange-700',
  },
  editor: {
    label: 'Éditeur',
    desc:  'Crée et édite du contenu pour les clients',
    cls:   'bg-green-100 text-green-700',
  },
  viewer: {
    label: 'Observateur',
    desc:  'Lecture seule sur les projets et le calendrier',
    cls:   'bg-gray-100 text-gray-600',
  },
}

interface InviteInfo {
  id:            string
  code:          string
  role:          string
  org_name:      string
  invited_name:  string | null
  invited_email: string | null
}

interface Props {
  invite:        InviteInfo
  isLoggedIn:    boolean
  userEmail:     string | null
  emailMismatch: boolean
}

export default function InviteClient({ invite, isLoggedIn, userEmail, emailMismatch }: Props) {
  const router    = useRouter()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [form,    setForm]    = useState({
    full_name: invite.invited_name ?? '',
    email:     invite.invited_email ?? '',
    password:  '',
  })
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const roleCfg    = ROLE_CONFIG[invite.role] ?? { label: invite.role, desc: '', cls: 'bg-gray-100 text-gray-600' }
  const firstName  = invite.invited_name?.split(' ')[0] ?? null

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.reload()
  }

  async function joinWithExistingAccount() {
    setLoading(true)
    setError(null)
    const res = await fetch('/api/invitations/join', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ code: invite.code }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setLoading(false); return }
    router.push('/dashboard')
    router.refresh()
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: signupErr } = await supabase.auth.signUp({
      email:    form.email,
      password: form.password,
      options:  { data: { full_name: form.full_name } },
    })
    if (signupErr) { setError(signupErr.message); setLoading(false); return }

    const res = await fetch('/api/invitations/join', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ code: invite.code }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setLoading(false); return }

    router.push('/dashboard')
    router.refresh()
  }

  const roleBgCls = roleCfg.cls.includes('blue')   ? 'bg-blue-50'
                  : roleCfg.cls.includes('orange')  ? 'bg-orange-50'
                  : roleCfg.cls.includes('green')   ? 'bg-green-50'
                  : 'bg-gray-50'

  return (
    <div className="w-full max-w-sm space-y-4">

      {/* ── Header invitation ─────────────────────────────────────────────── */}
      <div className="card space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-auchu-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-auchu-600" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Invitation</p>
            <h1 className="text-base font-semibold text-gray-900 leading-snug">
              {firstName
                ? <>Bonjour {firstName}, <span className="text-gray-500 font-normal">{invite.org_name} vous invite</span></>
                : <>{invite.org_name} vous invite à rejoindre l'équipe</>
              }
            </h1>
          </div>
        </div>

        {/* Rôle proposé */}
        <div className={cn('flex items-start gap-3 rounded-xl px-4 py-3', roleBgCls)}>
          <Users className="w-4 h-4 mt-0.5 flex-shrink-0 opacity-60" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-800">Vous serez</span>
              <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', roleCfg.cls)}>
                {roleCfg.label}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{roleCfg.desc}</p>
          </div>
        </div>
      </div>

      {/* ── Avertissement email différent ─────────────────────────────────── */}
      {emailMismatch && (
        <div className="card border-amber-200 bg-amber-50 space-y-3 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-900">Mauvais compte</p>
              <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                Cette invitation est destinée à <strong>{invite.invited_email}</strong>, mais vous êtes connecté en tant que <strong>{userEmail}</strong>.
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs font-medium text-amber-700 hover:text-amber-900 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Se déconnecter et utiliser le bon compte
          </button>
        </div>
      )}

      {/* ── Carte d'action ───────────────────────────────────────────────── */}
      {isLoggedIn && !emailMismatch ? (
        <div className="card space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Rejoindre l'équipe</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Connecté en tant que <span className="font-medium text-gray-700">{userEmail}</span>
            </p>
          </div>
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}
          <button
            onClick={joinWithExistingAccount}
            disabled={loading}
            className="btn-primary w-full justify-center disabled:opacity-50"
          >
            {loading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <><CheckCircle2 className="w-4 h-4" /> Rejoindre {invite.org_name}</>
            }
          </button>
          <p className="text-xs text-gray-400 text-center">
            Ce n'est pas votre compte ?{' '}
            <button onClick={handleLogout} className="text-auchu-600 hover:underline font-medium">
              Se déconnecter
            </button>
          </p>
        </div>
      ) : !isLoggedIn ? (
        <div className="card space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Créer mon compte</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Vous rejoindrez <strong>{invite.org_name}</strong> automatiquement
            </p>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="label">Nom complet</label>
              <input
                type="text"
                className="input"
                placeholder="Samuel Martin"
                value={form.full_name}
                onChange={set('full_name')}
                required
                autoFocus={!form.full_name}
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                placeholder="toi@email.com"
                value={form.email}
                onChange={set('email')}
                required
              />
            </div>
            <div>
              <label className="label">Mot de passe</label>
              <input
                type="password"
                className="input"
                placeholder="Minimum 8 caractères"
                minLength={8}
                value={form.password}
                onChange={set('password')}
                required
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center disabled:opacity-50"
            >
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : 'Créer mon compte et rejoindre'
              }
            </button>
          </form>

          <p className="text-xs text-gray-400 text-center border-t border-gray-100 pt-4">
            Déjà un compte ?{' '}
            <Link
              href={`/auth/login?next=/invite/${invite.code}`}
              className="text-auchu-600 hover:underline font-medium"
            >
              Se connecter pour accepter
            </Link>
          </p>
        </div>
      ) : null}
    </div>
  )
}
