import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withRLSContext: vi.fn(),
  buildUnionEvidencePack: vi.fn(),
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
  auditLog: vi.fn(),
  recordUnionEyesCaseCreated: vi.fn(),
  sql: vi.fn(),
  badRequest: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, ApiError: { badRequest: m.badRequest } }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/evidence', () => ({ buildUnionEvidencePack: m.buildUnionEvidencePack }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/audit-logger', () => ({
  auditLog: m.auditLog,
  AuditEventType: { CASE_CREATED: 'CASE_CREATED' },
  AuditSeverity: { HIGH: 'HIGH', MEDIUM: 'MEDIUM' },
}));
vi.mock('@/lib/pilot-metrics', () => ({ recordUnionEyesCaseCreated: m.recordUnionEyesCaseCreated }));
vi.mock('drizzle-orm', () => ({ sql: m.sql }));

async function loadRoute() {
  return import('../cases/route');
}

describe('cases route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: any) => (ctx: any = {}) => handler(ctx));
    m.badRequest.mockImplementation((msg: string) => {
      const err = new Error(msg) as Error & { status: number };
      err.status = 400;
      throw err;
    });
    m.sql.mockImplementation((parts: TemplateStringsArray, ...values: unknown[]) => ({ parts, values }));
    m.buildUnionEvidencePack.mockResolvedValue(undefined);
    m.auditLog.mockResolvedValue(undefined);
    m.recordUnionEyesCaseCreated.mockResolvedValue(undefined);
    m.withRLSContext.mockImplementation(async (fn: any) => {
      const tx = { execute: vi.fn(async () => [{ claimId: 'c1', claimNumber: 'CLM-20260101-0001', status: 'open' }]) };
      return fn(tx);
    });
  });

  it('GET returns case list without org fallback', async () => {
    const { GET } = await loadRoute();
    const result = await GET({
      request: new NextRequest('http://localhost/api/cases?status=open&type=grievance_discipline&priority=high'),
      organizationId: 'org_1',
      userId: 'u1',
    });
    expect(Array.isArray(result.data)).toBe(true);
    expect(m.withRLSContext).toHaveBeenCalledTimes(1);
    expect(m.sql).toHaveBeenCalled();
  });

  it('GET falls back to org membership when organizationId is missing', async () => {
    const { GET } = await loadRoute();
    m.withRLSContext.mockImplementationOnce(async (fn: any) => fn({ execute: vi.fn(async () => [{ organization_id: 'org_2' }]) }));
    m.withRLSContext.mockImplementationOnce(async (fn: any) => fn({ execute: vi.fn(async () => [{ claimId: 'c1' }]) }));

    const result = await GET({
      request: new NextRequest('http://localhost/api/cases'),
      userId: 'u1',
    });

    expect(Array.isArray(result.data)).toBe(true);
    expect(m.withRLSContext).toHaveBeenCalledTimes(2);
  });

  it('POST returns 400 for invalid payload', async () => {
    const { POST } = await loadRoute();

    await expect(POST({ request: { json: vi.fn(async () => ({ claimType: 'other' })) }, organizationId: 'org_1', userId: 'u1' })).rejects.toMatchObject({ status: 400 });
  });

  it('POST returns 400 when organization context is missing', async () => {
    const { POST } = await loadRoute();

    await expect(
      POST({
        request: { json: vi.fn(async () => ({ claimType: 'other', description: 'A valid claim description' })) },
        userId: 'u1',
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('POST creates case and records audit events', async () => {
    const { POST } = await loadRoute();
    const response = await POST({
      request: {
        headers: { get: vi.fn(() => 'trace-123') },
        json: vi.fn(async () => ({
          claimType: 'other',
          description: 'A valid claim description',
          incidentDate: '2026-01-01T00:00:00.000Z',
          priority: 'high',
          sourceIntakeId: '11111111-1111-1111-1111-111111111111',
        })),
      },
      organizationId: 'org_1',
      userId: 'u1',
    });
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.data.claimId).toBe('c1');
    expect(m.auditLog).toHaveBeenCalled();
    expect(m.buildUnionEvidencePack).toHaveBeenCalled();
    expect(m.recordUnionEyesCaseCreated).toHaveBeenCalled();
  });
});
