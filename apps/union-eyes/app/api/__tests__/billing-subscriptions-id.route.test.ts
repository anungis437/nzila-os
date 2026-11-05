import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => {
  const state = { selectRows: [] as unknown[][], updateRows: [] as unknown[][], setCalls: [] as Array<Record<string, unknown>>, locks: [] as string[] };
  const createSelectChain = () => {
    const take = () => (state.selectRows.shift() ?? []) as unknown[];
    const chain = {
      from: vi.fn(() => chain),
      // A read is either awaited directly or locked with .for('update') first; each consumes the next queued result.
      where: vi.fn(() => ({
        for: vi.fn(async (strength: string) => {
          state.locks.push(strength);
          return take();
        }),
        then: (resolve: (rows: unknown[]) => unknown, reject?: (error: unknown) => unknown) => Promise.resolve(take()).then(resolve, reject),
      })),
    };
    return chain;
  };
  return {
    state,
    withApi: vi.fn(),
    audit: vi.fn(),
    mandate: vi.fn(),
    logger: { info: vi.fn() },
    db: {
      select: vi.fn(() => createSelectChain()),
      update: vi.fn(() => ({
        set: vi.fn((values: Record<string, unknown>) => {
          state.setCalls.push(values);
          return {
            where: vi.fn(() => ({
              returning: vi.fn(async () => (state.updateRows.shift() ?? []) as unknown[]),
            })),
          };
        }),
      })),
    },
  };
});

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: {
    badRequest: (message: string) => new Error(message),
    notFound: (message: string) => new Error(message),
    conflict: (message: string) => new Error(message),
  },
  z: require('zod'),
}));
vi.mock('@/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (...args: unknown[]) => (args[args.length - 1] as (tx: unknown) => Promise<unknown>)(m.db),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));
vi.mock('@/lib/finance/require-live-financial-mandate', () => ({ requireLiveFinancialMandate: m.mandate }));
vi.mock('@/lib/finance/financial-authority', () => ({ FINANCIAL_MEMBER_DATA_ROLES: ['secretary_treasurer'] }));
vi.mock('@/db/schema', () => ({ orgSubscriptions: { id: 'id', organizationId: 'organizationId' } }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), and: vi.fn(() => 'and') };
});

async function loadRoute() {
  return import('../billing/subscriptions/[id]/route');
}

describe('billing/subscriptions/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.state.selectRows = [];
    m.state.updateRows = [];
    m.state.setCalls = [];
    m.state.locks = [];
    m.audit.mockResolvedValue(undefined);
    m.mandate.mockResolvedValue({ ledgerWide: true, resourceIds: [] });
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
  });

  it('GET throws when organization context is missing', async () => {
    const { GET } = await loadRoute();

    await expect(GET({ params: Promise.resolve({ id: 'sub_1' }) })).rejects.toThrow('Organization context required');
  });

  it('GET throws not found when subscription does not exist', async () => {
    const { GET } = await loadRoute();
    m.state.selectRows.push([]);

    await expect(GET({ organizationId: 'org_1', userId: 'u1', params: Promise.resolve({ id: 'sub_1' }) })).rejects.toThrow('Subscription not found');
  });

  it('GET returns subscription payload when found', async () => {
    const { GET } = await loadRoute();
    m.state.selectRows.push([{ id: 'sub_1', status: 'active' }]);

    const result = await GET({ organizationId: 'org_1', userId: 'u1', params: Promise.resolve({ id: 'sub_1' }) });

    expect(result).toMatchObject({ data: { id: 'sub_1', status: 'active' } });
  });

  it('PATCH updates an existing subscription\'s metadata and audits it on the same transaction', async () => {
    const { PATCH } = await loadRoute();
    m.state.selectRows.push([{ id: 'sub_1' }]);
    m.state.updateRows.push([{ id: 'sub_1', metadata: { note: 'x' } }]);

    const result = await PATCH({
      organizationId: 'org_1',
      userId: 'treasurer',
      params: { id: 'sub_1' },
      request: { json: async () => ({ metadata: { note: 'x' } }) },
    });

    expect(result).toMatchObject({ data: { id: 'sub_1' } });
    expect(m.audit).toHaveBeenCalledWith(m.db, expect.objectContaining({ action: 'billing.subscription.metadata_update', userId: 'treasurer' }));
  });

  it.each([
    { status: 'active' },
    { seatCount: 0 },
    { localCount: 1 },
    { moduleList: ['all'] },
    { discountPercent: '100' },
    { subsidyAmount: '99999' },
    { endDate: '2099-01-01' },
  ])('PATCH refuses the commercial term %j instead of silently ignoring it, and writes nothing', async (body) => {
    const { PATCH } = await loadRoute();
    await expect(
      PATCH({ organizationId: 'org_1', userId: 'treasurer', params: { id: 'sub_1' }, request: { json: async () => body } }),
    ).rejects.toThrow('Only metadata can be changed here');
    expect(m.db.update).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('is restricted to the financial authority, not a minimum role level', async () => {
    vi.resetModules();
    m.withApi.mockClear();
    await loadRoute();
    const configs = m.withApi.mock.calls.map((c) => c[0] as { auth: { roles?: string[]; minRole?: string } });
    for (const config of configs.slice(1)) {
      expect(config.auth.roles).toEqual(['secretary_treasurer']);
      expect(config.auth.minRole).toBeUndefined();
    }
  });

  it('DELETE refuses to cancel an already cancelled subscription', async () => {
    const { DELETE } = await loadRoute();
    m.state.selectRows.push([{ id: 'sub_1', status: 'cancelled' }]);
    await expect(DELETE({ organizationId: 'org_1', userId: 'treasurer', params: { id: 'sub_1' } })).rejects.toThrow('already cancelled');
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('DELETE cancels an existing subscription', async () => {
    const { DELETE } = await loadRoute();
    m.state.selectRows.push([{ id: 'sub_1', status: 'active' }]);
    m.state.updateRows.push([{ id: 'sub_1', status: 'cancelled' }]);

    const result = await DELETE({ organizationId: 'org_1', userId: 'treasurer', params: { id: 'sub_1' } });

    expect(result).toMatchObject({ data: { id: 'sub_1', status: 'cancelled' } });
    expect(m.audit).toHaveBeenCalledWith(m.db, expect.objectContaining({ action: 'billing.subscription.cancel', details: { from: 'active' } }));
  });

  it('round 28: a steward PATCH cannot erase the commercial-terms provenance keys by replacing metadata wholesale', async () => {
    const { PATCH } = await loadRoute();
    m.state.selectRows.push([
      {
        id: 'sub_1',
        metadata: {
          source: 'pilot-commercial-transition',
          commercialTermsSnapshot: { verifiedMemberCount: 250 },
          commercialTermsFingerprint: 'real-fingerprint',
        },
      },
    ]);
    m.state.updateRows.push([{ id: 'sub_1' }]);

    await PATCH({
      organizationId: 'org_1',
      userId: 'treasurer',
      params: { id: 'sub_1' },
      request: { json: async () => ({ metadata: {} }) },
    });

    expect(m.state.setCalls).toHaveLength(1);
    expect(m.state.setCalls[0].metadata).toEqual({
      commercialTermsSnapshot: { verifiedMemberCount: 250 },
      commercialTermsFingerprint: 'real-fingerprint',
    });
  });

  it('round 28: a steward PATCH cannot forge the commercial-terms provenance keys with fabricated values', async () => {
    const { PATCH } = await loadRoute();
    m.state.selectRows.push([
      {
        id: 'sub_1',
        metadata: {
          commercialTermsSnapshot: { verifiedMemberCount: 250 },
          commercialTermsFingerprint: 'real-fingerprint',
        },
      },
    ]);
    m.state.updateRows.push([{ id: 'sub_1' }]);

    await PATCH({
      organizationId: 'org_1',
      userId: 'treasurer',
      params: { id: 'sub_1' },
      request: {
        json: async () => ({
          metadata: {
            commercialTermsSnapshot: { verifiedMemberCount: 999999 },
            commercialTermsFingerprint: 'attacker-forged-fingerprint',
          },
        }),
      },
    });

    expect(m.state.setCalls[0].metadata).toEqual({
      commercialTermsSnapshot: { verifiedMemberCount: 250 },
      commercialTermsFingerprint: 'real-fingerprint',
    });
  });

  it('round 28: still allows editing ordinary (non-reserved) metadata keys', async () => {
    const { PATCH } = await loadRoute();
    m.state.selectRows.push([
      {
        id: 'sub_1',
        metadata: {
          commercialTermsSnapshot: { verifiedMemberCount: 250 },
          commercialTermsFingerprint: 'real-fingerprint',
        },
      },
    ]);
    m.state.updateRows.push([{ id: 'sub_1' }]);

    await PATCH({
      organizationId: 'org_1',
      userId: 'treasurer',
      params: { id: 'sub_1' },
      request: { json: async () => ({ metadata: { steward_note: 'renewed manually' } }) },
    });

    expect(m.state.setCalls[0].metadata).toEqual({
      steward_note: 'renewed manually',
      commercialTermsSnapshot: { verifiedMemberCount: 250 },
      commercialTermsFingerprint: 'real-fingerprint',
    });
  });

  it('round 28: a subscription with no existing provenance keys is unaffected (nothing fabricated)', async () => {
    const { PATCH } = await loadRoute();
    m.state.selectRows.push([{ id: 'sub_1', metadata: { note: 'manual entry' } }]);
    m.state.updateRows.push([{ id: 'sub_1' }]);

    await PATCH({
      organizationId: 'org_1',
      userId: 'treasurer',
      params: { id: 'sub_1' },
      request: { json: async () => ({ metadata: { note: 'updated' } }) },
    });

    expect(m.state.setCalls[0].metadata).toEqual({ note: 'updated' });
  });

  it('PATCH without a metadata field never touches the metadata column at all', async () => {
    const { PATCH } = await loadRoute();
    m.state.selectRows.push([{ id: 'sub_1', metadata: { commercialTermsFingerprint: 'real-fingerprint' } }]);
    m.state.updateRows.push([{ id: 'sub_1' }]);

    await PATCH({
      organizationId: 'org_1',
      userId: 'treasurer',
      params: { id: 'sub_1' },
      request: { json: async () => ({}) },
    });

    expect(m.state.setCalls[0]).not.toHaveProperty('metadata');
  });

  describe('the live financial mandate comes before any subscription is read or changed', () => {
    const refusal = () => Object.assign(new Error('DUTY_NOT_HELD'), { code: 'DUTY_NOT_HELD' });

    it('GET asks for the view power on this subscription, and a refusal reads nothing', async () => {
      const { GET } = await loadRoute();
      m.state.selectRows.push([{ id: 'sub_1', status: 'active' }]);
      await GET({ organizationId: 'org_1', userId: 'u1', params: Promise.resolve({ id: 'sub_1' }) });
      expect(m.mandate).toHaveBeenCalledWith(m.db, { organizationId: 'org_1', userId: 'u1', action: 'finance:view', resourceId: 'sub_1' });

      m.db.select.mockClear();
      m.mandate.mockRejectedValueOnce(refusal());
      await expect(GET({ organizationId: 'org_1', userId: 'u1', params: Promise.resolve({ id: 'sub_1' }) })).rejects.toThrow('DUTY_NOT_HELD');
      expect(m.db.select).not.toHaveBeenCalled();
    });

    it('PATCH asks for the prepare power, and a refusal reads, writes and audits nothing', async () => {
      const { PATCH } = await loadRoute();
      m.mandate.mockRejectedValueOnce(refusal());
      await expect(PATCH({
        organizationId: 'org_1', userId: 'u1', params: { id: 'sub_1' }, request: { json: async () => ({ metadata: { note: 'x' } }) },
      })).rejects.toThrow('DUTY_NOT_HELD');
      expect(m.mandate).toHaveBeenCalledWith(m.db, { organizationId: 'org_1', userId: 'u1', action: 'finance:prepare', resourceId: 'sub_1' });
      expect(m.db.select).not.toHaveBeenCalled();
      expect(m.db.update).not.toHaveBeenCalled();
      expect(m.audit).not.toHaveBeenCalled();
    });

    it('DELETE asks for the execute power, and a refusal reads, cancels and audits nothing', async () => {
      const { DELETE } = await loadRoute();
      m.mandate.mockRejectedValueOnce(refusal());
      await expect(DELETE({ organizationId: 'org_1', userId: 'u1', params: { id: 'sub_1' } })).rejects.toThrow('DUTY_NOT_HELD');
      expect(m.mandate).toHaveBeenCalledWith(m.db, { organizationId: 'org_1', userId: 'u1', action: 'finance:execute', resourceId: 'sub_1' });
      expect(m.db.select).not.toHaveBeenCalled();
      expect(m.db.update).not.toHaveBeenCalled();
      expect(m.audit).not.toHaveBeenCalled();
    });

    it('every method needs the caller identity as well as the organization, and touches nothing without it', async () => {
      const { GET, PATCH, DELETE } = await loadRoute();
      await expect(GET({ organizationId: 'org_1', params: Promise.resolve({ id: 'sub_1' }) })).rejects.toThrow('Organization context required');
      await expect(PATCH({ organizationId: 'org_1', params: { id: 'sub_1' }, request: { json: async () => ({}) } })).rejects.toThrow('Organization context required');
      await expect(DELETE({ organizationId: 'org_1', params: { id: 'sub_1' } })).rejects.toThrow('Organization context required');
      expect(m.mandate).not.toHaveBeenCalled();
      expect(m.db.select).not.toHaveBeenCalled();
    });
  });

  it('PATCH and DELETE lock the subscription they read, so provenance and cancellation are decided on the row that is changed', async () => {
    const { PATCH, DELETE } = await loadRoute();
    m.state.selectRows.push([{ id: 'sub_1', metadata: {} }]);
    m.state.updateRows.push([{ id: 'sub_1' }]);
    await PATCH({ organizationId: 'org_1', userId: 'treasurer', params: { id: 'sub_1' }, request: { json: async () => ({ metadata: { note: 'x' } }) } });
    expect(m.state.locks).toEqual(['update']);

    m.state.selectRows.push([{ id: 'sub_1', status: 'active' }]);
    m.state.updateRows.push([{ id: 'sub_1', status: 'cancelled' }]);
    await DELETE({ organizationId: 'org_1', userId: 'treasurer', params: { id: 'sub_1' } });
    expect(m.state.locks).toEqual(['update', 'update']);
  });

  it('PATCH reports a conflict, and audits nothing, when the subscription changed between the read and the write', async () => {
    const { PATCH } = await loadRoute();
    m.state.selectRows.push([{ id: 'sub_1', metadata: {} }]);
    m.state.updateRows.push([]);
    await expect(PATCH({
      organizationId: 'org_1', userId: 'treasurer', params: { id: 'sub_1' }, request: { json: async () => ({ metadata: { note: 'x' } }) },
    })).rejects.toThrow('changed while metadata was being updated');
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('DELETE reports a conflict, and audits nothing, when the subscription changed between the read and the cancellation', async () => {
    const { DELETE } = await loadRoute();
    m.state.selectRows.push([{ id: 'sub_1', status: 'active' }]);
    m.state.updateRows.push([]);
    await expect(DELETE({ organizationId: 'org_1', userId: 'treasurer', params: { id: 'sub_1' } })).rejects.toThrow('changed while it was being cancelled');
    expect(m.audit).not.toHaveBeenCalled();
  });
});