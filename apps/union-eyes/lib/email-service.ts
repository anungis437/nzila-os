/**
 * Email Service — Canonical Resend Integration
 *
 * ALL email sending in Union-Eyes goes through this module.
 * Other services should import { getResendClient, getFromEmail, sendEmail }
 * instead of creating their own Resend instances.
 *
 * Lazy-initialised — gracefully degrades when RESEND_API_KEY is not set.
 */

import { Resend, type CreateEmailOptions } from 'resend';
import { logger } from '@/lib/logger';

// Lazy initialize Resend client to avoid errors during build
let resend: Resend | null = null;

/**
 * Get the shared Resend client. Returns null if RESEND_API_KEY is not set.
 * All email-sending code should use this instead of creating new Resend instances.
 */
export function getResendClient(): Resend | null {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

/**
 * Get the configured sender address. Reads RESEND_FROM_EMAIL, EMAIL_FROM,
 * or falls back to a default. Accepts an optional label override.
 */
export function getFromEmail(label?: string): string {
  const address = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || 'noreply@unioneyes.app';
  return label ? `${label} <${address}>` : address;
}

// Email configuration
const REPLY_TO_EMAIL = process.env.EMAIL_REPLY_TO || 'support@unioneyes.app';

export interface EmailRecipient {
  email: string;
  name: string;
}

export interface SendEmailOptions {
  to: EmailRecipient[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: Array<{ filename: string; content?: Buffer | string; path?: string }>;
}

export interface ResendSendContext {
  feature?: string;
  correlationId?: string;
  organizationId?: string;
  templateId?: string;
  maxRetries?: number;
  disableRetry?: boolean;
}

interface ResendParsedError {
  message: string;
  statusCode?: number;
  retryAfterMs?: number;
}

const TRANSIENT_RETRY_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

function parseInteger(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function parseResendError(error: unknown): ResendParsedError {
  if (!error || typeof error !== 'object') {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  const message =
    typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message
      : error instanceof Error
        ? error.message
        : 'Failed to send email';

  const statusCode = parseInteger((error as { statusCode?: unknown }).statusCode);
  const headers = (error as { headers?: unknown }).headers;
  const retryAfterSeconds =
    headers && typeof headers === 'object'
      ? parseInteger((headers as Record<string, unknown>)['retry-after'])
      : undefined;

  return {
    message,
    statusCode,
    retryAfterMs: retryAfterSeconds !== undefined ? Math.max(retryAfterSeconds, 0) * 1000 : undefined,
  };
}

function computeBackoffMs(attempt: number, retryAfterMs?: number): number {
  if (retryAfterMs !== undefined && retryAfterMs > 0) {
    return retryAfterMs;
  }
  return 100 * (2 ** Math.min(attempt, 4));
}

async function delay(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeRetryCount(input?: number): number {
  if (typeof input !== 'number' || !Number.isFinite(input)) {
    return 2;
  }
  return Math.max(0, Math.min(Math.trunc(input), 5));
}

function attachObservability(
  payload: CreateEmailOptions,
  context: ResendSendContext,
): CreateEmailOptions {
  const headers = {
    ...(payload.headers ?? {}),
    ...(context.correlationId ? { 'X-Correlation-Id': context.correlationId } : {}),
    ...(context.organizationId ? { 'X-Org-Id': context.organizationId } : {}),
    ...(context.feature ? { 'X-Email-Feature': context.feature } : {}),
    ...(context.templateId ? { 'X-Template-Id': context.templateId } : {}),
  };

  const tags = [
    ...(payload.tags ?? []),
    ...(context.feature ? [{ name: 'feature', value: context.feature }] : []),
    ...(context.organizationId ? [{ name: 'org_id', value: context.organizationId }] : []),
    ...(context.correlationId ? [{ name: 'correlation_id', value: context.correlationId }] : []),
    ...(context.templateId ? [{ name: 'template_id', value: context.templateId }] : []),
  ].slice(0, 10);

  return {
    ...payload,
    headers,
    tags,
  };
}

export async function sendResendEmail(
  payload: CreateEmailOptions,
  context: ResendSendContext = {},
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const client = getResendClient();
  if (!client) {
    logger.warn('RESEND_API_KEY not configured - email not sent', { feature: context.feature });
    return {
      success: false,
      error: 'Email service not configured',
    };
  }

  const maxRetries = normalizeRetryCount(context.maxRetries);
  const finalPayload = attachObservability(payload, context);

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const { data, error } = await client.emails.send(finalPayload);

    if (!error) {
      return {
        success: true,
        messageId: data?.id,
      };
    }

    const parsed = parseResendError(error);
    const shouldRetry =
      context.disableRetry !== true
      && attempt < maxRetries
      && parsed.statusCode !== undefined
      && TRANSIENT_RETRY_STATUS_CODES.has(parsed.statusCode);

    if (!shouldRetry) {
      logger.error('Error sending email', {
        feature: context.feature,
        statusCode: parsed.statusCode,
        error: parsed.message,
      });
      return {
        success: false,
        error: parsed.message,
      };
    }

    await delay(computeBackoffMs(attempt, parsed.retryAfterMs));
  }

  return {
    success: false,
    error: 'Failed to send email after retries',
  };
}

/**
 * Send an email via Resend
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo = REPLY_TO_EMAIL,
  attachments,
}: SendEmailOptions): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    return await sendResendEmail({
      from: getFromEmail(),
      to: to.map(recipient => `${recipient.name} <${recipient.email}>`),
      subject,
      html,
      text: text || stripHtml(html), // Fallback to plain text version
      replyTo,
      attachments,
    }, {
      feature: 'legacy_send_email',
    });
  } catch (error) {
    logger.error('Exception sending email', error instanceof Error ? error : new Error(String(error)));
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Simple HTML tag stripper for plain text fallback
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>.*<\/style>/gm, '') // codeql[js/incomplete-multi-character-sanitization] - plain-text conversion, not security sanitization
    .replace(/<[^>]+>/gm, '') // codeql[js/bad-tag-filter]
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Get recipient list with validation
 */
export function getValidRecipients(recipients: EmailRecipient[]): EmailRecipient[] {
  return recipients.filter(recipient => {
    if (!isValidEmail(recipient.email)) {
      logger.warn('Invalid email address', { email: recipient.email });
      return false;
    }
    return true;
  });
}

