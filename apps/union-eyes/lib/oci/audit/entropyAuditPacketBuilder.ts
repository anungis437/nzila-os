/**
 * ARTIFACT TYPE: IP / Framework
 * MODULE: lib/oci/audit/entropyAuditPacketBuilder (Entropy Audit Packet™)
 * DOCTRINE_VERSION: 1.0.0
 *
 * Builds reproducible audit packets for Governance Entropy readings.
 * Packets are content-addressed (stable hash over canonicalised
 * inputs) so that two reviewers replaying the same observations
 * produce identical packets.
 */

import { createHash } from 'node:crypto';
import type {
  EntropyAuditPacket,
  EvidenceObservation,
} from './entropyAuditContracts';
import type { CautionState, ConfidenceState } from '@nzila/oci-confidence';
import { evaluateEvidenceSufficiency } from './evidenceSufficiencyEngine';
import { decideEscalation } from './confidenceEscalationRules';

export interface BuildEntropyAuditPacketInput {
  readonly entropyOrdinal: 1 | 2 | 3 | 4 | 5;
  readonly observations: ReadonlyArray<EvidenceObservation>;
  readonly failedCriteria: ReadonlyArray<string>;
  readonly reviewerNotes?: ReadonlyArray<string>;
  readonly envelopeConfidence: ConfidenceState;
  readonly continuityCautionStates?: ReadonlyArray<CautionState>;
}

function canonicalise(input: BuildEntropyAuditPacketInput): string {
  // Sort observations deterministically by source then type.
  const sortedObs = [...input.observations]
    .map((o) => ({
      evidenceType: o.evidenceType,
      evidenceStrength: o.evidenceStrength,
      evidenceSource: o.evidenceSource,
      evidenceConfidence: Number(o.evidenceConfidence.toFixed(4)),
      reviewerConfidence: Number(o.reviewerConfidence.toFixed(4)),
      descriptor: o.descriptor ?? null,
    }))
    .sort((a, b) => {
      if (a.evidenceSource !== b.evidenceSource) return a.evidenceSource.localeCompare(b.evidenceSource);
      return a.evidenceType.localeCompare(b.evidenceType);
    });

  return JSON.stringify({
    entropyOrdinal: input.entropyOrdinal,
    observations: sortedObs,
    failedCriteria: [...input.failedCriteria].sort(),
    reviewerNotes: [...(input.reviewerNotes ?? [])],
    envelopeConfidence: input.envelopeConfidence,
    continuityCautionStates: [...(input.continuityCautionStates ?? [])].sort(),
  });
}

export function buildEntropyAuditPacket(input: BuildEntropyAuditPacketInput): EntropyAuditPacket {
  const sufficiency = evaluateEvidenceSufficiency(input.observations);
  const escalation = decideEscalation(sufficiency, input.envelopeConfidence);

  const uncertaintyStates: CautionState[] = [];
  if (sufficiency.sufficiency === 'insufficient') uncertaintyStates.push('LIMITED_GOVERNANCE_EVIDENCE');
  if (sufficiency.contradictionsDetected) uncertaintyStates.push('HIGH_VARIANCE');

  const contradictoryEvidence: string[] = sufficiency.contradictionsDetected
    ? sufficiency.rationale.filter((r) => r.startsWith('contradiction:'))
    : [];

  const escalationFlags: string[] = escalation.escalate
    ? [
        `escalation:${escalation.priority}`,
        ...escalation.reasons.map((r) => `reason:${r}`),
      ]
    : [];

  const canonical = canonicalise(input);
  const reproducibilityHash = createHash('sha256').update(canonical).digest('hex');

  return Object.freeze({
    entropyOrdinal: input.entropyOrdinal,
    observedEvidence: Object.freeze([...input.observations]),
    failedCriteria: Object.freeze([...input.failedCriteria]),
    uncertaintyStates: Object.freeze(uncertaintyStates),
    reviewerNotes: Object.freeze([...(input.reviewerNotes ?? [])]),
    confidence: input.envelopeConfidence,
    contradictoryEvidence: Object.freeze(contradictoryEvidence),
    escalationFlags: Object.freeze(escalationFlags),
    continuityCautionStates: Object.freeze([...(input.continuityCautionStates ?? [])]),
    reproducibilityHash,
  });
}
