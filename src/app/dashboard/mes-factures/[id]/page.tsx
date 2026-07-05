import { createClient }  from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/org'
import { notFound, redirect } from 'next/navigation'
import InvoiceMembreDetail from './InvoiceMembreDetail'

export const metadata = { title: 'Facture' }

export default async function FactureMembrePage({ params }: { params: { id: string } }) {
  const ctx = await getOrgContext()
  if (!ctx) redirect('/auth/login')

  const supabase = await createClient()

  const { data: invoice, error } = await supabase
    .from('member_invoices')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (error || !invoice) notFound()

  const [{ data: org }, { data: member }] = await Promise.all([
    supabase
      .from('organizations')
      .select('name, logo_url, primary_color, email, phone, website, address_street, address_city, address_province, address_postal, address_country')
      .eq('owner_id', ctx.dataOwnerId)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', invoice.member_id)
      .maybeSingle(),
  ])

  return (
    <InvoiceMembreDetail
      invoice={invoice}
      org={org ?? null}
      member={member ?? null}
      viewerIsSelf={invoice.member_id === ctx.userId}
      viewerCanApprove={ctx.isOwner || ctx.isDirector}
    />
  )
}
