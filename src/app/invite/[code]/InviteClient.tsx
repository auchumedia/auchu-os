'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Building2, Loader2, CheckCircle2, Users, AlertTriangle, LogOut, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ROLE_LABELS } from '@/lib/roles'
import type { OrgRole } from '@/types'

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
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [emailSent,    setEmailSent]    = useState(false)
  const [form,    setForm]    = useState({
    full_name: invite.invited_name ?? '',
    email:     invite.invited_email ?? '',
    password:  '',
  })
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const roleCfg    = ROLE_LABELS[invite.role as OrgRole] ?? { label: invite.role, desc: '', cls: 'bg-gray-100 text-gray-600' }
  const firstName  = invite.invited_name?.split(' ')[0] ?? null

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.reload()
  }

  async function joinWithExistingAccount() {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/invitations/join', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ code: invite.code }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Erreur inconnue'); return }
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      console.error('[join] erreur inattendue:', err)
      setError('Erreur réseau — réessaie dans un instant')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: signupData, error: signupErr } = await supabase.auth.signUp({
        email:    form.email,
        password: form.password,
        options:  {
          data:            { full_name: form.full_name },
          // Le code d'invitation est passé dans l'URL pour que /auth/callback
          // puisse auto-joindre l'org après confirmation email
          // Code dans le PATH (pas query param) — Supabase ajoute ?code=xxx
          // à ce qui devient /auth/callback/U6VP3B?code=xxx
          emailRedirectTo: `${window.location.origin}/auth/callback/${invite.code}`,
        },
      })
      if (signupErr) { setError(signupErr.message); return }

      // Email confirmation activée : pas de session immédiate.
      // Le join se fera automatiquement dans /auth/callback après confirmation.
      if (!signupData.session) {
        setEmailSent(true)
        return
      }

      const res  = await fetch('/api/invitations/join', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ code: invite.code }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Erreur inconnue'); return }

      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      console.error('[signup] erreur inattendue:', err)
      setError('Erreur réseau — réessaie dans un instant')
    } finally {
      setLoading(false)
    }
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
        emailSent ? (
          <div className="card space-y-4 text-center py-8">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Mail className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Vérifie ta boîte email</h2>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                Un lien de confirmation a été envoyé à <strong className="text-gray-700">{form.email}</strong>.
                Clique dessus pour activer ton compte et rejoindre <strong className="text-gray-700">{invite.org_name}</strong> automatiquement.
              </p>
            </div>
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
        )
      ) : null}
    </div>
  )
}
