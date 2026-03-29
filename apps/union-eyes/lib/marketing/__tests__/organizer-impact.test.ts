import { describe, it, expect } from 'vitest';
import {
  calculateOrganizerImpact,
  generateRecognitionEvents,
  compareImpactPeriods,
  getImpactSummary,
} from '../organizer-impact';
import type { OrganizerImpact } from '@/types/marketing';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const BASE_INPUT = {
  organizerId: 'org-1',
  organizationId: 'union-1',
  periodStart: new Date('2026-01-01'),
  periodEnd: new Date('2026-03-31'),
};

function makeCase(overrides: Record<string, unknown> = {}) {
  return {
    id: `c-${Math.random().toString(36).slice(2)}`,
    status: 'resolved',
    createdAt: new Date('2026-01-10'),
    resolvedAt: new Date('2026-01-20'),
    memberSatisfaction: 4,
    escalated: false,
    democraticActions: 2,
    ...overrides,
  };
}

function makeImpact(overrides: Partial<OrganizerImpact> = {}): OrganizerImpact {
  return {
    id: 'impact-1',
    userId: 'org-1',
    organizationId: 'union-1',
    casesHandled: 10,
    casesWon: 8,
    avgResolutionTime: 5,
    memberSatisfactionAvg: 4.2,
    escalationsAvoided: 7,
    democraticParticipationRate: 65,
    recognitionEvents: [],
    periodStart: new Date('2026-01-01'),
    periodEnd: new Date('2026-03-31'),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */
describe('calculateOrganizerImpact', () => {
  it('returns zero metrics for empty cases', () => {
    const result = calculateOrganizerImpact({ ...BASE_INPUT, casesData: [] });
    expect(result.casesHandled).toBe(0);
    expect(result.casesWon).toBe(0);
    expect(result.avgResolutionTime).toBe(0);
    expect(result.memberSatisfactionAvg).toBe(0);
    expect(result.escalationsAvoided).toBe(0);
    expect(result.democraticParticipationRate).toBe(0);
  });

  it('calculates cases handled from total count', () => {
    const result = calculateOrganizerImpact({
      ...BASE_INPUT,
      casesData: [makeCase(), makeCase(), makeCase()],
    });
    expect(result.casesHandled).toBe(3);
  });

  it('counts resolved cases as won', () => {
    const result = calculateOrganizerImpact({
      ...BASE_INPUT,
      casesData: [
        makeCase({ status: 'resolved' }),
        makeCase({ status: 'open' }),
        makeCase({ status: 'resolved' }),
      ],
    });
    expect(result.casesWon).toBe(2);
  });

  it('calculates average resolution time in days', () => {
    const result = calculateOrganizerImpact({
      ...BASE_INPUT,
      casesData: [
        makeCase({
          createdAt: new Date('2026-01-01'),
          resolvedAt: new Date('2026-01-11'), // 10 days
        }),
        makeCase({
          createdAt: new Date('2026-02-01'),
          resolvedAt: new Date('2026-02-21'), // 20 days
        }),
      ],
    });
    expect(result.avgResolutionTime).toBe(15); // (10+20)/2
  });

  it('calculates member satisfaction average', () => {
    const result = calculateOrganizerImpact({
      ...BASE_INPUT,
      casesData: [
        makeCase({ memberSatisfaction: 5 }),
        makeCase({ memberSatisfaction: 3 }),
        makeCase({ memberSatisfaction: undefined }),
      ],
    });
    expect(result.memberSatisfactionAvg).toBe(4); // (5+3)/2
  });

  it('counts escalations avoided', () => {
    const result = calculateOrganizerImpact({
      ...BASE_INPUT,
      casesData: [
        makeCase({ escalated: false }),
        makeCase({ escalated: true }),
        makeCase({ escalated: false }),
      ],
    });
    expect(result.escalationsAvoided).toBe(2);
  });

  it('calculates democratic participation rate', () => {
    const result = calculateOrganizerImpact({
      ...BASE_INPUT,
      casesData: [
        makeCase({ democraticActions: 3 }),
        makeCase({ democraticActions: 0 }),
      ],
    });
    // total actions: 3, total cases: 2 → (3/2)*100 = 150
    expect(result.democraticParticipationRate).toBe(150);
  });

  it('sets correct ID and metadata', () => {
    const result = calculateOrganizerImpact({
      ...BASE_INPUT,
      casesData: [makeCase()],
    });
    expect(result.id).toContain('impact-org-1-');
    expect(result.userId).toBe('org-1');
    expect(result.organizationId).toBe('union-1');
    expect(result.periodStart).toEqual(BASE_INPUT.periodStart);
    expect(result.periodEnd).toEqual(BASE_INPUT.periodEnd);
  });

  it('uses empty array when recognitionEvents not provided', () => {
    const result = calculateOrganizerImpact({
      ...BASE_INPUT,
      casesData: [makeCase()],
    });
    expect(result.recognitionEvents).toEqual([]);
  });
});

describe('generateRecognitionEvents', () => {
  it('generates first win event', () => {
    const impact = makeImpact({ casesWon: 1, casesHandled: 1 });
    const events = generateRecognitionEvents(impact);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'case-win',
          metadata: { milestone: 'first-win' },
        }),
      ]),
    );
  });

  it('skips first win if previous had wins', () => {
    const impact = makeImpact({ casesWon: 1 });
    const previous = makeImpact({ casesWon: 1 });
    const events = generateRecognitionEvents(impact, previous);
    const firstWin = events.find((e) => e.metadata?.milestone === 'first-win');
    expect(firstWin).toBeUndefined();
  });

  it('generates milestone events at 10, 25, 50, 100 cases', () => {
    const impact = makeImpact({ casesHandled: 25, casesWon: 0 });
    const previous = makeImpact({ casesHandled: 9, casesWon: 0 });
    const events = generateRecognitionEvents(impact, previous);
    const milestones = events.filter((e) => e.type === 'milestone');
    expect(milestones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metadata: { milestone: 'cases-10' } }),
        expect.objectContaining({ metadata: { milestone: 'cases-25' } }),
      ]),
    );
  });

  it('generates member feedback recognition for high satisfaction', () => {
    const impact = makeImpact({
      casesHandled: 10,
      memberSatisfactionAvg: 4.5,
    });
    const previous = makeImpact({ memberSatisfactionAvg: 4.0 });
    const events = generateRecognitionEvents(impact, previous);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'member-feedback' }),
      ]),
    );
  });

  it('generates strong outcome recognition for >75% win rate over 20+ cases', () => {
    const impact = makeImpact({ casesHandled: 20, casesWon: 16 });
    const previous = makeImpact({ casesHandled: 10, casesWon: 5 });
    const events = generateRecognitionEvents(impact, previous);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'case-win',
          description: expect.stringContaining('Strong track record'),
        }),
      ]),
    );
  });

  it('generates democratic engagement champion event', () => {
    const impact = makeImpact({
      casesHandled: 15,
      democraticParticipationRate: 85,
    });
    const previous = makeImpact({ democraticParticipationRate: 70 });
    const events = generateRecognitionEvents(impact, previous);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: expect.stringContaining('democratic'),
        }),
      ]),
    );
  });

  it('returns empty array when no milestones reached', () => {
    const impact = makeImpact({
      casesHandled: 3,
      casesWon: 0,
      memberSatisfactionAvg: 3.0,
      democraticParticipationRate: 50,
    });
    const events = generateRecognitionEvents(impact);
    expect(events).toEqual([]);
  });
});

describe('compareImpactPeriods', () => {
  it('computes change and changePercent for all metrics', () => {
    const current = makeImpact({
      casesHandled: 20,
      casesWon: 15,
      avgResolutionTime: 4,
      memberSatisfactionAvg: 4.5,
      democraticParticipationRate: 70,
    });
    const previous = makeImpact({
      casesHandled: 10,
      casesWon: 7,
      avgResolutionTime: 8,
      memberSatisfactionAvg: 3.5,
      democraticParticipationRate: 50,
    });
    const results = compareImpactPeriods(current, previous);

    expect(results).toHaveLength(5);
    // Cases handled: +10, +100%
    const casesHandled = results.find((r) => r.metric === 'Cases Handled')!;
    expect(casesHandled.change).toBe(10);
    expect(casesHandled.changePercent).toBe(100);
    expect(casesHandled.improving).toBe(true);
  });

  it('treats lower resolution time as improving', () => {
    const current = makeImpact({ avgResolutionTime: 3 });
    const previous = makeImpact({ avgResolutionTime: 6 });
    const results = compareImpactPeriods(current, previous);
    const resTime = results.find((r) => r.metric === 'Avg Resolution Time (days)')!;
    expect(resTime.change).toBe(-3);
    expect(resTime.improving).toBe(true);
  });

  it('treats higher resolution time as not improving', () => {
    const current = makeImpact({ avgResolutionTime: 10 });
    const previous = makeImpact({ avgResolutionTime: 5 });
    const results = compareImpactPeriods(current, previous);
    const resTime = results.find((r) => r.metric === 'Avg Resolution Time (days)')!;
    expect(resTime.improving).toBe(false);
  });

  it('returns 0 changePercent when previous is 0', () => {
    const current = makeImpact({ casesHandled: 5 });
    const previous = makeImpact({ casesHandled: 0 });
    const results = compareImpactPeriods(current, previous);
    const casesHandled = results.find((r) => r.metric === 'Cases Handled')!;
    expect(casesHandled.changePercent).toBe(0);
  });
});

describe('getImpactSummary', () => {
  it('returns "Getting Started" headline for 1-9 wins', () => {
    const result = getImpactSummary(makeImpact({ casesWon: 5, casesHandled: 10 }));
    expect(result.headline).toBe('Getting Started');
  });

  it('returns "Building Momentum" for 10-24 wins', () => {
    const result = getImpactSummary(makeImpact({ casesWon: 15, casesHandled: 20 }));
    expect(result.headline).toBe('Building Momentum');
  });

  it('returns "Strong Track Record" for 25-49 wins', () => {
    const result = getImpactSummary(makeImpact({ casesWon: 30, casesHandled: 40 }));
    expect(result.headline).toBe('Strong Track Record');
  });

  it('returns "Experienced Advocate" for 50+ wins', () => {
    const result = getImpactSummary(makeImpact({ casesWon: 55, casesHandled: 60 }));
    expect(result.headline).toBe('Experienced Advocate');
  });

  it('returns "Making a Difference" for 0 wins', () => {
    const result = getImpactSummary(makeImpact({ casesWon: 0, casesHandled: 0 }));
    expect(result.headline).toBe('Making a Difference');
  });

  it('includes highlight for positive outcomes', () => {
    const result = getImpactSummary(makeImpact({ casesWon: 5 }));
    expect(result.highlights.some((h) => h.includes('positive outcomes'))).toBe(true);
  });

  it('includes highlight for strong member satisfaction', () => {
    const result = getImpactSummary(makeImpact({ memberSatisfactionAvg: 4.2 }));
    expect(result.highlights.some((h) => h.includes('satisfaction'))).toBe(true);
  });

  it('includes highlight for democratic engagement', () => {
    const result = getImpactSummary(makeImpact({ democraticParticipationRate: 75 }));
    expect(result.highlights.some((h) => h.includes('democratic'))).toBe(true);
  });

  it('includes highlight for efficient resolution', () => {
    const result = getImpactSummary(makeImpact({ avgResolutionTime: 15 }));
    expect(result.highlights.some((h) => h.includes('resolution'))).toBe(true);
  });

  it('suggests feedback when satisfaction is low', () => {
    const result = getImpactSummary(
      makeImpact({ memberSatisfactionAvg: 3.0, casesHandled: 10 }),
    );
    expect(result.areasForGrowth.some((g) => g.includes('feedback'))).toBe(true);
  });

  it('suggests democratic engagement when rate is low', () => {
    const result = getImpactSummary(
      makeImpact({ democraticParticipationRate: 20, casesHandled: 15 }),
    );
    expect(result.areasForGrowth.some((g) => g.includes('engagement'))).toBe(true);
  });

  it('suggests case strategy when win rate is low', () => {
    const result = getImpactSummary(
      makeImpact({ casesWon: 3, casesHandled: 10 }),
    );
    expect(result.areasForGrowth.some((g) => g.includes('strategy'))).toBe(true);
  });

  it('shows default highlight when no positive metrics', () => {
    const result = getImpactSummary(
      makeImpact({
        casesWon: 0,
        casesHandled: 0,
        memberSatisfactionAvg: 0,
        democraticParticipationRate: 0,
        avgResolutionTime: 0,
      }),
    );
    expect(result.highlights).toEqual(['Getting started—every case matters']);
  });
});
