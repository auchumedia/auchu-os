'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Building2, Loader2, CheckCircle2, Users } from 'lucide-react'
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
  id:       string
  code:     string
  role:     string
  org_name: string
}

interface Props {
  invite:     InviteInfo
  isLoggedIn: boolean
  userEmail:  string | null
}

export default function InviteClient({ invite, isLoggedIn, userEmail }: Props) {
  const router  = useRouter()
  const [mode,    setMode]    = useState<'signup' | 'done'>(isLoggedIn ? 'done' : 'signup')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [form, setForm]       = useState({ full_name: '', email: '', password: '' })
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const roleCfg = ROLE_CONFIG[invite.role] ?? { label: invite.role, desc: '', cls: 'bg-gray-100 text-gray-600' }

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

  return (
    <div className="w-full max-w-sm space-y-4">

      {/* Invite header card */}
      <div className="card space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-auchu-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-auchu-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Invitation</p>
            <h1 className="text-base font-semibold text-gray-900 leading-tight">
              {invite.org_name} vous invite
            </h1>
          </div>
        </div>

        <div className={cn('flex items-start gap-3 rounded-xl px-4 py-3', roleCfg.cls.includes('blue') ? 'bg-blue-50' : roleCfg.cls.includes('orange') ? 'bg-orange-50' : roleCfg.cls.includes('green') ? 'bg-green-50' : 'bg-gray-50')}>
          <Users className="w-4 h-4 mt-0.5 flex-shrink-0 opacity-70" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">Votre rôle</span>
              <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', roleCfg.cls)}>
                {roleCfg.label}
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-0.5">{roleCfg.desc}</p>
          </div>
        </div>
      </div>

      {/* Action card */}
      {isLoggedIn ? (
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
          <p className="text-xs text-gray-500 text-center">
            Ce n'est pas votre compte ?{' '}
            <Link
              href={`/auth/login?next=/invite/${invite.code}`}
              className="text-auchu-600 hover:underline font-medium"
            >
              Se connecter avec un autre compte
            </Link>
          </p>
        </div>
      ) : (
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
                placeholder="Alex Tremblay"
                value={form.full_name}
                onChange={set('full_name')}
                required
                autoFocus
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
                : `Créer mon compte et rejoindre`
              }
            </button>
          </form>

          <p className="text-xs text-gray-500 text-center border-t border-gray-100 pt-4">
            Déjà un compte ?{' '}
            <Link
              href={`/auth/login?next=/invite/${invite.code}`}
              className="text-auchu-600 hover:underline font-medium"
            >
              Se connecter pour accepter
            </Link>
          </p>
        </div>
      )}
    </div>
  )
}
