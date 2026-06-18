import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  guardAiFeature: vi.fn(),
  enforceAISafety: vi.fn(),
  trackPilotEvent: vi.fn(),
  auditLog: vi.fn(),
  selectQueue: [] as unknown[][],
  updateQueue: [] as unknown[][],
}));

function makeSelectChain(rows: unknown[]) {
  const chain: any = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(async () => rows),
    orderBy: vi.fn(() => chain),
  };
  return chain;
}

const mockDb: any = {
  select: vi.fn(() => makeSelectChain((m.selectQueue.shift() ?? []) as unknown[])),
  insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'model_1', version: 'v1', parameters: {}, accuracy: '0.9', trainedAt: new Date() }]) })) })),
  update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => (m.updateQueue.shift() ?? []) as unknown[]), })) })) })),
};

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  RATE_LIMITS: { ML_PREDICTIONS: { limit: 10 } },
  z: {
    object: () => ({}),
    string: () => ({ uuid: () => ({ min: () => ({ default: () => ({}) }) }), min: () => ({ default: () => ({}) }), max: () => ({ optional: () => ({}) }), optional: () => ({}) }),
    boolean: () => ({}),
    number: () => ({ nonnegative: () => ({ optional: () => ({}) }) }),
  },
  ApiError: { badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }), notFound: (msg: string) => Object.assign(new Error(msg), { status: 404 }) },
}));
vi.mock('@/lib/ai/ai-feature-guard', () => ({ guardAiFeature: m.guardAiFeature }));
vi.mock('@/lib/services/feature-flags', () => ({ AI_FEATURES: { GRIEVANCE_TRIAGE: 'GRIEVANCE_TRIAGE' } }));
vi.mock('@nzila/policies', () => ({ enforceAISafety: m.enforceAISafety }));
vi.mock('@/db', () => ({ db: mockDb }));
vi.mock('@/db/schema', () => ({ mlPredictions: {}, modelMetadata: { id: {} } }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, and: vi.fn(() => 'and'), desc: vi.fn(() => 'desc'), eq: vi.fn(() => 'eq') };
});
vi.mock('@/lib/audit-logger', () => ({ auditLog: m.auditLog, AuditEventType: { DATA_UPDATE: 'DATA_UPDATE' }, AuditSeverity: { HIGH: 'HIGH', MEDIUM: 'MEDIUM' } }));
vi.mock('@/lib/services/pilot-tracking', () => ({ trackPilotEvent: m.trackPilotEvent }));

async function loadRoute() {
  return import('../ml/predictions/sla-breach-risk/feedback/route');
}

describe('ml/predictions/sla-breach-risk/feedback route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.updateQueue = [];
    m.guardAiFeature.mockResolvedValue(null);
    m.trackPilotEvent.mockResolvedValue(undefined);
    m.auditLog.mockResolvedValue(undefined);
    m.withApi.mockImplementation((_cfg: unknown, handler: any) =>
      async (_req: NextRequest, ctx: any = { organizationId: 'org_1', userId: 'u1', body: {}, query: {} }) => {
        try {
          const data = await handler(ctx);
          return new Response(JSON.stringify(data), { status: 200 });
        } catch (err) {
          return new Response(JSON.stringify({ error: (err as Error).message }), { status: (err as any).status ?? 500 });
        }
      });
  });

  it('POST returns 400 when organization context is missing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/ml/predictions/sla-breach-risk/feedback', { method: 'POST' }), { organizationId: null, userId: 'u1', body: {} });
    expect(response.status).toBe(400);
  });

  it('POST returns 404 when prediction is not found', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([]);

    const response = await POST(new NextRequest('http://localhost/api/ml/predictions/sla-breach-risk/feedback', { method: 'POST' }), {
      organizationId: 'org_1', userId: 'u1', body: { predictionId: 'p1', modelVersion: 'v1', actualBreach: true },
    });
    expect(response.status).toBe(404);
  });

  it('POST ingests feedback and returns metrics', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push(
      [{ id: 'p1', predictionDate: '2026-01-01', predictedValue: '0.8' }],
      [{ id: 'model_1', version: 'v1', parameters: { feedbackStats: { observations: 1, meanAbsoluteError: 0.2 } } }],
    );
    m.updateQueue.push([{ id: 'model_1', version: 'v1' }]);

    const response = await POST(new NextRequest('http://localhost/api/ml/predictions/sla-breach-risk/feedback', { method: 'POST' }), {
      organizationId: 'org_1', userId: 'u1', body: { predictionId: 'p1', modelVersion: 'v1', actualBreach: true },
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.metrics.observations).toBeGreaterThanOrEqual(1);
  });

  it('GET returns model feedback summary', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([{ id: 'model_1', version: 'v1', accuracy: '0.9', trainedAt: '2026-01-01', parameters: { feedbackStats: { observations: 2 }, retrainSignal: { recommended: false }, trainingDataQueue: [1, 2] } }]);

    const response = await GET(new NextRequest('http://localhost/api/ml/predictions/sla-breach-risk/feedback'), { organizationId: 'org_1', userId: 'u1', query: {} });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.model.version).toBe('v1');
    expect(json.queueSize).toBe(2);
  });
});
