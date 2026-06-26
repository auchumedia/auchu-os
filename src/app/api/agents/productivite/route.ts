import { NextRequest, NextResponse } from 'next/server'
import { anthropic, AGENT_MODEL, AGENT_SYSTEMS } from '@/lib/anthropic'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { clients, notes, startTime, workStyle } = await req.json()

    const clientsDesc = clients?.length > 0
      ? clients.map((c: any) => `- ${c.name}: ${c.deliverable} (priorité: ${c.priority})`).join('\n')
      : '- Aucun client spécifié'

    const prompt = `Voici la situation du gestionnaire aujourd'hui:
CLIENTS ET LIVRABLES:
${clientsDesc}

NOTES DU JOUR: ${notes || 'Aucune'}
HEURE DE DÉBUT: ${startTime || '9h00'}
STYLE DE TRAVAIL: ${workStyle || 'Équilibré'}

Génère un plan de journée en JSON:
{
  "stats": { "clients": N, "blocs": N, "heures_focus": N },
  "blocs": [
    {
      "heure": "9h00",
      "duree": "45 min",
      "titre": "...",
      "client": "...",
      "detail": "...",
      "priorite": "haute|moyenne|basse",
      "type": "creation|admin|reunion|review|pause"
    }
  ]
}

Règles: priorise l'urgent le matin, inclus pauses après 90 min, groupe tâches similaires, ajoute bloc admin/emails le matin, revue en fin de journée, journée 9h-17h30.`

    const message = await anthropic.messages.create({
      model: AGENT_MODEL,
      max_tokens: 1500,
      system: AGENT_SYSTEMS.productivite,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : '{}'
    const clean = text.replace(/```json|```/g, '').trim()
    const plan = JSON.parse(clean)

    return NextResponse.json({ plan })
  } catch (e: any) {
    console.error('Agent productivité error:', e)
    return NextResponse.json({ error: e.message || 'Erreur serveur' }, { status: 500 })
  }
}
