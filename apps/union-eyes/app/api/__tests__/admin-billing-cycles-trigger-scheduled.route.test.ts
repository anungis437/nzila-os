import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { declaredOptions } from './with-api-double';

const state = vi.hoisted(() => ({ systemDepth: 0, depthDuringJob: -1 }));

const m = vi.hoisted(() => ({
  BillingScheduler: { manualTrigger: vi.fn() },
  logger: { info: vi.fn(), error: vi.fn() },
  performAuditedOperation: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => (await import('./with-api-double')).frameworkDouble);
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: async (work: () => Promise<unknown>) => {
    state.systemDepth += 1;
    try {
      return await work();
    } finally {
      state.systemDepth -= 1;
    }
  },
}));
vi.mock('@/lib/jobs/billing-scheduler', () => ({ BillingScheduler: m.BillingScheduler }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/audit/operation-audit', () => ({
  performAuditedOperation: m.performAuditedOperation,
  operationAuditResponse: (error: unknown) => (error instanceof Error && error.message === 'audit down' ? { status: 409, body: { error: { code: 'OPERATION_AUDIT_UNAVAILABLE' } } } : null),
}));

vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { AUTH_REQUIRED: 'AUTH_REQUIRED', FORBIDDEN: 'FORBIDDEN', VALIDATION_ERROR: 'VALIDATION_ERROR', INTERNAL_ERROR: 'INTERNAL_ERROR' },
  standardErrorResponse: vi.fn((code: string, message: string) => new Response(JSON.stringify({ message }), { status: code === 'AUTH_REQUIRED' ? 401 : code === 'FORBIDDEN' ? 403 : code === 'INTERNAL_ERROR' ? 500 : 400 })),
  standardSuccessResponse: vi.fn((data: any) => new Response(JSON.stringify(data), { status: 200 })),
}));

async function loadRoute() {
  return import('../admin/billing-cycles/trigger-scheduled/route');
}

const ctx = { userId: 'u1', organizationId: 'org-1', role: 'platform_lead' };
const post = (body: unknown) => new NextRequest('http://localhost/api/admin/billing-cycles/trigger-scheduled', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

describe('admin/billing-cycles/trigger-scheduled route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.systemDepth = 0;
    state.depthDuringJob = -1;
    m.performAuditedOperation.mockImplementation((_op: unknown, run: () => unknown) => run());
    m.BillingScheduler.manualTrigger.mockImplementation(async () => {
      state.depthDuringJob = state.systemDepth;
      return { totalOrganizations: 3, successful: 2, failed: 1 };
    });
  });

  it('asks the wrapper for a platform lead acting in an organization, and for no tenant transaction: billing every organization is a system operation', async () => {
    const { POST } = await loadRoute();
    const options = declaredOptions(POST);
    expect(options.auth).toEqual({ minRole: 'platform_lead' });
    expect(options.requireOrg).toBeUndefined();
    expect(options.rlsOrgContext).toBeUndefined();
  });

  it('runs manual trigger for valid requests, as the system role, attributed to the acting organization and user', async () => {
    const { POST } = await loadRoute();

    const response = await POST(post({ frequency: 'weekly' }), ctx);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ totalOrganizations: 3, successful: 2, failed: 1 });
    expect(m.BillingScheduler.manualTrigger).toHaveBeenCalledWith('weekly');
    expect(state.depthDuringJob).toBe(1);
    expect(state.systemDepth).toBe(0);
    expect(m.performAuditedOperation).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1', userId: 'u1', scope: 'system', action: 'platform.billing_cycle.trigger_scheduled' }),
      expect.any(Function),
    );
  });

  it('answers a body that is not JSON, or names no frequency, as a client error, and runs nothing', async () => {
    const { POST } = await loadRoute();
    for (const body of ['{bad', { frequency: 'hourly' }, {}]) {
      expect((await POST(post(body), ctx)).status).toBe(400);
    }
    expect(m.BillingScheduler.manualTrigger).not.toHaveBeenCalled();
    expect(m.performAuditedOperation).not.toHaveBeenCalled();
  });

  it('answers an operation whose audit intent could not be recorded as a conflict', async () => {
    const { POST } = await loadRoute();
    m.performAuditedOperation.mockRejectedValueOnce(new Error('audit down'));
    const response = await POST(post({ frequency: 'weekly' }), ctx);
    expect(response.status).toBe(409);
  });

  it('returns 500 when manual trigger fails, and leaves the system context', async () => {
    const { POST } = await loadRoute();
    m.BillingScheduler.manualTrigger.mockRejectedValueOnce(new Error('scheduler failed'));

    const response = await POST(post({ frequency: 'weekly' }), ctx);

    expect(response.status).toBe(500);
    expect(state.systemDepth).toBe(0);
  });
});
