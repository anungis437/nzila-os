import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  ApiError: {
    badRequest: vi.fn((msg: string) => { throw new Error(msg); }),
    notFound: vi.fn((msg: string) => { throw new Error(msg); }),
    internal: vi.fn((msg: string) => { throw new Error(msg); }),
  },
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
  withRLSContext: vi.fn(),
  requireEntitlement: vi.fn(),
  resolvePayrollRules: vi.fn(),
  calculatePayroll: vi.fn(),
  sha256: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, ApiError: m.ApiError, z: require('zod') }));
vi.mock('@/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({
  requireEntitlement: m.requireEntitlement,
  PLATFORM_MODULES: { EMPLOYER_PAYROLL_OFFICIAL: 'EMPLOYER_PAYROLL_OFFICIAL' },
}));
vi.mock('../employer-execution/_lib', () => ({
  resolvePayrollRules: m.resolvePayrollRules,
  calculatePayroll: m.calculatePayroll,
  sha256: m.sha256,
}));

async function loadRoute() {
  return import('../employer-execution/payroll-runs/route');
}

describe('employer-execution/payroll-runs route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    m.withApi.mockImplementation((_cfg: unknown, handler: any) => {
      return (ctx: any = {}) => handler(ctx);
    });

    m.db.select.mockImplementation(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(async () => []),
          limit: vi.fn(async () => []),
        })),
      })),
    }));

    m.withRLSContext.mockImplementation((fn: any) => fn({
      insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'run_1' }]) })) })),
    }));

    m.resolvePayrollRules.mockReturnValue({});
    m.calculatePayroll.mockReturnValue({
      items: [],
      totals: { gross: 0, net: 0, dues: 0, benefits: 0, pension: 0 },
      snapshotHash: 'snap',
      calcTrace: {},
      calcTraceHash: 'trace',
    });
    m.sha256.mockReturnValue('hash');
  });

  it('GET returns bad request without organization context', async () => {
    const { GET } = await loadRoute();
    await expect(GET({ organizationId: undefined })).rejects.toThrow();
  });

  it('GET returns payroll runs for organization', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ organizationId: 'org_1' });
    expect(result).toBeDefined();
  });

  it('POST fails when timesheet batch is missing', async () => {
    const { POST } = await loadRoute();
    await expect(POST({
      organizationId: 'org_1',
      userId: 'u1',
      body: {
        timesheetBatchId: '00000000-0000-0000-0000-000000000001',
        periodStart: '2026-01-01',
        periodEnd: '2026-01-15',
        runType: 'preview',
        engineVersion: 'employer-execution-v1',
      },
    })).rejects.toThrow();
  });
});
