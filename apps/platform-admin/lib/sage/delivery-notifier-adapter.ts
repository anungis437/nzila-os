import 'server-only'

/**
 * Production SAGE invitation notifier. Recipient contact data is resolved only
 * inside this server-only adapter and is never written to SAGE audit/outbox
 * records in plaintext.
 */
import { resendAdapter } from '@nzila/comms-email'
import {
  SageDeliveryNotificationError,
  type SageDeliveryNotifier,
  type SageDeliveryInvitationMessage,
  type SageDeliveryNotifyResult,
} from '@nzila/sage-core'

type VerifiedContacts = Record<string, string>

function configuredContacts(): VerifiedContacts {
  const raw = process.env.SAGE_DELIVERY_VERIFIED_CONTACTS_JSON
  if (!raw) throw new Error('SAGE_DELIVERY_VERIFIED_CONTACTS_JSON is required')
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object')
    const contacts = Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] =>
        typeof entry[1] === 'string' && entry[1].includes('@'),
      ),
    )
    if (Object.keys(contacts).length === 0) throw new Error('empty')
    return contacts
  } catch {
    throw new Error('SAGE_DELIVERY_VERIFIED_CONTACTS_JSON must be a non-empty hash-to-email map')
  }
}

function resendCredentials(): Record<string, unknown> {
  const apiKey = process.env.RESEND_API_KEY
  const fromAddress = process.env.SAGE_DELIVERY_FROM_ADDRESS
  if (!apiKey || !fromAddress) throw new Error('RESEND_API_KEY and SAGE_DELIVERY_FROM_ADDRESS are required')
  return { apiKey, fromAddress, replyToAddress: process.env.SAGE_DELIVERY_REPLY_TO, maxRetries: 0 }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character]!)
}

function recipientSafeHtml(message: SageDeliveryInvitationMessage): string {
  const claimUrl = `${process.env.SAGE_DELIVERY_CLAIM_ORIGIN ?? ''}/delivery/claim?invitation=${encodeURIComponent(message.claimToken)}`
  return `<p>You have been invited to access a secure delivery from ${escapeHtml(message.organizationSafeName)}.</p><p><a href="${claimUrl}">Open secure delivery</a></p><p>This link expires ${escapeHtml(message.invitationExpiresAt)}.</p>`
}

class ResendSageDeliveryNotifier implements SageDeliveryNotifier {
  constructor(private readonly contacts: VerifiedContacts, private readonly credentials: Record<string, unknown>) {}

  async sendInvitation(message: SageDeliveryInvitationMessage): Promise<SageDeliveryNotifyResult> {
    const recipient = this.contacts[message.recipientEmailHash]
    if (!recipient) {
      throw new SageDeliveryNotificationError('permanent', 'verified recipient contact is unavailable')
    }
    const result = await resendAdapter.send(
      {
        orgId: 'sage',
        channel: 'email',
        to: recipient,
        templateId: 'sage_delivery_invitation',
        subject: 'Secure delivery invitation',
        body: recipientSafeHtml(message),
        correlationId: message.messageId,
        metadata: {
          headers: { 'Idempotency-Key': message.idempotencyKey, 'X-Sage-Message-Id': message.messageId },
          tags: { sage_message_id: message.messageId },
          disableRetry: true,
        },
      },
      this.credentials,
    )
    if (!result.ok) {
      const transient = result.rateLimitInfo?.isRateLimited || /(?:timeout|5\d\d|network|unavailable)/i.test(result.error ?? '')
      throw new SageDeliveryNotificationError(transient ? 'transient' : 'permanent', 'email provider rejected invitation')
    }
    return { accepted: true, providerMessageId: result.providerMessageId ?? null }
  }
}

/** Returns undefined outside configured production composition; fresh issuance then fails closed. */
export function getSageDeliveryNotifier(): SageDeliveryNotifier | undefined {
  if (process.env.SAGE_DELIVERY_NOTIFIER !== 'resend') return undefined
  return new ResendSageDeliveryNotifier(configuredContacts(), resendCredentials())
}
