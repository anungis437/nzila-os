import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApiAuth: vi.fn(),
  hasMinRole: vi.fn(),
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
  buildPilotStatus: vi.fn(),
  auth: vi.fn(),
  dbExecute: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withApiAuth: m.withApiAuth, hasMinRole: m.hasMinRole }));
vi.mock('@nzila/os-core', () => ({ createLogger: vi.fn(() => m.logger) }));
vi.mock('@/lib/pilot-admin', () => ({ buildPilotStatus: m.buildPilotStatus }));
vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/db', () => ({ db: { execute: m.dbExecute } }));
vi.mock('drizzle-orm', () => ({
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
    { raw: (v: unknown) => v },
  ),
}));

async function loadRoute() {
  return import('../admin/pilot-status/route');
}

describe('admin/pilot-status route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApiAuth.mockImplementation((handler: any) => (request: NextRequest) => handler(request));
    m.hasMinRole.mockResolvedValue(true);
    m.auth.mockResolvedValue({ orgId: 'org-abc' });
    m.dbExecute.mockResolvedValue([{ n: 3 }]);
    m.buildPilotStatus.mockReturnValue({
      health: { status: 'remediation_in_progress', checks: [] },
      configuration: {},
    });
  });

  it('returns 403 when caller is not platform lead', async () => {
    const { GET } = await loadRoute();
    m.hasMinRole.mockResolvedValueOnce(false);

    const response = await GET(new NextRequest('http://localhost/api/admin/pilot-status'));

    expect(response.status).toBe(403);
  });

  it('runs real DB-backed measurements and surfaces the honest status', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/admin/pilot-status'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ health: { status: 'remediation_in_progress' } });
    expect(m.dbExecute).toHaveBeenCalledTimes(2);
    // buildPilotStatus must receive `null` for every unmeasured flag —
    // never a fabricated `true`.
    expect(m.buildPilotStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        vocabularyLoaded: null,
        orgConfigured: null,
        slaThresholdsSet: null,
        auditTrailActive: null,
        usersInvited: 3,
        worksitesConfigured: 3,
      }),
      expect.anything(),
    );
  });

  it('reports null (unmeasured) when the DB queries fail', async () => {
    const { GET } = await loadRoute();
    m.dbExecute.mockRejectedValue(new Error('db-down'));

    const response = await GET(new NextRequest('http://localhost/api/admin/pilot-status'));
    await response.json();

    expect(response.status).toBe(200);
    expect(m.buildPilotStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        usersInvited: null,
        worksitesConfigured: null,
      }),
      expect.anything(),
    );
  });

  it('returns 500 when status computation throws', async () => {
    const { GET } = await loadRoute();
    m.buildPilotStatus.mockImplementationOnce(() => {
      throw new Error('boom');
    });

    const response = await GET(new NextRequest('http://localhost/api/admin/pilot-status'));

    expect(response.status).toBe(500);
  });
});