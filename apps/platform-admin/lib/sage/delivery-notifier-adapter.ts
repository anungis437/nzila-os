/**
 * Platform Admin — SAGE Phase 8A delivery notification adapter (server-only)
 *
 * Implements the `SageDeliveryNotifier` port. Phase 8A deliberately does NOT
 * retain recipient plaintext email in SAGE, so this adapter cannot resolve a
 * destination address from the recipient email hash alone. Per the security
 * posture it therefore FAILS CLOSED — it never prints or otherwise leaks the
 * one-time invitation token. A future change wires a verified-contact resolver
 * over the existing notification provider (comms-email) without changing this
 * port.
 *
 * Server-only: must never be imported into a client bundle.
 */
import 'server-only'
import type { SageDeliveryNotifier, SageDeliveryInvitationMessage, SageDeliveryNotifyResult } from '@nzila/sage-core'

class FailClosedDeliveryNotifier implements SageDeliveryNotifier {
  async sendInvitation(_message: SageDeliveryInvitationMessage): Promise<SageDeliveryNotifyResult> {
    void _message
    // Fail closed: no configured provider + no retained address. We never fall
    // back to printing/logging the token.
    throw new Error('SAGE delivery notification provider is not configured')
  }
}

/**
 * Returns the configured delivery notifier, or `undefined` when no provider is
 * wired. When `undefined`, issuance fails closed in the SAGE service layer
 * BEFORE a grant is created — no orphaned invitation, no leaked token.
 */
export function getSageDeliveryNotifier(): SageDeliveryNotifier | undefined {
  // Phase 8A: no production email transport with a verified-contact resolver is
  // wired yet, so issuance fails closed. The port + adapter exist for the
  // follow-up that attaches the resolver.
  if (process.env.SAGE_DELIVERY_NOTIFIER === 'fail-closed') {
    return new FailClosedDeliveryNotifier()
  }
  return undefined
}
