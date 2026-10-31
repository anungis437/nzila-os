import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// DEF-0B10-PIL-USAGE-TELEMETRY-ROUTES-READ-ANY-ORGANIZATION-NAMED-IN-THE-QUERY…: the champions, friction, metrics and
// readiness routes read the organization from the query string. They now read the caller's authenticated organization.

const m = vi.hoisted(() => ({
  detectChampions: vi.fn(),
  assessConversionReadiness: vi.fn(),
  getFrictionReport: vi.fn(),
  getFrictionSummary: vi.fn(),
  getPilotMetrics: vi.fn(),
  getDAUTrend: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({
  withRoleAuth: (_role: string, handler: (req: unknown, ctx: unknown) => Promise<unknown>) => handler,
}));
// The reads run inside the caller's organization context (B76); the services are mocked, so the context is a pass-through.
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: async (_ctx: unknown, fn: (tx: unknown) => unknown) => fn({}) }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
vi.mock('@/lib/services/pilot-signals', () => ({ detectChampions: m.detectChampions, assessConversionReadiness: m.assessConversionReadiness }));
vi.mock('@/lib/services/pilot-friction', () => ({ getFrictionReport: m.getFrictionReport, getFrictionSummary: m.getFrictionSummary }));
vi.mock('@/lib/services/pilot-metrics', () => ({ getPilotMetrics: m.getPilotMetrics, getDAUTrend: m.getDAUTrend }));

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';

const call = async (route: string, query: string, organizationId: string | null = ORG_A) => {
  const { GET } = await import(`../pilot/${route}/route`);
  const request = new NextRequest(`http://localhost/api/pilot/${route}${query}`);
  return (GET as any)(request, { organizationId: organizationId ?? undefined, userId: 'admin-1' }) as Promise<Response>;
};

const ROUTES: Array<[string, string, ReturnType<typeof vi.fn>]> = [
  ['champions', '', m.detectChampions],
  ['readiness', '', m.assessConversionReadiness],
  ['friction', '', m.getFrictionReport],
  ['metrics', '', m.getPilotMetrics],
];

beforeEach(() => {
  vi.clearAllMocks();
  for (const fn of Object.values(m)) fn.mockResolvedValue({ ok: true });
});

describe.each(ROUTES)('pilot/%s telemetry scope', (route, _q, service) => {
  it('reads the caller\'s own organization when no organization is named', async () => {
    const response = await call(route, '');
    expect(response.status).toBe(200);
    expect(service).toHaveBeenCalledWith(ORG_A);
  });

  it('accepts a query organization that equals the session organization', async () => {
    const response = await call(route, `?organizationId=${ORG_A}`);
    expect(response.status).toBe(200);
    expect(service).toHaveBeenCalledWith(ORG_A);
  });

  it('refuses a query naming another organization and never calls the service for it', async () => {
    const response = await call(route, `?organizationId=${ORG_B}`);
    expect(response.status).toBe(403);
    expect(service).not.toHaveBeenCalled();
    expect(JSON.stringify(await response.json())).not.toContain(ORG_B);
  });

  it('refuses a caller with no organization context', async () => {
    const response = await call(route, `?organizationId=${ORG_B}`, null);
    expect(response.status).toBe(400);
    expect(service).not.toHaveBeenCalled();
  });
});

describe('pilot/friction and pilot/metrics options', () => {
  it('the friction summary is also bound to the session organization', async () => {
    await call('friction', '?summary=true');
    expect(m.getFrictionSummary).toHaveBeenCalledWith(ORG_A);
    expect((await call('friction', `?summary=true&organizationId=${ORG_B}`)).status).toBe(403);
    expect(m.getFrictionSummary).toHaveBeenCalledTimes(1);
  });

  it('the DAU trend is bound to the session organization', async () => {
    await call('metrics', '?trend=true');
    expect(m.getDAUTrend).toHaveBeenCalledWith(ORG_A, 30);
    expect((await call('metrics', `?trend=true&organizationId=${ORG_B}`)).status).toBe(403);
    expect(m.getDAUTrend).toHaveBeenCalledTimes(1);
  });
});
