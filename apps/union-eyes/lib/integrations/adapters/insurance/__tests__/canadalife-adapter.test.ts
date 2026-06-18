import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const h = vi.hoisted(() => {
  const selectQueue: unknown[][] = [];
  const limit = vi.fn(() => (selectQueue.length ? selectQueue.shift()! : []));
  const valuesFn = vi.fn(async () => ({}));
  const db = {
    select: () => ({ from: () => ({ where: () => ({ limit }) }) }),
    insert: vi.fn(() => ({ values: valuesFn })),
    update: vi.fn(() => ({ set: () => ({ where: vi.fn(async () => ({})) }) })),
  };
  const client: Record<string, ReturnType<typeof vi.fn>> = {};
  return { selectQueue, limit, valuesFn, db, client };
});

vi.mock('@/db', () => ({ db: h.db }));
vi.mock('@/db/schema', () => new Proxy({}, {
  has: () => true,
  get: (_t, name) => {
    if (name === '__esModule') return false;
    return new Proxy({}, { get: (_o, col) => ({ __col: col }) });
  },
}));
vi.mock('drizzle-orm', () => ({ eq: () => ({}), and: () => ({}) }));
vi.mock('../canadalife-client', () => ({
  CanadaLifeClient: class { constructor() { return h.client; } },
}));

import { CanadaLifeAdapter } from '../canadalife-adapter';
import { IntegrationType, IntegrationProvider, SyncType } from '../../../types';

const baseConfig = {
  organizationId: 'org-1',
  type: IntegrationType.INSURANCE,
  provider: IntegrationProvider.CANADA_LIFE,
  credentials: { clientId: 'cid', clientSecret: 'secret', refreshToken: 'rt' },
  settings: { policyGroupId: 'pg-1' },
  enabled: true,
};

const makeConnected = async () => {
  const adapter = new CanadaLifeAdapter();
  await adapter.initialize(baseConfig);
  await adapter.connect();
  return adapter;
};

describe('CanadaLifeAdapter', () => {
  beforeEach(() => {
    h.selectQueue.length = 0;
    h.limit.mockClear();
    h.valuesFn.mockReset();
    h.valuesFn.mockImplementation(async () => ({}));
    Object.assign(h.client, {
      authenticate: vi.fn(async () => {}),
      getRefreshToken: vi.fn(() => 'rt-new'),
      healthCheck: vi.fn(async () => true),
      getPolicies: vi.fn(async () => []),
      getClaims: vi.fn(async () => []),
      getBeneficiaries: vi.fn(async () => []),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('connect authenticates and healthCheck is healthy', async () => {
    const adapter = await makeConnected();
    expect(h.client.authenticate).toHaveBeenCalled();
    expect((await adapter.healthCheck()).healthy).toBe(true);
  });

  it('connect rethrows when authentication fails', async () => {
    const adapter = new CanadaLifeAdapter();
    await adapter.initialize(baseConfig);
    h.client.authenticate = vi.fn(() => Promise.reject(new Error('auth fail')));
    await expect(adapter.connect()).rejects.toThrow('auth fail');
  });

  it('disconnect clears state', async () => {
    const adapter = await makeConnected();
    await adapter.disconnect();
    await expect(adapter.sync({ type: SyncType.FULL })).rejects.toThrow();
  });

  it('healthCheck returns unhealthy on client error', async () => {
    const adapter = await makeConnected();
    h.client.healthCheck = vi.fn(() => Promise.reject(new Error('down')));
    expect((await adapter.healthCheck()).healthy).toBe(false);
  });

  it('sync policies creates and updates records (incremental)', async () => {
    const adapter = await makeConnected();
    h.client.getPolicies = vi.fn(async () => ([
      { external_id: 'p1', policy_number: 'N1', policy_type: 'life', policy_holder: 'e1', coverage_amount: 1000, premium: 50, effective_date: 'd', expiry_date: null, status: 'active' },
      { external_id: 'p2', policy_number: 'N2', policy_type: 'health', policy_holder: 'e2', coverage_amount: 2000, premium: 75, effective_date: 'd', expiry_date: 'd2', status: 'active' },
    ]));
    h.selectQueue.push([{ id: 'existing-1' }]);
    const r = await adapter.sync({ type: SyncType.INCREMENTAL, orgs: ['policies'], cursor: '2024-01-01' });
    expect(r.recordsUpdated).toBe(1);
    expect(r.recordsCreated).toBe(1);
  });

  it('sync policies counts a per-record failure', async () => {
    const adapter = await makeConnected();
    h.client.getPolicies = vi.fn(async () => ([
      { external_id: 'p1', policy_number: 'N1', policy_type: 'life', policy_holder: 'e1', coverage_amount: 1, premium: 1, effective_date: 'd', status: 'active' },
    ]));
    h.valuesFn.mockImplementationOnce(() => Promise.reject(new Error('insert boom')));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['policies'] });
    expect(r.recordsFailed).toBe(1);
  });

  it('sync claims and beneficiaries process records', async () => {
    const adapter = await makeConnected();
    h.client.getClaims = vi.fn(async () => ([
      { external_id: 'c1', claim_number: 'CN1', member_name: 'Jane Doe', claim_type: 'dental', claim_amount: 100, approved_amount: 90, paid_amount: 90, status: 'paid', provider_name: 'Prov', service_date: 'd', claim_date: 'd' },
    ]));
    h.client.getBeneficiaries = vi.fn(async () => ([
      { external_id: 'b1', beneficiary_name: 'John Smith', policy_id: 'p1', relationship: 'spouse', percentage: 50.4, status: 'active' },
      { external_id: 'b2', beneficiary_name: 'Solo', policy_id: 'p1', relationship: 'child', percentage: 49.6, status: 'active' },
    ]));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['claims', 'beneficiaries'] });
    expect(r.recordsCreated).toBe(3);
  });

  it('sync records an entity-level error when a fetch throws', async () => {
    const adapter = await makeConnected();
    h.client.getPolicies = vi.fn(() => Promise.reject(new Error('entity boom')));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['policies'] });
    expect(r.errors?.[0]?.error).toContain('Failed to sync policies');
  });

  it('verifyWebhook returns false and processWebhook is a no-op', async () => {
    const adapter = await makeConnected();
    expect(await adapter.verifyWebhook('p', 's')).toBe(false);
    await adapter.processWebhook({ id: 'evt', type: 'x', data: {} } as never);
    expect(true).toBe(true);
  });
});
