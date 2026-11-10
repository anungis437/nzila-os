import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// DEF-0B5-COGNITION-KPI-ROI-FROM-ASSUMED-HOURS: the engine's own assumptions[] array and the route's governance
// note are what keep "estimated admin hours saved" and "estimated ROI" from reading as a measured result - this
// proves the route actually returns both, not just that the underlying engine function supports them.

const m = vi.hoisted(() => ({
  withOrganizationAuth: vi.fn(),
  hasMinRole: vi.fn(),
  execute: vi.fn(),
  auditLog: vi.fn(),
}));

vi.mock('@/lib/organization-middleware', () => ({ withOrganizationAuth: m.withOrganizationAuth }));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/db/db', () => ({ db: { execute: m.execute } }));
vi.mock('@/lib/audit-logger', () => ({
  auditLog: m.auditLog,
  AuditEventType: { DATA_ACCESS: 'data_access' },
  AuditSeverity: { LOW: 'low' },
}));
vi.mock('@nzila/ue-cognition', () => ({
  computeKpiSnapshot: vi.fn(() => ({
    id: 'kpi_1', modelVersion: 'test', estimatedAdminHoursSaved: 4, estimatedRoiCad: 200,
    assumptions: [
      { key: 'loadedHourlyRateCad', value: 50 }, { key: 'minutesSavedPerCase', value: 10 },
      { key: 'workingDaysPerYear', value: 250 }, { key: 'stewardUtilization', value: 0.8 },
    ],
  })),
}));

async function loadRoute() {
  return import('../cognition/kpis/route');
}

describe('cognition/kpis route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withOrganizationAuth.mockImplementation(
      (handler: any) => (request: NextRequest, context: any = { userId: 'u1', organizationId: 'org_1' }) => handler(request, context),
    );
    m.hasMinRole.mockResolvedValue(true);
    m.execute
      .mockResolvedValueOnce([{ avgDays: null }])
      .mockResolvedValueOnce([{ count: 2 }]);
    m.auditLog.mockResolvedValue(undefined);
  });

  it('returns 403 for a caller below steward', async () => {
    m.hasMinRole.mockResolvedValueOnce(false);
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/cognition/kpis'), { userId: 'u1', organizationId: 'org_1' } as any);

    expect(response.status).toBe(403);
  });

  it('surfaces every assumption and a governance note naming them as such, never as a measured result', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/cognition/kpis?windowDays=30'), { userId: 'u1', organizationId: 'org_1' } as any);
    const body = await response.json();

    expect(body.snapshot.estimatedAdminHoursSaved).toBeTypeOf('number');
    expect(body.snapshot.estimatedRoiCad).toBeTypeOf('number');
    expect(body.snapshot.assumptions.length).toBeGreaterThanOrEqual(4);
    expect(body.snapshot.assumptions.map((a: { key: string }) => a.key)).toContain('loadedHourlyRateCad');
    expect(body.governance.assumptions).toEqual(body.snapshot.assumptions);
    expect(body.governance.note).toContain('No inferred values');
  });

  it('rejects a non-numeric windowDays rather than silently defaulting it', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/cognition/kpis?windowDays=not-a-number'), { userId: 'u1', organizationId: 'org_1' } as any);

    expect(response.status).toBe(400);
  });
});
