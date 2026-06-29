'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Building2, Users, ChevronLeft, Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

type Step = 'choose' | 'join_code' | 'create_form' | 'join_form'

const ROLE_LABELS: Record<string, string> = {
  manager: 'Manager', editor: 'Éditeur', viewer: 'Observateur',
}

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteParam  = searchParams.get('invite')

  const [step,    setStep]    = useState<Step>(inviteParam ? 'join_code' : 'choose')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  // Join code state
  const [code,       setCode]       = useState(inviteParam ?? '')
  const [validating, setValidating] = useState(false)
  const [inviteInfo, setInviteInfo] = useState<{ org_name: string; role: string } | null>(null)

  // Form state
  const [form, setForm] = useState({ full_name: '', agency_name: '', email: '', password: '' })
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  // Auto-validate if invite param in URL
  useEffect(() => {
    if (inviteParam) validateCode(inviteParam)
  }, [inviteParam]) // eslint-disable-line

  async function validateCode(c = code) {
    const trimmed = c.trim().toUpperCase()
    if (trimmed.length < 6) return
    setValidating(true); setError(null)
    const res = await fetch(`/api/invitations/validate?code=${trimmed}`)
    const json = await res.json()
    setValidating(false)
    if (!res.ok) { setError(json.error); return }
    setInviteInfo({ org_name: json.org_name, role: json.role })
    setStep('join_form')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)

    const supabase = createClient()
    const { error: signupErr } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data:            { full_name: form.full_name },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    })

    if (signupErr) { setError(signupErr.message); setLoading(false); return }

    if (step === 'create_form') {
      const res = await fetch('/api/org/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.agency_name }),
      })
      if (!res.ok) {
        const j = await res.json()
        setError(j.error ?? 'Erreur lors de la création de l\'agence')
        setLoading(false); return
      }
    }

    if (step === 'join_form') {
      const res = await fetch('/api/invitations/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      })
      if (!res.ok) {
        const j = await res.json()
        setError(j.error ?? 'Erreur lors de l\'adhésion à l\'équipe')
        setLoading(false); return
      }
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="w-full max-w-sm space-y-4">

      {/* ── Étape 1 : choix du mode ─────────────────────────────────────────── */}
      {step === 'choose' && (
        <div className="card space-y-4">
          <div className="mb-2">
            <h1 className="text-xl font-semibold text-gray-900">Bienvenue sur AuchuOS</h1>
            <p className="text-sm text-gray-500 mt-0.5">Comment souhaitez-vous démarrer ?</p>
          </div>
          <button
            onClick={() => setStep('create_form')}
            className="w-full group flex items-start gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-auchu-400 hover:bg-auchu-50 transition-all text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-auchu-100 flex items-center justify-center flex-shrink-0 group-hover:bg-auchu-200 transition-colors">
              <Building2 className="w-5 h-5 text-auchu-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Créer mon agence</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                Démarrer un espace agence, inviter mon équipe et gérer mes clients
              </p>
            </div>
          </button>
          <button
            onClick={() => setStep('join_code')}
            className="w-full group flex items-start gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-200 transition-colors">
              <Users className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Rejoindre une équipe</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                Entrer un code d'invitation reçu de mon responsable
              </p>
            </div>
          </button>
          <p className="text-xs text-gray-500 text-center pt-1">
            Déjà un compte ?{' '}
            <Link href="/auth/login" className="text-auchu-600 hover:underline font-medium">Se connecter</Link>
          </p>
        </div>
      )}

      {/* ── Étape 2a : code d'invitation ────────────────────────────────────── */}
      {step === 'join_code' && (
        <div className="card space-y-4">
          <button onClick={() => setStep('choose')} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors -mb-1">
            <ChevronLeft className="w-3.5 h-3.5" /> Retour
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Code d'invitation</h1>
            <p className="text-sm text-gray-500 mt-0.5">Entrez le code à 6 caractères reçu de votre agence</p>
          </div>
          <div>
            <label className="label">Code d'invitation</label>
            <input
              type="text"
              value={code}
              onChange={e => { setCode(e.target.value.toUpperCase()); setError(null) }}
              onKeyDown={e => e.key === 'Enter' && validateCode()}
              placeholder="ABC123"
              maxLength={6}
              className="input text-center text-xl font-mono tracking-[0.5em] uppercase"
              autoFocus
            />
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
          <button
            onClick={() => validateCode()}
            disabled={code.length < 6 || validating}
            className="btn-primary w-full justify-center disabled:opacity-50"
          >
            {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Valider le code'}
          </button>
        </div>
      )}

      {/* ── Étape 2b : formulaire créer agence ──────────────────────────────── */}
      {step === 'create_form' && (
        <div className="card">
          <button onClick={() => setStep('choose')} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-4">
            <ChevronLeft className="w-3.5 h-3.5" /> Retour
          </button>
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Créer mon agence</h1>
          <p className="text-sm text-gray-500 mb-5">Tu seras le propriétaire de l'organisation</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Ton nom</label>
              <input type="text" className="input" placeholder="Alex Tremblay" value={form.full_name} onChange={set('full_name')} required />
            </div>
            <div>
              <label className="label">Nom de l'agence</label>
              <input type="text" className="input" placeholder="AuchuMedia" value={form.agency_name} onChange={set('agency_name')} required />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" placeholder="toi@agence.com" value={form.email} onChange={set('email')} required />
            </div>
            <div>
              <label className="label">Mot de passe</label>
              <input type="password" className="input" placeholder="Minimum 8 caractères" minLength={8} value={form.password} onChange={set('password')} required />
            </div>
            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Créer mon agence'}
            </button>
          </form>
          <p className="text-xs text-gray-500 text-center mt-4">
            Déjà un compte ?{' '}
            <Link href="/auth/login" className="text-auchu-600 hover:underline font-medium">Se connecter</Link>
          </p>
        </div>
      )}

      {/* ── Étape 2c : formulaire rejoindre équipe ───────────────────────────── */}
      {step === 'join_form' && inviteInfo && (
        <div className="card">
          <button onClick={() => { setStep('join_code'); setInviteInfo(null) }} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-4">
            <ChevronLeft className="w-3.5 h-3.5" /> Retour
          </button>
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-5">
            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-900">{inviteInfo.org_name}</p>
              <p className="text-xs text-green-700">Rôle : {ROLE_LABELS[inviteInfo.role] ?? inviteInfo.role}</p>
            </div>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Créer mon compte</h1>
          <p className="text-sm text-gray-500 mb-5">Tu rejoindras automatiquement l'équipe après l'inscription</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Ton nom</label>
              <input type="text" className="input" placeholder="Sammy Martin" value={form.full_name} onChange={set('full_name')} required />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" placeholder="toi@email.com" value={form.email} onChange={set('email')} required />
            </div>
            <div>
              <label className="label">Mot de passe</label>
              <input type="password" className="input" placeholder="Minimum 8 caractères" minLength={8} value={form.password} onChange={set('password')} required />
            </div>
            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : `Rejoindre ${inviteInfo.org_name}`}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  )
}
