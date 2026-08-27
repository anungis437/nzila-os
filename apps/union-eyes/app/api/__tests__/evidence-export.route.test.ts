import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  authenticateUser: vi.fn(),
  withRequestContext: vi.fn((_request: Request, handler: () => unknown) => handler()),
  auth: vi.fn(),
  withSpan: vi.fn((_name: string, _attributes: Record<string, unknown>, handler: () => unknown) => handler()),
  recordEvidenceExport: vi.fn(),
}));

vi.mock('@/lib/api-guards', () => ({
  authenticateUser: m.authenticateUser,
  withRequestContext: m.withRequestContext,
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: m.auth,
}));

vi.mock('@nzila/os-core/telemetry', () => ({
  withSpan: m.withSpan,
}));

vi.mock('@/app/api/governance/telemetry/route', () => ({
  recordEvidenceExport: m.recordEvidenceExport,
}));

async function loadRoute() {
  return import('../evidence/export/route');
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, any>>;
}

describe('/api/evidence/export route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.authenticateUser.mockResolvedValue({ ok: true });
    m.auth.mockResolvedValue({ orgRole: 'staff' });
  });

  it('denies plain members and does not record an export event', async () => {
    vi.resetModules();
    m.auth.mockResolvedValueOnce({ orgRole: 'member' });
    const { GET } = await loadRoute();

    const response = await GET(new Request('http://localhost/api/evidence/export?orgId=liuna-synthetic'));
    const body = await readJson(response);

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      error: 'Forbidden',
      message: 'Evidence export requires staff-level access.',
    });
    expect(m.recordEvidenceExport).not.toHaveBeenCalled();
  });

  it('returns an audit-safe org-scoped evidence snapshot for staff roles', async () => {
    vi.resetModules();
    m.auth.mockResolvedValueOnce({ orgRole: 'governance' });
    const { GET, dynamic } = await loadRoute();

    const response = await GET(new Request('http://localhost/api/evidence/export?orgId=liuna-opdc-cecof-synthetic'));
    const body = await readJson(response);

    expect(dynamic).toBe('force-dynamic');
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      org_id: 'liuna-opdc-cecof-synthetic',
      app: 'union-eyes',
      policy_checks: {
        grievance_creation: 'enforced',
        cross_org_access: 'denied',
      },
      org_isolation: {
        enforced: true,
        cross_org_read_attempts_blocked: true,
      },
    });
    expect(body).not.toHaveProperty('documents');
    expect(body).not.toHaveProperty('matters');
    expect(body).not.toHaveProperty('raw_records');
    expect(JSON.stringify(body)).not.toContain('privileged');
    expect(m.recordEvidenceExport).toHaveBeenCalledTimes(1);
  });
});
