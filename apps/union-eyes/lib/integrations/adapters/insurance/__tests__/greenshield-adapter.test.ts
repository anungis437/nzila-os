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
vi.mock('../greenshield-client', () => ({
  GreenShieldClient: class { constructor() { return h.client; } },
}));

import { GreenShieldAdapter } from '../greenshield-adapter';
import { IntegrationType, IntegrationProvider, SyncType } from '../../../types';

const baseConfig = {
  organizationId: 'org-1',
  type: IntegrationType.INSURANCE,
  provider: IntegrationProvider.GREEN_SHIELD_CANADA,
  credentials: { clientId: 'cid', clientSecret: 'secret', refreshToken: 'rt' },
  settings: { groupNumber: 'g-1' },
  enabled: true,
};

const makeConnected = async () => {
  const adapter = new GreenShieldAdapter();
  await adapter.initialize(baseConfig);
  await adapter.connect();
  return adapter;
};

describe('GreenShieldAdapter', () => {
  beforeEach(() => {
    h.selectQueue.length = 0;
    h.limit.mockClear();
    h.valuesFn.mockReset();
    h.valuesFn.mockImplementation(async () => ({}));
    Object.assign(h.client, {
      authenticate: vi.fn(async () => {}),
      getRefreshToken: vi.fn(() => 'rt-new'),
      healthCheck: vi.fn(async () => true),
      getPlans: vi.fn(async () => []),
      getEnrollments: vi.fn(async () => []),
      getClaims: vi.fn(async () => []),
      getCoverage: vi.fn(async () => []),
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
    const adapter = new GreenShieldAdapter();
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

  it('sync plans creates and updates records (incremental)', async () => {
    const adapter = await makeConnected();
    h.client.getPlans = vi.fn(async () => ([
      { external_id: 'p1', plan_name: 'Gold', plan_type: 'health', coverage_level: 'family', premium: 100, status: 'active', effective_date: 'd', expiry_date: null },
      { external_id: 'p2', plan_name: 'Silver', plan_type: 'dental', coverage_level: 'single', premium: 50, status: 'active', effective_date: 'd', expiry_date: 'd2' },
    ]));
    h.selectQueue.push([{ id: 'existing-1' }]);
    const r = await adapter.sync({ type: SyncType.INCREMENTAL, orgs: ['plans'], cursor: '2024-01-01' });
    expect(r.recordsUpdated).toBe(1);
    expect(r.recordsCreated).toBe(1);
  });

  it('sync plans counts a per-record failure', async () => {
    const adapter = await makeConnected();
    h.client.getPlans = vi.fn(async () => ([
      { external_id: 'p1', plan_name: 'Gold', plan_type: 'h', coverage_level: 'f', premium: 1, status: 's', effective_date: 'd' },
    ]));
    h.valuesFn.mockImplementationOnce(() => Promise.reject(new Error('insert boom')));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['plans'] });
    expect(r.recordsFailed).toBe(1);
  });

  it('sync enrollments, claims and coverage process records', async () => {
    const adapter = await makeConnected();
    h.client.getEnrollments = vi.fn(async () => ([
      { external_id: 'e1', employee_id: 'emp1', employee_name: 'A', plan_id: 'p1', coverage_start: 'd', coverage_end: null, employee_contribution: 40, status: 'active' },
    ]));
    h.client.getClaims = vi.fn(async () => ([
      { external_id: 'c1', claim_number: 'CN1', employee_id: 'emp1', member_name: 'Jane', claim_date: 'd', claim_type: 'dental', claim_amount: 100, approved_amount: 90, paid_amount: 90, status: 'paid', provider_name: 'Prov', service_date: 'd' },
    ]));
    h.client.getCoverage = vi.fn(async () => ([
      { external_id: 'cov1', member_id: 'emp1', plan_id: 'p1', coverage_type: 'health', coverage_amount: 1000, deductible: 50, status: 'active', effective_date: 'd', expiry_date: null },
    ]));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['enrollments', 'claims', 'coverage'] });
    expect(r.recordsCreated).toBe(3);
  });

  it('sync records an Unknown entity error and an entity-level error', async () => {
    const adapter = await makeConnected();
    h.client.getPlans = vi.fn(() => Promise.reject(new Error('entity boom')));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['mystery', 'plans'] });
    const messages = (r.errors ?? []).map((e) => e.error).join(' | ');
    expect(messages).toContain('Unknown entity type: mystery');
    expect(messages).toContain('Failed to sync plans');
  });

  it('verifyWebhook returns false and processWebhook is a no-op', async () => {
    const adapter = await makeConnected();
    expect(await adapter.verifyWebhook('p', 's')).toBe(false);
    await adapter.processWebhook({ type: 'x', data: {} } as never);
    expect(true).toBe(true);
  });
});
