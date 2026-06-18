import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
}));

const mockDb = {
  select: vi.fn(() => {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(async () => (m.selectQueue.shift() ?? []) as unknown[]),
    };
    return chain;
  }),
};

vi.mock('@/lib/api/framework', () => ({
  withApi: vi.fn((_: unknown, handler: (...args: any[]) => unknown) => handler),
}));

vi.mock('@/db/db', () => ({ db: mockDb }));

async function loadRoute() {
  return import('../exit-interviews/analytics/route');
}

describe('exit-interviews/analytics route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
  });

  it('returns timeline with computed trend and counters', async () => {
    const { GET } = await loadRoute();

    const now = new Date();
    const recent = new Date(now.getFullYear(), now.getMonth(), 5);
    const prior = new Date(now.getFullYear(), now.getMonth() - 4, 5);

    m.selectQueue.push(
      [
        { id: 'i1', status: 'published', createdAt: recent, publishedAt: recent, continuityRiskScore: 70, consentGranted: true },
        { id: 'i2', status: 'draft', createdAt: prior, publishedAt: null, continuityRiskScore: 40, consentGranted: false },
      ],
      [
        { createdAt: recent, eventType: 'governance_updated' },
      ],
    );

    const payload = await GET({ organizationId: 'org_1' } as any);

    expect(payload.data.organizationId).toBe('org_1');
    expect(payload.data.totalInterviewsCaptured).toBe(2);
    expect(payload.data.totalPublished).toBe(1);
    expect(Array.isArray(payload.data.timeline)).toBe(true);
  });

  it('handles empty data sets with stable defaults', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([], []);

    const payload = await GET({ organizationId: 'org_1' } as any);

    expect(payload.data.totalInterviewsCaptured).toBe(0);
    expect(payload.data.currentExposureScore).toBe(0);
    expect(payload.data.trendDirection).toBe('stable');
  });
});
