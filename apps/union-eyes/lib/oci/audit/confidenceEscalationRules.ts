/**
 * ARTIFACT TYPE: IP / Module
 * MODULE: lib/oci/audit/confidenceEscalationRules
 * DOCTRINE_VERSION: 1.0.0
 *
 * Deterministic rules describing when a Governance Entropy reading
 * must be escalated for reviewer-led re-examination. Rules are
 * conservative by design (fail cautiously).
 */

import type { SufficiencyResult } from './entropyAuditContracts';
import type { ConfidenceState } from '@nzila/oci-confidence';

export interface EscalationDecision {
  readonly escalate: boolean;
  readonly priority: 'routine' | 'elevated' | 'urgent';
  readonly reasons: ReadonlyArray<string>;
}

export function decideEscalation(
  sufficiency: SufficiencyResult,
  envelopeConfidence: ConfidenceState,
): EscalationDecision {
  const reasons: string[] = [];

  if (sufficiency.contradictionsDetected) {
    reasons.push('contradictions detected in observed evidence');
  }
  if (sufficiency.sufficiency === 'insufficient') {
    reasons.push('evidence sufficiency below partial threshold');
  }
  if (envelopeConfidence === 'INSUFFICIENT') {
    reasons.push('universal confidence envelope is INSUFFICIENT');
  }
  if (envelopeConfidence === 'LOW' && sufficiency.sufficiency !== 'sufficient') {
    reasons.push('LOW envelope confidence combined with non-sufficient evidence');
  }

  const escalate = reasons.length > 0 || sufficiency.escalationRequired;

  let priority: EscalationDecision['priority'];
  if (sufficiency.contradictionsDetected || envelopeConfidence === 'INSUFFICIENT') {
    priority = 'urgent';
  } else if (escalate) {
    priority = 'elevated';
  } else {
    priority = 'routine';
  }

  return Object.freeze({ escalate, priority, reasons: Object.freeze(reasons) });
}
