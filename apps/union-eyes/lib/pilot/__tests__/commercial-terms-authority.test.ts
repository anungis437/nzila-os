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
    pilotHasFinancialArtifacts: vi.fn(async () => false),
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
vi.mock('@/lib/pilot/pilot-ownership', () => ({
  pilotHasFinancialArtifacts: m.pilotHasFinancialArtifacts,
}));

async function loadModule() {
  return import('../commercial-terms-authority');
}

describe('approveCommercialTerms (PR #752 round 25)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.reset();
    m.pilotHasFinancialArtifacts.mockResolvedValue(false);
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

describe('approveCommercialTerms round 26 lifecycle + monetary hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.reset();
    m.pilotHasFinancialArtifacts.mockResolvedValue(false);
  });

  it('rejects re-approval once a real financial artifact already exists for this pilot', async () => {
    const { approveCommercialTerms } = await loadModule();
    m.pilotHasFinancialArtifacts.mockResolvedValueOnce(true);
    m.queueSelect([{ id: 'p1' }]); // locked pilot lookup

    const result = await approveCommercialTerms({ pilotId: 'p1', approvedBy: 'admin-2', memberCount: 500 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error).toMatch(/already has a real financial artifact/);
    }
    expect(m.updateCalls).toHaveLength(0);
  });

  it('rejects re-approval with IDENTICAL values once a financial artifact exists (no silent no-op allowed)', async () => {
    const { approveCommercialTerms } = await loadModule();
    m.pilotHasFinancialArtifacts.mockResolvedValueOnce(true);
    m.queueSelect([{ id: 'p1' }]);

    const result = await approveCommercialTerms({ pilotId: 'p1', approvedBy: 'admin-1', memberCount: 250, pilotAmount: '5000.00' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(409);
  });

  it('checks the financial-artifact census AFTER acquiring the row lock (TOCTOU-safe ordering)', async () => {
    const { approveCommercialTerms } = await loadModule();
    const callOrder: string[] = [];
    m.pilotHasFinancialArtifacts.mockImplementationOnce(async () => {
      callOrder.push('artifact-check');
      return false;
    });
    m.queueSelect([{ id: 'p1' }]);
    const originalSelect = m.mockDb.select.getMockImplementation();
    m.mockDb.select.mockImplementationOnce((...args: unknown[]) => {
      callOrder.push('row-lock-select');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (originalSelect as any)(...args);
    });

    await approveCommercialTerms({ pilotId: 'p1', approvedBy: 'admin-1', memberCount: 250 });

    expect(callOrder).toEqual(['row-lock-select', 'artifact-check']);
  });

  it('rejects a raw pilotAmount that is positive but normalizes below $0.01', async () => {
    const { approveCommercialTerms } = await loadModule();
    const result = await approveCommercialTerms({ pilotId: 'p1', approvedBy: 'admin-1', memberCount: 250, pilotAmount: '0.001' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error).toMatch(/normalize to at least \$0\.01/);
    }
    expect(m.updateCalls).toHaveLength(0);
  });

  it('accepts a pilotAmount that normalizes to exactly $0.01', async () => {
    const { approveCommercialTerms } = await loadModule();
    m.queueSelect([{ id: 'p1' }]);

    const result = await approveCommercialTerms({ pilotId: 'p1', approvedBy: 'admin-1', memberCount: 250, pilotAmount: '0.006' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.verifiedPilotAmount).toBe('0.01');
  });

  it('rejects a pilotAmount that exceeds numeric(12,2) bounds', async () => {
    const { approveCommercialTerms } = await loadModule();
    const result = await approveCommercialTerms({
      pilotId: 'p1',
      approvedBy: 'admin-1',
      memberCount: 250,
      pilotAmount: '99999999999.99',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error).toMatch(/at most \$9999999999\.99/);
    }
  });
});
