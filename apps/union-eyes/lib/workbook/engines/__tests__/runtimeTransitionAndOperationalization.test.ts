import { describe, expect, it } from 'vitest';
import {
  runRuntimeTransitionEngine,
  type RuntimeTransitionInput,
} from '@/lib/workbook/engines/transition/runtimeTransitionEngine';
import {
  runContinuityOperationalization,
  type OperationalizationInput,
} from '@/lib/workbook/engines/operationalization/continuityOperationalization';
import { listOperationalContinuityHooks } from '@/lib/workbook/engines/operationalization/operationalContinuityHooks';

const FORBIDDEN =
  /\b(optimize|optimise|optimization|optimisation|productivity|autonomous|disrupt|automation|automate|ai-led|ai-driven|ai-powered|demo|modules available|all-in-one|frictionless|seamless|behavioural analytics|behavioral analytics|scoring|rip and replace)\b/i;
const BLAME = /why do you (not|fail to|never)/i;

const baseTransitionInput: RuntimeTransitionInput = {
  currentState: 'continuity_stabilized',
  progressionBand: 'advancing',
  anyActiveInterventionReversibilityExhausted: false,
  readiness: {
    engineVersion: '2.0.0',
    sufficient: true,
    unmet: [],
    statement: 'All four institutional readiness conditions are present.',
  },
  transitionSpecific: {
    hasIrreversiblyRatifiedRedistribution: true,
    compositeHealthBand: 'stabilizing',
    evolutionDirection: 'advancing',
    hasRatifiedGovernanceRecoveryMove: true,
    facilitatorSensitivityRegister: 'elevated',
  },
};

describe('runRuntimeTransitionEngine', () => {
  it('offers all five transitions when every gate passes', () => {
    const r = runRuntimeTransitionEngine(baseTransitionInput);
    expect(r.offeredCount).toBe(5);
    expect(r.refusedCount).toBe(0);
  });

  it('refuses all transitions when state is not stabilized', () => {
    const r = runRuntimeTransitionEngine({ ...baseTransitionInput, currentState: 'stabilization_initiated' });
    expect(r.offeredCount).toBe(0);
    expect(r.refusedCount).toBe(5);
    expect(r.evaluations.every((e) => e.failedGates.includes('state_not_stabilized'))).toBe(true);
  });

  it('refuses transitions when progression is regressing', () => {
    const r = runRuntimeTransitionEngine({ ...baseTransitionInput, progressionBand: 'regressing' });
    expect(r.evaluations.every((e) => e.failedGates.includes('progression_is_regressing'))).toBe(true);
  });

  it('refuses transitions when readiness is insufficient', () => {
    const r = runRuntimeTransitionEngine({
      ...baseTransitionInput,
      readiness: {
        engineVersion: '2.0.0',
        sufficient: false,
        unmet: ['governance_ratification_capacity_present'],
        statement: 'Readiness is insufficient.',
      },
    });
    expect(r.evaluations.every((e) => e.failedGates.includes('readiness_insufficient'))).toBe(true);
  });

  it('refuses commercial pilot transition without an irreversibly ratified redistribution', () => {
    const r = runRuntimeTransitionEngine({
      ...baseTransitionInput,
      transitionSpecific: { ...baseTransitionInput.transitionSpecific, hasIrreversiblyRatifiedRedistribution: false },
    });
    const pilot = r.evaluations.find((e) => e.transition === 'stabilization_to_commercial_pilot');
    expect(pilot?.disposition).toBe('refused');
    expect(pilot?.failedGates).toContain('transition_specific_gate_failed');
  });

  it('uses tone free of forbidden vocabulary and blame framing', () => {
    const r = runRuntimeTransitionEngine({ ...baseTransitionInput, progressionBand: 'regressing' });
    const text = r.evaluations.map((e) => e.statement).join(' ');
    expect(text).not.toMatch(FORBIDDEN);
    expect(text).not.toMatch(BLAME);
  });
});

const baseOpsInput: OperationalizationInput = {
  readiness: {
    engineVersion: '2.0.0',
    sufficient: true,
    unmet: [],
    statement: 'All four institutional readiness conditions are present.',
  },
  governanceCycleObserved: false,
  onboardingIntakeObserved: false,
  carrierChangeObserved: false,
  reversibilityWindowEndObserved: false,
  executiveReportingCycleObserved: false,
  longitudinalReadingCycleObserved: false,
};

describe('runContinuityOperationalization', () => {
  it('produces one reading per domain', () => {
    const r = runContinuityOperationalization(baseOpsInput);
    expect(r.perDomain.length).toBe(6);
  });

  it('all hooks are inert (deferred_readiness_insufficient) when readiness is insufficient', () => {
    const r = runContinuityOperationalization({
      ...baseOpsInput,
      readiness: {
        engineVersion: '2.0.0',
        sufficient: false,
        unmet: ['workbook_completion_threshold_met'],
        statement: 'Readiness is insufficient.',
      },
      governanceCycleObserved: true,
      onboardingIntakeObserved: true,
      executiveReportingCycleObserved: true,
    });
    expect(r.perDomain.every((d) => d.band === 'deferred_readiness_insufficient')).toBe(true);
  });

  it('marks observed domains as observed and unobserved as not_yet_readable when readiness sufficient', () => {
    const r = runContinuityOperationalization({
      ...baseOpsInput,
      governanceCycleObserved: true,
      executiveReportingCycleObserved: true,
    });
    const gov = r.perDomain.find((d) => d.domain === 'governance_ratification_cycle');
    const onb = r.perDomain.find((d) => d.domain === 'onboarding_intake_rhythm');
    expect(gov?.band).toBe('observed');
    expect(onb?.band).toBe('not_yet_readable');
  });

  it('uses tone free of forbidden vocabulary', () => {
    const r = runContinuityOperationalization(baseOpsInput);
    const text = r.perDomain.map((d) => d.statement).join(' ');
    expect(text).not.toMatch(FORBIDDEN);
    expect(text).not.toMatch(BLAME);
  });
});

describe('listOperationalContinuityHooks', () => {
  it('returns six declarative hooks with stable attachment points', () => {
    const hooks = listOperationalContinuityHooks();
    expect(hooks.length).toBe(6);
    const keys = hooks.map((h) => h.key);
    expect(new Set(keys).size).toBe(6);
    for (const h of hooks) {
      expect(h.attachmentPoint.length).toBeGreaterThan(0);
      expect(h.intent.length).toBeGreaterThan(0);
    }
  });
});
