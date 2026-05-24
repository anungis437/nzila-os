/**
 * ARTIFACT TYPE: Engine
 * MODULE: Continuity Breakpoints
 * DOCTRINE_VERSION: 2.0.0
 *
 * Continuity Breakpoint Engine — identifies the organizational points at
 * which a continuity break would have the greatest blast radius. Combines
 * the Continuity Survivability Matrix™, the Reconstruction Burden Index™,
 * and the Onboarding Survivability Layer™ into a calm, ranked register
 * of breakpoints with operational posture.
 *
 * Tone: calm operational observation, NEVER alarmist, NEVER compliance-
 * framed, NEVER risk-consulting boilerplate. Breakpoints are described
 * as the organizational configurations in which continuity is most likely
 * to fail quietly — not as "threats" or "exposures".
 *
 * Pure, deterministic.
 */

import {
  analyzeReconstructionBurden,
  aggregateReconstructionBurden,
  type BreakpointReconstructionInput,
  type BreakpointReconstructionResult,
} from './reconstructionBurdenAnalyzer';
import {
  analyzeOnboardingFragility,
  type OnboardingRoleInput,
  type OnboardingSurvivabilityLayer,
} from './onboardingFragilityAnalysis';
import {
  predictContinuityCollapse,
  type ContinuityBreakpointInput as PredictorInput,
  type ContinuityBreakpointRecord,
} from './continuityCollapsePredictor';
import type { DependencyConcentration, SuccessorReadiness } from '../../oci/frameworks/continuity-survivability-matrix';

export interface BreakpointDefinitionInput {
  readonly id: string;
  readonly subject: string;
  readonly dependency: DependencyConcentration;
  readonly successor: SuccessorReadiness;
  /** Optional reconstruction input — joined by breakpoint id. */
  readonly reconstruction?: Omit<BreakpointReconstructionInput, 'id' | 'subject'>;
  /** Optional associated role id for onboarding fragility lookup. */
  readonly onboardingRoleId?: string;
}

export interface ContinuityBreakpointInput {
  readonly workbookId: string;
  readonly breakpoints: readonly BreakpointDefinitionInput[];
  readonly onboardingRoles: readonly OnboardingRoleInput[];
}

export type BreakpointSignalSeverity = 'note' | 'observation' | 'warning' | 'critical';

export type BreakpointSignalCategory =
  | 'critical_breakpoint_concentration'
  | 'severe_reconstruction_burden'
  | 'onboarding_fragility_concentration'
  | 'distributed_breakpoints_healthy';

export interface BreakpointSignal {
  readonly signalId: string;
  readonly severity: BreakpointSignalSeverity;
  readonly category: BreakpointSignalCategory;
  readonly statement: string;
  readonly evidence: Readonly<Record<string, unknown>>;
}

export interface ContinuityBreakpointResult {
  readonly status: 'facilitated' | 'self-guided';
  readonly breakpoints: readonly ContinuityBreakpointRecord[];
  readonly onboarding: OnboardingSurvivabilityLayer;
  readonly reconstructionAggregate: ReturnType<typeof aggregateReconstructionBurden>;
  readonly signals: readonly BreakpointSignal[];
  readonly preview: string;
}

export const ENGINE_VERSION = '2.0.0';

export function runContinuityBreakpoint(
  input: ContinuityBreakpointInput,
): ContinuityBreakpointResult {
  const onboarding = analyzeOnboardingFragility(input.onboardingRoles);
  const reconstructionInputs: BreakpointReconstructionInput[] = input.breakpoints
    .filter((b): b is BreakpointDefinitionInput & { reconstruction: NonNullable<BreakpointDefinitionInput['reconstruction']> } => !!b.reconstruction)
    .map((b) => ({
      id: b.id,
      subject: b.subject,
      ...b.reconstruction,
    }));
  const reconstructionResults = analyzeReconstructionBurden(reconstructionInputs);
  const reconstructionById = new Map<string, BreakpointReconstructionResult>();
  for (const r of reconstructionResults) reconstructionById.set(r.id, r);

  const onboardingById = new Map(onboarding.roles.map((r) => [r.id, r]));

  const predictorInputs: PredictorInput[] = input.breakpoints.map((b) => ({
    id: b.id,
    subject: b.subject,
    dependency: b.dependency,
    successor: b.successor,
    reconstruction: reconstructionById.get(b.id),
    onboarding: b.onboardingRoleId ? onboardingById.get(b.onboardingRoleId) : undefined,
  }));

  const breakpoints = predictContinuityCollapse(predictorInputs);
  const reconstructionAggregate = aggregateReconstructionBurden(reconstructionResults);

  const signals = synthesizeSignals(breakpoints, onboarding, reconstructionAggregate);
  const status: ContinuityBreakpointResult['status'] =
    input.breakpoints.length === 0 && input.onboardingRoles.length === 0
      ? 'self-guided'
      : 'facilitated';

  return {
    status,
    breakpoints,
    onboarding,
    reconstructionAggregate,
    signals,
    preview: buildPreview(breakpoints, onboarding),
  };
}

function synthesizeSignals(
  breakpoints: readonly ContinuityBreakpointRecord[],
  onboarding: OnboardingSurvivabilityLayer,
  reconstruction: ReturnType<typeof aggregateReconstructionBurden>,
): readonly BreakpointSignal[] {
  const signals: BreakpointSignal[] = [];
  const critical = breakpoints.filter((b) => b.severity === 'critical');
  const warnings = breakpoints.filter((b) => b.severity === 'warning');

  if (critical.length >= 1) {
    signals.push({
      signalId: 'critical_breakpoint_concentration',
      severity: critical.length >= 3 ? 'critical' : 'warning',
      category: 'critical_breakpoint_concentration',
      statement: `${critical.length} continuity breakpoint${critical.length === 1 ? ' is' : 's are'} in a configuration where continuity is most likely to fail quietly on the next transition.`,
      evidence: { criticalIds: critical.map((c) => c.id) },
    });
  }

  if (reconstruction.severeCount >= 1) {
    signals.push({
      signalId: 'severe_reconstruction_burden',
      severity: reconstruction.severeCount >= 2 ? 'warning' : 'observation',
      category: 'severe_reconstruction_burden',
      statement: `${reconstruction.severeCount} breakpoint${reconstruction.severeCount === 1 ? ' carries' : 's carry'} severe reconstruction burden if a continuity break occurs.`,
      evidence: {
        severeCount: reconstruction.severeCount,
        meanScore: reconstruction.meanScore,
      },
    });
  }

  if (onboarding.criticalCount >= 1) {
    signals.push({
      signalId: 'onboarding_fragility_concentration',
      severity: onboarding.criticalCount >= 2 ? 'warning' : 'observation',
      category: 'onboarding_fragility_concentration',
      statement: `${onboarding.criticalCount} role${onboarding.criticalCount === 1 ? ' has' : 's have'} critically fragile onboarding; new carriers cannot absorb practice fast enough to prevent quiet continuity failure.`,
      evidence: { criticalCount: onboarding.criticalCount, meanScore: onboarding.meanScore },
    });
  }

  if (
    breakpoints.length >= 3 &&
    critical.length === 0 &&
    warnings.length <= 1 &&
    onboarding.criticalCount === 0 &&
    reconstruction.severeCount === 0
  ) {
    signals.push({
      signalId: 'distributed_breakpoints_healthy',
      severity: 'note',
      category: 'distributed_breakpoints_healthy',
      statement: 'Named breakpoints appear broadly distributed with no acute single-point fragility.',
      evidence: { breakpointCount: breakpoints.length },
    });
  }

  return signals;
}

function buildPreview(
  breakpoints: readonly ContinuityBreakpointRecord[],
  onboarding: OnboardingSurvivabilityLayer,
): string {
  if (breakpoints.length === 0) {
    return 'No breakpoints have been named yet — the breakpoint register will populate as continuity carriers and processes are surfaced.';
  }
  const top = breakpoints[0];
  return `The most exposed breakpoint sits at ${top.subject.toLowerCase()}; ${top.posture.toLowerCase()} ${onboarding.reading.toLowerCase()}`;
}
