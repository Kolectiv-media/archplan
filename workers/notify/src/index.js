// Cloudflare Worker — Email notification via SendGrid
// Replaces Firebase Cloud Function (functions/index.js)
//
// Deploy:
//   cd workers/notify
//   wrangler secret put SENDGRID_API_KEY
//   wrangler deploy
//
// Then set VITE_NOTIFY_WORKER_URL in Cloudflare Pages environment variables
// to the deployed worker URL (e.g. https://archplan-notify.<account>.workers.dev)

const COMPANY = { name: 'Studio Office Kolectiv', site: 'www.studiokolectiv.ro' }

const CHANNEL_LABELS = {
  general: 'General', cu: 'CU',
  avize: 'Avize', pt: 'PT', ac: 'Dosar AC',
}

const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'

// Verify a Firebase ID token (RS256 JWT signed by Google)
async function verifyFirebaseToken(token, projectId) {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Format JWT invalid')

  const decode = b64 =>
    JSON.parse(new TextDecoder().decode(
      Uint8Array.from(atob(b64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
    ))

  const header  = decode(parts[0])
  const payload = decode(parts[1])

  const now = Math.floor(Date.now() / 1000)
  if (payload.exp < now)             throw new Error('Token expirat')
  if (payload.iat > now + 300)       throw new Error('Token emis în viitor')
  if (payload.iss !== `https://securetoken.google.com/${projectId}`)
                                     throw new Error('Issuer invalid')
  if (payload.aud !== projectId)     throw new Error('Audience invalid')

  const keysRes = await fetch(GOOGLE_CERTS_URL)
  const { keys } = await keysRes.json()
  const jwk = keys.find(k => k.kid === header.kid)
  if (!jwk) throw new Error('Cheie publică negăsită')

  const publicKey = await crypto.subtle.importKey(
    'jwk', jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['verify']
  )

  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  const sig  = Uint8Array.from(
    atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')),
    c => c.charCodeAt(0)
  )
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, sig, data)
  if (!valid) throw new Error('Semnătură invalidă')

  return payload
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function highlightMentions(text) {
  return escHtml(text).replace(
    /@([\w][^\s@]*(?:\s[\w][^\s@]*)*)/g,
    '<span style="color:#0969da;font-weight:600;background:#ddf4ff;border-radius:3px;padding:0 3px">@$1</span>'
  )
}

function buildInvitationEmailHtml({ inviterName, projectName, appUrl }) {
  return `<!DOCTYPE html>
<html lang="ro">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f8fa;font-family:-apple-system,'Geist','Helvetica Neue',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fa;padding:32px 16px;">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #d0d7de;border-radius:12px;overflow:hidden;max-width:540px;">
        <tr><td style="background:linear-gradient(135deg,#0969da,#8250df);padding:22px 28px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="width:34px;height:34px;background:rgba(255,255,255,.18);border-radius:9px;text-align:center;vertical-align:middle;padding:7px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </td>
            <td style="padding-left:12px;">
              <div style="color:#fff;font-size:16px;font-weight:700;letter-spacing:-.3px;">ArchPlan</div>
              <div style="color:rgba(255,255,255,.7);font-size:11px;margin-top:1px;">${COMPANY.name}</div>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:26px 28px 20px;">
          <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#24292f;">Ai primit o invitație de colaborare</p>
          <p style="margin:0 0 18px;font-size:13px;color:#57606a;line-height:1.6;">
            <strong style="color:#24292f;">${escHtml(inviterName)}</strong> te-a invitat să colaborezi pe proiectul
            <strong style="color:#24292f;">${escHtml(projectName)}</strong> în ArchPlan.
          </p>
          <div style="background:#f6f8fa;border:1px solid #d0d7de;border-left:3px solid #0969da;border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:22px;">
            <div style="font-size:13px;color:#57606a;line-height:1.6;">
              Deschide aplicația, autentifică-te și acceptă invitația din bara laterală stângă. Vei putea vedea și edita proiectul în timp real împreună cu echipa.
            </div>
          </div>
          <a href="${appUrl}" style="display:inline-block;background:#0969da;color:#fff;text-decoration:none;border-radius:8px;padding:11px 22px;font-size:13px;font-weight:700;letter-spacing:-.1px;">
            Acceptă invitația →
          </a>
        </td></tr>
        <tr><td style="background:#f6f8fa;border-top:1px solid #d0d7de;padding:14px 28px;">
          <p style="margin:0;font-size:11px;color:#8c959f;line-height:1.6;">
            ${COMPANY.name} ·
            <a href="https://${COMPANY.site}" style="color:#0969da;text-decoration:none;">${COMPANY.site}</a>
            · Notificare automată generată de ArchPlan.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function buildAccessRequestEmailHtml({ requesterName, requesterEmail, appUrl }) {
  return `<!DOCTYPE html>
<html lang="ro">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f8fa;font-family:-apple-system,'Geist','Helvetica Neue',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fa;padding:32px 16px;">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #d0d7de;border-radius:12px;overflow:hidden;max-width:540px;">
        <tr><td style="background:linear-gradient(135deg,#0969da,#8250df);padding:22px 28px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="width:34px;height:34px;background:rgba(255,255,255,.18);border-radius:9px;text-align:center;vertical-align:middle;padding:7px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </td>
            <td style="padding-left:12px;">
              <div style="color:#fff;font-size:16px;font-weight:700;letter-spacing:-.3px;">ArchPlan</div>
              <div style="color:rgba(255,255,255,.7);font-size:11px;margin-top:1px;">${COMPANY.name}</div>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:26px 28px 20px;">
          <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#24292f;">Cerere nouă de acces</p>
          <p style="margin:0 0 18px;font-size:13px;color:#57606a;line-height:1.6;">
            Un utilizator nou a solicitat acces în platforma ArchPlan și așteaptă aprobarea ta.
          </p>
          <div style="background:#f6f8fa;border:1px solid #d0d7de;border-left:3px solid #0969da;border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:22px;">
            <div style="font-size:11px;font-weight:600;color:#8c959f;text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px;">Detalii utilizator</div>
            <div style="font-size:14px;color:#24292f;margin-bottom:4px;"><strong>Nume:</strong> ${escHtml(requesterName)}</div>
            <div style="font-size:14px;color:#24292f;"><strong>Email:</strong> ${escHtml(requesterEmail)}</div>
          </div>
          <p style="margin:0 0 18px;font-size:13px;color:#57606a;line-height:1.6;">
            Autentifică-te în ArchPlan și aprobă sau respinge cererea din secțiunea <strong style="color:#24292f;">Cereri de acces</strong>.
            Odată aprobat, specifică la ce proiecte are acces noul utilizator.
          </p>
          <a href="${appUrl}" style="display:inline-block;background:#0969da;color:#fff;text-decoration:none;border-radius:8px;padding:11px 22px;font-size:13px;font-weight:700;letter-spacing:-.1px;">
            Deschide ArchPlan →
          </a>
        </td></tr>
        <tr><td style="background:#f6f8fa;border-top:1px solid #d0d7de;padding:14px 28px;">
          <p style="margin:0;font-size:11px;color:#8c959f;line-height:1.6;">
            ${COMPANY.name} ·
            <a href="https://${COMPANY.site}" style="color:#0969da;text-decoration:none;">${COMPANY.site}</a>
            · Notificare automată generată de ArchPlan.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function buildEmailHtml({ mentionedBy, projectName, channel, messageText, appUrl }) {
  const chanLabel = CHANNEL_LABELS[channel] || channel
  return `<!DOCTYPE html>
<html lang="ro">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f8fa;font-family:-apple-system,'Geist','Helvetica Neue',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fa;padding:32px 16px;">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #d0d7de;border-radius:12px;overflow:hidden;max-width:540px;">
        <tr><td style="background:linear-gradient(135deg,#0969da,#8250df);padding:22px 28px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="width:34px;height:34px;background:rgba(255,255,255,.18);border-radius:9px;text-align:center;vertical-align:middle;padding:7px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </td>
            <td style="padding-left:12px;">
              <div style="color:#fff;font-size:16px;font-weight:700;letter-spacing:-.3px;">ArchPlan</div>
              <div style="color:rgba(255,255,255,.7);font-size:11px;margin-top:1px;">${COMPANY.name}</div>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:26px 28px 20px;">
          <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#24292f;">Ai fost menționat în chat</p>
          <p style="margin:0 0 18px;font-size:13px;color:#57606a;line-height:1.6;">
            <strong style="color:#24292f;">${escHtml(mentionedBy)}</strong> te-a menționat în proiectul
            <strong style="color:#24292f;">${escHtml(projectName)}</strong>
            în canalul <strong style="color:#24292f;">#${chanLabel}</strong>.
          </p>
          <div style="background:#f6f8fa;border:1px solid #d0d7de;border-left:3px solid #0969da;border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:22px;">
            <div style="font-size:11px;font-weight:600;color:#8c959f;text-transform:uppercase;letter-spacing:.6px;margin-bottom:7px;">Mesaj</div>
            <div style="font-size:14px;color:#24292f;line-height:1.6;">${highlightMentions(messageText)}</div>
          </div>
          <a href="${appUrl}" style="display:inline-block;background:#0969da;color:#fff;text-decoration:none;border-radius:8px;padding:11px 22px;font-size:13px;font-weight:700;letter-spacing:-.1px;">
            Deschide ArchPlan →
          </a>
        </td></tr>
        <tr><td style="background:#f6f8fa;border-top:1px solid #d0d7de;padding:14px 28px;">
          <p style="margin:0;font-size:11px;color:#8c959f;line-height:1.6;">
            ${COMPANY.name} ·
            <a href="https://${COMPANY.site}" style="color:#0969da;text-decoration:none;">${COMPANY.site}</a>
            · Notificare automată generată de ArchPlan.<br>
            Primești acest email deoarece ești menționat într-un proiect din aplicație.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS })
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405)
    }

    // Verify Firebase auth token
    const authHeader = request.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) {
      return json({ error: 'Neautentificat' }, 401)
    }

    try {
      await verifyFirebaseToken(authHeader.slice(7), env.FIREBASE_PROJECT_ID)
    } catch (err) {
      return json({ error: 'Token invalid: ' + err.message }, 401)
    }

    // Parse body
    let body
    try {
      body = await request.json()
    } catch {
      return json({ error: 'Body JSON invalid' }, 400)
    }

    const { type, toEmail, toName, mentionedBy, projectName, channel, messageText,
            requesterName, requesterEmail, inviterName, inviterEmail } = body

    const appUrl = env.APP_URL || 'https://app.studiokolectiv.ro'

    const fromAddress = env.FROM_EMAIL
      ? `ArchPlan <${env.FROM_EMAIL}>`
      : 'ArchPlan <onboarding@resend.dev>'

    let emailBody
    if (type === 'invitation') {
      if (!toEmail) return json({ error: 'toEmail lipsă' }, 400)
      emailBody = {
        from:    fromAddress,
        to:      [toEmail],
        subject: `${inviterName || inviterEmail} te-a invitat pe ArchPlan — ${projectName}`,
        html:    buildInvitationEmailHtml({ inviterName: inviterName || inviterEmail, projectName, appUrl }),
        text:    `${inviterName || inviterEmail} te-a invitat să colaborezi pe proiectul "${projectName}" în ArchPlan.\n\nDeschide aplicația și acceptă invitația: ${appUrl}`,
      }
    } else if (type === 'access_request') {
      const adminEmail = env.ADMIN_EMAIL || 'marketing.kolectiv@gmail.com'
      emailBody = {
        from:    fromAddress,
        to:      [adminEmail],
        subject: `Cerere acces ArchPlan — ${requesterName || requesterEmail}`,
        html:    buildAccessRequestEmailHtml({ requesterName: requesterName || requesterEmail, requesterEmail, appUrl }),
        text:    `Cerere nouă de acces în ArchPlan.\n\nNume: ${requesterName || requesterEmail}\nEmail: ${requesterEmail}\n\nIntră în aplicație pentru a aproba sau respinge cererea: ${appUrl}`,
      }
    } else {
      if (!toEmail) return json({ error: 'toEmail lipsă' }, 400)
      const chanLabel = CHANNEL_LABELS[channel] || channel
      emailBody = {
        from:    fromAddress,
        to:      [toEmail],
        subject: `@${toName} — ai fost menționat în ${projectName}`,
        html:    buildEmailHtml({ mentionedBy, projectName, channel, messageText, appUrl }),
        text:    `Ai fost menționat în ${projectName} (#${chanLabel}) de ${mentionedBy}:\n\n"${messageText}"\n\nDeschide ArchPlan: ${appUrl}`,
      }
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailBody),
    })

    if (!resendRes.ok) {
      const errText = await resendRes.text()
      return json({ error: 'Resend error: ' + errText }, 500)
    }

    return json({ success: true })
  },
}
