const nodemailer = require('nodemailer');

/* ---------------------------------------------------------------------------
 * EMAIL DELIVERY
 *
 * Optional, like image storage. Set SMTP_URL and verification emails go out;
 * leave it unset and email is disabled entirely — accounts are then created
 * already verified so nobody is locked out of a site with no way to send them
 * a link.
 *
 * SMTP_URL examples:
 *   Gmail (needs an App Password, not your login password):
 *     smtps://you%40gmail.com:app-password@smtp.gmail.com:465
 *   Brevo / Sendinblue free tier:
 *     smtp://user:key@smtp-relay.brevo.com:587
 *   Resend:
 *     smtp://resend:re_xxx@smtp.resend.com:587
 *
 * The @ and any special characters in a username or password must be
 * percent-encoded, exactly like a Mongo connection string.
 * ------------------------------------------------------------------------- */

const SMTP_URL = process.env.SMTP_URL || '';
const MAIL_FROM = process.env.MAIL_FROM || 'CampusNest <no-reply@campusnest.local>';

/** Email is only "on" when there is somewhere to send it. */
const EMAIL_ENABLED = Boolean(SMTP_URL);

let transporter = null;

function getTransporter() {
  if (!EMAIL_ENABLED) return null;
  if (!transporter) transporter = nodemailer.createTransport(SMTP_URL);
  return transporter;
}

/**
 * Send an email. Never throws — a delivery failure must not cost someone their
 * signup. Returns whether it actually went out so callers can tell the user.
 */
async function sendMail({ to, subject, text, html }) {
  const t = getTransporter();
  if (!t) return { sent: false, reason: 'email-disabled' };

  try {
    await t.sendMail({ from: MAIL_FROM, to, subject, text, html });
    return { sent: true };
  } catch (err) {
    console.warn('[mail] delivery failed for', to, '-', err.message);
    return { sent: false, reason: err.message };
  }
}

function verificationEmail({ name, url }) {
  return {
    subject: 'Confirm your CampusNest account',
    text:
      `Hi ${name},\n\n` +
      `Confirm your email to start reviewing places on CampusNest:\n${url}\n\n` +
      `This link expires in 24 hours. If you did not sign up, ignore this email.\n`,
    html:
      `<p>Hi ${name},</p>` +
      `<p>Confirm your email to start reviewing places on CampusNest:</p>` +
      `<p><a href="${url}" style="background:#236b68;color:#fff;padding:10px 18px;` +
      `border-radius:8px;text-decoration:none;display:inline-block">Confirm my email</a></p>` +
      `<p style="color:#64748b;font-size:13px">Or paste this into your browser:<br>${url}</p>` +
      `<p style="color:#64748b;font-size:13px">This link expires in 24 hours. ` +
      `If you did not sign up, you can ignore this email.</p>`,
  };
}

module.exports = { sendMail, verificationEmail, EMAIL_ENABLED };
