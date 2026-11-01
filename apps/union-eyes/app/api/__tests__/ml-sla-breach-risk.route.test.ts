import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  guardAiFeature: vi.fn(),
  enforceAISafety: vi.fn(),
  db: { select: vi.fn(), insert: vi.fn() },
  audit: vi.fn(),
  claim: [] as unknown[],
  inserted: [] as Array<Record<string, unknown>>,
  rlsScopes: [] as Array<Record<string, unknown>>,
  rlsFailure: null as Error | null,
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, ApiError: { badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }) }, RATE_LIMITS: { ML_PREDICTIONS: 'ML_PREDICTIONS' }, z: require('zod') }));
vi.mock('@/lib/ai/ai-feature-guard', () => ({ guardAiFeature: m.guardAiFeature }));
vi.mock('@/lib/services/feature-flags', () => ({ AI_FEATURES: { GRIEVANCE_TRIAGE: 'GRIEVANCE_TRIAGE' } }));
vi.mock('@nzila/policies', () => ({ enforceAISafety: m.enforceAISafety }));
vi.mock('@/db', () => ({ db: m.db }));
vi.mock('@/db/schema', () => ({ claims: { claimId: 'claimId', organizationId: 'organizationId', status: 'status', priority: 'priority', updatedAt: 'updatedAt', createdAt: 'createdAt' }, mlPredictions: { organizationId: 'organizationId', predictionType: 'predictionType', createdAt: 'createdAt' }, modelMetadata: { organizationId: 'organizationId', modelType: 'modelType', version: 'version', trainedAt: 'trainedAt' } }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (scope: Record<string, unknown>, fn: (tx: unknown) => Promise<unknown>) => {
    m.rlsScopes.push(scope);
    if (m.rlsFailure) throw m.rlsFailure;
    return fn(m.db);
  },
}));
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
    m.claim = [{ status: 'open', priority: 'high', updatedAt: new Date(Date.now() - 3_600_000), createdAt: new Date(Date.now() - 3_600_000) }];
    m.inserted = [];
    m.rlsScopes = [];
    m.rlsFailure = null;
    // the first select is the case, the second the model record
    m.db.select
      .mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => m.claim) })) })) } as any)
      .mockReturnValue({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [{ version: 'sla-risk-v1', modelType: 'sla_breach_risk', trainedAt: '2026-01-01' }]) })) })) } as any);
    m.db.insert.mockReturnValue({ values: vi.fn((row: Record<string, unknown>) => { m.inserted.push(row); return { returning: vi.fn(async () => [{ id: 'pred_1' }]) }; }) });
    m.audit.mockResolvedValue(undefined);
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
    expect(m.audit).toHaveBeenCalledWith(
      m.db,
      expect.objectContaining({ organizationId: 'org_1', userId: 'u1', action: 'ml.sla_breach.predict', resourceId: 'pred_1' }),
    );
  });

  const call = (features: Record<string, unknown>) => async () => {
    const { POST } = await loadRoute();
    return POST(new NextRequest('http://localhost/api/ml/predictions/sla-breach-risk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ caseId: '550e8400-e29b-41d4-a716-446655440000', features: { transitionCount: 0, hasPreviousBreaches: false, featureRefs: ['f1'], ...features } }),
    }), { organizationId: 'org_1', userId: 'u1' });
  };

  it('scores from the case\'s own priority and deadline, ignoring a caller-supplied priority and time remaining', async () => {
    // the case is high priority with most of its window left; the caller claims urgent and already overdue
    const honest = await call({ priority: 'low', hoursRemaining: 500 })();
    m.db.select.mockReset();
    m.claim = [{ status: 'open', priority: 'high', updatedAt: new Date(Date.now() - 3_600_000), createdAt: new Date(Date.now() - 3_600_000) }];
    m.db.select
      .mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => m.claim) })) })) } as any)
      .mockReturnValue({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [{ version: 'sla-risk-v1', modelType: 'sla_breach_risk' }]) })) })) } as any);
    const inflated = await call({ priority: 'urgent', hoursRemaining: -5 })();
    expect(inflated.score).toBe(honest.score);
    expect(inflated.inputs.fromCase.priority).toBe('high');
  });

  it('answers not found, and stores nothing, for a case that is not in the caller\'s organization', async () => {
    m.db.select.mockReset();
    m.db.select.mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => []) })) })) } as any);
    await expect(call({})()).rejects.toThrow();
    expect(m.inserted).toEqual([]);
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('presents a rule-based score as one: no confidence, no interval and no training date', async () => {
    const result = await call({})();
    expect(result.method).toBe('rule_based_heuristic_v1');
    expect(result.confidence).toBeNull();
    expect(result.model).toEqual({ type: 'sla_breach_risk', version: 'sla-risk-v1' });
    const stored = m.inserted.find((row) => row.predictionType === 'sla_breach_risk');
    expect(stored).toMatchObject({ confidence: null, lowerBound: null, upperBound: null });
  });

  it('does not return a prediction whose audit record cannot be written', async () => {
    const { POST } = await loadRoute();
    m.audit.mockRejectedValueOnce(new Error('audit down'));
    await expect(POST(new NextRequest('http://localhost/api/ml/predictions/sla-breach-risk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        caseId: '550e8400-e29b-41d4-a716-446655440000',
        features: { hoursRemaining: 8, transitionCount: 2, hasPreviousBreaches: true, priority: 'high', featureRefs: ['f1'] },
      }),
    }), { organizationId: 'org_1', userId: 'u1' })).rejects.toThrow('audit down');
  });

  // DEF-0B9-ML-SLA-LIST-GET-SKIPS-THE-FEATURE-GATE-AND-SAFETY-CHECK-THE-POST-APPLIES
  describe('GET list', () => {
    const list = async () => {
      const { GET } = await loadRoute();
      return GET(new NextRequest('http://localhost/api/ml/predictions/sla-breach-risk'), { organizationId: 'org_1', userId: 'u1' });
    };
    const rows = () => m.db.select.mockReset().mockReturnValue({ from: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: vi.fn(async () => [{ id: 'p1' }]) })) })) })) } as any);

    it('applies the feature gate and the safety check before reading', async () => {
      rows();
      const result = await list();
      expect(result).toEqual({ predictions: [{ id: 'p1' }] });
      expect(m.guardAiFeature).toHaveBeenCalled();
      expect(m.enforceAISafety).toHaveBeenCalledWith(expect.objectContaining({ origin: 'sla-breach-risk', action: 'GET' }));
    });

    it('executes the prediction list inside the resolved tenant RLS transaction', async () => {
      rows();
      const result = await list();
      expect(result).toEqual({ predictions: [{ id: 'p1' }] });
      expect(m.rlsScopes).toEqual([{ organizationId: 'org_1' }]);
    });

    it('fails closed when the tenant transaction cannot be established', async () => {
      rows();
      m.rlsFailure = new Error('tenant transaction unavailable');
      await expect(list()).rejects.toThrow('tenant transaction unavailable');
      expect(m.db.select).not.toHaveBeenCalled();
    });

    it('returns the gate refusal and reads nothing when the feature is off', async () => {
      const refusal = { blocked: true };
      m.guardAiFeature.mockResolvedValueOnce(refusal);
      m.db.select.mockClear();
      expect(await list()).toBe(refusal);
      expect(m.db.select).not.toHaveBeenCalled();
    });
  });
});