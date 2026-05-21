import { describe, expect, it } from 'vitest';
import {
  ENGINE_VERSION,
  REQUIRED_RECIPROCITY_TERMS,
  evaluateReciprocityRatification,
} from '@/lib/workbook/engines/redistribution/reciprocityRatificationGate';
import {
  deriveCarrierConsentLedger,
  type CarrierConsentLedgerInput,
} from '@/lib/workbook/engines/redistribution/carrierConsentLedger';
import { readResidualConcentration } from '@/lib/workbook/engines/redistribution/residualConcentrationReader';
import { runRedistributionExecutionEngine } from '@/lib/workbook/engines/redistribution/redistributionExecutionEngine';

const FORBIDDEN =
  /\b(optimize|optimise|optimization|optimisation|productivity|autonomous|disrupt|automation|automate|ai-led|ai-driven|ai-powered|demo|modules available|all-in-one|frictionless|seamless|behavioural analytics|behavioral analytics|scoring|rip and replace)\b/i;
const BLAME = /why do you (not|fail to|never)/i;

describe('reciprocityRatificationGate', () => {
  it('exposes engine version 2.0.0', () => {
    expect(ENGINE_VERSION).toBe('2.0.0');
  });

  it('refuses when any required term is missing', () => {
    const out = evaluateReciprocityRatification({ ratifiedTerms: [] });
    expect(out.disposition).toBe('refused');
    expect(out.missingTerms.length).toBe(REQUIRED_RECIPROCITY_TERMS.length);
    expect(out.signals.some((s) => s.severity === 'critical')).toBe(true);
  });

  it('permits when all required terms are ratified', () => {
    const out = evaluateReciprocityRatification({
      ratifiedTerms: [...REQUIRED_RECIPROCITY_TERMS],
    });
    expect(out.disposition).toBe('permitted');
    expect(out.missingTerms.length).toBe(0);
  });

  it('flags unrecognised term keys without changing disposition', () => {
    const out = evaluateReciprocityRatification({
      ratifiedTerms: [...REQUIRED_RECIPROCITY_TERMS, 'foo_bar' as never],
    });
    expect(out.disposition).toBe('permitted');
    expect(out.unrecognisedTerms).toContain('foo_bar');
  });
});

describe('carrierConsentLedger', () => {
  it('records carrier consent flow and honours withdrawal', () => {
    const input: CarrierConsentLedgerInput = {
      candidates: [
        { carrierId: 'c1', subjectSummary: 's', proposedAtClockTick: 1 },
      ],
      events: [
        {
          eventId: 'e1',
          carrierId: 'c1',
          from: null,
          to: 'proposed',
          producingAction: 'proposed_by_facilitator',
          recordedAtClockTick: 1,
        },
        {
          eventId: 'e2',
          carrierId: 'c1',
          from: 'proposed',
          to: 'consented',
          producingAction: 'consented_by_carrier',
          recordedAtClockTick: 2,
        },
        {
          eventId: 'e3',
          carrierId: 'c1',
          from: 'consented',
          to: 'withdrawn',
          producingAction: 'withdrawn_by_carrier',
          recordedAtClockTick: 3,
        },
      ],
    };
    const out = deriveCarrierConsentLedger(input);
    expect(out.perCandidate[0].currentStatus).toBe('withdrawn');
    expect(out.perCandidate[0].hasBeenWithdrawn).toBe(true);
    expect(out.withdrawnIds).toEqual(['c1']);
  });

  it('rejects illegal direct proposed → withdrawn transition', () => {
    const input: CarrierConsentLedgerInput = {
      candidates: [{ carrierId: 'c1', subjectSummary: 's', proposedAtClockTick: 1 }],
      events: [
        {
          eventId: 'e1',
          carrierId: 'c1',
          from: null,
          to: 'proposed',
          producingAction: 'proposed_by_facilitator',
          recordedAtClockTick: 1,
        },
        {
          eventId: 'e2',
          carrierId: 'c1',
          from: 'proposed',
          to: 'withdrawn',
          producingAction: 'withdrawn_by_carrier',
          recordedAtClockTick: 2,
        },
      ],
    };
    const out = deriveCarrierConsentLedger(input);
    expect(out.rejections[0].reason).toBe('illegal_transition');
    expect(out.perCandidate[0].currentStatus).toBe('proposed');
  });

  it('is deterministic across input event ordering', () => {
    const a: CarrierConsentLedgerInput = {
      candidates: [{ carrierId: 'c1', subjectSummary: 's', proposedAtClockTick: 1 }],
      events: [
        {
          eventId: 'e2',
          carrierId: 'c1',
          from: 'proposed',
          to: 'consented',
          producingAction: 'consented_by_carrier',
          recordedAtClockTick: 2,
        },
        {
          eventId: 'e1',
          carrierId: 'c1',
          from: null,
          to: 'proposed',
          producingAction: 'proposed_by_facilitator',
          recordedAtClockTick: 1,
        },
      ],
    };
    const b = { ...a, events: a.events.slice().reverse() };
    expect(deriveCarrierConsentLedger(a)).toEqual(deriveCarrierConsentLedger(b));
  });
});

describe('residualConcentrationReader', () => {
  it('reads "relieved" when a sole carrier is broadened', () => {
    const out = readResidualConcentration({
      pre: [{ processId: 'p1', carrierCount: 1 }],
      post: [{ processId: 'p1', carrierCount: 3 }],
    });
    expect(out.perProcess[0].reading).toBe('relieved');
    expect(out.overall).toBe('relieved');
  });

  it('reads "unchanged" when carrier counts are identical', () => {
    const out = readResidualConcentration({
      pre: [{ processId: 'p1', carrierCount: 2 }],
      post: [{ processId: 'p1', carrierCount: 2 }],
    });
    expect(out.overall).toBe('unchanged');
  });

  it('reads "worsened" if a process was lost entirely', () => {
    const out = readResidualConcentration({
      pre: [{ processId: 'p1', carrierCount: 2 }],
      post: [],
    });
    expect(out.overall).toBe('worsened');
  });

  it('reads "partially_relieved" on mixed outcomes', () => {
    const out = readResidualConcentration({
      pre: [
        { processId: 'p1', carrierCount: 1 },
        { processId: 'p2', carrierCount: 2 },
      ],
      post: [
        { processId: 'p1', carrierCount: 3 },
        { processId: 'p2', carrierCount: 2 },
      ],
    });
    expect(out.overall).toBe('partially_relieved');
  });
});

describe('runRedistributionExecutionEngine', () => {
  it('refuses when reciprocity is incomplete', () => {
    const out = runRedistributionExecutionEngine({
      reciprocity: { ratifiedTerms: [] },
      consentLedger: { candidates: [], events: [] },
      residual: { pre: [], post: [] },
    });
    expect(out.disposition).toBe('refused');
    expect(
      out.signals.some((s) => s.category === 'execution_refused_reciprocity_missing'),
    ).toBe(true);
  });

  it('refuses when reciprocity is complete but no carrier has consented', () => {
    const out = runRedistributionExecutionEngine({
      reciprocity: { ratifiedTerms: [...REQUIRED_RECIPROCITY_TERMS] },
      consentLedger: {
        candidates: [{ carrierId: 'c1', subjectSummary: 's', proposedAtClockTick: 1 }],
        events: [
          {
            eventId: 'e1',
            carrierId: 'c1',
            from: null,
            to: 'proposed',
            producingAction: 'proposed_by_facilitator',
            recordedAtClockTick: 1,
          },
        ],
      },
      residual: { pre: [], post: [] },
    });
    expect(out.disposition).toBe('refused');
    expect(
      out.signals.some((s) => s.category === 'execution_refused_no_consented_carrier'),
    ).toBe(true);
  });

  it('offers execution when reciprocity is ratified and a carrier consents', () => {
    const out = runRedistributionExecutionEngine({
      reciprocity: { ratifiedTerms: [...REQUIRED_RECIPROCITY_TERMS] },
      consentLedger: {
        candidates: [{ carrierId: 'c1', subjectSummary: 's', proposedAtClockTick: 1 }],
        events: [
          {
            eventId: 'e1',
            carrierId: 'c1',
            from: null,
            to: 'proposed',
            producingAction: 'proposed_by_facilitator',
            recordedAtClockTick: 1,
          },
          {
            eventId: 'e2',
            carrierId: 'c1',
            from: 'proposed',
            to: 'consented',
            producingAction: 'consented_by_carrier',
            recordedAtClockTick: 2,
          },
        ],
      },
      residual: {
        pre: [{ processId: 'p1', carrierCount: 1 }],
        post: [{ processId: 'p1', carrierCount: 3 }],
      },
    });
    expect(out.disposition).toBe('offered');
    expect(out.residual.overall).toBe('relieved');
  });

  it('is deterministic', () => {
    const input = {
      reciprocity: { ratifiedTerms: [...REQUIRED_RECIPROCITY_TERMS] },
      consentLedger: { candidates: [], events: [] },
      residual: { pre: [], post: [] },
    };
    expect(runRedistributionExecutionEngine(input)).toEqual(
      runRedistributionExecutionEngine(input),
    );
  });

  it('uses tone free of forbidden vocabulary and blame framing', () => {
    const out = runRedistributionExecutionEngine({
      reciprocity: { ratifiedTerms: [] },
      consentLedger: { candidates: [], events: [] },
      residual: {
        pre: [{ processId: 'p1', carrierCount: 1 }],
        post: [{ processId: 'p1', carrierCount: 3 }],
      },
    });
    const text = [out.preview, ...out.signals.map((s) => s.statement)]
      .join(' ')
      .replace(/anti-surveillance/g, '');
    expect(text).not.toMatch(FORBIDDEN);
    expect(text).not.toMatch(BLAME);
  });
});
