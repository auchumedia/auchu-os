import { createAnonClient } from '@/lib/supabase/anon'
import { createClient }     from '@/lib/supabase/server'
import InviteClient         from './InviteClient'
import { XCircle }          from 'lucide-react'
import Link                 from 'next/link'

export const dynamic = 'force-dynamic'

interface InviteInfo {
  id:             string
  code:           string
  role:           string
  expires_at:     string
  org_id:         string
  org_name:       string
  invited_name:   string | null
  invited_email:  string | null
}

async function getInvite(code: string): Promise<InviteInfo | null> {
  const anon           = createAnonClient()
  const normalizedCode = code.toUpperCase().trim()

  console.log('[invite] lookup code:', normalizedCode)

  // Requête principale — .maybeSingle() retourne data:null sans erreur si 0 lignes
  const { data, error } = await anon
    .from('invitations')
    .select('id, code, role, expires_at, org_id, invited_name, invited_email, org:organizations(name)')
    .eq('code', normalizedCode)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  console.log('[invite] data:', JSON.stringify(data), '| error:', JSON.stringify(error))

  if (data) {
    const org = data.org as unknown as { name: string } | null
    return {
      id:            data.id,
      code:          data.code,
      role:          data.role,
      expires_at:    data.expires_at,
      org_id:        data.org_id,
      org_name:      org?.name ?? 'Cette agence',
      invited_name:  (data as any).invited_name  ?? null,
      invited_email: (data as any).invited_email ?? null,
    }
  }

  // Si erreur de colonne inconnue (migration 013 non appliquée), on réessaie sans ces colonnes
  if (error && error.code !== 'PGRST116') {
    console.log('[invite] fallback sans invited_name/invited_email — erreur:', error.code, error.message)
    const { data: d2, error: e2 } = await anon
      .from('invitations')
      .select('id, code, role, expires_at, org_id, org:organizations(name)')
      .eq('code', normalizedCode)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    console.log('[invite] fallback data:', JSON.stringify(d2), '| error:', JSON.stringify(e2))

    if (d2) {
      const org2 = d2.org as unknown as { name: string } | null
      return {
        id:            d2.id,
        code:          d2.code,
        role:          d2.role,
        expires_at:    d2.expires_at,
        org_id:        d2.org_id,
        org_name:      org2?.name ?? 'Cette agence',
        invited_name:  null,
        invited_email: null,
      }
    }
  }

  console.log('[invite] aucune invitation trouvée pour ce code')
  return null
}

export default async function InvitePage({ params }: { params: { code: string } }) {
  const invite = await getInvite(params.code)

  if (!invite) {
    return (
      <div className="w-full max-w-sm">
        <div className="card text-center space-y-4 py-10">
          <XCircle className="w-12 h-12 text-red-300 mx-auto" />
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Lien invalide</h1>
            <p className="text-sm text-gray-500 mt-1">
              Ce lien d'invitation est expiré, déjà utilisé ou n'existe pas.
            </p>
          </div>
          <Link href="/auth/login" className="btn-secondary inline-flex">
            Retour à la connexion
          </Link>
        </div>
      </div>
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Détecter un email différent entre l'invité et l'utilisateur connecté
  const emailMismatch =
    !!user &&
    !!invite.invited_email &&
    user.email?.toLowerCase() !== invite.invited_email.toLowerCase()

  return (
    <InviteClient
      invite={invite}
      isLoggedIn={!!user}
      userEmail={user?.email ?? null}
      emailMismatch={emailMismatch}
    />
  )
}
