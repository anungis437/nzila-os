/**
 * Email Service
 *
 * Delegates to the real Resend-backed email service at @/lib/email-service.
 * This module exists as the canonical import for callers that expect
 * the simpler (to: string) interface.
 */
import {
  sendEmail as sendEmailViaResend,
  type SendEmailOptions,
} from '@/lib/email-service'
import { logger } from '@/lib/logger'

export interface EmailOptions {
  to: string
  subject: string
  html: string
  from?: string
}

export async function sendEmail(
  options: EmailOptions,
): Promise<{ success: boolean; id?: string }> {
  logger.info('Sending email', { to: options.to, subject: options.subject })

  const result = await sendEmailViaResend({
    to: [{ email: options.to, name: options.to }],
    subject: options.subject,
    html: options.html,
  })

  return {
    success: result.success,
    id: result.messageId,
  }
}
