/**
 * CFO — Email service using Resend.
 *
 * Provides typed email sending for:
 * - Deadline reminders
 * - Report delivery
 * - Client onboarding welcome
 * - Ad-hoc notifications
 *
 * Requires RESEND_API_KEY and RESEND_FROM_EMAIL env vars.
 */
import { Resend } from 'resend'
import { logger } from '@/lib/logger'

let _resend: Resend | null = null

function getResend(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) throw new Error('Missing RESEND_API_KEY environment variable')
    _resend = new Resend(apiKey)
  }
  return _resend
}

function getFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL ?? 'LedgerIQ <notifications@ledgeriq.io>'
}

// ── Core send ───────────────────────────────────────────────────────────────

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  replyTo?: string
  attachments?: Array<{
    filename: string
    content: Buffer | string
    contentType?: string
  }>
}

export async function sendEmail(opts: SendEmailOptions): Promise<{ success: boolean; id?: string }> {
  try {
    const resend = getResend()
    const { data, error } = await resend.emails.send({
      from: getFromEmail(),
      to: Array.isArray(opts.to) ? opts.to : [opts.to],
      subject: opts.subject,
      html: opts.html,
      replyTo: opts.replyTo,
      attachments: opts.attachments?.map((a) => ({
        filename: a.filename,
        content: typeof a.content === 'string' ? Buffer.from(a.content) : a.content,
        contentType: a.contentType,
      })),
    })

    if (error) {
      logger.error('Email send failed', { error, to: opts.to, subject: opts.subject })
      return { success: false }
    }

    logger.info('Email sent', { id: data?.id, to: opts.to, subject: opts.subject })
    return { success: true, id: data?.id }
  } catch (error) {
    logger.error('Email send exception', { error })
    return { success: false }
  }
}

// ── Pre-built templates ─────────────────────────────────────────────────────

export async function sendDeadlineReminder(opts: {
  to: string
  clientName: string
  deadlineLabel: string
  dueDate: string
  daysRemaining: number
  urgency: 'green' | 'yellow' | 'red'
}) {
  const urgencyColor = { green: '#10b981', yellow: '#f59e0b', red: '#ef4444' }[opts.urgency]
  const urgencyLabel = { green: 'Upcoming', yellow: 'Due Soon', red: 'Urgent' }[opts.urgency]

  return sendEmail({
    to: opts.to,
    subject: `[${urgencyLabel}] ${opts.deadlineLabel} — ${opts.clientName} — Due ${opts.dueDate}`,
    html: `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 560px; margin: 0 auto;">
        <div style="background: #0f172a; padding: 24px 32px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; font-size: 18px; margin: 0;">LedgerIQ</h1>
        </div>
        <div style="padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
          <div style="display: inline-block; background: ${urgencyColor}20; color: ${urgencyColor}; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; margin-bottom: 16px;">
            ${urgencyLabel} — ${opts.daysRemaining} day${opts.daysRemaining !== 1 ? 's' : ''} remaining
          </div>
          <h2 style="color: #0f172a; font-size: 20px; margin: 0 0 8px;">${opts.deadlineLabel}</h2>
          <p style="color: #64748b; font-size: 15px; margin: 0 0 24px;">
            Client: <strong>${opts.clientName}</strong><br/>
            Due date: <strong>${opts.dueDate}</strong>
          </p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.ledgeriq.io'}/dashboard/tasks"
             style="display: inline-block; background: #3b82f6; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
            View in LedgerIQ
          </a>
        </div>
      </div>
    `,
  })
}

export async function sendReportDelivery(opts: {
  to: string
  reportTitle: string
  period: string
  narrativeSummary?: string
  pdfBuffer?: Buffer
}) {
  const attachments = opts.pdfBuffer
    ? [{ filename: `${opts.reportTitle.replace(/\s+/g, '-')}.pdf`, content: opts.pdfBuffer, contentType: 'application/pdf' }]
    : undefined

  return sendEmail({
    to: opts.to,
    subject: `Financial Report: ${opts.reportTitle} — ${opts.period}`,
    html: `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 560px; margin: 0 auto;">
        <div style="background: #0f172a; padding: 24px 32px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; font-size: 18px; margin: 0;">LedgerIQ</h1>
        </div>
        <div style="padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="color: #0f172a; font-size: 20px; margin: 0 0 8px;">${opts.reportTitle}</h2>
          <p style="color: #64748b; font-size: 14px; margin: 0 0 16px;">Period: ${opts.period}</p>
          ${
            opts.narrativeSummary
              ? `<div style="background: #f8fafc; border-left: 3px solid #3b82f6; padding: 16px; margin: 0 0 24px; border-radius: 0 8px 8px 0;">
                   <p style="color: #334155; font-size: 14px; line-height: 1.6; margin: 0;">${opts.narrativeSummary}</p>
                 </div>`
              : ''
          }
          ${opts.pdfBuffer ? '<p style="color: #64748b; font-size: 13px;">PDF report attached.</p>' : ''}
          <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.ledgeriq.io'}/dashboard/reports"
             style="display: inline-block; background: #3b82f6; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
            View in LedgerIQ
          </a>
        </div>
      </div>
    `,
    attachments,
  })
}

export async function sendWelcomeEmail(opts: { to: string; firmName: string; clientName: string }) {
  return sendEmail({
    to: opts.to,
    subject: `Welcome to ${opts.firmName} — Client Portal`,
    html: `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 560px; margin: 0 auto;">
        <div style="background: #0f172a; padding: 24px 32px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; font-size: 18px; margin: 0;">LedgerIQ</h1>
        </div>
        <div style="padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="color: #0f172a; font-size: 20px; margin: 0 0 8px;">Welcome, ${opts.clientName}!</h2>
          <p style="color: #64748b; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
            You've been added to <strong>${opts.firmName}</strong>'s client portal on LedgerIQ.
            You can now access your financial documents, reports, and communicate with your advisory team.
          </p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.ledgeriq.io'}/sign-in"
             style="display: inline-block; background: #3b82f6; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
            Access Your Portal
          </a>
        </div>
      </div>
    `,
  })
}
