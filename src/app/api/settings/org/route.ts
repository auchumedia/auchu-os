import { createClient } from '@/lib/supabase/server'
import { NextResponse }  from 'next/server'

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    name, logo_url, primary_color, secondary_color,
    email, phone, website,
    address_street, address_city, address_province,
    address_postal, address_country,
  } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!org) return NextResponse.json({ error: 'Aucune organisation' }, { status: 404 })

  const { error } = await supabase
    .from('organizations')
    .update({
      name:             name.trim(),
      logo_url:         logo_url         || null,
      primary_color:    primary_color    || '#4f46e5',
      secondary_color:  secondary_color  || '#7c3aed',
      email:            email?.trim()            || null,
      phone:            phone?.trim()            || null,
      website:          website?.trim()          || null,
      address_street:   address_street?.trim()   || null,
      address_city:     address_city?.trim()     || null,
      address_province: address_province?.trim() || null,
      address_postal:   address_postal?.trim()   || null,
      address_country:  address_country?.trim()  || 'Canada',
      updated_at: new Date().toISOString(),
    })
    .eq('id', org.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
