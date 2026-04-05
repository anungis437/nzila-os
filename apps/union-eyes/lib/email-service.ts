/**
 * Email Service — Canonical Resend Integration
 *
 * ALL email sending in Union-Eyes goes through this module.
 * Other services should import { getResendClient, getFromEmail, sendEmail }
 * instead of creating their own Resend instances.
 *
 * Lazy-initialised — gracefully degrades when RESEND_API_KEY is not set.
 */

import { Resend } from 'resend';
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
  attachments?: Array<{ filename: string; content: Buffer }>;
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
    // Check if email service is configured
    const client = getResendClient();
    if (!client) {
      logger.warn('RESEND_API_KEY not configured - email not sent');
      return {
        success: false,
        error: 'Email service not configured',
      };
    }

    // Send email
    const { data, error } = await client.emails.send({
      from: getFromEmail(),
      to: to.map(recipient => `${recipient.name} <${recipient.email}>`),
      subject,
      html,
      text: text || stripHtml(html), // Fallback to plain text version
      replyTo,
      attachments,
    });

    if (error) {
      logger.error('Error sending email', error instanceof Error ? error : new Error(error.message || 'Failed to send email'));
      return {
        success: false,
        error: error.message || 'Failed to send email',
      };
    }

    return {
      success: true,
      messageId: data?.id,
    };
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
    .replace(/<style[^>]*>.*<\/style>/gm, '')
    .replace(/<[^>]+>/gm, '')
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

