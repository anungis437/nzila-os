import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  guardAiFeature: vi.fn(),
  enforceAISafety: vi.fn(),
  db: { select: vi.fn(), insert: vi.fn() },
  auditLog: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, ApiError: { badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }) }, RATE_LIMITS: { ML_PREDICTIONS: 'ML_PREDICTIONS' }, z: require('zod') }));
vi.mock('@/lib/ai/ai-feature-guard', () => ({ guardAiFeature: m.guardAiFeature }));
vi.mock('@/lib/services/feature-flags', () => ({ AI_FEATURES: { GRIEVANCE_TRIAGE: 'GRIEVANCE_TRIAGE' } }));
vi.mock('@nzila/policies', () => ({ enforceAISafety: m.enforceAISafety }));
vi.mock('@/db', () => ({ db: m.db }));
vi.mock('@/db/schema', () => ({ mlPredictions: { organizationId: 'organizationId', predictionType: 'predictionType', createdAt: 'createdAt' }, modelMetadata: { organizationId: 'organizationId', modelType: 'modelType', version: 'version', trainedAt: 'trainedAt' } }));
vi.mock('@/lib/audit-logger', () => ({ auditLog: m.auditLog, AuditEventType: { DATA_CREATE: 'DATA_CREATE' }, AuditSeverity: { HIGH: 'HIGH' } }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, and: vi.fn(() => 'and'), eq: vi.fn(() => 'eq'), desc: vi.fn(() => 'desc'), sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../ml/predictions/sla-breach-risk/route');
}

describe('ml/predictions/sla-breach-risk route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) =>
      async (request: NextRequest, context: any = {}) => {
        const body = await request.clone().json().catch(() => undefined);
        return handler({ request, body, ...context });
      });
    m.guardAiFeature.mockResolvedValue(null);
    m.enforceAISafety.mockReturnValue(undefined);
    m.db.select.mockReturnValue({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [{ version: 'sla-risk-v1', modelType: 'sla_breach_risk', trainedAt: '2026-01-01' }]) })) })) } as any);
    m.db.insert.mockReturnValue({ values: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'pred_1' }]) })) });
    m.auditLog.mockResolvedValue(undefined);
  });

  it('creates an SLA breach prediction', async () => {
    const { POST } = await loadRoute();
    const result = await POST(new NextRequest('http://localhost/api/ml/predictions/sla-breach-risk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        caseId: '550e8400-e29b-41d4-a716-446655440000',
        features: { hoursRemaining: 8, transitionCount: 2, hasPreviousBreaches: true, priority: 'high', featureRefs: ['f1'] },
      }),
    }), { organizationId: 'org_1', userId: 'u1' });

    expect(result.score).toBeGreaterThan(0);
    expect(result.model.version).toBe('sla-risk-v1');
  });
});