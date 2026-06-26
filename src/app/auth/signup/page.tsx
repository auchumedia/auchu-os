'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    full_name: '',
    agency_name: '',
    email: '',
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.full_name,
          agency_name: form.agency_name,
        },
      },
    })

    if (error) {
      setError(error.message)
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
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Créer ton compte</h1>
          <p className="text-sm text-gray-500">Lance ton espace agence AuchuOS</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="label">Ton nom</label>
            <input
              type="text"
              name="full_name"
              className="input"
              placeholder="Alex Tremblay"
              value={form.full_name}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label className="label">Nom de ton agence</label>
            <input
              type="text"
              name="agency_name"
              className="input"
              placeholder="AuchuMedia"
              value={form.agency_name}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label className="label">Email</label>
            <input
              type="email"
              name="email"
              className="input"
              placeholder="toi@auchumedia.com"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label className="label">Mot de passe</label>
            <input
              type="password"
              name="password"
              className="input"
              placeholder="Minimum 8 caractères"
              minLength={8}
              value={form.password}
              onChange={handleChange}
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
            {loading ? 'Création...' : 'Créer mon compte'}
          </button>
        </form>

        <p className="text-xs text-gray-500 text-center mt-5">
          Déjà un compte ?{' '}
          <Link href="/auth/login" className="text-auchu-600 hover:underline font-medium">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}
