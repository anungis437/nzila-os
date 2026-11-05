import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { declaredOptions } from './with-api-double';

const state = vi.hoisted(() => ({ auditDepth: 0, depthDuringJob: -1 }));

const audit = vi.hoisted(() => ({
  run: vi.fn(),
}));
vi.mock('@/lib/audit/operation-audit', () => ({
  performAuditedOperation: audit.run,
  operationAuditResponse: () => null,
}));

const m = vi.hoisted(() => ({
  manualTriggerRetry: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn() },
  withSystemContext: vi.fn(),
  withRLSContext: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => (await import('./with-api-double')).frameworkDouble);
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: m.withSystemContext,
  withRLSContext: m.withRLSContext,
}));
vi.mock('@/lib/jobs/failed-payment-retry', () => ({ manualTriggerRetry: m.manualTriggerRetry }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { AUTH_REQUIRED: 'AUTH_REQUIRED', FORBIDDEN: 'FORBIDDEN', CONFLICT: 'CONFLICT', INTERNAL_ERROR: 'INTERNAL_ERROR' },
  standardErrorResponse: vi.fn((code: string, message: string) => new Response(JSON.stringify({ message }), { status: code === 'AUTH_REQUIRED' ? 401 : code === 'FORBIDDEN' ? 403 : code === 'CONFLICT' ? 409 : 500 })),
  standardSuccessResponse: vi.fn((data: any) => new Response(JSON.stringify(data), { status: 200 })),
}));

async function loadRoute() {
  return import('../admin/payments/retry-failed/route');
}

const ctx = { userId: 'u1', organizationId: 'org_1', role: 'platform_lead' };
const request = () => new NextRequest('http://localhost/api/admin/payments/retry-failed', { method: 'POST' });

describe('admin/payments/retry-failed route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.auditDepth = 0;
    state.depthDuringJob = -1;
    audit.run.mockImplementation(async (_op: unknown, fn: () => Promise<unknown>) => {
      state.auditDepth += 1;
      try {
        return await fn();
      } finally {
        state.auditDepth -= 1;
      }
    });
    m.manualTriggerRetry.mockImplementation(async () => {
      state.depthDuringJob = state.auditDepth;
      return { totalProcessed: 10, retriesAttempted: 8, retriesSucceeded: 5, retriesFailed: 3, markedForAdmin: 2 };
    });
  });

  it('asks the wrapper for a platform lead, and for no tenant transaction: the job reads every organization as the system role', async () => {
    const { POST } = await loadRoute();
    const options = declaredOptions(POST);
    expect(options.auth).toEqual({ minRole: 'platform_lead' });
    expect(options.rlsOrgContext).toBeUndefined();
  });

  it('runs the job inside the audited operation and opens no context itself: the job opens its own system transactions', async () => {
    const { POST } = await loadRoute();
    await POST(request(), ctx);
    expect(state.depthDuringJob).toBe(1);
    expect(m.withSystemContext).not.toHaveBeenCalled();
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });

  it('returns retry summary on success', async () => {
    const { POST } = await loadRoute();

    const response = await POST(request(), ctx);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ totalProcessed: 10, retriesAttempted: 8, retriesSucceeded: 5 });
  });

  it('returns 500 when retry job throws', async () => {
    const { POST } = await loadRoute();
    m.manualTriggerRetry.mockRejectedValueOnce(new Error('job failed'));

    const response = await POST(request(), ctx);

    expect(response.status).toBe(500);
    expect(state.auditDepth).toBe(0);
  });

  it('answers an operation whose audit intent could not be recorded as a conflict, and does not run the job', async () => {
    const { POST } = await loadRoute();
    audit.run.mockRejectedValueOnce(Object.assign(new Error('not recorded'), { code: 'OPERATION_AUDIT_UNAVAILABLE' }));

    const response = await POST(request(), ctx);

    expect(response.status).toBe(409);
    expect(m.manualTriggerRetry).not.toHaveBeenCalled();
  });

  it('records the manual trigger as an audited platform operation of the acting organization and user', async () => {
    const { POST } = await loadRoute();
    await POST(request(), ctx);
    expect(audit.run).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'platform.payments.retry_failed', organizationId: 'org_1', userId: 'u1' }),
      expect.any(Function),
    );
  });
});
