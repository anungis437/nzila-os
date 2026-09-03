import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => {
  const state = { selectQueue: [] as unknown[][] };
  const nextSelect = () => Promise.resolve((state.selectQueue.shift() ?? []) as unknown[]);
  const updateCalls: Array<{ setValues: Record<string, unknown> }> = [];

  const createSelectChain = () => {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      limit: vi.fn(() => ({
        for: vi.fn(() => nextSelect()),
      })),
      then: (resolve: (value: unknown[]) => unknown) => nextSelect().then(resolve),
    };
    return chain;
  };

  const mockDb = {
    select: vi.fn(() => createSelectChain()),
    update: vi.fn(() => ({
      set: vi.fn((setValues: Record<string, unknown>) => {
        updateCalls.push({ setValues });
        return { where: vi.fn(async () => []) };
      }),
    })),
  };

  return {
    state,
    updateCalls,
    mockDb,
    queueSelect: (...rows: unknown[][]) => state.selectQueue.push(...rows),
    reset: () => {
      state.selectQueue = [];
      updateCalls.length = 0;
    },
  };
});

vi.mock('@/db', () => ({ db: m.mockDb }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: vi.fn(async (fn: (tx?: unknown) => Promise<unknown>) => fn(m.mockDb)),
}));

async function loadModule() {
  return import('../commercial-terms-authority');
}

describe('approveCommercialTerms (PR #752 round 25)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.reset();
  });

  it('rejects a non-positive memberCount', async () => {
    const { approveCommercialTerms } = await loadModule();
    const result = await approveCommercialTerms({ pilotId: 'p1', approvedBy: 'admin-1', memberCount: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error).toMatch(/positive integer/);
    }
  });

  it('rejects a non-integer memberCount', async () => {
    const { approveCommercialTerms } = await loadModule();
    const result = await approveCommercialTerms({ pilotId: 'p1', approvedBy: 'admin-1', memberCount: 250.5 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/positive integer/);
  });

  it('rejects a non-positive explicit pilotAmount override', async () => {
    const { approveCommercialTerms } = await loadModule();
    const result = await approveCommercialTerms({ pilotId: 'p1', approvedBy: 'admin-1', memberCount: 250, pilotAmount: '-5' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error).toMatch(/positive number/);
    }
  });

  it('returns 404 when the referenced subscription plan does not exist', async () => {
    const { approveCommercialTerms } = await loadModule();
    m.queueSelect([]); // plan lookup — none found

    const result = await approveCommercialTerms({
      pilotId: 'p1',
      approvedBy: 'admin-1',
      memberCount: 250,
      subscriptionPlanId: 'plan-x',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
      expect(result.error).toMatch(/Subscription plan not found/);
    }
  });

  it('returns 409 when the referenced subscription plan is not active', async () => {
    const { approveCommercialTerms } = await loadModule();
    m.queueSelect([{ id: 'plan-x', isActive: false }]);

    const result = await approveCommercialTerms({
      pilotId: 'p1',
      approvedBy: 'admin-1',
      memberCount: 250,
      subscriptionPlanId: 'plan-x',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error).toMatch(/not active/);
    }
  });

  it('returns 404 when the pilot application does not exist', async () => {
    const { approveCommercialTerms } = await loadModule();
    m.queueSelect([]); // locked pilot lookup — none found

    const result = await approveCommercialTerms({ pilotId: 'missing', approvedBy: 'admin-1', memberCount: 250 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
      expect(result.error).toMatch(/Pilot application not found/);
    }
  });

  it('derives the amount deterministically from the economics ladder when no explicit amount is given', async () => {
    const { approveCommercialTerms } = await loadModule();
    m.queueSelect([{ id: 'p1' }]); // locked pilot lookup

    const result = await approveCommercialTerms({ pilotId: 'p1', approvedBy: 'admin-1', memberCount: 250 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.verifiedMemberCount).toBe(250);
      // 250 members -> starter-local tier ($5K-$10K) -> lower bound 5000.00
      expect(result.verifiedPilotAmount).toBe('5000.00');
      expect(result.verifiedSubscriptionPlanId).toBeNull();
    }
    expect(m.updateCalls).toHaveLength(1);
    expect(m.updateCalls[0].setValues).toMatchObject({
      verifiedMemberCount: 250,
      verifiedPilotAmount: '5000.00',
      commercialTermsApprovedBy: 'admin-1',
    });
  });

  it('honors an explicit platform-approved pilotAmount override instead of the ladder value', async () => {
    const { approveCommercialTerms } = await loadModule();
    m.queueSelect([{ id: 'p1' }]);

    const result = await approveCommercialTerms({
      pilotId: 'p1',
      approvedBy: 'admin-1',
      memberCount: 250,
      pilotAmount: '18500',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.verifiedPilotAmount).toBe('18500.00');
    }
  });

  it('approves with an explicit active subscription plan', async () => {
    const { approveCommercialTerms } = await loadModule();
    m.queueSelect([{ id: 'plan-x', isActive: true }], [{ id: 'p1' }]);

    const result = await approveCommercialTerms({
      pilotId: 'p1',
      approvedBy: 'admin-1',
      memberCount: 250,
      subscriptionPlanId: 'plan-x',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.verifiedSubscriptionPlanId).toBe('plan-x');
    }
    expect(m.updateCalls[0].setValues.verifiedSubscriptionPlanId).toBe('plan-x');
  });
});
