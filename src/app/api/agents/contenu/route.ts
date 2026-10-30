import { NextRequest, NextResponse } from 'next/server'
import { anthropic, AGENT_MODEL, AGENT_SYSTEMS } from '@/lib/anthropic'
import { createClient } from '@/lib/supabase/server'

const MODE_PROMPTS: Record<string, (args: any) => string> = {
  social: ({ clientName, brief, tone, platform, language }) =>
    `Génère 3 variantes de post ${platform} pour le client "${clientName}". Brief: ${brief}. Ton: ${tone}. Langue: ${language}. Chaque variante doit avoir un angle différent (question engageante, storytelling, call-to-action direct). Inclus des hashtags. Format:\nVARIANTE 1:\n[texte]\n\nVARIANTE 2:\n[texte]\n\nVARIANTE 3:\n[texte]`,

  ads: ({ clientName, brief, tone, platform, language }) =>
    `Génère 3 variantes de copy publicitaire ${platform} pour "${clientName}". Brief: ${brief}. Ton: ${tone}. Langue: ${language}. Format pour chaque: Titre (max 40 car) + Texte principal (max 125 car) + CTA.\nVARIANTE 1:\nTitre: ...\nTexte: ...\nCTA: ...\n\nVARIANTE 2:\n...\n\nVARIANTE 3:\n...`,

  caption: ({ clientName, brief, tone, platform, language }) =>
    `Génère 3 captions ${platform} pour une photo de "${clientName}". Contexte: ${brief}. Ton: ${tone}. Langue: ${language}. Inclus emojis et hashtags.\nVARIANTE 1:\n[caption]\n\nVARIANTE 2:\n[caption]\n\nVARIANTE 3:\n[caption]`,

  script: ({ clientName, brief, tone, platform, language }) =>
    `Génère un script vidéo courte (30-60 sec) ${platform} pour "${clientName}". Sujet: ${brief}. Ton: ${tone}. Langue: ${language}. Structure: Accroche (3s) → Contenu (25s) → CTA (5s). Indique les actions visuelles entre [crochets].`,

  email: ({ clientName, brief, tone, language }) =>
    `Génère une infolettre pour "${clientName}". Sujet: ${brief}. Ton: ${tone}. Langue: ${language}. Structure: Objet accrocheur + préheader + corps (3 sections) + CTA.\nOBJET:\n...\nPRÉHEADER:\n...\nCORPS:\n...`,
}

function parseVariants(text: string, mode: string): { label: string; body: string }[] {
  if (mode === 'script' || mode === 'email') {
    return [{ label: mode === 'script' ? 'Script complet' : 'Infolettre', body: text.trim() }]
  }

  const parts = text.split(/VARIANTE \d+:/i).filter((p) => p.trim())
  if (parts.length >= 2) {
    return parts.map((p, i) => ({ label: `Option ${i + 1}`, body: p.trim() }))
  }
  return [{ label: 'Résultat', body: text.trim() }]
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const body = await req.json()
    const { mode, clientName, brief, tone, platform, language } = body

    if (!mode || !clientName || !brief) {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })
    }

    const promptFn = MODE_PROMPTS[mode]
    if (!promptFn) return NextResponse.json({ error: 'Mode invalide' }, { status: 400 })

    const message = await anthropic.messages.create({
      model: AGENT_MODEL,
      max_tokens: 1500,
      system: AGENT_SYSTEMS.contenu,
      messages: [{ role: 'user', content: promptFn({ clientName, brief, tone, platform, language }) }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const variants = parseVariants(text, mode)

    // Optionnel : sauvegarder en DB
    // await supabase.from('content_pieces').insert({ user_id: user.id, ... })

    return NextResponse.json({ variants, tokens_used: message.usage.output_tokens })
  } catch (e: any) {
    console.error('Agent contenu error:', e)
    return NextResponse.json({ error: e.message || 'Erreur serveur' }, { status: 500 })
  }
}
