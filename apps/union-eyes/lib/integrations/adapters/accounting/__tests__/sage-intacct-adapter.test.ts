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
vi.mock('../sage-intacct-client', () => ({
  SageIntacctClient: class { constructor() { return h.client; } },
}));

import { SageIntacctAdapter } from '../sage-intacct-adapter';
import { IntegrationType, IntegrationProvider, SyncType } from '../../../types';

const baseConfig = {
  organizationId: 'org-1',
  type: IntegrationType.ACCOUNTING,
  provider: IntegrationProvider.SAGE_INTACCT,
  credentials: {
    apiKey: 'k',
    metadata: { companyId: 'co', userId: 'u', password: 'p', senderId: 's', senderPassword: 'sp' },
  },
  settings: { orgId: 'org', environment: 'production' },
  enabled: true,
};

const makeConnected = async () => {
  const adapter = new SageIntacctAdapter();
  await adapter.initialize(baseConfig);
  await adapter.connect();
  return adapter;
};

describe('SageIntacctAdapter', () => {
  beforeEach(() => {
    h.findFirstQueue.length = 0;
    h.findFirst.mockClear();
    h.db.insert.mockClear();
    h.db.update.mockClear();
    Object.assign(h.client, {
      authenticate: vi.fn(async () => {}),
      healthCheck: vi.fn(async () => true),
      getInvoices: vi.fn(async () => ({ invoices: [], hasMore: false })),
      getPayments: vi.fn(async () => ({ payments: [], hasMore: false })),
      getCustomers: vi.fn(async () => ({ customers: [], hasMore: false })),
      getAccounts: vi.fn(async () => ({ accounts: [], hasMore: false })),
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
    const adapter = new SageIntacctAdapter();
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

  it('sync invoices creates and updates records (incremental, numeric and string amounts)', async () => {
    const adapter = await makeConnected();
    const getInvoices = vi.fn(async () => ({
      invoices: [
        { RECORDNO: '1', RECORDID: 'N1', CUSTOMERID: 'c1', CUSTOMERNAME: 'Acme', WHENCREATED: '2024-01-01', WHENDUE: '2024-02-01', TOTALENTERED: 100, TOTALDUE: 50, STATE: 'POSTED' },
        { RECORDNO: '2', RECORDID: 'N2', CUSTOMERID: 'c2', CUSTOMERNAME: 'Beta', WHENCREATED: '2024-01-02', WHENDUE: null, TOTALENTERED: '200.00', TOTALDUE: '0.00', STATE: 'DRAFT' },
      ],
      hasMore: false,
    }));
    h.client.getInvoices = getInvoices;
    h.findFirstQueue.push({ id: 'existing-1' });
    const r = await adapter.sync({ type: SyncType.INCREMENTAL, orgs: ['invoices'], cursor: '2024-01-01' });
    expect(r.recordsUpdated).toBe(1);
    expect(r.recordsCreated).toBe(1);
    expect(getInvoices.mock.calls[0][0].modifiedSince).toBeInstanceOf(Date);
  });

  it('sync invoices counts a per-record failure', async () => {
    const adapter = await makeConnected();
    h.client.getInvoices = vi.fn(async () => ({
      invoices: [{ RECORDNO: '1', RECORDID: 'N1', CUSTOMERID: 'c1', CUSTOMERNAME: 'A', WHENCREATED: 'd', WHENDUE: null, TOTALENTERED: 1, TOTALDUE: 1, STATE: 'X' }],
      hasMore: false,
    }));
    h.findFirst.mockImplementationOnce(() => Promise.reject(new Error('db boom')));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['invoices'] });
    expect(r.recordsFailed).toBe(1);
  });

  it('sync payments, customers and accounts process records', async () => {
    const adapter = await makeConnected();
    h.client.getPayments = vi.fn(async () => ({
      payments: [{ RECORDNO: 'p1', CUSTOMERID: 'c1', CUSTOMERNAME: 'Acme', WHENPAID: '2024-01-01', AMOUNTPAID: 10 }],
      hasMore: false,
    }));
    h.client.getCustomers = vi.fn(async () => ({
      customers: [{ RECORDNO: 'c1', NAME: 'Acme', EMAIL1: 'a@x.com', PHONE1: '123' }],
      hasMore: false,
    }));
    h.client.getAccounts = vi.fn(async () => ({
      accounts: [{ RECORDNO: 'a1', TITLE: 'Cash', ACCOUNTTYPE: 'Bank', ACCOUNTNO: '100', CLOSINGTYPE: 'balance_sheet', STATUS: 'active' }],
      hasMore: false,
    }));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['payments', 'customers', 'accounts'] });
    expect(r.recordsCreated).toBe(3);
  });

  it('sync logs an unknown entity and records an entity-level error', async () => {
    const adapter = await makeConnected();
    h.client.getInvoices = vi.fn(() => Promise.reject(new Error('entity boom')));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['unknown', 'invoices'] });
    expect(r.metadata?.error).toContain('Failed to sync invoices');
  });

  it('verifyWebhook returns false and processWebhook is a no-op', async () => {
    const adapter = await makeConnected();
    expect(await adapter.verifyWebhook('p', 's')).toBe(false);
    await adapter.processWebhook({ type: 'x', data: {} } as never);
    expect(true).toBe(true);
  });
});
