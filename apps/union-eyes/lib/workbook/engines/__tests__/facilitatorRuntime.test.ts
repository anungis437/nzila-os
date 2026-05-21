import { describe, expect, it } from 'vitest';
import {
  runFacilitatorRuntime,
  type FacilitatorRuntimeInput,
} from '@/lib/workbook/engines/facilitator/facilitatorRuntime';

const FORBIDDEN =
  /\b(optimize|optimise|optimization|optimisation|productivity|autonomous|disrupt|automation|automate|ai-led|ai-driven|ai-powered|demo|modules available|all-in-one|frictionless|seamless|behavioural analytics|behavioral analytics|scoring|rip and replace)\b/i;
const BLAME = /why do you (not|fail to|never)/i;
// Disallow person-identifying surface forms in any facilitator output.
const PERSON_REF = /\b(Mr|Ms|Mrs|Dr|Sir|Madam)\.\s+[A-Z]/;
const DEFENSIVENESS_PERSON = /\b(defensiveness|defensive)\b/i;

const baseInput: FacilitatorRuntimeInput = {
  pacing: {
    recentRatifiedCount: 0,
    recentRegressedCount: 0,
    activeInterventionCount: 0,
  },
  sensitivity: {
    currentState: null,
    progressionBand: 'not_yet_readable',
    hasRegressedWithoutRecovery: false,
  },
  readiness: {
    governanceRatificationCapacityPresent: true,
    carrierConsentCaptureMechanismAvailable: true,
    noActiveInterventionHasExhaustedReversibilityWindow: true,
    workbookCompletionThresholdMet: true,
  },
};

describe('runFacilitatorRuntime — pacing', () => {
  it('recommends hold when there is no recent activity', () => {
    const r = runFacilitatorRuntime(baseInput);
    expect(r.pacing.pacing).toBe('hold');
  });

  it('recommends advance after ratifications without regression', () => {
    const r = runFacilitatorRuntime({
      ...baseInput,
      pacing: { recentRatifiedCount: 2, recentRegressedCount: 0, activeInterventionCount: 1 },
    });
    expect(r.pacing.pacing).toBe('advance');
  });

  it('recommends defer after regression with no recovery ratification', () => {
    const r = runFacilitatorRuntime({
      ...baseInput,
      pacing: { recentRatifiedCount: 0, recentRegressedCount: 2, activeInterventionCount: 1 },
    });
    expect(r.pacing.pacing).toBe('defer');
    const deferSignal = r.signals.find((s) => s.category === 'facilitator_pacing_recommendation');
    expect(deferSignal?.severity).toBe('warning');
  });

  it('engages overload protection and slows pacing past bandwidth', () => {
    const r = runFacilitatorRuntime({
      ...baseInput,
      pacing: { recentRatifiedCount: 3, recentRegressedCount: 0, activeInterventionCount: 9, bandwidthThreshold: 6 },
    });
    expect(r.pacing.overloadEngaged).toBe(true);
    expect(r.pacing.pacing).toBe('slow');
    expect(r.signals.find((s) => s.category === 'facilitator_overload_protection_engaged')).toBeDefined();
  });
});

describe('runFacilitatorRuntime — sensitivity', () => {
  it('reports high sensitivity on elevated state plus regressing band', () => {
    const r = runFacilitatorRuntime({
      ...baseInput,
      sensitivity: {
        currentState: 'continuity_debt_elevated',
        progressionBand: 'regressing',
        hasRegressedWithoutRecovery: false,
      },
    });
    expect(r.sensitivity.register).toBe('high');
  });

  it('reports none when state is calm and band is holding', () => {
    const r = runFacilitatorRuntime({
      ...baseInput,
      sensitivity: {
        currentState: 'continuity_stabilized',
        progressionBand: 'holding',
        hasRegressedWithoutRecovery: false,
      },
    });
    expect(r.sensitivity.register).toBe('none');
  });
});

describe('runFacilitatorRuntime — readiness', () => {
  it('emits readiness_insufficient signal and names unmet conditions', () => {
    const r = runFacilitatorRuntime({
      ...baseInput,
      readiness: {
        governanceRatificationCapacityPresent: false,
        carrierConsentCaptureMechanismAvailable: true,
        noActiveInterventionHasExhaustedReversibilityWindow: false,
        workbookCompletionThresholdMet: true,
      },
    });
    expect(r.readiness.sufficient).toBe(false);
    const sig = r.signals.find((s) => s.category === 'facilitator_readiness_insufficient');
    expect(sig).toBeDefined();
    expect(sig?.evidence).toMatchObject({
      unmet: expect.arrayContaining([
        'governance_ratification_capacity_present',
        'no_active_intervention_has_exhausted_reversibility_window',
      ]),
    });
  });

  it('does not emit readiness_insufficient when all conditions are met', () => {
    const r = runFacilitatorRuntime(baseInput);
    expect(r.signals.find((s) => s.category === 'facilitator_readiness_insufficient')).toBeUndefined();
  });
});

describe('runFacilitatorRuntime — anti-surveillance discipline', () => {
  it('never names any individual carrier in any signal statement', () => {
    const inputs: FacilitatorRuntimeInput[] = [
      baseInput,
      {
        ...baseInput,
        pacing: { recentRatifiedCount: 0, recentRegressedCount: 3, activeInterventionCount: 1 },
        sensitivity: {
          currentState: 'continuity_debt_elevated',
          progressionBand: 'regressing',
          hasRegressedWithoutRecovery: true,
        },
        readiness: {
          governanceRatificationCapacityPresent: false,
          carrierConsentCaptureMechanismAvailable: false,
          noActiveInterventionHasExhaustedReversibilityWindow: false,
          workbookCompletionThresholdMet: false,
        },
      },
    ];
    for (const i of inputs) {
      const text = runFacilitatorRuntime(i)
        .signals.map((s) => s.statement)
        .join(' ');
      expect(text).not.toMatch(PERSON_REF);
      expect(text).not.toMatch(DEFENSIVENESS_PERSON);
    }
  });

  it('uses tone free of forbidden vocabulary and blame framing', () => {
    const r = runFacilitatorRuntime({
      ...baseInput,
      pacing: { recentRatifiedCount: 1, recentRegressedCount: 1, activeInterventionCount: 3 },
      sensitivity: {
        currentState: 'governance_recovery_active',
        progressionBand: 'regressing',
        hasRegressedWithoutRecovery: false,
      },
    });
    const text = r.signals.map((s) => s.statement).join(' ');
    expect(text).not.toMatch(FORBIDDEN);
    expect(text).not.toMatch(BLAME);
  });

  it('is deterministic across repeated runs', () => {
    const a = runFacilitatorRuntime(baseInput);
    const b = runFacilitatorRuntime(baseInput);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('returns signals in stable signalId order', () => {
    const r = runFacilitatorRuntime({
      ...baseInput,
      pacing: { recentRatifiedCount: 3, recentRegressedCount: 0, activeInterventionCount: 9, bandwidthThreshold: 6 },
      readiness: {
        governanceRatificationCapacityPresent: false,
        carrierConsentCaptureMechanismAvailable: true,
        noActiveInterventionHasExhaustedReversibilityWindow: true,
        workbookCompletionThresholdMet: true,
      },
    });
    const ids = r.signals.map((s) => s.signalId);
    expect([...ids].sort()).toEqual(ids);
  });
});
