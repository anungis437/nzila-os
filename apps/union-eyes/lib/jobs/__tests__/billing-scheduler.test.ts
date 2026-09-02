import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withSystemContext: vi.fn(),
  dbSelect: vi.fn(),
}));

vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/db', () => ({ db: { select: m.dbSelect } }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/services/notification-service', () => ({ getNotificationService: vi.fn() }));
vi.mock('@/lib/services/billing-cycle-service', () => ({ BillingCycleService: { calculatePeriodDates: vi.fn(), generateBillingCycle: vi.fn() } }));

function mockTx(configuredRows: unknown[]) {
  m.withSystemContext.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
    const tx = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({ where: vi.fn(async () => configuredRows) })),
          where: vi.fn(async () => []),
        })),
      })),
    };
    return fn(tx);
  });
}

async function loadModule() {
  return import('../billing-scheduler');
}

describe('BillingScheduler.getOrganizationsForBilling (organization_billing_config is SYSTEM_ONLY)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enumerates organizations via withSystemContext, never the ordinary tenant db connection', async () => {
    mockTx([{ organizationId: 'org-1', organizationName: 'Org One', frequency: 'monthly', enabled: true }]);
    const { BillingScheduler } = await loadModule();

    const result = await (BillingScheduler as unknown as {
      getOrganizationsForBilling: (frequency: 'monthly') => Promise<unknown[]>;
    })['getOrganizationsForBilling']('monthly');

    expect(m.withSystemContext).toHaveBeenCalledTimes(1);
    expect(m.dbSelect).not.toHaveBeenCalled(); // no escape to the ordinary tenant db connection
    expect(result).toEqual([{ organizationId: 'org-1', organizationName: 'Org One', frequency: 'monthly', enabled: true }]);
  });
});
