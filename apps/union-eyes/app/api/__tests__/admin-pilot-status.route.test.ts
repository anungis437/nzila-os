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
  const originalEnv = { ...process.env };
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset env each test so secret-presence probes are deterministic.
    process.env = { ...originalEnv };
    process.env.DATABASE_URL = 'postgres://test';
    process.env.AUTH_SECRET = 'test-secret';
    process.env.AZURE_AD_TENANT_ID = 'test-tenant';
    delete process.env.UE_FEATURE_PROFILE;
    delete process.env.NEXT_PUBLIC_UE_DEMO_PROFILE;
    process.env.TARGET_ENVIRONMENT = 'development';

    m.withApiAuth.mockImplementation((handler: any) => (request: NextRequest) => handler(request));
    m.hasMinRole.mockResolvedValue(true);
    m.auth.mockResolvedValue({ orgId: 'org-abc' });
    // Return SELECT 1's shape for the postgres-ping probe and COUNT's
    // shape for the users/worksites queries. The mock sql template is
    // stringified via its `strings` array; inspect it to decide.
    m.dbExecute.mockImplementation(async (arg: any) => {
      const raw = Array.isArray(arg?.strings) ? arg.strings.join(' ') : String(arg);
      if (/SELECT 1/i.test(raw)) return [{ ok: 1 }];
      return [{ n: 3 }];
    });
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
    // dbExecute is now called 3x: users, worksites, and the postgres
    // ping probe (SELECT 1).
    expect(m.dbExecute).toHaveBeenCalledTimes(3);
    // The route MUST emit an `operational` array with the mandated
    // shape. Every entry needs capabilityId/state/severity/etc.
    expect(Array.isArray(payload.operational)).toBe(true);
    expect(payload.operational.length).toBeGreaterThanOrEqual(20);
    for (const check of payload.operational) {
      expect(check.capabilityId).toBeTruthy();
      expect(['pass', 'warn', 'fail', 'unknown']).toContain(check.state);
      expect(check.evidenceReference).toBeTruthy();
      expect(check.remediationGuidance).toBeTruthy();
    }
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