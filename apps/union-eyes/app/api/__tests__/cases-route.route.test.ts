import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withRLSContext: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, ApiError: { badRequest: vi.fn((msg: string) => { throw new Error(msg); }) }, z: require('zod') }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/evidence', () => ({ buildUnionEvidencePack: vi.fn(async () => undefined) }));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/audit-logger', () => ({
  auditLog: vi.fn(async () => undefined),
  AuditEventType: { CASE_CREATED: 'CASE_CREATED' },
  AuditSeverity: { HIGH: 'HIGH', MEDIUM: 'MEDIUM' },
}));
vi.mock('@/lib/pilot-metrics', () => ({ recordUnionEyesCaseCreated: vi.fn(async () => undefined) }));

async function loadRoute() {
  return import('../cases/route');
}

describe('cases route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: any) => (ctx: any = {}) => handler(ctx));
    m.withRLSContext.mockImplementation(async (fn: any) => {
      const tx = { execute: vi.fn(async () => [{ claimId: 'c1', status: 'open' }]) };
      return fn(tx);
    });
  });

  it('GET returns case list', async () => {
    const { GET } = await loadRoute();
    const result = await GET({
      request: new Request('http://localhost/api/cases'),
      organizationId: 'org_1',
      userId: 'u1',
    });
    expect(result).toBeDefined();
  });
});
