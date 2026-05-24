/**
 * ARTIFACT TYPE: Module Engine (Composition)
 * MODULE: Stabilization Workflows (Product 3 / Operationalization)
 * DOCTRINE_VERSION: 2.0.0
 *
 * Stabilization Workflow Engine — reads existing OCI engine signals
 * (priority, redistribution, recovery, onboarding) and emits a
 * deterministic, sequenced workflow offer for a Product 3 engagement.
 *
 * Pure composition. Introduces no new analytics. Composes:
 *   - stabilizationPriorityEngine
 *   - stewardshipRedistributionEngine (which composes continuityRedistributionPlanner)
 *   - governanceRecoveryEngine (which composes continuityLineageEngine)
 *   - onboardingFragilityAnalysis
 *
 * Tone: organizational, recognition-first, governance-receivable,
 * blame-free. Deferral is a method outcome.
 *
 * Doctrine: docs/oci/stabilization/workflows/README.md and the six
 * workflow documents it indexes.
 */

import {
  prioritizeStabilizationMoves,
  type StabilizationInput,
} from '../stabilizationPriorityEngine';
import {
  runStewardshipRedistribution,
  type StewardshipRedistributionInput,
  type StewardshipRedistributionResult,
} from '../stewardshipRedistributionEngine';
import {
  runGovernanceRecovery,
  type GovernanceRecoveryInput,
  type GovernanceRecoveryResult,
} from '../governanceRecoveryEngine';
import {
  analyzeOnboardingFragility,
  type OnboardingRoleInput,
  type OnboardingSurvivabilityLayer,
} from '../onboardingFragilityAnalysis';
import {
  sequenceWorkflows,
  type WorkflowEligibility,
  type WorkflowSequencingResult,
  type WorkflowSeverityBand,
} from './workflowSequencing';
import type { WorkflowKey } from './continuityWorkflowRegistry';

export const ENGINE_VERSION = '2.0.0';

export type StabilizationWorkflowStatus = 'facilitated' | 'self-guided';

export type WorkflowSignalCategory =
  | 'workflow_offered'
  | 'workflow_deferred'
  | 'no_workflow_eligible'
  | 'recognition_phase_exit_required';

export interface WorkflowSignal {
  readonly signalId: string;
  readonly severity: 'note' | 'observation' | 'warning' | 'critical';
  readonly category: WorkflowSignalCategory;
  readonly statement: string;
  readonly evidence: Readonly<Record<string, unknown>>;
}

export interface StabilizationWorkflowEngineInput {
  readonly status: StabilizationWorkflowStatus;
  readonly stabilization: StabilizationInput;
  readonly redistribution: StewardshipRedistributionInput;
  readonly recovery: GovernanceRecoveryInput;
  readonly onboardingRoles: readonly OnboardingRoleInput[];
  /** Whether the Recognition phase exit condition (signed recognition statement) is on file. */
  readonly recognitionPhaseExitMet: boolean;
  /** Whether all five readiness thresholds are at sufficiency. */
  readonly readinessSufficient: boolean;
  /** Whether historical-tenure recognition has been recorded. */
  readonly historicalTenureRecognised: boolean;
  /**
   * Whether modernization scope has been named by the institution. The
   * modernization_remediation workflow is only eligible when scope is
   * named.
   */
  readonly modernizationScopeNamed: boolean;
}

export interface StabilizationWorkflowEngineResult {
  readonly status: StabilizationWorkflowStatus;
  readonly engineVersion: typeof ENGINE_VERSION;
  readonly sequencing: WorkflowSequencingResult;
  readonly composedReadings: {
    readonly redistribution: StewardshipRedistributionResult;
    readonly recovery: GovernanceRecoveryResult;
    readonly onboarding: OnboardingSurvivabilityLayer;
  };
  readonly signals: readonly WorkflowSignal[];
  readonly preview: string;
}

export function runStabilizationWorkflowEngine(
  input: StabilizationWorkflowEngineInput,
): StabilizationWorkflowEngineResult {
  const stabilizationMoves = prioritizeStabilizationMoves(input.stabilization);
  const redistribution = runStewardshipRedistribution(input.redistribution);
  const recovery = runGovernanceRecovery(input.recovery);
  const onboarding = analyzeOnboardingFragility(input.onboardingRoles);

  const eligibilities = buildEligibilities(input, {
    stabilizationMoves,
    redistribution,
    recovery,
    onboarding,
  });

  const sequencing = sequenceWorkflows(eligibilities);
  const signals = buildSignals(input, sequencing);

  return {
    status: input.status,
    engineVersion: ENGINE_VERSION,
    sequencing,
    composedReadings: { redistribution, recovery, onboarding },
    signals,
    preview: buildPreview(sequencing, signals),
  };
}

interface ComposedReadings {
  readonly stabilizationMoves: ReturnType<typeof prioritizeStabilizationMoves>;
  readonly redistribution: StewardshipRedistributionResult;
  readonly recovery: GovernanceRecoveryResult;
  readonly onboarding: OnboardingSurvivabilityLayer;
}

function buildEligibilities(
  input: StabilizationWorkflowEngineInput,
  readings: ComposedReadings,
): readonly WorkflowEligibility[] {
  const out: WorkflowEligibility[] = [];

  // Continuity capture: eligible if there are undocumented single-carrier
  // processes or carrier redistribution targets.
  const captureSeverity = pickCaptureSeverity(input, readings);
  if (captureSeverity !== null) {
    out.push(makeEligibility(input, 'continuity_capture', captureSeverity));
  }

  // Governance clarification: eligible if recovery surface present.
  const clarifySeverity = pickClarifySeverity(readings);
  if (clarifySeverity !== null) {
    out.push(makeEligibility(input, 'governance_clarification', clarifySeverity));
  }

  // Stewardship redistribution: eligible if redistribution targets exist.
  const redistributeSeverity = pickRedistributeSeverity(readings);
  if (redistributeSeverity !== null) {
    out.push(makeEligibility(input, 'stewardship_redistribution', redistributeSeverity));
  }

  // Onboarding stabilization: eligible if fragile or critical roles present.
  const onboardSeverity = pickOnboardSeverity(readings);
  if (onboardSeverity !== null) {
    out.push(makeEligibility(input, 'onboarding_stabilization', onboardSeverity));
  }

  // Modernization remediation: eligible only when scope is named.
  if (input.modernizationScopeNamed) {
    out.push(makeEligibility(input, 'modernization_remediation', 'moderate'));
  }

  // Operational reconstruction: eligible if lapsed precedents present.
  const reconstructSeverity = pickReconstructSeverity(readings);
  if (reconstructSeverity !== null) {
    out.push(makeEligibility(input, 'operational_reconstruction', reconstructSeverity));
  }

  return out;
}

function makeEligibility(
  input: StabilizationWorkflowEngineInput,
  key: WorkflowKey,
  observed: WorkflowSeverityBand,
): WorkflowEligibility {
  return {
    key,
    observedSeverity: observed,
    readinessSufficient: input.readinessSufficient,
    reciprocityRatified: input.redistribution.reciprocityTermsRatified,
    historicalTenureRecognised: input.historicalTenureRecognised,
    recognitionPhaseExitMet: input.recognitionPhaseExitMet,
  };
}

function pickCaptureSeverity(
  input: StabilizationWorkflowEngineInput,
  readings: ComposedReadings,
): WorkflowSeverityBand | null {
  const undocumented = input.stabilization.undocumentedProcessCount;
  const singleCarrier = input.stabilization.singleCarrierProcessCount;
  const lineageGapTargets = readings.redistribution.plan.targets.filter(
    (t) => t.kind === 'lineage_capture',
  ).length;
  const combined = undocumented + singleCarrier + lineageGapTargets;
  if (combined === 0) return null;
  if (combined >= 6) return 'critical';
  if (combined >= 3) return 'elevated';
  return 'moderate';
}

function pickClarifySeverity(readings: ComposedReadings): WorkflowSeverityBand | null {
  const lapsed = readings.recovery.lineage.survivability.lapsed;
  const drift = readings.recovery.lineage.aggregateInterpretationDrift;
  if (lapsed === 0 && drift < 0.2) return null;
  if (lapsed >= 3 || drift >= 0.7) return 'critical';
  if (lapsed >= 1 || drift >= 0.4) return 'elevated';
  return 'moderate';
}

function pickRedistributeSeverity(readings: ComposedReadings): WorkflowSeverityBand | null {
  const targets = readings.redistribution.plan.targets.length;
  const monopoly = readings.redistribution.signals.some(
    (s) => s.category === 'monopoly_concentration' && s.severity === 'critical',
  );
  if (targets === 0) return null;
  if (monopoly) return 'institutional_fragility';
  if (targets >= 3) return 'critical';
  return 'elevated';
}

function pickOnboardSeverity(readings: ComposedReadings): WorkflowSeverityBand | null {
  const critical = readings.onboarding.criticalCount;
  const fragile = readings.onboarding.fragileCount;
  if (critical === 0 && fragile === 0) return null;
  if (critical >= 2) return 'critical';
  if (critical >= 1) return 'elevated';
  return 'moderate';
}

function pickReconstructSeverity(readings: ComposedReadings): WorkflowSeverityBand | null {
  const lapsed = readings.recovery.lineage.survivability.lapsed;
  if (lapsed === 0) return null;
  if (lapsed >= 4) return 'institutional_fragility';
  if (lapsed >= 2) return 'critical';
  return 'elevated';
}

function buildSignals(
  input: StabilizationWorkflowEngineInput,
  sequencing: WorkflowSequencingResult,
): readonly WorkflowSignal[] {
  const out: WorkflowSignal[] = [];

  if (!input.recognitionPhaseExitMet) {
    out.push({
      signalId: 'workflow_recognition_phase_exit_required',
      severity: 'note',
      category: 'recognition_phase_exit_required',
      statement:
        'Recognition phase exit condition is not yet met; no stabilization workflow is offered until the signed recognition statement is on file.',
      evidence: { recognitionPhaseExitMet: false },
    });
  }

  if (sequencing.offered.length === 0 && sequencing.deferred.length === 0) {
    out.push({
      signalId: 'workflow_no_eligible_surface',
      severity: 'note',
      category: 'no_workflow_eligible',
      statement:
        'No stabilization workflow is currently eligible; recognition continuation under Product 1 or a Product 2 deepening is the institutionally honest next step.',
      evidence: {},
    });
  }

  for (const o of sequencing.offered) {
    out.push({
      signalId: `workflow_offered_${o.key}`,
      severity: o.severityBand === 'institutional_fragility' || o.severityBand === 'critical' ? 'warning' : 'observation',
      category: 'workflow_offered',
      statement: `${o.definition.title} is offered at position ${String(o.position)} under the institution's ratified scope.`,
      evidence: {
        workflowKey: o.key,
        position: o.position,
        severityBand: o.severityBand,
      },
    });
  }

  for (const d of sequencing.deferred) {
    out.push({
      signalId: `workflow_deferred_${d.key}`,
      severity: 'note',
      category: 'workflow_deferred',
      statement: `${d.definition.title} is held in deferral until the named conditions are met; deferral is a method outcome and is recorded in the engagement log.`,
      evidence: {
        workflowKey: d.key,
        reasons: d.reasons,
      },
    });
  }

  return out;
}

function buildPreview(
  sequencing: WorkflowSequencingResult,
  signals: readonly WorkflowSignal[],
): string {
  if (sequencing.offered.length === 0 && sequencing.deferred.length === 0) {
    return 'No stabilization workflow is currently eligible; recognition continuation is the institutionally honest next step.';
  }
  const offeredCount = sequencing.offered.length;
  const deferredCount = sequencing.deferred.length;
  const head = sequencing.offered[0];
  const lead = head
    ? `${head.definition.title} is offered first; ${String(offeredCount)} workflow(s) total under the institution's ratified scope.`
    : `No workflow is currently offered; ${String(deferredCount)} workflow(s) are held in deferral pending conditions.`;
  const tail = deferredCount > 0 && head
    ? ` ${String(deferredCount)} workflow(s) are held in deferral.`
    : '';
  return `${lead}${tail} Signals: ${String(signals.length)}.`;
}
