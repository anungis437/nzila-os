import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/workflow/case-lifecycle', () => ({ getSLADeadlineHours: (_s: string, p: string) => (p === 'urgent' ? 8 : 100) }));
vi.mock('@/lib/workflow/state-bridge', () => ({ toLifecycleState: () => 'submitted' }));

import { caseFacts, computeSlaBreachProbability, computeVerifiedCaseSlaRisk, scoringPriority } from '../sla-breach-score';

const NOW = new Date('2026-06-01T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

describe('computeSlaBreachProbability', () => {
  it('rises with priority, time pressure, transitions and history, and stays inside 0.01 to 0.99', () => {
    const base = { priority: 'low' as const, hoursRemaining: 100, transitionCount: 0, hasPreviousBreaches: false };
    const low = computeSlaBreachProbability(base);
    expect(low).toBe(0.12);
    expect(computeSlaBreachProbability({ ...base, priority: 'urgent' })).toBeGreaterThan(low);
    expect(computeSlaBreachProbability({ ...base, hoursRemaining: 0 })).toBeGreaterThan(low);
    expect(computeSlaBreachProbability({ ...base, transitionCount: 4 })).toBeGreaterThan(low);
    expect(computeSlaBreachProbability({ ...base, hasPreviousBreaches: true })).toBeGreaterThan(low);
    expect(computeSlaBreachProbability({ priority: 'urgent', hoursRemaining: -1, transitionCount: 99, hasPreviousBreaches: true })).toBe(0.99);
  });

  it('cannot be pushed to the alert threshold by the supplied inputs alone when the case has time left', () => {
    // with the case's real facts fixed (medium priority, plenty of time), the most the caller-supplied inputs add is 0.34
    const best = computeSlaBreachProbability({ priority: 'medium', hoursRemaining: 100, transitionCount: 1000, hasPreviousBreaches: true });
    expect(best).toBeLessThan(0.8);
  });
});

describe('verified case-facts-only SLA scoring', () => {
  it('uses only priority and deadline, not caller-provided history', () => {
    expect(computeVerifiedCaseSlaRisk({ priority: 'high', hoursRemaining: 8 })).toBe(0.5);
    expect(computeVerifiedCaseSlaRisk({ priority: 'high', hoursRemaining: 8 })).toBe(
      computeSlaBreachProbability({ priority: 'high', hoursRemaining: 8, transitionCount: 0, hasPreviousBreaches: false }),
    );
  });
});

describe('case facts', () => {
  it('takes priority and time remaining from the case', () => {
    expect(caseFacts({ status: 'open', priority: 'urgent', statusChangedAt: hoursAgo(2), createdAt: hoursAgo(50) }, NOW)).toEqual({ priority: 'urgent', hoursRemaining: 6 });
    expect(caseFacts({ status: 'open', priority: 'urgent', statusChangedAt: hoursAgo(12), createdAt: null }, NOW).hoursRemaining).toBe(-4);
  });
  // Disclosed adaptation: the clock was updatedAt, so an edit restarted it. It is the last status change, else creation.
  it('starts the clock at the status change, falls back to creation, and ignores later edits', () => {
    expect(caseFacts({ status: 'open', priority: 'urgent', statusChangedAt: null, createdAt: hoursAgo(10), updatedAt: hoursAgo(1) } as never, NOW).hoursRemaining).toBe(-2);
    expect(caseFacts({ status: 'open', priority: 'urgent', statusChangedAt: hoursAgo(2), createdAt: hoursAgo(50), updatedAt: hoursAgo(0) } as never, NOW).hoursRemaining).toBe(6);
  });
  it('scores a priority outside the four as medium', () => {
    expect(scoringPriority('critical')).toBe('medium');
    expect(scoringPriority(null)).toBe('medium');
  });
});
