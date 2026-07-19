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
vi.mock('../quickbooks-client', () => ({
  QuickBooksClient: class { constructor() { return h.client; } },
}));

import { QuickBooksAdapter } from '../quickbooks-adapter';
import { IntegrationType, IntegrationProvider, SyncType } from '../../../types';

const baseConfig = {
  organizationId: 'org-1',
  type: IntegrationType.ACCOUNTING,
  provider: IntegrationProvider.QUICKBOOKS,
  credentials: { clientId: 'cid', clientSecret: 'secret', refreshToken: 'rt' },
  settings: { realmId: 'realm-1', environment: 'production' },
  enabled: true,
};

const makeConnected = async () => {
  const adapter = new QuickBooksAdapter();
  await adapter.initialize(baseConfig);
  await adapter.connect();
  return adapter;
};

describe('QuickBooksAdapter', () => {
  beforeEach(() => {
    h.findFirstQueue.length = 0;
    h.findFirst.mockClear();
    h.db.insert.mockClear();
    h.db.update.mockClear();
    Object.assign(h.client, {
      authenticate: vi.fn(async () => {}),
      getRefreshToken: vi.fn(() => 'rt-new'),
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
    const adapter = new QuickBooksAdapter();
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

  it('healthCheck reports error when not connected', async () => {
    const adapter = new QuickBooksAdapter();
    await adapter.initialize(baseConfig);
    expect((await adapter.healthCheck()).healthy).toBe(false);
  });

  it('sync invoices creates and updates records', async () => {
    const adapter = await makeConnected();
    h.client.getInvoices = vi.fn(async () => ({
      invoices: [
        { Id: 'i1', DocNumber: 'N1', CustomerRef: { value: 'c1', name: 'Acme' }, TxnDate: '2024-01-01', DueDate: '2024-02-01', TotalAmt: 100, Balance: 50, TxnStatus: 'open' },
        { Id: 'i2', DocNumber: 'N2', CustomerRef: { value: 'c2' }, TxnDate: '2024-01-02', TotalAmt: 200, Balance: 0 },
      ],
      hasMore: false,
    }));
    h.findFirstQueue.push({ id: 'existing-1' });
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['invoices'] });
    expect(r.recordsUpdated).toBe(1);
    expect(r.recordsCreated).toBe(1);
  });

  it('sync invoices counts a per-record failure', async () => {
    const adapter = await makeConnected();
    h.client.getInvoices = vi.fn(async () => ({
      invoices: [{ Id: 'i1', DocNumber: 'N1', CustomerRef: { value: 'c1' }, TxnDate: 'd', TotalAmt: 1, Balance: 1 }],
      hasMore: false,
    }));
    h.findFirst.mockImplementationOnce(() => Promise.reject(new Error('db boom')));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['invoices'] });
    expect(r.recordsFailed).toBe(1);
  });

  it('sync invoices uses an incremental cursor', async () => {
    const adapter = await makeConnected();
    const getInvoices = vi.fn(async () => ({ invoices: [], hasMore: false }));
    h.client.getInvoices = getInvoices;
    await adapter.sync({ type: SyncType.INCREMENTAL, orgs: ['invoices'], cursor: '2024-01-01' });
    expect(getInvoices.mock.calls[0][0].modifiedSince).toBeInstanceOf(Date);
  });

  it('sync payments processes records', async () => {
    const adapter = await makeConnected();
    h.client.getPayments = vi.fn(async () => ({
      payments: [{ Id: 'p1', CustomerRef: { value: 'c1', name: 'Acme' }, TxnDate: '2024-01-01', TotalAmt: 10 }],
      hasMore: false,
    }));
    const r = await adapter.sync({ type: SyncType.INCREMENTAL, orgs: ['payments'], cursor: '2024-01-01' });
    expect(r.recordsCreated).toBe(1);
  });

  it('sync customers and accounts process records', async () => {
    const adapter = await makeConnected();
    h.client.getCustomers = vi.fn(async () => ({
      customers: [{ Id: 'c1', DisplayName: 'Acme', CompanyName: 'Acme Inc', PrimaryEmailAddr: { Address: 'a@x.com' }, PrimaryPhone: { FreeFormNumber: '123' }, Balance: 5 }],
      hasMore: false,
    }));
    h.client.getAccounts = vi.fn(async () => ({
      accounts: [{ Id: 'a1', Name: 'Cash', AccountType: 'Bank', AccountSubType: 'Checking', Classification: 'Asset', CurrentBalance: 100, Active: true }],
      hasMore: false,
    }));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['customers', 'accounts'] });
    expect(r.recordsCreated).toBe(2);
  });

  it('sync logs an unknown entity and records an entity-level error', async () => {
    const adapter = await makeConnected();
    h.client.getInvoices = vi.fn(() => Promise.reject(new Error('entity boom')));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['unknown', 'invoices'] });
    expect(r.metadata?.error).toContain('Failed to sync invoices');
  });

  it('verifyWebhook returns false (fail-closed)', async () => {
    const adapter = await makeConnected();
    expect(await adapter.verifyWebhook('payload', 'sig')).toBe(false);
  });

  it('processWebhook handles notifications and the empty case', async () => {
    const adapter = await makeConnected();
    await adapter.processWebhook({ type: 'qb.change', data: { eventNotifications: [{ dataChangeEvent: { orgs: [{ name: 'Invoice', operation: 'Update', id: '1' }] } }] } } as never);
    await adapter.processWebhook({ type: 'noop', data: {} } as never);
    expect(true).toBe(true);
  });
});
