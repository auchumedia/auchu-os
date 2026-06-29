import { createClient } from '@/lib/supabase/server'
import { notFound }      from 'next/navigation'
import InvoiceDetail     from './InvoiceDetail'

export const metadata = { title: 'Facture' }

export default async function FacturePage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [invoiceRes, orgRes] = await Promise.all([
    supabase
      .from('invoices')
      .select('*, client:clients(id, name, email, phone, company)')
      .eq('id', params.id)
      .eq('user_id', user!.id)
      .single(),
    supabase
      .from('organizations')
      .select('name, logo_url, primary_color, email, phone, website, address_street, address_city, address_province, address_postal, address_country')
      .eq('owner_id', user!.id)
      .maybeSingle(),
  ])

  if (invoiceRes.error || !invoiceRes.data) notFound()

  return <InvoiceDetail invoice={invoiceRes.data} org={orgRes.data ?? null} />
}
