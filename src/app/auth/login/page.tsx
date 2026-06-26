'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email ou mot de passe incorrect.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="w-full max-w-sm">
      <div className="card">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Connexion</h1>
          <p className="text-sm text-gray-500">Accède à ton espace AuchuOS</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              placeholder="toi@auchumedia.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label">Mot de passe</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
            {loading ? <span className="spinner" /> : null}
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <p className="text-xs text-gray-500 text-center mt-5">
          Pas encore de compte ?{' '}
          <Link href="/auth/signup" className="text-auchu-600 hover:underline font-medium">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  )
}
