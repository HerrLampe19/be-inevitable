// E-Mail-Versand. Nutzt SMTP (nodemailer) NUR wenn EMAIL_HOST gesetzt ist.
// Ohne Konfiguration wird die Mail ins Server-Log geschrieben (Dev-Fallback),
// damit die App ohne Mailserver nicht bricht und Links testbar bleiben.
//
// Benötigte Umgebungsvariablen für echten Versand:
//   EMAIL_HOST   z.B. smtp.zoho.eu / smtp.gmail.com
//   EMAIL_PORT   z.B. 465 (SSL) oder 587 (STARTTLS)   [Standard 587]
//   EMAIL_USER   SMTP-Benutzer (meist die Absenderadresse)
//   EMAIL_PASS   SMTP-Passwort / App-Passwort
//   EMAIL_FROM   Absender, z.B. "BE INEVITABLE <no-reply@deine-domain.de>"
//   APP_URL      öffentliche Basis-URL, z.B. https://be-inevitable.onrender.com

let transporter = null;
let triedInit = false;

function appUrl() {
  return (process.env.APP_URL || '').replace(/\/$/, '') || '';
}

async function getTransporter() {
  if (triedInit) return transporter;
  triedInit = true;
  if (!process.env.EMAIL_HOST) return null; // nicht konfiguriert -> Log-Fallback
  try {
    const nodemailer = (await import('nodemailer')).default;
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: Number(process.env.EMAIL_PORT) === 465,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
  } catch (e) {
    console.error('[email] nodemailer nicht verfügbar:', e.message);
    transporter = null;
  }
  return transporter;
}

// Sendet eine Mail. Gibt { sent } zurück. Wirft nie (Fehler werden geloggt),
// damit ein Mailproblem nie einen Request scheitern lässt.
export async function sendEmail({ to, subject, html, text }) {
  const from = process.env.EMAIL_FROM || 'BE INEVITABLE <no-reply@be-inevitable.local>';
  const tx = await getTransporter();
  if (!tx) {
    console.log('\n[email:LOG-FALLBACK] (kein EMAIL_HOST gesetzt – Mail wird nur geloggt)');
    console.log('  An:', to, '| Betreff:', subject);
    if (text) console.log('  Text:', text);
    console.log('');
    return { sent: false, logged: true };
  }
  try {
    await tx.sendMail({ from, to, subject, html, text: text || undefined });
    return { sent: true };
  } catch (e) {
    console.error('[email] Versand fehlgeschlagen:', e.message);
    return { sent: false, error: e.message };
  }
}

// Einheitliches Layout (schlicht, dunkel, mit Wortmarke als Text)
function wrap(title, bodyHtml) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a">
    <div style="background:#000;border-radius:12px;padding:18px 22px;text-align:center;margin-bottom:24px">
      <span style="color:#fff;font-size:22px;font-weight:800;letter-spacing:1px"><span style="background:#e2231a;padding:2px 8px;border-radius:4px">BE</span> INEVITABLE</span>
    </div>
    <h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
    ${bodyHtml}
    <p style="color:#888;font-size:12px;margin-top:28px;border-top:1px solid #eee;padding-top:14px">BE INEVITABLE · Lifestyle &amp; Bodybuilding Coaching</p>
  </div>`;
}

const btn = (url, label) =>
  `<a href="${url}" style="display:inline-block;background:#e2231a;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;margin:8px 0">${label}</a>`;

export function verifyEmailContent(name, token) {
  const link = `${appUrl()}/api/verify-email?token=${token}`;
  const html = wrap('Bestätige deine E-Mail', `
    <p>Hi ${name || ''},</p>
    <p>willkommen bei BE INEVITABLE! Bestätige bitte deine E-Mail-Adresse, um alle Funktionen zu nutzen.</p>
    <p>${btn(link, 'E-Mail bestätigen')}</p>
    <p style="color:#666;font-size:13px">Falls der Button nicht geht, öffne diesen Link:<br><a href="${link}">${link}</a></p>
    <p style="color:#666;font-size:13px">Der Link ist 48 Stunden gültig.</p>`);
  const text = `Bestätige deine E-Mail bei BE INEVITABLE: ${link} (48 Std. gültig)`;
  return { subject: 'Bestätige deine E-Mail – BE INEVITABLE', html, text };
}

export function resetPasswordContent(name, token) {
  const link = `${appUrl()}/?reset=${token}`;
  const html = wrap('Passwort zurücksetzen', `
    <p>Hi ${name || ''},</p>
    <p>du hast angefordert, dein Passwort zurückzusetzen. Klicke auf den Button, um ein neues Passwort zu vergeben.</p>
    <p>${btn(link, 'Neues Passwort festlegen')}</p>
    <p style="color:#666;font-size:13px">Falls der Button nicht geht, öffne diesen Link:<br><a href="${link}">${link}</a></p>
    <p style="color:#666;font-size:13px">Der Link ist 1 Stunde gültig. Wenn du das nicht warst, ignoriere diese E-Mail – dein Passwort bleibt unverändert.</p>`);
  const text = `Passwort zurücksetzen bei BE INEVITABLE: ${link} (1 Std. gültig). Wenn du das nicht warst, ignoriere diese E-Mail.`;
  return { subject: 'Passwort zurücksetzen – BE INEVITABLE', html, text };
}

export function notifyMessageContent(name, fromName, preview) {
  const link = `${appUrl()}/`;
  const html = wrap('Neue Nachricht von deinem Coach', `
    <p>Hi ${name || ''},</p>
    <p><b>${fromName || 'Dein Coach'}</b> hat dir eine Nachricht in BE INEVITABLE geschickt:</p>
    <blockquote style="border-left:3px solid #e2231a;margin:12px 0;padding:6px 14px;color:#444">${preview || ''}</blockquote>
    <p>${btn(link, 'In der App öffnen')}</p>
    <p style="color:#666;font-size:13px">Diese Benachrichtigung kannst du in der App unter „Mehr → Profil" abschalten.</p>`);
  const text = `Neue Nachricht von ${fromName || 'deinem Coach'} in BE INEVITABLE: ${link}`;
  return { subject: 'Neue Nachricht – BE INEVITABLE', html, text };
}
