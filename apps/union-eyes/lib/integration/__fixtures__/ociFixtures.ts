/**
 * ARTIFACT TYPE: Test Fixtures
 * MODULE: OCI Operational Truth Hardening
 * DOCTRINE_VERSION: 1.0.0
 *
 * Shared, deterministic fixtures for cross-product OCI integration tests.
 *
 * These fixtures construct a coherent institutional shape that flows through
 * the full OCI lifecycle: Recognition → Mapping → Stabilization → Runtime →
 * Intelligence. They are intentionally narrow and reviewer-led; nothing here
 * carries identifying detail.
 */

import { ALL_QUESTIONS } from '../../icra/questions';
import { buildAnswer } from '../../icra/scoring';
import type { Answer } from '../../icra/types';
import { composeContinuityEvent } from '../../runtime/events/continuityEventEnvelope';
import type {
  AnonymisedInstitutionHandle,
  ContinuityDebtEvolutionRecord,
  ContinuityTrajectoryRecord,
  GovernanceEntropyDriftRecord,
  IntelligenceParticipationGrant,
  IntelligenceSector,
  StewardshipEvolutionRecord,
  SurvivabilityProgressionRecord,
} from '../../intelligence/contracts/intelligenceContracts';
import type {
  ContinuityEventEnvelope,
  ContinuityRuntimeBand,
} from '../../runtime/contracts/runtimeContracts';

export const FIXTURE_REVIEWER_REF = 'reviewer:test-001';
export const FIXTURE_INSTITUTION_SCOPE = 'institution:test:scope';
export const FIXTURE_OBSERVED_AT = '2026-01-01T00:00:00.000Z';

/**
 * Build a complete answer set for every scored OCRA question at a uniform
 * effective maturity. Determinism: the same input always yields the same
 * normalized scoring profile.
 *
 * @param uniformScore  An integer 0..4 used for every likert question.
 */
export function buildUniformAnswers(uniformScore: 0 | 1 | 2 | 3 | 4): Answer[] {
  return ALL_QUESTIONS.map((question) => {
    if (question.type === 'likert_5') {
      return buildAnswer(question, String(uniformScore));
    }
    // For non-likert, take the option whose score is closest to uniformScore/4.
    const target = uniformScore / 4;
    const closest = question.options.reduce((best, option) =>
      Math.abs(option.score - target) < Math.abs(best.score - target) ? option : best,
    );
    return buildAnswer(question, closest.value);
  });
}

/** Build answers for a graded continuity posture: 0 = absent, 4 = institutional. */
export function buildGradedAnswers(
  bandFor: (index: number) => 0 | 1 | 2 | 3 | 4,
): Answer[] {
  return ALL_QUESTIONS.map((question, index) => {
    const score = bandFor(index);
    if (question.type === 'likert_5') {
      return buildAnswer(question, String(score));
    }
    const target = score / 4;
    const closest = question.options.reduce((best, option) =>
      Math.abs(option.score - target) < Math.abs(best.score - target) ? option : best,
    );
    return buildAnswer(question, closest.value);
  });
}

export function makeHandle(
  hashSuffix: string,
  sector: IntelligenceSector = 'labour_union',
  contributedAt: string = FIXTURE_OBSERVED_AT,
): AnonymisedInstitutionHandle {
  return {
    institutionRefHash: `hash_${hashSuffix.padEnd(12, '0')}`,
    sector,
    contributedAt,
  };
}

export function makeGrant(
  hashSuffix: string,
  sector: IntelligenceSector = 'labour_union',
): IntelligenceParticipationGrant {
  return {
    institutionRefHash: `hash_${hashSuffix.padEnd(12, '0')}`,
    sector,
    grantedScopes: [
      'continuity_trajectory',
      'governance_drift',
      'stewardship_evolution',
      'survivability_progression',
      'continuity_debt',
    ],
    grantedAt: FIXTURE_OBSERVED_AT,
    reviewerRefId: FIXTURE_REVIEWER_REF,
  };
}

export function makeTrajectory(
  hashSuffix: string,
  observedAt: string,
  band: ContinuityTrajectoryRecord['band'],
  sector: IntelligenceSector = 'labour_union',
): ContinuityTrajectoryRecord {
  return {
    trajectoryId: `traj:${hashSuffix}:${observedAt}`,
    handle: makeHandle(hashSuffix, sector),
    observedAt,
    band,
    reviewerRefId: FIXTURE_REVIEWER_REF,
  };
}

export function makeDrift(
  hashSuffix: string,
  observedAt: string,
  drift: GovernanceEntropyDriftRecord['drift'],
  sector: IntelligenceSector = 'labour_union',
): GovernanceEntropyDriftRecord {
  return {
    driftId: `drift:${hashSuffix}:${observedAt}`,
    handle: makeHandle(hashSuffix, sector),
    observedAt,
    drift,
    reviewerRefId: FIXTURE_REVIEWER_REF,
  };
}

export function makeStewardship(
  hashSuffix: string,
  observedAt: string,
  evolution: StewardshipEvolutionRecord['evolution'],
  sector: IntelligenceSector = 'labour_union',
): StewardshipEvolutionRecord {
  return {
    evolutionId: `stew:${hashSuffix}:${observedAt}`,
    handle: makeHandle(hashSuffix, sector),
    observedAt,
    evolution,
    reviewerRefId: FIXTURE_REVIEWER_REF,
  };
}

export function makeSurvivability(
  hashSuffix: string,
  observedAt: string,
  progression: SurvivabilityProgressionRecord['progression'],
  sector: IntelligenceSector = 'labour_union',
): SurvivabilityProgressionRecord {
  return {
    progressionId: `surv:${hashSuffix}:${observedAt}`,
    handle: makeHandle(hashSuffix, sector),
    observedAt,
    progression,
    reviewerRefId: FIXTURE_REVIEWER_REF,
  };
}

export function makeDebt(
  hashSuffix: string,
  observedAt: string,
  trend: ContinuityDebtEvolutionRecord['trend'],
  sector: IntelligenceSector = 'labour_union',
): ContinuityDebtEvolutionRecord {
  return {
    debtId: `debt:${hashSuffix}:${observedAt}`,
    handle: makeHandle(hashSuffix, sector),
    observedAt,
    trend,
    reviewerRefId: FIXTURE_REVIEWER_REF,
  };
}

export function makeRuntimeEvent(
  eventId: string,
  kind: ContinuityEventEnvelope['kind'],
  observedAt: string = FIXTURE_OBSERVED_AT,
): ContinuityEventEnvelope {
  return composeContinuityEvent({
    eventId,
    kind,
    observedAt,
    institutionScope: FIXTURE_INSTITUTION_SCOPE,
    statement: `Deterministic event ${eventId}`,
  });
}

export const RUNTIME_BANDS: readonly ContinuityRuntimeBand[] = [
  'not_yet_readable',
  'holding',
  'stabilizing',
  'regressing',
];
