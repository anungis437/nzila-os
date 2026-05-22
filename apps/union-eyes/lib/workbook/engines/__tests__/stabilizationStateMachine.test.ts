import { describe, expect, it } from 'vitest';
import {
  ENGINE_VERSION,
  STABILIZATION_STATES,
  evaluateTransition,
  legalNextStates,
  type TransitionGateSnapshot,
} from '@/lib/workbook/engines/state/stabilizationStateMachine';
import { runStabilizationStateEngine } from '@/lib/workbook/engines/state/stabilizationStateEngine';
import { readProgression } from '@/lib/workbook/engines/state/stabilizationProgressionModel';

const FORBIDDEN =
  /\b(optimize|optimise|optimization|optimisation|productivity|autonomous|disrupt|automation|automate|ai-led|ai-driven|ai-powered|demo|modules available|all-in-one|frictionless|seamless|behavioural analytics|behavioral analytics|scoring|rip and replace)\b/i;
const BLAME = /why do you (not|fail to|never)/i;

const emptyGates: TransitionGateSnapshot = {};

describe('stabilizationStateMachine', () => {
  it('exposes engine version 2.0.0', () => {
    expect(ENGINE_VERSION).toBe('2.0.0');
  });

  it('enumerates exactly ten canonical states in lifecycle order', () => {
    expect(STABILIZATION_STATES.length).toBe(10);
    expect(STABILIZATION_STATES[0]).toBe('recognition');
    expect(STABILIZATION_STATES[9]).toBe('longitudinal_monitoring');
  });

  it('refuses self-transitions', () => {
    const ev = evaluateTransition('recognition', 'recognition', emptyGates);
    expect(ev.disposition).toBe('refused_illegal_edge');
  });

  it('refuses long-jump transitions not on a defined edge', () => {
    const ev = evaluateTransition('recognition', 'continuity_stabilized', emptyGates);
    expect(ev.disposition).toBe('refused_illegal_edge');
  });

  it('defers forward transitions when required gates are unmet', () => {
    const ev = evaluateTransition('recognition', 'mapping_complete', emptyGates);
    expect(ev.disposition).toBe('deferred');
    expect(ev.unmetGates).toContain('phase_ii_map_returned');
    expect(ev.unmetGates).toContain('readiness_reverified');
  });

  it('permits a forward transition when all required gates are met', () => {
    const ev = evaluateTransition('recognition', 'mapping_complete', {
      phaseIiMapReturned: true,
      readinessReverified: true,
    });
    expect(ev.disposition).toBe('permitted');
    expect(ev.unmetGates.length).toBe(0);
  });

  it('recognises regression with an explicit trigger and defers without one', () => {
    const withTrigger = evaluateTransition(
      'governance_recovery_active',
      'continuity_debt_elevated',
      { regressionTrigger: 'severity_worsened' },
    );
    expect(withTrigger.isRegression).toBe(true);
    expect(withTrigger.disposition).toBe('permitted');

    const noTrigger = evaluateTransition(
      'governance_recovery_active',
      'continuity_debt_elevated',
      {},
    );
    expect(noTrigger.isRegression).toBe(true);
    expect(noTrigger.disposition).toBe('deferred');
  });

  it('allows the three workflow-active states as legal next states from stabilization_initiated', () => {
    const { forward } = legalNextStates('stabilization_initiated');
    expect(forward).toContain('governance_recovery_active');
    expect(forward).toContain('stewardship_redistribution_active');
    expect(forward).toContain('onboarding_reinforcement_active');
  });

  it('treats longitudinal_monitoring as terminal (no forward edges)', () => {
    const { forward } = legalNextStates('longitudinal_monitoring');
    expect(forward.length).toBe(0);
  });
});

describe('stabilizationStateEngine (composition)', () => {
  it('emits a deferred progression signal when gates are unmet', () => {
    const out = runStabilizationStateEngine({
      declaredState: 'recognition',
      activeStateSet: [],
      gates: {},
    });
    const offer = out.signals.find(
      (s) =>
        s.category === 'state_progression_offer' ||
        s.category === 'state_progression_deferred',
    );
    expect(offer).toBeDefined();
    expect(offer?.category).toBe('state_progression_deferred');
  });

  it('emits a progression offer when forward gates are met', () => {
    const out = runStabilizationStateEngine({
      declaredState: 'continuity_debt_elevated',
      activeStateSet: [],
      gates: {
        stabilizationMoveRatified: true,
        reversibilityDocumented: true,
      },
    });
    const permitted = out.signals.find(
      (s) => s.category === 'state_progression_offer',
    );
    expect(permitted).toBeDefined();
  });

  it('records workflow concurrency when more than one workflow-active state is active', () => {
    const out = runStabilizationStateEngine({
      declaredState: 'stewardship_redistribution_active',
      activeStateSet: [
        'governance_recovery_active',
        'stewardship_redistribution_active',
      ],
      gates: {},
    });
    expect(
      out.signals.some((s) => s.category === 'workflow_concurrency_recorded'),
    ).toBe(true);
  });

  it('emits no-progression-available at the terminal state', () => {
    const out = runStabilizationStateEngine({
      declaredState: 'longitudinal_monitoring',
      activeStateSet: [],
      gates: {},
    });
    expect(
      out.signals.some((s) => s.category === 'no_legal_progression_available'),
    ).toBe(true);
  });

  it('is deterministic', () => {
    const input = {
      declaredState: 'stabilization_initiated' as const,
      activeStateSet: [],
      gates: { governanceWorkflowEligible: true, readinessReverified: true },
    };
    expect(runStabilizationStateEngine(input)).toEqual(
      runStabilizationStateEngine(input),
    );
  });

  it('uses tone free of forbidden vocabulary and blame framing', () => {
    const out = runStabilizationStateEngine({
      declaredState: 'governance_recovery_active',
      activeStateSet: ['governance_recovery_active'],
      gates: { regressionTrigger: 'consent_withdrawn' },
    });
    const text = [out.preview, ...out.signals.map((s) => s.statement)]
      .join(' ')
      .replace(/anti-surveillance/g, '');
    expect(text).not.toMatch(FORBIDDEN);
    expect(text).not.toMatch(BLAME);
  });
});

describe('stabilizationProgressionModel', () => {
  it('reads regression when the recent regression flag is set', () => {
    const r = readProgression({
      declaredState: 'continuity_debt_elevated',
      previousDeclaredState: 'stabilization_initiated',
      recentRegressionRecorded: true,
      hasMeasuredImprovementSincePrevious: false,
    });
    expect(r.direction).toBe('regressing');
    expect(r.band).toBe('continuity_debt_phase');
  });

  it('reads advancing when ordinal increased without regression', () => {
    const r = readProgression({
      declaredState: 'stabilization_initiated',
      previousDeclaredState: 'continuity_debt_elevated',
      recentRegressionRecorded: false,
      hasMeasuredImprovementSincePrevious: false,
    });
    expect(r.direction).toBe('advancing');
  });

  it('reads holding when state is unchanged with no improvement signal', () => {
    const r = readProgression({
      declaredState: 'continuity_debt_elevated',
      previousDeclaredState: 'continuity_debt_elevated',
      recentRegressionRecorded: false,
      hasMeasuredImprovementSincePrevious: false,
    });
    expect(r.direction).toBe('holding');
  });
});
