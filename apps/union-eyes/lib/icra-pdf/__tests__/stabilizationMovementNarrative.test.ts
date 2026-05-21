import { describe, expect, it } from 'vitest';
import {
  buildStabilizationMovementNarrative,
  buildContinuityDebtReductionNarrative,
  buildGovernanceRecoveryTrajectoryNarrative,
  buildOnboardingSurvivabilityNarrative,
  buildStewardshipRedistributionEvolutionNarrative,
} from '../reportNarrativeEngine';
import type {
  ExecutiveDomainBand,
  ExecutiveDomainId,
  ExecutiveStabilizationResult,
} from '../../workbook/engines/executive/executiveStabilizationModel';

const FORBIDDEN =
  /\b(optimize|optimise|optimization|optimisation|productivity|autonomous|disrupt|automation|automate|ai-led|ai-driven|ai-powered|demo|modules available|all-in-one|frictionless|seamless|behavioural analytics|behavioral analytics|scoring|rip and replace)\b/i;
const BLAME = /why do you (not|fail to|never)/i;

function makeResult(overrides: Partial<Record<ExecutiveDomainId, ExecutiveDomainBand>> = {}, composite: ExecutiveDomainBand = 'stabilizing'): ExecutiveStabilizationResult {
  const defaults: Record<ExecutiveDomainId, ExecutiveDomainBand> = {
    stabilization_state: 'stabilizing',
    progression_direction: 'stabilizing',
    maturity_placement: 'stabilizing',
    intervention_ledger_health: 'stabilizing',
    stewardship_redistribution: 'stabilizing',
    governance_recovery: 'stabilizing',
    onboarding_survivability: 'stabilizing',
    continuity_operational_health: composite,
  };
  const merged: Record<ExecutiveDomainId, ExecutiveDomainBand> = { ...defaults, ...overrides };
  return {
    engineVersion: '2.0.0',
    compositeBand: composite,
    reading: 'composite reading',
    domains: (Object.keys(merged) as ExecutiveDomainId[]).map((domain) => ({
      domain,
      band: merged[domain],
      statement: 'observation',
      evidence: {},
    })),
  };
}

describe('Stabilization Movement appendix builders', () => {
  it('builds a composite stabilization movement paragraph that reflects the composite band', () => {
    const stable = buildStabilizationMovementNarrative(makeResult({}, 'stabilizing'));
    expect(stable.heading.length).toBeGreaterThan(0);
    expect(stable.body).toMatch(/stabilization/i);
    const regressing = buildStabilizationMovementNarrative(makeResult({}, 'regressing'));
    expect(regressing.body).toMatch(/away from stabilization/i);
  });

  it('reads continuity debt reduction from the intervention ledger band', () => {
    const p = buildContinuityDebtReductionNarrative(makeResult({ intervention_ledger_health: 'holding' }));
    expect(p.body).toMatch(/holding/i);
  });

  it('reads governance recovery trajectory and does not treat pending moves as recovery', () => {
    const p = buildGovernanceRecoveryTrajectoryNarrative(makeResult({ governance_recovery: 'not_yet_readable' }));
    expect(p.body).toMatch(/not yet readable/i);
    expect(p.body).toMatch(/pending/i);
  });

  it('reads onboarding survivability institutionally and never as an individual measurement', () => {
    const p = buildOnboardingSurvivabilityNarrative(makeResult({ onboarding_survivability: 'stabilizing' }));
    expect(p.body).toMatch(/institutional/i);
    expect(p.body).not.toMatch(/individual.{0,40}measurement/i);
  });

  it('reads stewardship redistribution evolution and frames refusals as evidence', () => {
    const p = buildStewardshipRedistributionEvolutionNarrative(makeResult({ stewardship_redistribution: 'regressing' }));
    expect(p.body).toMatch(/refusals|withdrawals/i);
  });

  it('every appendix paragraph respects tone discipline', () => {
    const r = makeResult();
    const all = [
      buildStabilizationMovementNarrative(r),
      buildContinuityDebtReductionNarrative(r),
      buildGovernanceRecoveryTrajectoryNarrative(r),
      buildOnboardingSurvivabilityNarrative(r),
      buildStewardshipRedistributionEvolutionNarrative(r),
    ];
    for (const p of all) {
      expect(p.heading).not.toMatch(FORBIDDEN);
      expect(p.heading).not.toMatch(BLAME);
      expect(p.body).not.toMatch(FORBIDDEN);
      expect(p.body).not.toMatch(BLAME);
    }
  });

  it('produces deterministic output for the same input', () => {
    const r = makeResult({ stewardship_redistribution: 'holding' });
    const a = buildStewardshipRedistributionEvolutionNarrative(r);
    const b = buildStewardshipRedistributionEvolutionNarrative(r);
    expect(a).toEqual(b);
  });
});
