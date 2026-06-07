import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockThen: vi.fn(),
  mockExecute: vi.fn(),
}));

vi.mock('@/db', () => {
  const chain = {
    select: mocks.mockSelect.mockReturnThis(),
    from: mocks.mockFrom.mockReturnThis(),
    where: mocks.mockWhere.mockReturnThis(),
    then: mocks.mockThen,
  };
  mocks.mockSelect.mockReturnValue(chain);
  return { db: { ...chain, execute: mocks.mockExecute } };
});

vi.mock('@/db/schema', () => ({
  profiles: {},
  smsMessages: {},
  newsletterEngagement: {},
  surveyResponses: {},
  pollVotes: {},
  pushDeliveries: {},
  organizationMembers: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  gte: vi.fn(),
  and: vi.fn(),
  sql: (strings: TemplateStringsArray, ...values: any[]) => ({ strings, values }),
  relations: vi.fn(() => ({})),
}));

vi.mock('date-fns', () => ({
  subDays: vi.fn((d: Date, n: number) => new Date(d.getTime() - n * 86400000)),
  subMonths: vi.fn((d: Date, n: number) => {
    const r = new Date(d);
    r.setMonth(r.getMonth() - n);
    return r;
  }),
  differenceInDays: vi.fn((_a: Date, _b: Date) => 5),
}));

import { calculateEngagementScore } from '../engagement-scoring';

describe('engagement-scoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: each DB query returns zero counts
    mocks.mockThen.mockImplementation((fn: (rows: any[]) => unknown) =>
      Promise.resolve(
        fn([{ received: 0, replied: 0, clicked: 0, lastActivity: null, opened: 0, started: 0, completed: 0, voted: 0, delivered: 0, count: 0 }])
      )
    );
  });

  it('returns zero score when no activity', async () => {
    const score = await calculateEngagementScore('prof-1', 'org-1');
    expect(score.totalScore).toBe(0);
    expect(score.tier).toBe('dormant');
  });

  it('assigns highly-engaged tier for high activity', async () => {
    let callCount = 0;
    mocks.mockThen.mockImplementation((fn: (rows: any[]) => unknown) => {
      callCount++;
      // First 5 calls are main activity queries; then previous-period queries
      if (callCount <= 5) {
        return Promise.resolve(
          fn([{
            received: 50, replied: 20, clicked: 10, lastActivity: new Date(),
            opened: 30, started: 15, completed: 10, voted: 25, delivered: 40,
          }])
        );
      }
      return Promise.resolve(fn([{ count: 0 }]));
    });

    const score = await calculateEngagementScore('prof-1', 'org-1', 90);
    expect(score.totalScore).toBeGreaterThanOrEqual(100);
    expect(score.tier).toBe('highly-engaged');
  });

  it('includes all channel sub-scores', async () => {
    const score = await calculateEngagementScore('prof-1', 'org-1');
    expect(score).toHaveProperty('smsScore');
    expect(score).toHaveProperty('newsletterScore');
    expect(score).toHaveProperty('surveyScore');
    expect(score).toHaveProperty('pollScore');
    expect(score).toHaveProperty('pushScore');
  });

  it('includes trend information', async () => {
    const score = await calculateEngagementScore('prof-1', 'org-1');
    expect(['improving', 'stable', 'declining']).toContain(score.trend);
    expect(typeof score.trendPercentage).toBe('number');
  });
});
