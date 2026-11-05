import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// UE-OFFICER-EXECUTIVE-CANONICAL-2.1 P0 boundary tests for executive-reachable
// routes: no confidential case rows, no fabricated zero balances, no vote
// counter, and a finance floor that does not widen to a general officer.

const m = vi.hoisted(() => ({
  getExecutiveMetrics: vi.fn(),
  select: vi.fn(),
}));

class TestApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
  static badRequest = (msg: string) => new TestApiError(400, msg);
  static notImplemented = (msg: string) => new TestApiError(501, msg);
}

vi.mock('@/lib/api/framework', () => ({
  ApiError: TestApiError,
  withApi: (cfg: unknown, handler: (ctx: unknown) => Promise<unknown>) => {
    const fn = (ctx: unknown) => handler(ctx);
    (fn as unknown as { cfg: unknown }).cfg = cfg;
    return fn;
  },
}));
vi.mock('@/lib/api-auth-guard', () => ({ GOVERNANCE_SYSTEM_ROLES: ['clc_staff', 'clc_executive', 'system_admin'] }));
vi.mock('@/db', () => {
  throw new Error('the election vote route must not touch the database');
});
vi.mock('@/db/db', () => ({ db: { select: m.select } }));
vi.mock('@/db/schema', () => ({ strategicGoals: { organizationId: 'organizationId', createdAt: 'createdAt' } }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), desc: vi.fn(() => 'desc') };
});
vi.mock('@/lib/services/dashboard-kpi-service', () => ({ getExecutiveMetrics: m.getExecutiveMetrics }));

type Handler = ((ctx: unknown) => Promise<unknown>) & { cfg: { auth?: Record<string, unknown> } };

const API_ROOT = path.resolve(__dirname, '..');

describe('executive P0 route boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/executive/dashboard returns aggregates and goals but never grievance rows', async () => {
    m.getExecutiveMetrics.mockResolvedValue({ activeGrievances: 3 });
    m.select.mockReturnValue({
      from: () => ({ where: () => ({ orderBy: () => ({ limit: async () => [{ id: 'g1', title: 'Goal' }] }) }) }),
    });
    const { GET } = (await import('../executive/dashboard/route')) as unknown as { GET: Handler };

    const result = (await GET({ organizationId: 'org-1' })) as Record<string, unknown>;

    expect(Object.keys(result).sort()).toEqual(['metrics', 'strategicGoals']);
    expect(result).not.toHaveProperty('recentGrievances');
    expect(m.select).toHaveBeenCalledTimes(1);
    expect(m.getExecutiveMetrics).toHaveBeenCalledWith({ organizationId: 'org-1', timeframe: 'monthly' });
  });

  it('POST /api/elections/[id]/vote answers 501 and mutates nothing', async () => {
    const { POST } = (await import('../elections/[id]/vote/route')) as unknown as { POST: Handler };

    await expect(POST({ params: { id: 'e1' }, body: { votes: { A: 9999 } } })).rejects.toMatchObject({ status: 501 });
    expect(POST.cfg.auth?.roles).toEqual(['clc_staff', 'clc_executive', 'system_admin']);
  });

  it('GET /api/strike-fund/dashboard no longer asserts a $0 balance and is closed to members and general officers', async () => {
    const { GET } = (await import('../strike-fund/dashboard/route')) as unknown as { GET: Handler };

    expect(GET.cfg.auth?.minRole).toBe('secretary_treasurer');
    await expect(GET({ organizationId: 'org-1' })).rejects.toMatchObject({ status: 501 });
    await expect(GET({ organizationId: undefined })).rejects.toMatchObject({ status: 400 });
  });

  it('keeps every /api/finance handler above the general-officer floor', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (entry === 'route.ts') files.push(full);
      }
    };
    walk(path.join(API_ROOT, 'finance'));

    expect(files.length).toBeGreaterThan(10);
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source, path.relative(API_ROOT, file)).not.toMatch(/withMinRole\(\s*'officer'/);
      expect(source, path.relative(API_ROOT, file)).not.toMatch(/minRole:\s*'officer'/);
    }
  });
});
