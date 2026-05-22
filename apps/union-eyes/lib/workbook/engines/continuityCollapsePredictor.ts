/**
 * ARTIFACT TYPE: Engine Helper
 * MODULE: Continuity Breakpoints
 * DOCTRINE_VERSION: 2.0.0
 *
 * Continuity Collapse Predictor — composes survivability matrix
 * classifications, reconstruction burden, and onboarding fragility into
 * a calm, deterministic prediction of where continuity is most likely
 * to fail quietly during the next 12 months.
 *
 * Tone is operational observation, NOT alarmist forecasting.
 * Pure, deterministic.
 */

import {
  classifySurvivability,
  type SurvivabilityCell,
  type DependencyConcentration,
  type SuccessorReadiness,
} from '../../oci/frameworks/continuity-survivability-matrix';
import type { BreakpointReconstructionResult } from './reconstructionBurdenAnalyzer';
import type { OnboardingFragilityRole } from './onboardingFragilityAnalysis';

export interface ContinuityBreakpointInput {
  /** Stable abstract id. */
  readonly id: string;
  /** Abstract subject label. */
  readonly subject: string;
  readonly dependency: DependencyConcentration;
  readonly successor: SuccessorReadiness;
  /** Reconstruction burden result associated with this breakpoint, if computed. */
  readonly reconstruction?: BreakpointReconstructionResult;
  /** Onboarding fragility for the associated role, if computed. */
  readonly onboarding?: OnboardingFragilityRole;
}

export type BreakpointSeverity = 'note' | 'observation' | 'warning' | 'critical';

export interface ContinuityBreakpointRecord {
  readonly id: string;
  readonly subject: string;
  readonly survivability: SurvivabilityCell;
  readonly severity: BreakpointSeverity;
  readonly compositeRisk: number;
  readonly posture: string;
  readonly reconstruction: BreakpointReconstructionResult['burden'] | null;
  readonly onboardingFragility: OnboardingFragilityRole['fragility'] | null;
}

export function predictContinuityCollapse(
  inputs: readonly ContinuityBreakpointInput[],
): readonly ContinuityBreakpointRecord[] {
  const records = inputs.map(toRecord);
  return [...records].sort((a, b) => b.compositeRisk - a.compositeRisk);
}

function toRecord(input: ContinuityBreakpointInput): ContinuityBreakpointRecord {
  const survivability = classifySurvivability(input.dependency, input.successor);
  const survivabilityScore = scoreSurvivability(input.dependency, input.successor);
  const reconstructionScore = input.reconstruction ? input.reconstruction.burden.score / 10 : 0;
  const onboardingScore = input.onboarding ? input.onboarding.score : 0;

  // Composite: 50% survivability, 30% reconstruction, 20% onboarding.
  const compositeRisk = round2(
    survivabilityScore * 0.5 + reconstructionScore * 0.3 + onboardingScore * 0.2,
  );
  const severity = classifySeverity(compositeRisk);

  return {
    id: input.id,
    subject: input.subject,
    survivability,
    severity,
    compositeRisk,
    posture: buildPosture(severity, survivability),
    reconstruction: input.reconstruction ? input.reconstruction.burden : null,
    onboardingFragility: input.onboarding ? input.onboarding.fragility : null,
  };
}

function scoreSurvivability(
  dependency: DependencyConcentration,
  successor: SuccessorReadiness,
): number {
  const dep = dependency === 'singular' ? 1 : dependency === 'concentrated' ? 0.6 : 0.2;
  const suc = successor === 'absent' ? 1 : successor === 'in_progress' ? 0.5 : 0.1;
  return round2((dep + suc) / 2);
}

function classifySeverity(score: number): BreakpointSeverity {
  if (score >= 0.75) return 'critical';
  if (score >= 0.5) return 'warning';
  if (score >= 0.3) return 'observation';
  return 'note';
}

function buildPosture(severity: BreakpointSeverity, survivability: SurvivabilityCell): string {
  // Calm operational observation, never alarmist.
  return `${survivability.label}. ${survivability.posture}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
