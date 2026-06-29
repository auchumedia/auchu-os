import { Resend } from 'resend'

// Vérification au démarrage
const apiKey = process.env.RESEND_API_KEY
if (!apiKey) {
  console.warn('[email] RESEND_API_KEY absent — les emails d\'invitation ne seront pas envoyés')
} else {
  console.log(`[email] RESEND_API_KEY chargée (${apiKey.slice(0, 8)}...)`)
}

const resend = apiKey ? new Resend(apiKey) : null

// IMPORTANT : onboarding@resend.dev ne peut envoyer QU'à l'email du propriétaire
// du compte Resend. Pour envoyer à n'importe qui, vérifier un domaine dans le
// dashboard Resend et définir RESEND_FROM_EMAIL=noreply@votre-domaine.com
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

// ─── Data ─────────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  manager: 'Manager',
  partner: 'Partenaire',
  editor:  'Éditeur',
  viewer:  'Observateur',
}


const ROLE_PERMISSIONS: Record<string, string[]> = {
  manager: [
    'Accès complet aux clients et projets',
    'Gestion du calendrier et des contenus',
    'Inviter et gérer les membres de l\'équipe',
  ],
  partner: [
    'Accès aux clients qui vous seront assignés',
    'Créer et éditer du contenu',
    'Consulter le calendrier de l\'équipe',
  ],
  editor: [
    'Créer et éditer des contenus',
    'Accès aux projets et aux clients',
    'Gestion du calendrier éditorial',
  ],
  viewer: [
    'Lecture seule sur tous les projets',
    'Accès au calendrier de l\'équipe',
    'Aucune modification possible',
  ],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map(w => w[0]?.toUpperCase() ?? '')
    .filter(Boolean)
    .slice(0, 2)
    .join('')
}


function buildPermissionsRows(role: string, checkColor: string): string {
  const perms = ROLE_PERMISSIONS[role] ?? []
  return perms.map(p => `
    <tr>
      <td style="padding:5px 12px 5px 0;vertical-align:top;width:20px">
        <span style="color:${checkColor};font-size:15px;font-weight:700;line-height:1.4">✓</span>
      </td>
      <td style="padding:5px 0;vertical-align:top">
        <span style="color:#374151;font-size:14px;line-height:1.5">${p}</span>
      </td>
    </tr>`).join('')
}

// ─── Template ─────────────────────────────────────────────────────────────────

function buildInviteHtml({
  firstName,
  orgName,
  orgLogoUrl,
  orgPrimaryColor,
  roleLabel,
  role,
  inviteUrl,
}: {
  firstName:       string
  orgName:         string
  orgLogoUrl:      string | null
  orgPrimaryColor: string
  roleLabel:       string
  role:            string
  inviteUrl:       string
}): string {
  const initials        = getInitials(orgName) || 'A'
  const permissionsRows = buildPermissionsRows(role, orgPrimaryColor)

  // Logo dans boîte blanche si disponible, sinon cercle d'initiales.
  const orgAvatar = orgLogoUrl
    ? `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto 24px">
        <tr>
          <td style="background:#ffffff;padding:10px 20px;border-radius:8px;text-align:center;vertical-align:middle">
            <img src="${orgLogoUrl}" alt="${orgName}"
                 style="max-width:160px;max-height:50px;height:auto;width:auto;object-fit:contain;display:block;margin:0 auto"
                 onerror="this.parentNode.parentNode.parentNode.parentNode.style.display='none'">
          </td>
        </tr>
      </table>`
    : `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto 24px">
        <tr>
          <td width="80" height="80"
              style="width:80px;height:80px;border-radius:50%;background:#ffffff;text-align:center;vertical-align:middle;font-size:28px;font-weight:800;letter-spacing:-1px;color:${orgPrimaryColor};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:80px">
            ${initials}
          </td>
        </tr>
      </table>`

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <title>Invitation — ${orgName}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;-webkit-font-smoothing:antialiased">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f1f5f9;padding:40px 0">
  <tr><td align="center" style="padding:0 16px">

    <!-- ─── Card ─────────────────────────────────────────────────────────── -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="max-width:580px;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(0,0,0,0.06)">

      <!-- ─── Header ──────────────────────────────────────────────────── -->
      <tr>
        <td style="background-color:#1a1a1a;padding:48px 48px 40px;text-align:center">
          ${orgAvatar}
          <h1 style="color:#ffffff;margin:0 0 8px;font-size:26px;font-weight:800;letter-spacing:-0.5px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">${orgName}</h1>
          <p style="color:rgba(255,255,255,0.72);margin:0;font-size:14px;font-weight:500;letter-spacing:0.1px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
            vous invite à rejoindre l'équipe
          </p>
        </td>
      </tr>

      <!-- ─── Body ────────────────────────────────────────────────────── -->
      <tr>
        <td style="background:#ffffff;padding:44px 48px 36px">

          <!-- Greeting -->
          <h2 style="color:#0f172a;font-size:22px;font-weight:700;margin:0 0 10px;letter-spacing:-0.3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
            Bonjour ${firstName},
          </h2>
          <p style="color:#64748b;font-size:15px;line-height:1.7;margin:0 0 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
            <strong style="color:#0f172a">${orgName}</strong> vous a envoyé une invitation pour
            rejoindre leur espace de travail sur <strong style="color:#0f172a">AuchuOS</strong>.
          </p>

          <!-- Role card -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                 style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:14px;margin-bottom:32px">
            <tr>
              <td style="padding:20px 24px">
                <!-- Role label -->
                <p style="color:#94a3b8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
                  Votre rôle
                </p>
                <!-- Role badge -->
                <div style="margin-bottom:18px">
                  <span style="display:inline-block;background:${orgPrimaryColor};color:#ffffff;padding:7px 18px;border-radius:999px;font-size:13px;font-weight:700;letter-spacing:0.1px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
                    ${roleLabel}
                  </span>
                </div>
                <!-- Permissions list -->
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  ${permissionsRows}
                </table>
              </td>
            </tr>
          </table>

          <!-- CTA button -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px">
            <tr>
              <td align="center">
                <a href="${inviteUrl}"
                   style="display:inline-block;background:${orgPrimaryColor};color:#ffffff;text-decoration:none;padding:17px 44px;border-radius:12px;font-size:16px;font-weight:700;letter-spacing:-0.1px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;box-shadow:0 4px 14px rgba(0,0,0,0.18)">
                  Rejoindre ${orgName} &nbsp;→
                </a>
              </td>
            </tr>
          </table>

          <!-- Expiry note -->
          <p style="color:#94a3b8;font-size:13px;text-align:center;margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
            Ce lien est valide pendant <strong style="color:#64748b">7 jours</strong>.
          </p>

        </td>
      </tr>

      <!-- ─── Fallback link ─────────────────────────────────────────── -->
      <tr>
        <td style="background:#f8fafc;border-top:1px solid #f1f5f9;padding:16px 48px">
          <p style="color:#94a3b8;font-size:11px;margin:0 0 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
            Bouton inaccessible ? Copiez ce lien&nbsp;:
          </p>
          <a href="${inviteUrl}"
             style="color:${orgPrimaryColor};font-size:12px;word-break:break-all;text-decoration:underline;font-family:ui-monospace,'Cascadia Code','Fira Code',monospace">
            ${inviteUrl}
          </a>
        </td>
      </tr>

      <!-- ─── Footer ────────────────────────────────────────────────── -->
      <tr>
        <td style="background:#ffffff;border-top:1px solid #f1f5f9;padding:24px 48px;text-align:center">
          <!-- AuchuOS branding -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td align="center" style="padding-bottom:12px">
                <table cellpadding="0" cellspacing="0" role="presentation" style="display:inline-table">
                  <tr>
                    <td style="background:${orgPrimaryColor};width:24px;height:24px;border-radius:6px;vertical-align:middle;text-align:center">
                      <span style="color:white;font-size:12px;font-weight:800;line-height:24px;display:block">A</span>
                    </td>
                    <td style="padding-left:8px;vertical-align:middle">
                      <span style="color:#475569;font-size:14px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">AuchuOS</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center">
                <p style="color:#cbd5e1;font-size:11px;margin:0;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
                  Logiciel de gestion d'agence &middot; Envoyé par ${orgName}<br>
                  Si vous n'attendiez pas cette invitation, ignorez cet email en toute sécurité.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

    </table>
    <!-- ─── End Card ──────────────────────────────────────────────────────── -->

  </td></tr>
</table>
</body>
</html>`
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function sendInvitationEmail({
  to,
  toName,
  orgName,
  orgLogoUrl      = null,
  orgPrimaryColor = '#4f46e5',
  role,
  inviteUrl,
}: {
  to:               string
  toName:           string
  orgName:          string
  orgLogoUrl?:      string | null
  orgPrimaryColor?: string
  role:             string
  inviteUrl:        string
}): Promise<boolean> {
  if (!resend) {
    console.warn('[email] RESEND_API_KEY manquant — email non envoyé')
    return false
  }

  const roleLabel = ROLE_LABELS[role] ?? role
  const firstName = toName.split(' ')[0] || toName

  // Validation basique de la couleur hex
  const color = /^#[0-9a-fA-F]{6}$/.test(orgPrimaryColor) ? orgPrimaryColor : '#4f46e5'

  const html = buildInviteHtml({ firstName, orgName, orgLogoUrl, orgPrimaryColor: color, roleLabel, role, inviteUrl })

  const fromField = FROM_EMAIL === 'onboarding@resend.dev'
    ? FROM_EMAIL
    : `${orgName} via AuchuOS <${FROM_EMAIL}>`

  const payload = {
    from:    fromField,
    to:      [to],
    subject: `${orgName} vous invite à rejoindre l'équipe`,
    html,
  }

  console.log('[email] Envoi vers:', to, '| from:', payload.from, '| subject:', payload.subject)

  try {
    const { data, error } = await resend.emails.send(payload)

    if (error) {
      console.error('[email] Resend erreur:', JSON.stringify(error, null, 2))
      return false
    }

    console.log('[email] Envoyé. ID Resend:', data?.id)
    return true
  } catch (err) {
    console.error('[email] Exception Resend:', err)
    return false
  }
}
