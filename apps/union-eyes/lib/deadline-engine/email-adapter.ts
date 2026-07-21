/**
 * Union Eyes Deadline Engine — email adapter
 *
 * Thin wrapper around the canonical Resend email service
 * (`lib/email-service.ts`). Renders a safe, minimum-necessary body — no
 * grievance title, description, or confidential metadata — and returns
 * structured provider status so the worker can distinguish transient vs
 * permanent failures for retry decisions.
 */
import { sendEmail as sendViaResend } from '@/lib/email-service';
import { logger } from '@/lib/logger';

export type DeliveryOutcome =
  | { kind: 'sent'; providerMessageId: string; provider: 'resend' }
  | { kind: 'transient_failure'; provider: 'resend'; code?: string; message: string; statusCode?: number }
  | { kind: 'permanent_failure'; provider: 'resend'; code?: string; message: string; statusCode?: number }
  | { kind: 'disabled'; message: string };

export interface DeliverReminderInput {
  recipientEmail: string;
  recipientLocale: string;
  subject: string;
  correlationId: string;
  /** Days between now and the deadline (positive = upcoming, negative = overdue). */
  daysToDeadline: number;
  /** Human-readable deadline kind for the body ("filing deadline", "response required"). */
  deadlineKind: string;
  /** Opaque deep-link to the grievance / claim view. Never includes secrets. */
  claimUrl: string;
  organizationId: string;
}

const TRANSIENT_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

function renderBody(input: DeliverReminderInput): { html: string; text: string } {
  const when =
    input.daysToDeadline > 0
      ? `in ${input.daysToDeadline} day${input.daysToDeadline === 1 ? '' : 's'}`
      : input.daysToDeadline === 0
        ? 'today'
        : `${Math.abs(input.daysToDeadline)} day${Math.abs(input.daysToDeadline) === 1 ? '' : 's'} ago`;

  const status = input.daysToDeadline < 0 ? 'PAST DUE' : 'UPCOMING';

  // MIN-NECESSARY body: no grievance title, no member name, no description.
  // The full detail lives behind the authenticated claimUrl.
  const text = [
    'Union Eyes deadline reminder',
    '',
    `Status: ${status}`,
    `A ${input.deadlineKind} is due ${when}.`,
    '',
    `Open the matter to review and respond: ${input.claimUrl}`,
    '',
    'This is an automated notice. Do not reply to this email.',
  ].join('\n');

  const html = [
    '<div style="font-family:system-ui,sans-serif;max-width:560px;line-height:1.5;color:#111">',
    '<h2 style="margin:0 0 12px">Union Eyes deadline reminder</h2>',
    `<p><strong>Status:</strong> ${status}</p>`,
    `<p>A ${escapeHtml(input.deadlineKind)} is due <strong>${escapeHtml(when)}</strong>.</p>`,
    `<p><a href="${escapeHtml(input.claimUrl)}" style="color:#0057b7">Open the matter to review and respond</a></p>`,
    '<hr style="border:0;border-top:1px solid #ddd;margin:20px 0" />',
    '<p style="color:#666;font-size:12px">This is an automated notice. Do not reply to this email.</p>',
    '</div>',
  ].join('');

  return { html, text };
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Deliver a deadline reminder email via Resend. Returns a structured
 * DeliveryOutcome — never throws for provider errors; the worker uses the
 * outcome kind to decide retry vs dead-letter.
 */
export async function deliverDeadlineReminderEmail(
  input: DeliverReminderInput,
): Promise<DeliveryOutcome> {
  if (!process.env.RESEND_API_KEY) {
    logger.warn('deadline-engine.email: RESEND_API_KEY not set — reminder cannot be delivered', {
      correlationId: input.correlationId,
    });
    return {
      kind: 'disabled',
      message: 'RESEND_API_KEY is not configured — email delivery is disabled',
    };
  }

  const { html, text } = renderBody(input);

  try {
    const result = await sendViaResend({
      to: [{ email: input.recipientEmail, name: input.recipientEmail }],
      subject: input.subject,
      html,
      text,
    });

    if (result.success && result.messageId) {
      return { kind: 'sent', provider: 'resend', providerMessageId: result.messageId };
    }

    // Provider explicit failure without throw
    const message = result.error || 'Resend returned success=false with no messageId';
    return {
      kind: 'permanent_failure',
      provider: 'resend',
      message,
      code: 'resend_no_message_id',
    };
  } catch (error) {
    const rawStatus =
      typeof (error as { statusCode?: unknown })?.statusCode === 'number'
        ? ((error as { statusCode: number }).statusCode)
        : undefined;
    const message = error instanceof Error ? error.message : String(error);
    const code =
      typeof (error as { code?: unknown })?.code === 'string'
        ? (error as { code: string }).code
        : undefined;

    const isTransient =
      (rawStatus !== undefined && TRANSIENT_STATUS_CODES.has(rawStatus)) ||
      /timeout|ECONNRESET|ETIMEDOUT|EAI_AGAIN/i.test(message);

    return {
      kind: isTransient ? 'transient_failure' : 'permanent_failure',
      provider: 'resend',
      message,
      code,
      statusCode: rawStatus,
    };
  }
}
