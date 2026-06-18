import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const h = vi.hoisted(() => {
  const findFirstQueue: unknown[] = [];
  const findFirst = vi.fn(async () => (findFirstQueue.length ? findFirstQueue.shift() : undefined));
  const tableProxy = new Proxy({}, { get: () => ({ findFirst }) });
  const db = {
    query: tableProxy,
    insert: vi.fn(() => ({ values: vi.fn(async () => ({})) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => ({})) })) })),
    delete: vi.fn(() => ({ where: vi.fn(async () => ({})) })),
  };
  const client: Record<string, ReturnType<typeof vi.fn>> = {};
  return { findFirstQueue, findFirst, db, client };
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
vi.mock('../manulife-client', () => ({
  ManulifeClient: class { constructor() { return h.client; } },
}));

import { ManulifeAdapter } from '../manulife-adapter';
import { IntegrationType, IntegrationProvider, SyncType } from '../../../types';

const baseConfig = {
  organizationId: 'org-1',
  type: IntegrationType.INSURANCE,
  provider: IntegrationProvider.MANULIFE,
  credentials: { clientId: 'cid', clientSecret: 'secret', refreshToken: 'rt' },
  settings: { policyGroupId: 'pg-1' },
  enabled: true,
};

const makeConnected = async () => {
  const adapter = new ManulifeAdapter();
  await adapter.initialize(baseConfig);
  await adapter.connect();
  return adapter;
};

describe('ManulifeAdapter', () => {
  beforeEach(() => {
    h.findFirstQueue.length = 0;
    h.findFirst.mockClear();
    h.db.insert.mockClear();
    h.db.update.mockClear();
    Object.assign(h.client, {
      authenticate: vi.fn(async () => {}),
      getRefreshToken: vi.fn(() => 'rt-new'),
      healthCheck: vi.fn(async () => true),
      getClaims: vi.fn(async () => ({ data: [], hasMore: false })),
      getPolicies: vi.fn(async () => ({ data: [], hasMore: false })),
      getBeneficiaries: vi.fn(async () => ({ data: [], hasMore: false })),
      getUtilization: vi.fn(async () => ({ data: [], hasMore: false })),
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
    const adapter = new ManulifeAdapter();
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

  it('sync claims creates and updates records (incremental)', async () => {
    const adapter = await makeConnected();
    h.client.getClaims = vi.fn(async () => ({
      data: [
        { claimId: 'c1', claimNumber: 'N1', employeeId: 'e1', employeeName: 'A', policyNumber: 'P1', claimType: 't', serviceDate: 'd', submissionDate: 'd', processedDate: 'd', claimAmount: 100, approvedAmount: 90, paidAmount: 90, deniedAmount: 0, status: 'paid', denialReason: null, providerId: 'pr1', providerName: 'Prov' },
        { claimId: 'c2', claimNumber: 'N2', employeeId: 'e2', employeeName: 'B', policyNumber: 'P2', claimType: 't', serviceDate: 'd', submissionDate: 'd', claimAmount: null, status: 'pending' },
      ],
      hasMore: false,
    }));
    h.findFirstQueue.push({ id: 'existing-1' });
    const r = await adapter.sync({ type: SyncType.INCREMENTAL, orgs: ['claims'], cursor: '2024-01-01' });
    expect(r.recordsUpdated).toBe(1);
    expect(r.recordsCreated).toBe(1);
  });

  it('sync claims counts a per-record failure', async () => {
    const adapter = await makeConnected();
    h.client.getClaims = vi.fn(async () => ({
      data: [{ claimId: 'c1', claimNumber: 'N1', employeeId: 'e1', employeeName: 'A', policyNumber: 'P1', claimType: 't', serviceDate: 'd', submissionDate: 'd', claimAmount: 1, status: 's' }],
      hasMore: false,
    }));
    h.findFirst.mockImplementationOnce(() => Promise.reject(new Error('db boom')));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['claims'] });
    expect(r.recordsFailed).toBe(1);
  });

  it('sync policies, beneficiaries and utilization process records', async () => {
    const adapter = await makeConnected();
    h.client.getPolicies = vi.fn(async () => ({
      data: [{ policyId: 'p1', policyNumber: 'PN1', policyType: 'life', employeeId: 'e1', effectiveDate: 'd', terminationDate: null, coverageAmount: 1000, premium: 50, status: 'active' }],
      hasMore: false,
    }));
    h.client.getBeneficiaries = vi.fn(async () => ({
      data: [{ beneficiaryId: 'b1', policyId: 'p1', employeeId: 'e1', firstName: 'A', lastName: 'B', relationship: 'spouse', percentage: 100, isPrimary: true, status: 'active' }],
      hasMore: false,
    }));
    h.client.getUtilization = vi.fn(async () => ({
      data: [{ utilizationId: 'u1', employeeId: 'e1', policyId: 'p1', benefitType: 'dental', periodStart: 'd', periodEnd: 'd', maximumBenefit: 500, utilized: 100, remaining: 400 }],
      hasMore: false,
    }));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['policies', 'beneficiaries', 'utilization'] });
    expect(r.recordsCreated).toBe(3);
  });

  it('sync logs an unknown entity and records an entity-level error', async () => {
    const adapter = await makeConnected();
    h.client.getClaims = vi.fn(() => Promise.reject(new Error('entity boom')));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['unknown', 'claims'] });
    expect(r.errors?.[0]?.error).toContain('Failed to sync claims');
  });

  it('verifyWebhook returns false and processWebhook is a no-op', async () => {
    const adapter = await makeConnected();
    expect(await adapter.verifyWebhook('p', 's')).toBe(false);
    await adapter.processWebhook({ type: 'x', data: {} } as never);
    expect(true).toBe(true);
  });
});
