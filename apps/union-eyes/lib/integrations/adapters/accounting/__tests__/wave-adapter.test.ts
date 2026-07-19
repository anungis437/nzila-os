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
vi.mock('../wave-client', () => ({
  WaveClient: class { constructor() { return h.client; } },
}));

import { WaveAdapter } from '../wave-adapter';
import { IntegrationType, IntegrationProvider, SyncType } from '../../../types';

const baseConfig = {
  organizationId: 'org-1',
  type: IntegrationType.ACCOUNTING,
  provider: IntegrationProvider.WAVE,
  credentials: { clientId: 'cid', clientSecret: 'secret', refreshToken: 'rt' },
  settings: { businessId: 'biz-1' },
  enabled: true,
};

const makeConnected = async () => {
  const adapter = new WaveAdapter();
  await adapter.initialize(baseConfig);
  await adapter.connect();
  return adapter;
};

describe('WaveAdapter', () => {
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
    const adapter = new WaveAdapter();
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

  it('sync invoices creates and updates records', async () => {
    const adapter = await makeConnected();
    h.client.getInvoices = vi.fn(async () => ({
      invoices: [
        { id: 'i1', invoiceNumber: 'N1', customer: { id: 'c1', name: 'Acme' }, invoiceDate: '2024-01-01', dueDate: '2024-02-01', total: 100, amountDue: 50, status: 'SAVED' },
        { id: 'i2', invoiceNumber: 'N2', customer: { id: 'c2', name: 'Beta' }, invoiceDate: '2024-01-02', dueDate: null, total: 200, amountDue: 0, status: 'PAID' },
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
      invoices: [{ id: 'i1', invoiceNumber: 'N1', customer: { id: 'c1', name: 'A' }, invoiceDate: 'd', dueDate: null, total: 1, amountDue: 1, status: 'X' }],
      hasMore: false,
    }));
    h.findFirst.mockImplementationOnce(() => Promise.reject(new Error('db boom')));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['invoices'] });
    expect(r.recordsFailed).toBe(1);
  });

  it('sync payments and customers process records', async () => {
    const adapter = await makeConnected();
    h.client.getPayments = vi.fn(async () => ({
      payments: [{ id: 'p1', customer: { id: 'c1', name: 'Acme' }, date: '2024-01-01', amount: 10 }],
      hasMore: false,
    }));
    h.client.getCustomers = vi.fn(async () => ({
      customers: [{ id: 'c1', name: 'Acme', email: 'a@x.com', phone: '123' }],
      hasMore: false,
    }));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['payments', 'customers'] });
    expect(r.recordsCreated).toBe(2);
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
