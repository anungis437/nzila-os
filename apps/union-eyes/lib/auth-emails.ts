/**
 * Auth-related email senders for Union Eyes.
 *
 * These are the last mile that turns a platform-auth token into an actual
 * email. They call the canonical Resend-backed `sendEmail` in
 * `@/lib/email-service`; if RESEND_API_KEY is not configured, the sender
 * returns `{success: false}` and the calling handler decides whether to
 * treat that as a soft-failure (dev) or a hard-failure (prod).
 *
 * All templates are inline HTML — deliberately small, brand-minimal, and
 * accessible. No external template engine. No marketing copy.
 */
import { sendEmail } from '@/lib/email-service'
import { logger } from '@/lib/logger'

function getAppBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    'http://localhost:3000'
  )
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function wrap(bodyHtml: string, preheader: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Union Eyes</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f5f5f5; padding:24px; margin:0;">
    <span style="display:none !important; visibility:hidden; opacity:0; overflow:hidden; mso-hide:all; height:0; width:0; max-height:0; max-width:0; font-size:0;">${escape(preheader)}</span>
    <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:12px; padding:32px;">
      <div style="font-weight:700; font-size:20px; color:#111; margin-bottom:24px;">Union Eyes</div>
      ${bodyHtml}
      <hr style="border:none; border-top:1px solid #e5e5e5; margin:32px 0;" />
      <p style="color:#888; font-size:12px; line-height:1.5; margin:0;">
        If you did not expect this email, you can safely ignore it. For
        account security questions, contact <a href="mailto:support@unioneyes.app" style="color:#2563eb; text-decoration:none;">support@unioneyes.app</a>.
      </p>
    </div>
  </body>
</html>`
}

/** Send a magic-link sign-in email. Returns {success,messageId?} or {success:false,error}. */
export async function sendMagicLinkEmail(opts: {
  to: string
  token: string
  expiresAt: Date
  ipAddress?: string | null
}): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const verifyUrl = `${getAppBaseUrl()}/magic-link/verify?token=${encodeURIComponent(opts.token)}`
  const minutes = Math.max(1, Math.round((opts.expiresAt.getTime() - Date.now()) / 60000))
  const ipLine = opts.ipAddress
    ? `<p style="color:#666; font-size:12px; margin:16px 0 0;">Request came from IP ${escape(opts.ipAddress)}.</p>`
    : ''
  const body = `
    <h1 style="font-size:20px; color:#111; margin:0 0 16px;">Your sign-in link</h1>
    <p style="color:#333; line-height:1.6; margin:0 0 24px;">
      Tap the button below to sign in. This link is valid for the next ${minutes} minutes and can only be used once.
    </p>
    <p style="margin:0 0 24px;">
      <a href="${verifyUrl}" style="display:inline-block; background:#2563eb; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600;">Sign in to Union Eyes</a>
    </p>
    <p style="color:#666; font-size:13px; line-height:1.5; margin:0 0 8px;">
      Or copy and paste this URL into your browser:
    </p>
    <p style="color:#2563eb; font-size:13px; word-break:break-all; margin:0;">${escape(verifyUrl)}</p>
    ${ipLine}
  `
  return sendEmail({
    to: [{ email: opts.to, name: opts.to }],
    subject: 'Your Union Eyes sign-in link',
    html: wrap(body, `Sign in to Union Eyes — valid for ${minutes} minutes`),
  })
}

/** Send an invite email. */
export async function sendInviteEmail(opts: {
  to: string
  token: string
  expiresAt: Date
  role: string
  organizationName?: string
  inviterName?: string
}): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const acceptUrl = `${getAppBaseUrl()}/invite/accept?token=${encodeURIComponent(opts.token)}`
  const days = Math.max(1, Math.round((opts.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
  const who = opts.inviterName ? escape(opts.inviterName) : 'A colleague'
  const org = opts.organizationName ? escape(opts.organizationName) : 'their organization'
  const body = `
    <h1 style="font-size:20px; color:#111; margin:0 0 16px;">You've been invited to Union Eyes</h1>
    <p style="color:#333; line-height:1.6; margin:0 0 8px;">
      ${who} has invited you to join <strong>${org}</strong> on Union Eyes as <strong>${escape(opts.role)}</strong>.
    </p>
    <p style="color:#333; line-height:1.6; margin:0 0 24px;">
      This invitation is valid for the next ${days} day${days === 1 ? '' : 's'}.
    </p>
    <p style="margin:0 0 24px;">
      <a href="${acceptUrl}" style="display:inline-block; background:#2563eb; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600;">Accept invitation</a>
    </p>
    <p style="color:#666; font-size:13px; line-height:1.5; margin:0 0 8px;">
      Or copy and paste this URL into your browser:
    </p>
    <p style="color:#2563eb; font-size:13px; word-break:break-all; margin:0;">${escape(acceptUrl)}</p>
  `
  return sendEmail({
    to: [{ email: opts.to, name: opts.to }],
    subject: `Invitation to join Union Eyes`,
    html: wrap(body, `${who} invited you to Union Eyes`),
  })
}

/** Send a password-reset email. */
export async function sendPasswordResetEmail(opts: {
  to: string
  token: string
  expiresAt: Date
}): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const resetUrl = `${getAppBaseUrl()}/reset-password?token=${encodeURIComponent(opts.token)}`
  const minutes = Math.max(1, Math.round((opts.expiresAt.getTime() - Date.now()) / 60000))
  const body = `
    <h1 style="font-size:20px; color:#111; margin:0 0 16px;">Reset your password</h1>
    <p style="color:#333; line-height:1.6; margin:0 0 24px;">
      We received a request to reset your Union Eyes password. Tap the button below to set a new one. This link is valid for ${minutes} minutes and can only be used once.
    </p>
    <p style="margin:0 0 24px;">
      <a href="${resetUrl}" style="display:inline-block; background:#2563eb; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600;">Set new password</a>
    </p>
    <p style="color:#666; font-size:13px; line-height:1.5; margin:0 0 8px;">
      Or copy and paste this URL into your browser:
    </p>
    <p style="color:#2563eb; font-size:13px; word-break:break-all; margin:0;">${escape(resetUrl)}</p>
  `
  return sendEmail({
    to: [{ email: opts.to, name: opts.to }],
    subject: 'Reset your Union Eyes password',
    html: wrap(body, 'Reset your Union Eyes password'),
  })
}

/**
 * Log + audit delivery failures for security-sensitive emails.
 * Callers pass the audit-write themselves (we stay decoupled), but this
 * helper ensures the error is observable in app logs.
 */
export function logEmailDeliveryFailure(
  kind: 'magic_link' | 'invite' | 'password_reset',
  to: string,
  error: string | undefined,
): void {
  logger.error(`Email delivery failed (${kind})`, new Error(error ?? 'Unknown'))
  logger.warn('Auth email not delivered', { kind, to })
}
