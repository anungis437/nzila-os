import { beforeEach, describe, expect, it, vi } from 'vitest';

// F06 R4 (replaces the two-phase mock): ANALYZE changes planner statistics, which are rows of our own database, so the run and its audit
// record are one transaction (performAtomicAuditedOperation, system scope), and the answer says how many tables the role could analyze.
const TX = vi.hoisted(() => ({ execute: vi.fn() }));
const audit = vi.hoisted(() => ({
  run: vi.fn(async (_op: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(TX)),
}));
vi.mock('@/lib/audit/operation-audit', () => ({
  performAtomicAuditedOperation: audit.run,
  operationAuditResponse: () => null,
}));

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  isPlatformAdminUser: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/lib/api-auth-guard', () => ({ isPlatformAdminUser: m.isPlatformAdminUser, getCurrentUser: m.getCurrentUser }));
vi.mock('drizzle-orm', () => ({ sql: vi.fn((strings: TemplateStringsArray) => strings.join('?').trim().split(/\s+/)[0]) }));

async function loadRoute() {
  return import('../admin/database/optimize/route');
}

const coverage = (analyzable: number, total: number) => {
  TX.execute.mockReset();
  TX.execute.mockResolvedValueOnce(undefined).mockResolvedValueOnce([{ analyzable, total }]);
};

describe('admin/database/optimize route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.auth.mockResolvedValue({ userId: 'admin_1' });
    m.isPlatformAdminUser.mockResolvedValue(true);
    m.getCurrentUser.mockResolvedValue({ id: 'admin_1', organizationId: 'org_1' });
    coverage(12, 12);
  });

  it('returns 403 when user is not a platform admin', async () => {
    const { POST } = await loadRoute();
    m.auth.mockResolvedValueOnce({ userId: 'member_1' });
    m.isPlatformAdminUser.mockResolvedValueOnce(false);

    const response = await POST();

    expect(response.status).toBe(403);
    expect(m.isPlatformAdminUser).toHaveBeenCalledWith('member_1');
    expect(TX.execute).not.toHaveBeenCalled();
    expect(audit.run).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({ error: 'Forbidden' });
  });

  it('runs ANALYZE and its audit record as one system-scope atomic operation and reports every table analyzed', async () => {
    const { POST } = await loadRoute();

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ success: true, tablesAnalyzed: 12, tablesSkipped: 0, message: expect.stringContaining('all 12 tables') });
    expect(audit.run).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'platform.database.analyze', organizationId: 'org_1', userId: 'admin_1', scope: 'system' }),
      expect.any(Function),
    );
    expect(TX.execute).toHaveBeenCalledTimes(2);
  });

  it('does not claim database-wide statistics when the role owns only some of the tables', async () => {
    coverage(3, 40);
    const { POST } = await loadRoute();

    const payload = await (await POST()).json();

    expect(payload).toMatchObject({ success: true, tablesAnalyzed: 3, tablesSkipped: 37 });
    expect(payload.message).toContain('3 of 40 tables');
    expect(payload.message).not.toMatch(/all .* tables|database-wide/);
  });

  it('says plainly that nothing was updated when the role owns none of the tables', async () => {
    coverage(0, 40);
    const { POST } = await loadRoute();

    const payload = await (await POST()).json();

    expect(payload).toMatchObject({ success: false, tablesAnalyzed: 0, tablesSkipped: 40 });
    expect(payload.message).toContain('no planner statistics were updated');
  });

  it('records what was analyzed in the same audit row', async () => {
    const { POST } = await loadRoute();
    await POST();
    const op = audit.run.mock.calls[0][0] as { resultDetails: (r: { analyzable: number; total: number }) => Record<string, unknown> };
    expect(op.resultDetails({ analyzable: 3, total: 40 })).toEqual({ tablesAnalyzable: 3, tablesSkipped: 37 });
  });

  it('returns 500 when optimization throws', async () => {
    const { POST } = await loadRoute();
    TX.execute.mockReset();
    TX.execute.mockRejectedValueOnce(new Error('boom'));

    const response = await POST();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ success: false, error: 'Optimization failed' });
  });
});
