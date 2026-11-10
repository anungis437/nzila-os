import { beforeEach, describe, expect, it, vi } from 'vitest';

// Simulates the REAL AsyncLocalStorage-based routing in db/db.ts's `db`
// Proxy: every db.select() call is tagged with whether it happened while
// "inside" the (mocked) withSystemContext callback, so these tests prove
// the entire scheduler operation — not just the initial enumeration —
// runs through the system connection.
//
// SCOPE NOTE (PR #752 round 5): BillingCycleService.generateBillingCycle
// and the notification service are MOCKED below, so this file proves the
// scheduler INVOKES its dependencies while the (simulated) SYSTEM boundary
// is active — it does not, by itself, prove those dependencies' internal
// `db` access actually resolves to the system connection. That second half
// of the chain is proven independently, against the REAL (non-mocked)
// db/db.ts Proxy and the real source of each dependency, in
// billing-scheduler-system-boundary-proof.test.ts.
const m = vi.hoisted(() => {
  let depth = 0;
  const calls: string[] = [];
  const queue: unknown[][] = [];
  function chain() {
    const c: Record<string, unknown> = {};
    for (const fn of ['from', 'innerJoin', 'where', 'limit']) c[fn] = () => c;
    c.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
      const v = queue.length ? queue.shift() : [];
      return Promise.resolve(v).then(resolve, reject);
    };
    return c;
  }
  return {
    isSystem: () => depth > 0,
    enter: () => { depth += 1; },
    exit: () => { depth -= 1; },
    calls,
    queue,
    chain,
    withSystemContext: vi.fn(),
    activeSystemDb: vi.fn(),
    generateBillingCycle: vi.fn(),
    getFromEmail: vi.fn(),
    notificationServiceSend: vi.fn(),
  };
});

vi.mock('@/db/system-context-storage', () => ({
  getActiveSystemDb: () => m.activeSystemDb(),
}));

vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: async (fn: (tx: unknown) => Promise<unknown>) => {
    m.withSystemContext(fn);
    m.enter();
    try {
      return await fn({});
    } finally {
      m.exit();
    }
  },
}));

vi.mock('@/db', () => ({
  db: {
    select: (..._args: unknown[]) => {
      m.calls.push(m.isSystem() ? 'select:SYSTEM' : 'select:TENANT');
      return m.chain();
    },
  },
}));

vi.mock('@/db/schema-organizations', () => ({
  organizations: { id: 'id', name: 'name', status: 'status', slug: 'slug', email: 'email' },
  organizationMembers: { organizationId: 'organizationId', email: 'email', role: 'role' },
}));
vi.mock('@/db/schema/domains/finance/billing-config', () => ({
  organizationBillingConfig: { organizationId: 'organizationId', billingFrequency: 'billingFrequency', enabled: 'enabled' },
}));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), and: vi.fn(() => 'and'), inArray: vi.fn(() => 'inArray'), or: vi.fn(() => 'or') };
});
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/services/billing-cycle-service', () => ({
  BillingCycleService: {
    calculatePeriodDates: vi.fn(() => ({ periodStart: new Date(), periodEnd: new Date() })),
    generateBillingCycle: (...args: unknown[]) => m.generateBillingCycle(...args),
  },
}));
vi.mock('@/lib/services/notification-service', () => ({
  getNotificationService: () => ({ send: (...args: unknown[]) => m.notificationServiceSend(...args) }),
}));

async function loadModule() {
  return import('../billing-scheduler');
}

describe('BillingScheduler — full SYSTEM execution boundary (organization_billing_config is SYSTEM_ONLY)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.calls.length = 0;
    m.queue.length = 0;
    m.activeSystemDb.mockReturnValue(undefined);
    m.generateBillingCycle.mockResolvedValue({ transactionsCreated: 1, totalAmount: 10 });
    m.notificationServiceSend.mockResolvedValue({ success: true });
  });

  it('the entire runScheduledBilling operation — enumeration, per-org billing, and recipient/notification lookups — runs inside withSystemContext, never on the ordinary tenant connection', async () => {
    // organization_billing_config enumeration
    m.queue.push([{ organizationId: 'org-1', organizationName: 'Org One', frequency: 'monthly', enabled: true }]);
    // getBillingRecipients: org lookup, then org members lookup
    m.queue.push([{ id: 'org-1', slug: 'org-one', email: 'org1@example.com' }]);
    m.queue.push([{ email: 'admin@example.com' }]);

    const { BillingScheduler } = await loadModule();
    const result = await BillingScheduler.runScheduledBilling('monthly');

    expect(m.withSystemContext).toHaveBeenCalledTimes(1);
    expect(result.successful).toBe(1);
    expect(m.generateBillingCycle).toHaveBeenCalledTimes(1);
    expect(m.notificationServiceSend).toHaveBeenCalled();

    // Every db.select() call — enumeration AND recipient lookups for the
    // completion notification — happened while inside the system context.
    expect(m.calls.length).toBeGreaterThan(0);
    expect(m.calls.every((c) => c === 'select:SYSTEM')).toBe(true);
    expect(m.calls).not.toContain('select:TENANT');
  });

  it('getOrganizationsForBilling does not open a second, nested withSystemContext of its own', async () => {
    m.queue.push([]); // enumeration: no configured orgs

    const { BillingScheduler } = await loadModule();
    await BillingScheduler.runScheduledBilling('monthly');

    // Only the ONE outer withSystemContext call from runScheduledBilling.
    expect(m.withSystemContext).toHaveBeenCalledTimes(1);
  });

  it('does not infer monthly charges for active organizations without an enabled billing configuration', async () => {
    // An empty configured set must not trigger a second organization-wide
    // enumeration or any financial write, even for the monthly frequency.
    m.queue.push([]);
    const { BillingScheduler } = await loadModule();
    const result = await BillingScheduler.runScheduledBilling('monthly');

    expect(result.totalOrganizations).toBe(0);
    expect(result.successful).toBe(0);
    expect(m.calls).toEqual(['select:SYSTEM']);
    expect(m.generateBillingCycle).not.toHaveBeenCalled();
    expect(m.notificationServiceSend).not.toHaveBeenCalled();
  });

  it('does not infer charges for a non-monthly frequency without explicit configuration', async () => {
    m.queue.push([]);
    const { BillingScheduler } = await loadModule();
    const result = await BillingScheduler.runScheduledBilling('quarterly');

    expect(result.totalOrganizations).toBe(0);
    expect(m.calls).toEqual(['select:SYSTEM']);
    expect(m.generateBillingCycle).not.toHaveBeenCalled();
  });

  it('does not misreport successful financial writes when completion email fails', async () => {
    m.queue.push([{ organizationId: 'org-1', organizationName: 'Org One', frequency: 'monthly', enabled: true }]);
    m.queue.push([{ email: 'org1@example.com' }]);
    m.queue.push([]);
    m.notificationServiceSend.mockRejectedValueOnce(new Error('provider unavailable'));

    const { BillingScheduler } = await loadModule();
    const result = await BillingScheduler.runScheduledBilling('monthly');

    expect(result.successful).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.results[0].success).toBe(true);
    expect(m.generateBillingCycle).toHaveBeenCalledTimes(1);
  });

  it('continues to the next organization when failure notification delivery also fails', async () => {
    m.queue.push([
      { organizationId: 'org-1', organizationName: 'Org One', frequency: 'monthly', enabled: true },
      { organizationId: 'org-2', organizationName: 'Org Two', frequency: 'monthly', enabled: true },
    ]);
    // Failure recipient lookup for org-1.
    m.queue.push([{ email: 'org1@example.com' }]);
    m.queue.push([]);
    // Completion recipient lookup for org-2.
    m.queue.push([{ email: 'org2@example.com' }]);
    m.queue.push([]);
    m.generateBillingCycle.mockRejectedValueOnce(new Error('mandate refused'))
      .mockResolvedValueOnce({ transactionsCreated: 1, totalAmount: 10 });
    m.notificationServiceSend.mockRejectedValueOnce(new Error('mail offline'));

    const { BillingScheduler } = await loadModule();
    const result = await BillingScheduler.runScheduledBilling('monthly');

    expect(result.failed).toBe(1);
    expect(result.successful).toBe(1);
    expect(result.results.map((entry) => entry.success)).toEqual([false, true]);
    expect(m.generateBillingCycle).toHaveBeenCalledTimes(2);
  });

  it.each(['daily', '', 'MONTHLY', null, undefined])(
    'rejects unsupported scheduler frequency %s before privileged context or financial work',
    async (invalidFrequency) => {
      const { BillingScheduler } = await loadModule();
      await expect(BillingScheduler.runScheduledBilling(invalidFrequency as never))
        .rejects.toThrow('Unsupported billing frequency');
      expect(m.withSystemContext).not.toHaveBeenCalled();
      expect(m.calls).toEqual([]);
      expect(m.generateBillingCycle).not.toHaveBeenCalled();
      expect(m.notificationServiceSend).not.toHaveBeenCalled();
    },
  );

  it('rejects an unsupported manual frequency without enumerating organizations', async () => {
    const { BillingScheduler } = await loadModule();
    await expect(BillingScheduler.manualTrigger('daily' as never))
      .rejects.toThrow('Unsupported billing frequency');
    expect(m.withSystemContext).not.toHaveBeenCalled();
    expect(m.calls).toEqual([]);
    expect(m.generateBillingCycle).not.toHaveBeenCalled();
  });

  it('manualTrigger delegates to the same SYSTEM-context-wrapped runScheduledBilling', async () => {
    m.queue.push([]);
    const { BillingScheduler } = await loadModule();
    await BillingScheduler.manualTrigger('weekly');

    expect(m.withSystemContext).toHaveBeenCalledTimes(1);
  });

  it('lends the run the transaction of a caller that already runs as the system role: no second one is opened on another connection', async () => {
    m.activeSystemDb.mockReturnValue({});
    m.queue.push([]); // enumeration: no configured orgs

    const { BillingScheduler } = await loadModule();
    const result = await BillingScheduler.manualTrigger('monthly');

    expect(m.withSystemContext).not.toHaveBeenCalled();
    expect(result.totalOrganizations).toBe(0);
  });

  it('looks the notification recipients up by the organization uuid: the members table holds no organization slug', async () => {
    const { eq, inArray } = await import('drizzle-orm');
    m.queue.push([{ organizationId: 'org-1', organizationName: 'Org One', frequency: 'monthly', enabled: true }]);
    m.queue.push([{ email: 'org1@example.com' }]);
    m.queue.push([{ email: 'admin@example.com' }]);

    const { BillingScheduler } = await loadModule();
    await BillingScheduler.runScheduledBilling('monthly');

    expect(vi.mocked(inArray).mock.calls.map((call) => call[1])).toEqual([
      ['admin', 'super_admin', 'billing_manager', 'billing_specialist'],
    ]);
    expect(eq).toHaveBeenCalledWith('organizationId', 'org-1');
    expect(m.notificationServiceSend.mock.calls.map(([message]) => message.recipientEmail).sort()).toEqual(['admin@example.com', 'org1@example.com']);
  });
});

