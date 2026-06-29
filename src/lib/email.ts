import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const FROM_EMAIL  = process.env.RESEND_FROM_EMAIL  || 'onboarding@resend.dev'

const ROLE_LABELS: Record<string, string> = {
  manager: 'Manager',
  partner: 'Partenaire',
  editor:  'Éditeur',
  viewer:  'Observateur',
}

const ROLE_DESCS: Record<string, string> = {
  manager: 'Accès aux clients, projets, calendrier et gestion de l\'équipe',
  partner: 'Accès à vos clients assignés, création de contenu et calendrier',
  editor:  'Création et édition de contenu pour les clients',
  viewer:  'Lecture seule sur les projets et le calendrier',
}

function buildInviteHtml({
  firstName,
  orgName,
  roleLabel,
  roleDesc,
  inviteUrl,
}: {
  firstName:  string
  orgName:    string
  roleLabel:  string
  roleDesc:   string
  inviteUrl:  string
}): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Invitation — ${orgName}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:40px 16px">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#4f46e5 0%,#6366f1 100%);border-radius:16px 16px 0 0;padding:36px 32px;text-align:center">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:52px;height:52px;background:rgba(255,255,255,0.15);border-radius:14px;margin-bottom:20px">
        <span style="color:white;font-size:22px;font-weight:700;line-height:1">A</span>
      </div>
      <h1 style="color:white;margin:0 0 6px;font-size:22px;font-weight:700;letter-spacing:-0.3px">${orgName}</h1>
      <p style="color:rgba(255,255,255,0.75);margin:0;font-size:14px">vous invite à rejoindre l'équipe</p>
    </div>

    <!-- Body -->
    <div style="background:white;padding:36px 32px;border-radius:0 0 16px 16px;border:1px solid #e5e7eb;border-top:none">

      <p style="color:#111827;font-size:16px;font-weight:500;margin:0 0 6px">Bonjour ${firstName},</p>
      <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 28px">
        <strong style="color:#111827">${orgName}</strong> vous a envoyé une invitation pour rejoindre
        leur espace de travail en tant que&nbsp;
        <span style="display:inline-block;background:#fff7ed;color:#c2410c;padding:2px 10px;border-radius:20px;font-size:13px;font-weight:600">${roleLabel}</span>.
      </p>

      <!-- CTA -->
      <div style="text-align:center;margin:0 0 28px">
        <a href="${inviteUrl}"
           style="display:inline-block;background:#4f46e5;color:white;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:600;letter-spacing:0.1px">
          Rejoindre l'équipe →
        </a>
      </div>

      <!-- Role detail -->
      <div style="background:#f9fafb;border:1px solid #f3f4f6;border-radius:12px;padding:16px 20px;margin:0 0 24px">
        <p style="color:#374151;font-size:13px;font-weight:600;margin:0 0 4px">En tant que ${roleLabel}, vous pourrez :</p>
        <p style="color:#6b7280;font-size:13px;line-height:1.5;margin:0">${roleDesc}</p>
      </div>

      <!-- Fallback link -->
      <p style="color:#9ca3af;font-size:12px;line-height:1.5;margin:0 0 4px">
        Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur&nbsp;:
      </p>
      <p style="color:#6366f1;font-size:12px;word-break:break-all;margin:0 0 24px">
        <a href="${inviteUrl}" style="color:#6366f1">${inviteUrl}</a>
      </p>

      <!-- Footer -->
      <div style="border-top:1px solid #f3f4f6;padding-top:20px;text-align:center">
        <p style="color:#d1d5db;font-size:11px;margin:0">
          Ce lien expire dans 7 jours · Si vous n'attendiez pas cette invitation, ignorez cet email.
        </p>
      </div>
    </div>

    <p style="color:#d1d5db;font-size:11px;text-align:center;margin:20px 0 0">
      Envoyé via <span style="font-weight:600">AuchuOS</span>
    </p>
  </div>
</body>
</html>`
}

export async function sendInvitationEmail({
  to,
  toName,
  orgName,
  role,
  inviteUrl,
}: {
  to:         string
  toName:     string
  orgName:    string
  role:       string
  inviteUrl:  string
}): Promise<boolean> {
  if (!resend) {
    console.warn('[email] RESEND_API_KEY manquant — email d\'invitation non envoyé')
    return false
  }

  const roleLabel = ROLE_LABELS[role] ?? role
  const roleDesc  = ROLE_DESCS[role]  ?? ''
  const firstName = toName.split(' ')[0] || toName

  const html = buildInviteHtml({ firstName, orgName, roleLabel, roleDesc, inviteUrl })

  try {
    const { error } = await resend.emails.send({
      from:    `${orgName} via AuchuOS <${FROM_EMAIL}>`,
      to:      [to],
      subject: `${orgName} vous invite à rejoindre l'équipe`,
      html,
    })
    if (error) { console.error('[email] Resend error:', error); return false }
    return true
  } catch (err) {
    console.error('[email] sendInvitationEmail failed:', err)
    return false
  }
}
