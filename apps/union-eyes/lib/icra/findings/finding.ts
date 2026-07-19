/**
 * ARTIFACT TYPE: Government-Readiness Additive Layer — Finding Artifact
 * MODULE: OCI/OCRA Finding (the addressable unit of explanation)
 * DOCTRINE: docs/oci/government-readiness/OCI_OCRA_POLICY_TRACEABILITY_ARCHITECTURE.md
 *           docs/oci/government-readiness/OCI_OCRA_EXPLAINABILITY_MODEL.md
 * DOCTRINE_VERSION: 1.0.0
 *
 * A Finding is a deterministic, PII-free assertion derived from the scoring
 * trace + reviewer-supplied evidence. It carries the seven-answer contract:
 * evidence, statement, obligation, dimension contribution, confidence,
 * consequence, recommendation.
 *
 * READ-ONLY OVER THE FROZEN CORE: dimension contributions are READ from the
 * ScoringTrace and never recomputed or mutated.
 */

import type { ConfidenceEnvelope } from '@nzila/oci-confidence';
import type { DimensionId } from '../types';
import type { EvidenceLevel } from '../evidence-strength/evidenceTaxonomy';
import type { ObligationClassId } from '../obligations/obligationTaxonomy';
import type { MappedConsequence } from '../consequences/consequenceModel';

export type FindingSeverity = 'attention' | 'material' | 'serious' | 'critical';

export interface AffectedDimension {
  readonly dimension: DimensionId;
  /** READ from ScoringTrace.questionTraces[].dimensionContributions. Never recomputed. */
  readonly contribution: number;
}

export interface Finding {
  readonly findingId: string;
  readonly theme: string;
  /** Plain-language, PII-free institutional assertion. */
  readonly statement: string;
  readonly contributingQuestionIds: readonly string[];
  readonly evidenceLevel: EvidenceLevel;
  readonly affectedDimensions: readonly AffectedDimension[];
  readonly obligationClasses: readonly ObligationClassId[];
  readonly severity: FindingSeverity;
  readonly confidence: ConfidenceEnvelope<null>;
  readonly consequence: MappedConsequence;
  readonly recommendationRefs: readonly string[];
}

/**
 * The seven-answer completeness predicate. A finding may only be surfaced when
 * every answer is populated. (Enforced by finding-completeness.test.ts.)
 */
export function isComplete(finding: Finding): boolean {
  return (
    finding.evidenceLevel != null &&
    finding.statement.trim().length > 0 &&
    finding.obligationClasses.length >= 1 &&
    finding.affectedDimensions.length >= 1 &&
    finding.confidence != null &&
    finding.consequence != null &&
    finding.recommendationRefs.length >= 1
  );
}
