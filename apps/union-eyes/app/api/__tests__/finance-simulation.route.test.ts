import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withMinRole: vi.fn(),
  requireEntitlement: vi.fn(),
  runAllocation: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withMinRole: m.withMinRole }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/services/platform-economics', () => ({ runAllocation: m.runAllocation }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { AUTH_REQUIRED: 'AUTH_REQUIRED', FORBIDDEN: 'FORBIDDEN', VALIDATION_ERROR: 'VALIDATION_ERROR', INTERNAL_ERROR: 'INTERNAL_ERROR' },
  standardErrorResponse: (code: string, message: string, details?: unknown) => new Response(JSON.stringify({ code, message, details }), { status: code === 'AUTH_REQUIRED' ? 401 : code === 'FORBIDDEN' ? 403 : code === 'INTERNAL_ERROR' ? 500 : 400 }),
  standardSuccessResponse: (data: unknown) => new Response(JSON.stringify(data), { status: 200 }),
}));

async function loadRoute() {
  return import('../finance/simulation/route');
}

describe('finance/simulation route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withMinRole.mockImplementation((_role: string, handler: (request: NextRequest, context: any) => Promise<Response>) =>
      (request: NextRequest, context: any = {}) => handler(request, context));
    m.requireEntitlement.mockResolvedValue(undefined);
    m.runAllocation.mockResolvedValue({ allocated: 100 });
  });

  it('returns a simulation payload', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/finance/simulation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          billingPeriodId: '550e8400-e29b-41d4-a716-446655440000',
          ruleId: '550e8400-e29b-41d4-a716-446655440001',
          localBasisData: [{ localId: '550e8400-e29b-41d4-a716-446655440002', memberCount: 10 }],
        }),
      }),
      { organizationId: 'org_1', userId: 'u1' },
    );

    expect(response.status).toBe(200);
    expect(m.runAllocation).toHaveBeenCalledWith(expect.objectContaining({ isSimulation: true, organizationId: 'org_1', createdBy: 'u1' }));
  });
});