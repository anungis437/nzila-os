/**
 * ARTIFACT TYPE: Module Engine
 * MODULE: Transformation Roadmap (Module 6 of the Governance Entropy Workbook™)
 * DOCTRINE_VERSION: 2.0.0
 *
 * Composes the Stabilization Priority Engine, Continuity Redistribution
 * Planner, and OCI Maturity Pathway into a single, deterministic
 * roadmap result for the workbook.
 *
 * Pure, no I/O. Tone: institutional responsibility; not transformation
 * theatre, not optimization, not consulting boilerplate.
 */

import { OCI_METHOD } from '../../oci/frameworks';
import {
  prioritizeStabilizationMoves,
  type StabilizationInput,
  type StabilizationMove,
} from './stabilizationPriorityEngine';
import {
  planContinuityRedistribution,
  type RedistributionPlanInput,
  type StewardshipRedistributionPlan,
} from './continuityRedistributionPlanner';
import {
  locateOciMaturity,
  type OciMaturityInput,
  type OciMaturityPathwayResult,
} from './ociMaturityPathway';

export const ENGINE_VERSION = '2.0.0';

export type TransformationRoadmapStatus = 'facilitated' | 'self-guided';

export type RoadmapSignalCategory =
  | 'unsuccessed_concentration'
  | 'undocumented_single_carrier_concentration'
  | 'governance_drift_acute'
  | 'onboarding_fragility_acute'
  | 'lineage_lapse_concentration'
  | 'mapping_complete_ready_for_stabilization'
  | 'stabilization_ratified_ready_for_infrastructure';

export interface RoadmapSignal {
  readonly signalId: string;
  readonly severity: 'note' | 'observation' | 'warning' | 'critical';
  readonly category: RoadmapSignalCategory;
  readonly statement: string;
  readonly evidence: Readonly<Record<string, unknown>>;
}

export interface TransformationRoadmapInput {
  readonly status: TransformationRoadmapStatus;
  readonly stabilization: StabilizationInput;
  readonly redistribution: RedistributionPlanInput;
  readonly maturity: OciMaturityInput;
}

export interface TransformationRoadmapResult {
  readonly status: TransformationRoadmapStatus;
  readonly engineVersion: typeof ENGINE_VERSION;
  readonly phases: typeof OCI_METHOD;
  readonly stabilization: readonly StabilizationMove[];
  readonly redistribution: StewardshipRedistributionPlan;
  readonly pathway: OciMaturityPathwayResult;
  readonly signals: readonly RoadmapSignal[];
  readonly preview: string;
}

export function runTransformationRoadmap(
  input: TransformationRoadmapInput,
): TransformationRoadmapResult {
  const stabilization = prioritizeStabilizationMoves(input.stabilization);
  const redistribution = planContinuityRedistribution(input.redistribution);
  const pathway = locateOciMaturity(input.maturity);

  const signals = buildSignals(input, stabilization, redistribution, pathway);

  return {
    status: input.status,
    engineVersion: ENGINE_VERSION,
    phases: OCI_METHOD,
    stabilization,
    redistribution,
    pathway,
    signals,
    preview: buildPreview(stabilization, redistribution, pathway, signals),
  };
}

function buildSignals(
  input: TransformationRoadmapInput,
  stabilization: readonly StabilizationMove[],
  redistribution: StewardshipRedistributionPlan,
  pathway: OciMaturityPathwayResult,
): readonly RoadmapSignal[] {
  const out: RoadmapSignal[] = [];
  const s = input.stabilization;

  if (s.unsuccessedInstitutionCriticalCount >= 1) {
    out.push({
      signalId: 'roadmap_unsuccessed_concentration',
      severity: s.unsuccessedInstitutionCriticalCount >= 3 ? 'critical' : 'warning',
      category: 'unsuccessed_concentration',
      statement:
        'Institution-critical carriers without identified successors are present; successor identification is the first stabilization move.',
      evidence: {
        unsuccessedInstitutionCriticalCount: s.unsuccessedInstitutionCriticalCount,
        unsuccessedLoadBearingCount: s.unsuccessedLoadBearingCount,
      },
    });
  }

  if (s.singleCarrierProcessCount >= 1 && s.undocumentedProcessCount >= 1) {
    out.push({
      signalId: 'roadmap_undocumented_single_carrier_concentration',
      severity: s.singleCarrierProcessCount >= 3 ? 'warning' : 'observation',
      category: 'undocumented_single_carrier_concentration',
      statement:
        'Single-carrier undocumented processes concentrate operational fragility; broaden practice and capture lineage together.',
      evidence: {
        singleCarrierProcessCount: s.singleCarrierProcessCount,
        undocumentedProcessCount: s.undocumentedProcessCount,
      },
    });
  }

  if (s.governanceDriftAggregate >= 0.5) {
    out.push({
      signalId: 'roadmap_governance_drift_acute',
      severity: s.governanceDriftAggregate >= 0.75 ? 'critical' : 'warning',
      category: 'governance_drift_acute',
      statement:
        'Aggregate governance design-practice drift is acute; governance review is a near-term stabilization move.',
      evidence: { aggregate: s.governanceDriftAggregate },
    });
  }

  if (s.onboardingCriticalCount >= 1) {
    out.push({
      signalId: 'roadmap_onboarding_fragility_acute',
      severity: s.onboardingCriticalCount >= 3 ? 'critical' : 'warning',
      category: 'onboarding_fragility_acute',
      statement:
        'Onboarding is critically fragile for one or more roles; strengthen written practice and shadowing in the next 90 days.',
      evidence: { criticalCount: s.onboardingCriticalCount },
    });
  }

  const lapsed = input.redistribution.lineageGaps.filter((l) => l.continuity === 'lapsed').length;
  if (lapsed >= 1) {
    out.push({
      signalId: 'roadmap_lineage_lapse_concentration',
      severity: lapsed >= 3 ? 'warning' : 'observation',
      category: 'lineage_lapse_concentration',
      statement:
        'Lapsed precedents are present; reconstruct interpretation while institutional memory remains accessible.',
      evidence: { lapsedCount: lapsed, totalGaps: input.redistribution.lineageGaps.length },
    });
  }

  if (pathway.currentStage === 'mapping_underway' && stabilization.length > 0) {
    out.push({
      signalId: 'roadmap_mapping_complete_ready_for_stabilization',
      severity: 'note',
      category: 'mapping_complete_ready_for_stabilization',
      statement:
        'Mapping is underway and stabilization candidates are identified; the institution is positioned to enter the Stabilization phase.',
      evidence: {
        stabilizationCandidates: stabilization.length,
        redistributionTargets: redistribution.targets.length,
      },
    });
  }

  if (pathway.currentStage === 'stabilization_underway') {
    out.push({
      signalId: 'roadmap_stabilization_ratified_ready_for_infrastructure',
      severity: 'note',
      category: 'stabilization_ratified_ready_for_infrastructure',
      statement:
        'Stabilization is ratified; the institution is positioned to embed continuity practice into operating rhythm.',
      evidence: { nextPhase: pathway.nextPhase },
    });
  }

  return out;
}

function buildPreview(
  stabilization: readonly StabilizationMove[],
  redistribution: StewardshipRedistributionPlan,
  pathway: OciMaturityPathwayResult,
  signals: readonly RoadmapSignal[],
): string {
  const top = stabilization.find((m) => m.priority === 1);
  const phaseName = OCI_METHOD.phases.find((p) => p.id === pathway.currentPhase)?.name ?? pathway.currentPhase;
  const parts: string[] = [
    `Institution is in the ${phaseName} phase of the OCI Method.`,
  ];
  if (top) {
    parts.push(`First stabilization move: ${top.summary}`);
  }
  if (redistribution.targets.length > 0) {
    parts.push(`Redistribution plan covers ${redistribution.targets.length} targets across carriers, processes, and lineage.`);
  }
  if (signals.length > 0) {
    parts.push(`${signals.length} roadmap signals recorded.`);
  }
  return parts.join(' ');
}
