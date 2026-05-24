/**
 * ARTIFACT TYPE: Engine
 * MODULE: Modernization Alignment
 * DOCTRINE_VERSION: 2.0.0
 *
 * Modernization Alignment Engine — aligns continuity, governance, and
 * modernization arcs so modernization does not erase organizational
 * memory. Combines the Continuity-Safe Modernization Matrix™, governance
 * review classification, operational traceability review, and the
 * derived Modernization Continuity Gap™.
 *
 * The category is OCI, NOT AI transformation. AI capability remains a
 * restrained, governance-aware, secondary consideration.
 *
 * Pure, deterministic.
 */

import {
  classifyContinuitySafeModernization,
  type ContinuitySafeModernizationCell,
  type ModernizationInitiativeInput,
} from './continuitySafeModernization';
import {
  reviewGovernanceModernization,
  computeModernizationContinuityGaps,
  type GovernanceReviewCell,
  type GovernanceReviewInput,
  type ModernizationContinuityGap,
} from './governanceModernizationReview';
import {
  reviewOperationalTraceability,
  type OperationalTraceabilityCell,
  type OperationalTraceabilityInput,
} from './operationalTraceabilityReview';

export interface ModernizationAlignmentInput {
  readonly workbookId: string;
  readonly initiatives: readonly ModernizationInitiativeInput[];
  readonly governanceReview: readonly GovernanceReviewInput[];
  readonly traceability: readonly OperationalTraceabilityInput[];
}

export type AlignmentSignalSeverity = 'note' | 'observation' | 'warning' | 'critical';

export type AlignmentSignalCategory =
  | 'continuity_eroding_initiative'
  | 'governance_review_absent'
  | 'opaque_traceability_concentration'
  | 'compound_modernization_gap'
  | 'aligned_modernization_healthy';

export interface AlignmentSignal {
  readonly signalId: string;
  readonly severity: AlignmentSignalSeverity;
  readonly category: AlignmentSignalCategory;
  readonly statement: string;
  readonly evidence: Readonly<Record<string, unknown>>;
}

export interface ModernizationAlignmentResult {
  readonly status: 'facilitated' | 'self-guided';
  readonly modernizationMatrix: readonly ContinuitySafeModernizationCell[];
  readonly governanceReview: readonly GovernanceReviewCell[];
  readonly traceability: readonly OperationalTraceabilityCell[];
  readonly continuityGaps: readonly ModernizationContinuityGap[];
  readonly signals: readonly AlignmentSignal[];
  readonly preview: string;
}

export const ENGINE_VERSION = '2.0.0';

export function runModernizationAlignment(
  input: ModernizationAlignmentInput,
): ModernizationAlignmentResult {
  const modernizationMatrix = classifyContinuitySafeModernization(input.initiatives);
  const governanceReview = reviewGovernanceModernization(input.governanceReview);
  const traceability = reviewOperationalTraceability(input.traceability);
  const continuityGaps = computeModernizationContinuityGaps(modernizationMatrix, governanceReview);

  const signals = synthesizeSignals(modernizationMatrix, governanceReview, traceability, continuityGaps);
  const status: ModernizationAlignmentResult['status'] =
    input.initiatives.length === 0 ? 'self-guided' : 'facilitated';

  return {
    status,
    modernizationMatrix,
    governanceReview,
    traceability,
    continuityGaps,
    signals,
    preview: buildPreview(modernizationMatrix, continuityGaps),
  };
}

function synthesizeSignals(
  modernization: readonly ContinuitySafeModernizationCell[],
  review: readonly GovernanceReviewCell[],
  traceability: readonly OperationalTraceabilityCell[],
  gaps: readonly ModernizationContinuityGap[],
): readonly AlignmentSignal[] {
  const signals: AlignmentSignal[] = [];

  const eroding = modernization.filter((m) => m.posture === 'continuity_eroding');
  if (eroding.length >= 1) {
    signals.push({
      signalId: 'continuity_eroding_initiative',
      severity: eroding.length >= 2 ? 'warning' : 'observation',
      category: 'continuity_eroding_initiative',
      statement: `${eroding.length} modernization initiative${eroding.length === 1 ? ' is' : 's are'} configured in a way that displaces existing practice without lineage capture.`,
      evidence: { ids: eroding.map((e) => e.id) },
    });
  }

  const absent = review.filter((r) => r.posture === 'governance_absent');
  if (absent.length >= 1 && modernization.length > 0) {
    signals.push({
      signalId: 'governance_review_absent',
      severity: absent.length / Math.max(1, modernization.length) >= 0.5 ? 'warning' : 'observation',
      category: 'governance_review_absent',
      statement: `${absent.length} initiative${absent.length === 1 ? ' has' : 's have'} not been reviewed by a governance body.`,
      evidence: { count: absent.length },
    });
  }

  const opaque = traceability.filter((t) => t.posture === 'opaque');
  if (opaque.length >= 1) {
    signals.push({
      signalId: 'opaque_traceability_concentration',
      severity: opaque.length >= 2 ? 'warning' : 'observation',
      category: 'opaque_traceability_concentration',
      statement: `${opaque.length} initiative${opaque.length === 1 ? ' provides' : 's provide'} no operational traceability across the modernization.`,
      evidence: { ids: opaque.map((o) => o.initiativeId) },
    });
  }

  const compound = gaps.filter((g) => g.gapKind === 'compound_gap');
  if (compound.length >= 1) {
    signals.push({
      signalId: 'compound_modernization_gap',
      severity: 'warning',
      category: 'compound_modernization_gap',
      statement: `${compound.length} initiative${compound.length === 1 ? ' shows' : 's show'} a compound gap — neither continuity engagement nor governance review is in place.`,
      evidence: { ids: compound.map((c) => c.initiativeId) },
    });
  }

  if (
    modernization.length >= 2 &&
    eroding.length === 0 &&
    compound.length === 0 &&
    opaque.length === 0
  ) {
    signals.push({
      signalId: 'aligned_modernization_healthy',
      severity: 'note',
      category: 'aligned_modernization_healthy',
      statement:
        'Modernization initiatives are broadly continuity-aware, governance-reviewed, and traceable. Continue periodic review.',
      evidence: { initiativeCount: modernization.length },
    });
  }

  return signals;
}

function buildPreview(
  modernization: readonly ContinuitySafeModernizationCell[],
  gaps: readonly ModernizationContinuityGap[],
): string {
  if (modernization.length === 0) {
    return 'No modernization initiatives have been named yet — the alignment module will populate as initiatives are surfaced.';
  }
  const eroding = modernization.filter((m) => m.posture === 'continuity_eroding').length;
  const safe = modernization.filter((m) => m.posture === 'continuity_safe').length;
  if (eroding >= 1) {
    return `${eroding} of ${modernization.length} initiatives are configured in a way that may erode organizational continuity.`;
  }
  if (safe / modernization.length >= 0.6) {
    return `${safe} of ${modernization.length} initiatives are continuity-safe; modernization is broadly carrying organizational practice forward.`;
  }
  const compoundGaps = gaps.filter((g) => g.gapKind === 'compound_gap').length;
  if (compoundGaps >= 1) {
    return `${compoundGaps} of ${modernization.length} initiatives show compound continuity gaps; governance and continuity engagement both warrant attention.`;
  }
  return `${modernization.length} initiatives reviewed; modernization alignment is observed but uneven across the named initiatives.`;
}
