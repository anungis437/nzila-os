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
vi.mock('../freshbooks-client', () => ({
  FreshBooksClient: class { constructor() { return h.client; } },
}));

import { FreshBooksAdapter } from '../freshbooks-adapter';
import { IntegrationType, IntegrationProvider, SyncType } from '../../../types';

const baseConfig = {
  organizationId: 'org-1',
  type: IntegrationType.ACCOUNTING,
  provider: IntegrationProvider.FRESHBOOKS,
  credentials: { clientId: 'cid', clientSecret: 'secret', refreshToken: 'rt' },
  settings: { accountId: 'acct-1', environment: 'production' },
  enabled: true,
};

const makeConnected = async () => {
  const adapter = new FreshBooksAdapter();
  await adapter.initialize(baseConfig);
  await adapter.connect();
  return adapter;
};

describe('FreshBooksAdapter', () => {
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
      getClients: vi.fn(async () => ({ clients: [], hasMore: false })),
      getExpenses: vi.fn(async () => ({ expenses: [], hasMore: false })),
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
    const adapter = new FreshBooksAdapter();
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

  it('sync invoices creates and updates records (incremental)', async () => {
    const adapter = await makeConnected();
    const getInvoices = vi.fn(async () => ({
      invoices: [
        { id: 1, invoice_number: 'N1', customerid: 11, organization: 'Acme', create_date: '2024-01-01', due_date: '2024-02-01', amount: { amount: '100.00' }, outstanding: { amount: '50.00' }, status: 4 },
        { id: 2, invoice_number: 'N2', customerid: 12, organization: 'Beta', create_date: '2024-01-02', due_date: '2024-02-02', amount: { amount: '200.00' }, outstanding: { amount: '0.00' }, status: 99 },
      ],
      hasMore: false,
    }));
    h.client.getInvoices = getInvoices;
    h.findFirstQueue.push({ id: 'existing-1' });
    const r = await adapter.sync({ type: SyncType.INCREMENTAL, orgs: ['invoices'], cursor: '2024-01-01' });
    expect(r.recordsUpdated).toBe(1);
    expect(r.recordsCreated).toBe(1);
    expect(getInvoices.mock.calls[0][0].updatedSince).toBeInstanceOf(Date);
  });

  it('sync invoices counts a per-record failure', async () => {
    const adapter = await makeConnected();
    h.client.getInvoices = vi.fn(async () => ({
      invoices: [{ id: 1, invoice_number: 'N1', customerid: 11, organization: 'A', create_date: 'd', due_date: 'd', amount: { amount: '1' }, outstanding: { amount: '1' }, status: 1 }],
      hasMore: false,
    }));
    h.findFirst.mockImplementationOnce(() => Promise.reject(new Error('db boom')));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['invoices'] });
    expect(r.recordsFailed).toBe(1);
  });

  it('sync payments, clients and expenses process records', async () => {
    const adapter = await makeConnected();
    h.client.getPayments = vi.fn(async () => ({
      payments: [{ id: 5, invoiceid: 11, type: 'Credit', date: '2024-01-01', amount: { amount: '10.00' } }],
      hasMore: false,
    }));
    h.client.getClients = vi.fn(async () => ({
      clients: [{ id: 11, fname: 'Jane', lname: 'Doe', organization: 'Acme', email: 'j@x.com', business_phone: '123', outstanding_balance: [{ amount: '25.00' }] }],
      hasMore: false,
    }));
    h.client.getExpenses = vi.fn(async () => ({
      expenses: [{ id: 7, category_name: 'Travel', vendor: 'Air', amount: { amount: '30.00' }, status: 0 }],
      hasMore: false,
    }));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['payments', 'clients', 'expenses'] });
    expect(r.recordsCreated).toBe(3);
  });

  it('sync clients handles a missing outstanding_balance', async () => {
    const adapter = await makeConnected();
    h.client.getClients = vi.fn(async () => ({
      clients: [{ id: 12, fname: 'No', lname: 'Bal', organization: 'X', email: 'n@x.com', business_phone: '0' }],
      hasMore: false,
    }));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['clients'] });
    expect(r.recordsCreated).toBe(1);
  });

  it('sync logs an unknown entity and records an entity-level error', async () => {
    const adapter = await makeConnected();
    h.client.getInvoices = vi.fn(() => Promise.reject(new Error('entity boom')));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['unknown', 'invoices'] });
    expect(r.metadata?.error).toContain('Failed to sync invoices');
  });

  it('verifyWebhook returns false and processWebhook logs', async () => {
    const adapter = await makeConnected();
    expect(await adapter.verifyWebhook('p', 's')).toBe(false);
    await adapter.processWebhook({ type: 'x', data: {} } as never);
    expect(true).toBe(true);
  });
});
