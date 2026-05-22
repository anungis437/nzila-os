/**
 * ARTIFACT TYPE: Engine Helper (Workflow Sequencing)
 * MODULE: Stabilization Workflows (Product 3 / Operationalization)
 * DOCTRINE_VERSION: 2.0.0
 *
 * Workflow Sequencing — deterministic ordering of eligible workflows
 * per the five sequencing rules in
 * docs/oci/stabilization/workflows/README.md §4.
 *
 * 1. Recognition precedes intervention (recognition gate).
 * 2. Reduction precedes addition (capture + redistribution before
 *    modernization).
 * 3. Severity governs precedence within an eligibility class.
 * 4. Readiness gates absolute (unmet readiness → deferral).
 * 5. Reciprocity ratification gates stewardship redistribution.
 *
 * Pure, deterministic. No I/O. No new analytics.
 */

import {
  CONTINUITY_WORKFLOW_REGISTRY,
  type WorkflowDefinition,
  type WorkflowKey,
} from './continuityWorkflowRegistry';

export type WorkflowSeverityBand = 'moderate' | 'elevated' | 'critical' | 'institutional_fragility';

export interface WorkflowEligibility {
  readonly key: WorkflowKey;
  readonly observedSeverity: WorkflowSeverityBand;
  readonly readinessSufficient: boolean;
  readonly reciprocityRatified: boolean;
  readonly historicalTenureRecognised: boolean;
  readonly recognitionPhaseExitMet: boolean;
}

export type DeferralReason =
  | 'recognition_phase_exit_not_met'
  | 'readiness_insufficient'
  | 'reciprocity_terms_not_ratified'
  | 'historical_tenure_not_recognised'
  | 'severity_below_floor';

export interface SequencedWorkflowOffer {
  readonly key: WorkflowKey;
  readonly definition: WorkflowDefinition;
  readonly severityBand: WorkflowSeverityBand;
  readonly position: number;
}

export interface DeferredWorkflowEntry {
  readonly key: WorkflowKey;
  readonly definition: WorkflowDefinition;
  readonly reasons: readonly DeferralReason[];
}

export interface WorkflowSequencingResult {
  readonly offered: readonly SequencedWorkflowOffer[];
  readonly deferred: readonly DeferredWorkflowEntry[];
}

const SEVERITY_RANK: Record<WorkflowSeverityBand, number> = {
  moderate: 1,
  elevated: 2,
  critical: 3,
  institutional_fragility: 4,
};

const REDUCTION_BEFORE_ADDITION_RANK: Record<WorkflowKey, number> = {
  continuity_capture: 1,
  stewardship_redistribution: 1,
  governance_clarification: 2,
  onboarding_stabilization: 2,
  operational_reconstruction: 3,
  modernization_remediation: 4,
};

export function sequenceWorkflows(
  eligibilities: readonly WorkflowEligibility[],
): WorkflowSequencingResult {
  const offered: SequencedWorkflowOffer[] = [];
  const deferred: DeferredWorkflowEntry[] = [];

  for (const e of eligibilities) {
    const def = CONTINUITY_WORKFLOW_REGISTRY[e.key];
    const reasons = collectDeferralReasons(e, def);
    if (reasons.length > 0) {
      deferred.push({ key: e.key, definition: def, reasons });
      continue;
    }
    offered.push({
      key: e.key,
      definition: def,
      severityBand: e.observedSeverity,
      position: 0,
    });
  }

  // Sort: severity desc → reduction-before-addition asc → key asc.
  offered.sort((a, b) => {
    const severityDelta = SEVERITY_RANK[b.severityBand] - SEVERITY_RANK[a.severityBand];
    if (severityDelta !== 0) return severityDelta;
    const reductionDelta =
      REDUCTION_BEFORE_ADDITION_RANK[a.key] - REDUCTION_BEFORE_ADDITION_RANK[b.key];
    if (reductionDelta !== 0) return reductionDelta;
    return a.key.localeCompare(b.key);
  });

  const positioned: SequencedWorkflowOffer[] = offered.map((o, i) => ({
    ...o,
    position: i + 1,
  }));

  // Stable deferred order: alphabetical by key.
  deferred.sort((a, b) => a.key.localeCompare(b.key));

  return { offered: positioned, deferred };
}

function collectDeferralReasons(
  e: WorkflowEligibility,
  def: WorkflowDefinition,
): readonly DeferralReason[] {
  const out: DeferralReason[] = [];

  if (!e.recognitionPhaseExitMet) {
    out.push('recognition_phase_exit_not_met');
  }

  if (!e.readinessSufficient) {
    out.push('readiness_insufficient');
  }

  if (
    def.readiness === 'all_five_thresholds_plus_reciprocity_ratified' &&
    !e.reciprocityRatified
  ) {
    out.push('reciprocity_terms_not_ratified');
  }

  if (
    def.readiness === 'all_five_thresholds_plus_historical_tenure_recognition' &&
    !e.historicalTenureRecognised
  ) {
    out.push('historical_tenure_not_recognised');
  }

  if (SEVERITY_RANK[e.observedSeverity] < SEVERITY_RANK[def.severityFloor]) {
    out.push('severity_below_floor');
  }

  return out;
}
