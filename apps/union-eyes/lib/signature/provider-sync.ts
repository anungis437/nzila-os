/**
 * Provider status synchronisation for signature documents: a pure decision over what is stored and what a provider
 * reported, kept apart from the database so every rule is testable.
 *
 *  - Only an external provider can report a status. The built-in internal provider is a stub and says nothing.
 *  - A terminal state (completed, declined, voided, expired) is final: a later or replayed observation cannot move it.
 *  - A non-terminal observation can only move a document forward; a stale or repeated one changes nothing.
 *  - The acknowledgment time is the EVENT time the provider reported. If the provider reported none, none is recorded:
 *    the local clock is never stamped as a completion or signing time, and without an acknowledgment a completion is
 *    historical, not verified.
 *  - An implausible timestamp (in the future) is not accepted as an event time.
 */

export type SignatureDocumentState = 'draft' | 'sent' | 'delivered' | 'viewed' | 'signed' | 'completed' | 'declined' | 'voided' | 'expired';

const TERMINAL: readonly SignatureDocumentState[] = ['completed', 'declined', 'voided', 'expired'];
const PROGRESS: Record<string, number> = { draft: 0, sent: 1, delivered: 2, viewed: 3, signed: 4 };
const EXTERNAL_PROVIDERS = new Set(['docusign', 'hellosign', 'adobe_sign', 'pandadoc']);
const CLOCK_SKEW_MS = 5 * 60_000;

export const isTerminalSignatureState = (status: string): boolean => (TERMINAL as readonly string[]).includes(status);

export interface StoredSignatureState {
  status: string;
  provider: string;
  providerEnvelopeId: string | null;
  providerAcknowledgedAt: Date | null;
}

export interface ObservedProviderStatus {
  status: string;
  /** The completion time the provider itself reported, when it reported one. */
  completedAt?: Date;
}

export type ProviderSyncDecision =
  | { action: 'ignore'; reason: 'not_external_provider' | 'no_envelope' | 'unknown_status' | 'no_change' | 'terminal_is_final' | 'stale_observation' }
  | { action: 'apply'; status: SignatureDocumentState; providerAcknowledgedAt: Date | null; statusChanged: boolean };

function plausibleEventTime(value: Date | undefined, now: Date): Date | null {
  if (!value || Number.isNaN(value.getTime())) return null;
  if (value.getTime() > now.getTime() + CLOCK_SKEW_MS) return null;
  return value;
}

export function decideProviderSync(stored: StoredSignatureState, observed: ObservedProviderStatus, now: Date = new Date()): ProviderSyncDecision {
  if (!EXTERNAL_PROVIDERS.has(stored.provider)) return { action: 'ignore', reason: 'not_external_provider' };
  if (!stored.providerEnvelopeId) return { action: 'ignore', reason: 'no_envelope' };
  const next = observed.status as SignatureDocumentState;
  if (!(next in PROGRESS) && !isTerminalSignatureState(next)) return { action: 'ignore', reason: 'unknown_status' };

  const ack = next === 'completed' ? plausibleEventTime(observed.completedAt, now) : null;

  if (next === stored.status) {
    // The same status again changes nothing, except that a completion may now carry the provider's own timestamp.
    if (next === 'completed' && stored.providerAcknowledgedAt === null && ack) {
      return { action: 'apply', status: next, providerAcknowledgedAt: ack, statusChanged: false };
    }
    return { action: 'ignore', reason: 'no_change' };
  }
  if (isTerminalSignatureState(stored.status)) return { action: 'ignore', reason: 'terminal_is_final' };
  if (!isTerminalSignatureState(next) && (PROGRESS[next] ?? -1) <= (PROGRESS[stored.status] ?? -1)) {
    return { action: 'ignore', reason: 'stale_observation' };
  }
  return { action: 'apply', status: next, providerAcknowledgedAt: ack, statusChanged: true };
}

/** A signer status may only move forward, and never out of a settled state. */
const SIGNER_PROGRESS: Record<string, number> = { pending: 0, sent: 1, delivered: 2, viewed: 3, signed: 4 };
const SIGNER_SETTLED = new Set(['signed', 'declined', 'authentication_failed', 'expired']);

export function mayAdvanceSigner(current: string, next: string): boolean {
  if (current === next) return false;
  if (SIGNER_SETTLED.has(current)) return false;
  if (SIGNER_SETTLED.has(next)) return true;
  return (SIGNER_PROGRESS[next] ?? -1) > (SIGNER_PROGRESS[current] ?? -1);
}
