import { createAnonClient } from '@/lib/supabase/anon'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get('code')?.toUpperCase().trim()
  if (!code) return NextResponse.json({ error: 'Code requis' }, { status: 400 })

  const supabase = createAnonClient()

  const { data, error } = await supabase
    .from('invitations')
    .select('id, code, role, expires_at, org:organizations(name)')
    .eq('code', code)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Code invalide ou expiré' }, { status: 404 })
  }

  const org = data.org as unknown as { name: string } | null
  return NextResponse.json({
    valid:    true,
    code:     data.code,
    role:     data.role,
    org_name: org?.name ?? '',
    expires_at: data.expires_at,
  })
}
