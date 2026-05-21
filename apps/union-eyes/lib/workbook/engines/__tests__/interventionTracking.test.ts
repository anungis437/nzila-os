import { describe, expect, it } from 'vitest';
import {
  ENGINE_VERSION,
  evaluateInterventionTransition,
  isActive,
  isTerminal,
  legalTransitionsFrom,
} from '@/lib/workbook/engines/tracking/interventionLifecycle';
import {
  deriveLedger,
  type InterventionLedgerInput,
} from '@/lib/workbook/engines/tracking/interventionLedger';
import {
  DEFAULT_TRACKING_THRESHOLDS,
  runInterventionTrackingEngine,
} from '@/lib/workbook/engines/tracking/interventionTrackingEngine';

const FORBIDDEN =
  /\b(optimize|optimise|optimization|optimisation|productivity|autonomous|disrupt|automation|automate|ai-led|ai-driven|ai-powered|demo|modules available|all-in-one|frictionless|seamless|behavioural analytics|behavioral analytics|scoring|rip and replace)\b/i;
const BLAME = /why do you (not|fail to|never)/i;

describe('interventionLifecycle', () => {
  it('exposes engine version 2.0.0', () => {
    expect(ENGINE_VERSION).toBe('2.0.0');
  });

  it('permits proposed → ratified via ratified_by_governance', () => {
    const ev = evaluateInterventionTransition('proposed', 'ratified', 'ratified_by_governance');
    expect(ev.disposition).toBe('permitted');
  });

  it('refuses proposed → irreversibly_ratified (reversibility cannot be skipped)', () => {
    const ev = evaluateInterventionTransition(
      'proposed',
      'irreversibly_ratified',
      'irreversibly_ratified_by_governance',
    );
    expect(ev.disposition).toBe('refused_illegal_edge');
  });

  it('classifies active and terminal statuses correctly', () => {
    expect(isActive('proposed')).toBe(true);
    expect(isActive('in_reversible_execution')).toBe(true);
    expect(isTerminal('irreversibly_ratified')).toBe(true);
    expect(isTerminal('regressed')).toBe(true);
    expect(isTerminal('withdrawn')).toBe(true);
    expect(isActive('withdrawn')).toBe(false);
  });

  it('enumerates legal transitions from awaiting_irreversible_ratification', () => {
    const next = legalTransitionsFrom('awaiting_irreversible_ratification').map((e) => e.to);
    expect(next).toContain('irreversibly_ratified');
    expect(next).toContain('regressed');
    expect(next).not.toContain('proposed');
  });
});

describe('deriveLedger', () => {
  it('derives current status from a clean event stream', () => {
    const input: InterventionLedgerInput = {
      definitions: [
        {
          interventionId: 'iv1',
          workflow: 'stewardship_redistribution',
          subjectSummary: 'Redistribute compensation review',
          proposedAtClockTick: 1,
        },
      ],
      events: [
        {
          eventId: 'e1',
          interventionId: 'iv1',
          from: null,
          to: 'proposed',
          producingAction: 'initial_proposal',
          recordedAtClockTick: 1,
        },
        {
          eventId: 'e2',
          interventionId: 'iv1',
          from: 'proposed',
          to: 'ratified',
          producingAction: 'ratified_by_governance',
          recordedAtClockTick: 2,
        },
      ],
    };
    const out = deriveLedger(input);
    expect(out.perIntervention[0].currentStatus).toBe('ratified');
    expect(out.activeIds).toEqual(['iv1']);
    expect(out.rejections.length).toBe(0);
  });

  it('rejects illegal transition events without mutating prior status', () => {
    const input: InterventionLedgerInput = {
      definitions: [
        {
          interventionId: 'iv1',
          workflow: 'governance_clarification',
          subjectSummary: 'Clarify mandate scope',
          proposedAtClockTick: 1,
        },
      ],
      events: [
        {
          eventId: 'e1',
          interventionId: 'iv1',
          from: null,
          to: 'proposed',
          producingAction: 'initial_proposal',
          recordedAtClockTick: 1,
        },
        {
          eventId: 'e2',
          interventionId: 'iv1',
          from: 'proposed',
          to: 'irreversibly_ratified',
          producingAction: 'irreversibly_ratified_by_governance',
          recordedAtClockTick: 2,
        },
      ],
    };
    const out = deriveLedger(input);
    expect(out.perIntervention[0].currentStatus).toBe('proposed');
    expect(out.rejections[0].reason).toBe('illegal_transition');
  });

  it('rejects events with missing definitions and out-of-order ticks', () => {
    const input: InterventionLedgerInput = {
      definitions: [
        {
          interventionId: 'iv1',
          workflow: 'continuity_capture',
          subjectSummary: 'Capture lapsed precedent',
          proposedAtClockTick: 1,
        },
      ],
      events: [
        {
          eventId: 'e_missing',
          interventionId: 'iv_unknown',
          from: null,
          to: 'proposed',
          producingAction: 'initial_proposal',
          recordedAtClockTick: 1,
        },
        {
          eventId: 'e1',
          interventionId: 'iv1',
          from: null,
          to: 'proposed',
          producingAction: 'initial_proposal',
          recordedAtClockTick: 5,
        },
      ],
    };
    const out = deriveLedger(input);
    expect(out.rejections.some((r) => r.reason === 'definition_missing')).toBe(true);
  });

  it('is deterministic regardless of input event order', () => {
    const a: InterventionLedgerInput = {
      definitions: [
        {
          interventionId: 'iv1',
          workflow: 'onboarding_stabilization',
          subjectSummary: 'Onboard new chief steward',
          proposedAtClockTick: 1,
        },
      ],
      events: [
        {
          eventId: 'e2',
          interventionId: 'iv1',
          from: 'proposed',
          to: 'ratified',
          producingAction: 'ratified_by_governance',
          recordedAtClockTick: 2,
        },
        {
          eventId: 'e1',
          interventionId: 'iv1',
          from: null,
          to: 'proposed',
          producingAction: 'initial_proposal',
          recordedAtClockTick: 1,
        },
      ],
    };
    const b: InterventionLedgerInput = { ...a, events: a.events.slice().reverse() };
    expect(deriveLedger(a)).toEqual(deriveLedger(b));
  });
});

describe('runInterventionTrackingEngine (composition)', () => {
  it('emits awaiting_ratification when an intervention has aged past threshold', () => {
    const out = runInterventionTrackingEngine({
      currentClockTick: 100,
      declaredState: 'stabilization_initiated',
      ledger: {
        definitions: [
          {
            interventionId: 'iv1',
            workflow: 'governance_clarification',
            subjectSummary: 'Clarify bargaining mandate',
            proposedAtClockTick: 1,
          },
        ],
        events: [
          {
            eventId: 'e1',
            interventionId: 'iv1',
            from: null,
            to: 'proposed',
            producingAction: 'initial_proposal',
            recordedAtClockTick: 1,
          },
        ],
      },
    });
    expect(
      out.signals.some((s) => s.category === 'intervention_awaiting_ratification'),
    ).toBe(true);
  });

  it('emits critical regressed_without_recovery signal when ids are supplied', () => {
    const out = runInterventionTrackingEngine({
      currentClockTick: 10,
      declaredState: 'continuity_debt_elevated',
      ledger: { definitions: [], events: [] },
      regressedWithoutRecoveryIds: ['iv_old_1', 'iv_old_2'],
    });
    const regressionSignals = out.signals.filter(
      (s) => s.category === 'intervention_regressed_without_recovery',
    );
    expect(regressionSignals.length).toBe(2);
    expect(regressionSignals.every((s) => s.severity === 'critical')).toBe(true);
  });

  it('always emits active count by workflow and terminal distribution', () => {
    const out = runInterventionTrackingEngine({
      currentClockTick: 5,
      declaredState: 'mapping_complete',
      ledger: { definitions: [], events: [] },
    });
    expect(out.signals.some((s) => s.category === 'active_intervention_count_by_workflow')).toBe(true);
    expect(out.signals.some((s) => s.category === 'terminal_intervention_distribution')).toBe(true);
  });

  it('is deterministic', () => {
    const input = {
      currentClockTick: 30,
      declaredState: 'stewardship_redistribution_active' as const,
      ledger: {
        definitions: [
          {
            interventionId: 'iv1',
            workflow: 'stewardship_redistribution' as const,
            subjectSummary: 's',
            proposedAtClockTick: 1,
          },
        ],
        events: [
          {
            eventId: 'e1',
            interventionId: 'iv1',
            from: null,
            to: 'proposed' as const,
            producingAction: 'initial_proposal' as const,
            recordedAtClockTick: 1,
          },
        ],
      },
      thresholds: DEFAULT_TRACKING_THRESHOLDS,
    };
    expect(runInterventionTrackingEngine(input)).toEqual(
      runInterventionTrackingEngine(input),
    );
  });

  it('uses tone free of forbidden vocabulary and blame framing', () => {
    const out = runInterventionTrackingEngine({
      currentClockTick: 100,
      declaredState: 'governance_recovery_active',
      ledger: {
        definitions: [
          {
            interventionId: 'iv1',
            workflow: 'governance_clarification',
            subjectSummary: 'Clarify compensation governance',
            proposedAtClockTick: 1,
          },
        ],
        events: [
          {
            eventId: 'e1',
            interventionId: 'iv1',
            from: null,
            to: 'proposed',
            producingAction: 'initial_proposal',
            recordedAtClockTick: 1,
          },
        ],
      },
      regressedWithoutRecoveryIds: ['iv_old'],
    });
    const text = [out.preview, ...out.signals.map((s) => s.statement)]
      .join(' ')
      .replace(/anti-surveillance/g, '');
    expect(text).not.toMatch(FORBIDDEN);
    expect(text).not.toMatch(BLAME);
  });
});
