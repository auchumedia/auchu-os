import { redirect } from 'next/navigation'

// "Mon espace" a été fusionné dans /dashboard (tableau de bord unifié) —
// cette page ne subsiste que pour ne pas casser d'anciens liens/favoris.
export default function MonEspaceRedirect() {
  redirect('/dashboard')
}
