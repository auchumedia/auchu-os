import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import InvoiceDetail from './InvoiceDetail'

export const metadata = { title: 'Facture' }

export default async function FacturePage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('*, client:clients(id, name, email, phone, company)')
    .eq('id', params.id)
    .eq('user_id', user!.id)
    .single()

  if (error || !invoice) notFound()

  return <InvoiceDetail invoice={invoice} />
}
