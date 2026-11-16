import type { CreateInviteResult } from '@nzila/platform-auth/invites'
import { sendInviteEmail, logEmailDeliveryFailure } from '@/lib/auth-emails'

/** Creation is durable; submission to the provider is a separate, fallible operation. */
export async function deliverOrganizationInvitation(result: CreateInviteResult) {
  let delivery: 'sent' | 'failed' = 'failed'
  if (result.token && result.email && result.role && result.expiresAt) {
    try {
      const sent = await sendInviteEmail({
        to: result.email, token: result.token, role: result.role, expiresAt: result.expiresAt,
      })
      delivery = sent.success ? 'sent' : 'failed'
    } catch {
      // Do not propagate provider errors: they can contain the credential URL.
    }
  }
  if (delivery === 'failed') logEmailDeliveryFailure('invite', result.email ?? '', 'Submission could not be confirmed')
  return { inviteId: result.inviteId, expiresAt: result.expiresAt, delivery }
}
