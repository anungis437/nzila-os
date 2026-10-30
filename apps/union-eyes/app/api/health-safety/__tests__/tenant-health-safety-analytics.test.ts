import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  contexts: {} as Record<string, { organizationId: string | null; userId: string | null }>,
  configs: [] as Array<Record<string, any>>,
  requests: [] as unknown[],
  execute: vi.fn(),
  audit: vi.fn(),
  scope: vi.fn(),
}));
vi.mock('@/lib/api/framework', () => ({
  withApi: (cfg: Record<string, any>, handler: (ctx: any) => Promise<unknown>) => {
    m.configs.push(cfg);
    return (request: NextRequest) => handler({ request, ...m.contexts.current });
  },
  ApiError: { forbidden: (message: string) => Object.assign(new Error(message), { status: 403 }) },
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: m.scope,
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));

const url = 'http://localhost/api/health-safety/';
beforeEach(() => {
  vi.clearAllMocks();
  m.contexts.current = { organizationId: 'org-allowed', userId: 'hs-operator' };
  m.execute.mockResolvedValue([]);
  m.audit.mockResolvedValue(undefined);
  m.scope.mockImplementation(async (_ctx: unknown, callback: (tx: unknown) => Promise<unknown>) =>
    callback({ execute: m.execute }),
  );
});

describe('Health-and-safety reporting — no cross-tenant fallback', () => {
  it('refuses unauthenticated-tenant and attacker-selected trend queries before touching database', async () => {
    const { GET } = await import('../incidents/trends/route');
    expect(m.configs.at(-1)?.auth?.minRole).toBe('health_safety_rep');
    const request = (organizationId?: string) =>
      new NextRequest(url + 'incidents/trends' + (organizationId ? '?organizationId=' + organizationId : ''));
    await expect(GET(request('org-other'))).rejects.toMatchObject({ status: 403 });
    m.contexts.current = { organizationId: null, userId: 'hs-operator' };
    await expect(GET(request())).rejects.toMatchObject({ status: 403 });
    expect(m.scope).not.toHaveBeenCalled();
    expect(m.execute).not.toHaveBeenCalled();
  });

  it('audits tenant-bound daily and monthly trend reads through the same transaction', async () => {
    const { GET } = await import('../incidents/trends/route');
    for (const period of ['30d', '12m']) {
      const rows = await GET(new NextRequest(url + 'incidents/trends?period=' + period));
      expect(rows).toEqual([]);
      expect(m.scope).toHaveBeenCalledWith({ organizationId: 'org-allowed' }, expect.any(Function));
      expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        organizationId: 'org-allowed', userId: 'hs-operator',
        action: 'health_safety.incident_trends.read',
      }));
    }
  });

  it('requires an active H&S mandate for findings, with no organization fallback', async () => {
    const { GET } = await import('../inspections/findings/route');
    expect(m.configs.at(-1)?.auth?.minRole).toBe('health_safety_rep');
    const request = new NextRequest(url + 'inspections/findings');
    m.contexts.current = { organizationId: null, userId: 'hs-operator' };
    await expect(GET(request)).rejects.toMatchObject({ status: 403 });
    expect(m.scope).not.toHaveBeenCalled();
    m.contexts.current = { organizationId: 'org-allowed', userId: 'hs-operator' };
    expect(await GET(request)).toEqual({ findings: [] });
    expect(m.scope).toHaveBeenCalledWith({ organizationId: 'org-allowed' }, expect.any(Function));
    expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'health_safety.inspection_findings.read', organizationId: 'org-allowed',
    }));
  });
});
