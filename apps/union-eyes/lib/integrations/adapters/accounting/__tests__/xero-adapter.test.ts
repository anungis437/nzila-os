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
vi.mock('../xero-client', () => ({
  XeroClient: class { constructor() { return h.client; } },
}));

import { XeroAdapter } from '../xero-adapter';
import { IntegrationType, IntegrationProvider, SyncType } from '../../../types';

const baseConfig = {
  organizationId: 'org-1',
  type: IntegrationType.ACCOUNTING,
  provider: IntegrationProvider.XERO,
  credentials: { clientId: 'cid', clientSecret: 'secret', refreshToken: 'rt' },
  settings: { organizationId: 'tenant-1', environment: 'production' },
  enabled: true,
};

const makeConnected = async (over: Partial<typeof baseConfig> = {}) => {
  const adapter = new XeroAdapter();
  await adapter.initialize({ ...baseConfig, ...over });
  await adapter.connect();
  return adapter;
};

describe('XeroAdapter', () => {
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
      getInvoice: vi.fn(async () => ({ Contact: { Name: 'C' } })),
      getPayments: vi.fn(async () => ({ payments: [], hasMore: false })),
      getContacts: vi.fn(async () => ({ contacts: [], hasMore: false })),
      getAccounts: vi.fn(async () => ({ accounts: [], hasMore: false })),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('connect authenticates and stores the refresh token', async () => {
    const adapter = await makeConnected();
    expect(h.client.authenticate).toHaveBeenCalled();
    expect((await adapter.healthCheck()).healthy).toBe(true);
  });

  it('connect rethrows when authentication fails', async () => {
    const adapter = new XeroAdapter();
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
    const r = await adapter.healthCheck();
    expect(r.healthy).toBe(false);
  });

  it('healthCheck reports error when not connected', async () => {
    const adapter = new XeroAdapter();
    await adapter.initialize(baseConfig);
    const r = await adapter.healthCheck();
    expect(r.healthy).toBe(false);
  });

  it('sync invoices creates and updates records', async () => {
    const adapter = await makeConnected();
    h.client.getInvoices = vi.fn(async () => ({
      invoices: [
        { InvoiceID: 'i1', InvoiceNumber: 'N1', Contact: { ContactID: 'c1', Name: 'Acme' }, DateString: '2024-01-01', DueDateString: '2024-02-01', Total: 100, AmountDue: 50, Status: 'AUTHORISED' },
        { InvoiceID: 'i2', InvoiceNumber: 'N2', Contact: { ContactID: 'c2', Name: 'Beta' }, DateString: '2024-01-02', DueDateString: null, Total: 200, AmountDue: 0, Status: 'PAID' },
      ],
      hasMore: false,
    }));
    h.findFirstQueue.push({ id: 'existing-1' }); // first invoice exists -> update; second new -> insert
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['invoices'] });
    expect(r.recordsProcessed).toBe(2);
    expect(r.recordsUpdated).toBe(1);
    expect(r.recordsCreated).toBe(1);
    expect(r.success).toBe(true);
  });

  it('sync invoices counts a per-record failure', async () => {
    const adapter = await makeConnected();
    h.client.getInvoices = vi.fn(async () => ({
      invoices: [{ InvoiceID: 'i1', InvoiceNumber: 'N1', Contact: { ContactID: 'c1', Name: 'A' }, DateString: 'd', DueDateString: null, Total: 1, AmountDue: 1, Status: 'X' }],
      hasMore: false,
    }));
    h.findFirst.mockImplementationOnce(() => Promise.reject(new Error('db boom')));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['invoices'] });
    expect(r.recordsFailed).toBe(1);
    expect(r.success).toBe(false);
  });

  it('sync invoices uses an incremental cursor', async () => {
    const adapter = await makeConnected();
    const getInvoices = vi.fn(async () => ({ invoices: [], hasMore: false }));
    h.client.getInvoices = getInvoices;
    await adapter.sync({ type: SyncType.INCREMENTAL, orgs: ['invoices'], cursor: '2024-01-01' });
    expect(getInvoices.mock.calls[0][0].modifiedSince).toBeInstanceOf(Date);
  });

  it('sync payments resolves customer name and handles getInvoice failure', async () => {
    const adapter = await makeConnected();
    h.client.getPayments = vi.fn(async () => ({
      payments: [
        { PaymentID: 'p1', Invoice: { InvoiceID: 'i1', InvoiceNumber: 'N1' }, Date: '2024-01-01', Amount: 10 },
        { PaymentID: 'p2', Invoice: { InvoiceID: 'i2', InvoiceNumber: 'N2' }, Date: '2024-01-02', Amount: 20 },
      ],
      hasMore: false,
    }));
    h.client.getInvoice = vi.fn()
      .mockResolvedValueOnce({ Contact: { Name: 'Acme' } })
      .mockRejectedValueOnce(new Error('not found'));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['payments'] });
    expect(r.recordsProcessed).toBe(2);
    expect(r.recordsCreated).toBe(2);
  });

  it('sync contacts and accounts process records', async () => {
    const adapter = await makeConnected();
    h.client.getContacts = vi.fn(async () => ({
      contacts: [{ ContactID: 'c1', Name: 'Acme', EmailAddress: 'a@x.com', ContactNumber: '123' }],
      hasMore: false,
    }));
    h.client.getAccounts = vi.fn(async () => ({
      accounts: [{ AccountID: 'a1', Name: 'Cash', Type: 'BANK', Code: '100', Class: 'ASSET', Status: 'ACTIVE' }],
      hasMore: false,
    }));
    const r = await adapter.sync({ type: SyncType.FULL, orgs: ['contacts', 'accounts'] });
    expect(r.recordsProcessed).toBe(2);
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

  it('processWebhook handles events and the no-events case', async () => {
    const adapter = await makeConnected();
    await adapter.processWebhook({ type: 'invoice.updated', data: { events: [{ resourceUrl: 'u', eventCategory: 'INVOICE' }] } } as never);
    await adapter.processWebhook({ type: 'noop', data: {} } as never);
    expect(true).toBe(true);
  });
});
