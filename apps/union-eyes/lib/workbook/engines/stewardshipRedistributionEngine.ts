/**
 * ARTIFACT TYPE: Module Engine (Composition)
 * MODULE: Stewardship Redistribution (Product 3 / Stabilization)
 * DOCTRINE_VERSION: 2.0.0
 *
 * Reads a Stewardship Redistribution shape over the existing continuity
 * redistribution planner. Pure composition: emits a canonical signal
 * envelope aligned to OCI_STABILIZATION_SEVERITY_MODEL.md, names
 * reciprocity terms explicitly, and resists positioning originating
 * stewards as bottlenecks.
 *
 * Pure, deterministic. Tone: institutional, recognition-first,
 * governance-receivable, blame-free. No transformation theatre.
 *
 * Doctrine: docs/oci/superseded/stabilization/STEWARDSHIP_REDISTRIBUTION.md and
 * docs/oci/superseded/stabilization/playbooks/STEWARDSHIP_REDISTRIBUTION.md.
 */

import {
  planContinuityRedistribution,
  type RedistributionPlanInput,
  type StewardshipRedistributionPlan,
  type RedistributionTarget,
} from './continuityRedistributionPlanner';

export const ENGINE_VERSION = '2.0.0';

export type StewardshipRedistributionStatus = 'facilitated' | 'self-guided';

export type StewardshipRedistributionSignalCategory =
  | 'monopoly_concentration'
  | 'single_carrier_undocumented_cluster'
  | 'lineage_lapse_concentration'
  | 'broadening_ready'
  | 'reciprocity_terms_required'
  | 'no_redistribution_targets';

export type StewardshipRedistributionSeverity =
  | 'note'
  | 'observation'
  | 'warning'
  | 'critical';

export interface StewardshipRedistributionSignal {
  readonly signalId: string;
  readonly severity: StewardshipRedistributionSeverity;
  readonly category: StewardshipRedistributionSignalCategory;
  readonly statement: string;
  readonly evidence: Readonly<Record<string, unknown>>;
}

export interface StewardshipRedistributionInput {
  readonly status: StewardshipRedistributionStatus;
  readonly redistribution: RedistributionPlanInput;
  /**
   * Whether reciprocity terms have been ratified for the originating
   * stewards. The engine emits a `reciprocity_terms_required` signal
   * when redistribution targets exist without ratified terms.
   */
  readonly reciprocityTermsRatified: boolean;
}

export interface StewardshipRedistributionResult {
  readonly status: StewardshipRedistributionStatus;
  readonly engineVersion: typeof ENGINE_VERSION;
  readonly plan: StewardshipRedistributionPlan;
  readonly signals: readonly StewardshipRedistributionSignal[];
  readonly preview: string;
}

const MONOPOLY_EXPOSURE_THRESHOLD = 0.8;
const CRITICAL_EXPOSURE_THRESHOLD = 0.9;

export function runStewardshipRedistribution(
  input: StewardshipRedistributionInput,
): StewardshipRedistributionResult {
  const plan = planContinuityRedistribution(input.redistribution);
  const signals = buildSignals(input, plan);
  return {
    status: input.status,
    engineVersion: ENGINE_VERSION,
    plan,
    signals,
    preview: buildPreview(plan, signals),
  };
}

function buildSignals(
  input: StewardshipRedistributionInput,
  plan: StewardshipRedistributionPlan,
): readonly StewardshipRedistributionSignal[] {
  const out: StewardshipRedistributionSignal[] = [];

  const monopolyCarriers = input.redistribution.carriers.filter(
    (c) => c.exposure >= MONOPOLY_EXPOSURE_THRESHOLD,
  );
  if (monopolyCarriers.length > 0) {
    const anyCritical = monopolyCarriers.some(
      (c) => c.exposure >= CRITICAL_EXPOSURE_THRESHOLD,
    );
    out.push({
      signalId: 'redistribution_monopoly_concentration',
      severity: anyCritical ? 'critical' : 'warning',
      category: 'monopoly_concentration',
      statement:
        'Continuity carriers are concentrated on a small set of stewards; broaden carriers with ratified reciprocity to preserve originating standing.',
      evidence: {
        monopolyCarrierCount: monopolyCarriers.length,
        highestExposure: Math.max(...monopolyCarriers.map((c) => c.exposure)),
      },
    });
  }

  const undocumentedSingleCarrier = input.redistribution.processes.filter(
    (p) => p.singleCarrier && p.undocumented,
  );
  if (undocumentedSingleCarrier.length >= 1) {
    out.push({
      signalId: 'redistribution_single_carrier_undocumented_cluster',
      severity: undocumentedSingleCarrier.length >= 3 ? 'critical' : 'warning',
      category: 'single_carrier_undocumented_cluster',
      statement:
        'Single-carrier undocumented processes carry continuity exposure; broaden practice and capture lineage together with the originating steward present.',
      evidence: { clusterSize: undocumentedSingleCarrier.length },
    });
  }

  const lapsedLineage = input.redistribution.lineageGaps.filter(
    (l) => l.continuity === 'lapsed',
  );
  if (lapsedLineage.length >= 1) {
    out.push({
      signalId: 'redistribution_lineage_lapse_concentration',
      severity: lapsedLineage.length >= 3 ? 'warning' : 'observation',
      category: 'lineage_lapse_concentration',
      statement:
        'Lapsed precedents are present; reconstruct interpretation while institutional memory remains accessible.',
      evidence: {
        lapsedCount: lapsedLineage.length,
        totalGaps: input.redistribution.lineageGaps.length,
      },
    });
  }

  if (plan.targets.length === 0) {
    out.push({
      signalId: 'redistribution_no_targets',
      severity: 'note',
      category: 'no_redistribution_targets',
      statement:
        'No redistribution targets surfaced; recognition continuation under Product 1 or Product 2 deepening is the institutionally honest next step.',
      evidence: {},
    });
    return out;
  }

  if (!input.reciprocityTermsRatified) {
    out.push({
      signalId: 'redistribution_reciprocity_terms_required',
      severity: 'warning',
      category: 'reciprocity_terms_required',
      statement:
        'Redistribution targets are present without ratified reciprocity terms; ratify reciprocity before any broadening sequence begins.',
      evidence: { targetCount: plan.targets.length },
    });
  } else {
    const priorityOne = plan.targets.filter((t) => t.priority === 1).length;
    out.push({
      signalId: 'redistribution_broadening_ready',
      severity: 'note',
      category: 'broadening_ready',
      statement:
        'Reciprocity is ratified and broadening candidates are sequenced; the redistribution playbook is positioned to open.',
      evidence: {
        priorityOneTargets: priorityOne,
        totalTargets: plan.targets.length,
      },
    });
  }

  return out;
}

function buildPreview(
  plan: StewardshipRedistributionPlan,
  signals: readonly StewardshipRedistributionSignal[],
): string {
  if (plan.targets.length === 0) {
    return 'No redistribution targets surfaced; recognition continuation is the institutionally honest next step.';
  }
  const kinds: Record<RedistributionTarget['kind'], number> = {
    carrier_backup: plan.carrierBackupCount,
    process_broadening: plan.processBroadeningCount,
    lineage_capture: plan.lineageCaptureCount,
  };
  const parts: string[] = [
    `Redistribution plan covers ${plan.targets.length} targets: ${kinds.carrier_backup} carrier backup, ${kinds.process_broadening} process broadening, ${kinds.lineage_capture} lineage capture.`,
  ];
  if (signals.length > 0) {
    parts.push(`${signals.length} redistribution signals recorded.`);
  }
  return parts.join(' ');
}
