/**
 * ARTIFACT TYPE: IP / Module
 * MODULE: lib/oci/audit/auditObservability
 * DOCTRINE_VERSION: 1.0.0
 *
 * Audit observability event shapes. Side-effect free: this module
 * defines the event structure and a builder. Emitting to a sink
 * is the caller's responsibility.
 *
 * Anti-surveillance: events never carry holder identities; only
 * surveillance-safe stable ids, aggregated counts, and hashes.
 */

import type { EntropyAuditPacket } from './entropyAuditContracts';

export interface AuditObservabilityEvent {
  readonly type: 'oci.audit.packet.built' | 'oci.audit.escalation.raised' | 'oci.audit.variance.observed';
  readonly occurredAt: string;
  readonly subject: { readonly hashed: string };
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface AuditObservabilityClock {
  now(): Date;
}

const defaultClock: AuditObservabilityClock = { now: () => new Date() };

export function eventForPacket(
  packet: EntropyAuditPacket,
  clock: AuditObservabilityClock = defaultClock,
): AuditObservabilityEvent {
  return Object.freeze({
    type: 'oci.audit.packet.built',
    occurredAt: clock.now().toISOString(),
    subject: Object.freeze({ hashed: packet.reproducibilityHash }),
    payload: Object.freeze({
      entropyOrdinal: packet.entropyOrdinal,
      confidence: packet.confidence,
      observationCount: packet.observedEvidence.length,
      failedCriteriaCount: packet.failedCriteria.length,
      escalationFlagCount: packet.escalationFlags.length,
      contradictionCount: packet.contradictoryEvidence.length,
    }),
  });
}
