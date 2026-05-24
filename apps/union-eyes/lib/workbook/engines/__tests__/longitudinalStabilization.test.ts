import { describe, expect, it } from 'vitest';
import {
  runLongitudinalStabilizationRuntime,
  type LongitudinalRuntimeInput,
} from '@/lib/workbook/engines/longitudinal/longitudinalStabilizationRuntime';
import { readStabilizationTrajectory } from '@/lib/workbook/engines/longitudinal/stabilizationTrajectoryEngine';

const FORBIDDEN =
  /\b(optimize|optimise|optimization|optimisation|productivity|autonomous|disrupt|automation|automate|ai-led|ai-driven|ai-powered|demo|modules available|all-in-one|frictionless|seamless|behavioural analytics|behavioral analytics|scoring|rip and replace)\b/i;
const BLAME = /why do you (not|fail to|never)/i;

const baseInput: LongitudinalRuntimeInput = {
  evolution: {
    engineVersion: '2.0.0',
    direction: 'advancing',
    posture: 'continuous',
    continuityRate: 0.95,
    reading: 'Institutional evolution is continuous.',
  },
  maturity: {
    engineVersion: '2.0.0',
    currentStage: 'stabilization_underway',
    nextStage: 'infrastructure_underway',
    atTerminalStage: false,
    reading: 'Maturity placement is at stabilization underway.',
  },
  ledger: {
    totalInterventionEvents: 10,
    distinctWorkflowParticipations: 6,
    irreversiblyRatifiedCount: 6,
    regressedCount: 0,
  },
};

describe('runLongitudinalStabilizationRuntime', () => {
  it('reports k-floor met when ledger has enough events and workflow distinctness', () => {
    const r = runLongitudinalStabilizationRuntime(baseInput);
    expect(r.kFloorMet).toBe(true);
    expect(r.contributingInputs.length).toBe(3);
    expect(r.ledgerDirection).toBe('improving');
  });

  it('withholds the envelope when k-floor is not met', () => {
    const r = runLongitudinalStabilizationRuntime({
      ...baseInput,
      ledger: {
        totalInterventionEvents: 2,
        distinctWorkflowParticipations: 1,
        irreversiblyRatifiedCount: 1,
        regressedCount: 0,
      },
    });
    expect(r.kFloorMet).toBe(false);
    expect(r.statement).toMatch(/k-anonymity floor/);
  });

  it('classifies ledger as regressing when regressions outnumber ratifications', () => {
    const r = runLongitudinalStabilizationRuntime({
      ...baseInput,
      ledger: {
        totalInterventionEvents: 10,
        distinctWorkflowParticipations: 6,
        irreversiblyRatifiedCount: 2,
        regressedCount: 5,
      },
    });
    expect(r.ledgerDirection).toBe('regressing');
  });

  it('is deterministic across repeated runs', () => {
    const a = runLongitudinalStabilizationRuntime(baseInput);
    const b = runLongitudinalStabilizationRuntime(baseInput);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('uses tone free of forbidden vocabulary and blame framing', () => {
    const r = runLongitudinalStabilizationRuntime(baseInput);
    expect(r.statement).not.toMatch(FORBIDDEN);
    expect(r.statement).not.toMatch(BLAME);
  });
});

describe('readStabilizationTrajectory', () => {
  it('returns not_yet_readable when k-floor is not met', () => {
    const env = runLongitudinalStabilizationRuntime({
      ...baseInput,
      ledger: { totalInterventionEvents: 2, distinctWorkflowParticipations: 1, irreversiblyRatifiedCount: 1, regressedCount: 0 },
    });
    const r = readStabilizationTrajectory(env);
    expect(r.trajectory).toBe('not_yet_readable');
  });

  it('returns improving when evolution and ledger both advance', () => {
    const env = runLongitudinalStabilizationRuntime(baseInput);
    const r = readStabilizationTrajectory(env);
    expect(r.trajectory).toBe('improving');
  });

  it('returns regressing when any input regresses', () => {
    const env = runLongitudinalStabilizationRuntime({
      ...baseInput,
      ledger: {
        totalInterventionEvents: 10,
        distinctWorkflowParticipations: 6,
        irreversiblyRatifiedCount: 2,
        regressedCount: 5,
      },
    });
    const r = readStabilizationTrajectory(env);
    expect(r.trajectory).toBe('regressing');
  });

  it('uses tone free of forbidden vocabulary and blame framing', () => {
    const env = runLongitudinalStabilizationRuntime(baseInput);
    const r = readStabilizationTrajectory(env);
    expect(r.statement).not.toMatch(FORBIDDEN);
    expect(r.statement).not.toMatch(BLAME);
  });
});
