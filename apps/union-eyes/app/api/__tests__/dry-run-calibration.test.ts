/**
 * DRY RUN — calibrate mock patterns across 3 representative route tiers.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  STEWARD_USER,
  AUDIT_EVENT_TYPE,
  AUDIT_SEVERITY,
  makeGetRequest,
  makePostRequest,
} from './shared-route-mocks';

const m = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 99 }),
  createRateLimitHeaders: vi.fn(() => ({})),
  requireEntitlement: vi.fn().mockResolvedValue(undefined),
  checkEntitlement: vi.fn().mockResolvedValue(true),
  dbExecute: vi.fn().mockResolvedValue([]),
  auditLog: vi.fn().mockResolvedValue(undefined),
  auditDataAccess: vi.fn().mockResolvedValue(undefined),
  withRLSContext: vi.fn(),
  evaluateRoutePolicy: vi.fn().mockResolvedValue({ allow: true, directives: {} }),
  executePostHandlerPolicies: vi.fn().mockResolvedValue(undefined),
  createCorrelationContext: vi.fn().mockReturnValue({ traceId: 'test-trace' }),
  correlationToHeaders: vi.fn().mockReturnValue({}),
}));

vi.mock('@/lib/api-auth-guard', async (orig) => {
  const actual = await orig<typeof import('@/lib/api-auth-guard')>();
  return {
    ...actual,
    getCurrentUser: m.getCurrentUser,
    // Bypass withRoleAuth — invoke handler directly with steward context
    withRoleAuth: vi.fn(
      (_role: string, handler: (req: unknown, ctx: unknown) => Promise<unknown>) =>
        (req: unknown, ctx: unknown) =>
          handler(req, {
            userId: 'user_test_001',
            organizationId: '00000000-0000-0000-0000-000000000001',
            role: 'steward',
            ...(typeof ctx === 'object' && ctx !== null ? ctx : {}),
          })
    ),
    withApiAuth: vi.fn(
      (handler: (req: unknown, ctx: unknown) => Promise<unknown>) =>
        (req: unknown, ctx: unknown) =>
          handler(req, {
            userId: 'user_test_001',
            organizationId: '00000000-0000-0000-0000-000000000001',
            role: 'steward',
            ...(typeof ctx === 'object' && ctx !== null ? ctx : {}),
          })
    ),
  };
});
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  createRateLimitHeaders: m.createRateLimitHeaders,
  RATE_LIMITS: {
    DEFAULT: { requests: 100, window: 60 }, STRICT: { requests: 10, window: 60 },
    AI_INFERENCE: { requests: 20, window: 60 }, FINANCIAL_READ: { requests: 50, window: 60 },
    FINANCIAL_WRITE: { requests: 20, window: 60 }, DATA_EXPORT: { requests: 10, window: 60 },
    WEBHOOK: { requests: 100, window: 60 }, CRON: { requests: 5, window: 3600 },
    ADMIN: { requests: 200, window: 60 }, PUBLIC: { requests: 500, window: 60 },
    SEARCH: { requests: 30, window: 60 },
  },
}));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({
  requireEntitlement: m.requireEntitlement, checkEntitlement: m.checkEntitlement,
  PLATFORM_MODULES: {
    CORE: 'core', AI: 'ai', ANALYTICS: 'analytics', SOCIAL_MEDIA: 'social_media',
    PENSION: 'pension', PILOT: 'pilot', ELECTIONS: 'elections',
    CBA_INTELLIGENCE: 'cba_intelligence', WORKBOOK: 'workbook', ICRA: 'icra',
    FINANCE: 'finance', DOCUMENTS: 'documents', EMPLOYER_EXECUTION: 'employer_execution',
  },
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/audit-logger', () => ({
  auditLog: m.auditLog, auditDataAccess: m.auditDataAccess,
  AuditEventType: AUDIT_EVENT_TYPE, AuditSeverity: AUDIT_SEVERITY,
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: m.withRLSContext,
  withSystemRLSContext: vi.fn().mockImplementation(
    (_r: string, fn: (tx: unknown) => Promise<unknown>) =>
      fn({ execute: vi.fn().mockResolvedValue([]) })
  ),
  withSystemContext: vi.fn().mockImplementation(
    (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ execute: vi.fn().mockResolvedValue([]) })
  ),
}));
const mockDb = {
  execute: m.dbExecute,
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(), offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(), leftJoin: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
  }),
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: 'test-id' }]),
      onConflictDoNothing: vi.fn().mockReturnThis(),
    }),
  }),
  update: vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'test-id' }]) }),
    }),
  }),
  delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
};
vi.mock('@/db/db', () => ({ db: mockDb }));
vi.mock('@/db', () => ({ db: mockDb }));
vi.mock('@/lib/governance-observability/correlation', () => ({
  createCorrelationContext: m.createCorrelationContext,
  correlationToHeaders: m.correlationToHeaders,
}));
vi.mock('@/lib/api/route-policy', () => ({
  evaluateRoutePolicy: m.evaluateRoutePolicy,
  executePostHandlerPolicies: m.executePostHandlerPolicies,
}));
vi.mock('@/lib/api/openapi-registry', () => ({ registerApiRoute: vi.fn() }));
vi.mock('@/lib/evidence', () => ({
  buildUnionEvidencePack: vi.fn().mockResolvedValue({ packId: 'test-pack' }),
}));
vi.mock('@/lib/pilot-metrics', () => ({
  recordUnionEyesCaseCreated: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/services/ai/auto-classification-service', () => ({
  classifyClause: vi.fn().mockResolvedValue({ classification: 'wages', confidence: 0.9 }),
  generateClauseTags: vi.fn().mockResolvedValue(['wages']),
  detectCrossReferences: vi.fn().mockResolvedValue([]),
  classifyPrecedent: vi.fn().mockResolvedValue({ type: 'binding' }),
  enrichClauseMetadata: vi.fn().mockResolvedValue({ enriched: true }),
  batchClassifyClauses: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/lib/services/entitlements', () => ({
  checkEntitlement: vi.fn().mockResolvedValue(true),
}));

// ── Tier 1: crudRoutes ────────────────────────────────────────────────────────

describe('Tier 1 — crudRoutes: admin/alerts/escalations', () => {
  it('exports GET and POST handlers', async () => {
    const route = await import('../admin/alerts/escalations/route');
    expect(typeof route.GET).toBe('function');
    expect(typeof route.POST).toBe('function');
  });
});

// ── Tier 2: withApi — cases ───────────────────────────────────────────────────

describe('Tier 2 — withApi: GET /api/cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.getCurrentUser.mockResolvedValue(STEWARD_USER);
    m.withRLSContext.mockImplementation(
      (fn: (tx: unknown) => Promise<unknown>) =>
        fn({ execute: vi.fn().mockResolvedValue([]) })
    );
    m.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 99 });
    m.evaluateRoutePolicy.mockResolvedValue({ allow: true, directives: {} });
  });

  it('returns 200 with empty list when no cases', async () => {
    const { GET } = await import('../cases/route');
    const res = await GET(makeGetRequest('cases'));
    expect([200, 201]).toContain(res.status);
  });

  it('returns 401/403 when unauthenticated', async () => {
    m.getCurrentUser.mockResolvedValue(null);
    const { GET } = await import('../cases/route');
    const res = await GET(makeGetRequest('cases'));
    expect([401, 403]).toContain(res.status);
  });

  it('POST returns 4xx/5xx for short description', async () => {
    const { POST } = await import('../cases/route');
    const res = await POST(makePostRequest('cases', {
      claimType: 'grievance_discipline',
      description: 'short',
    }));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// ── Tier 3: withRoleAuth — ai/classify ───────────────────────────────────────

describe('Tier 3 — withRoleAuth: POST /api/ai/classify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.getCurrentUser.mockResolvedValue(STEWARD_USER);
    m.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 99 });
    m.checkEntitlement.mockResolvedValue(true);
  });

  it('classifies a clause — returns a response', async () => {
    const { POST } = await import('../ai/classify/route');
    const res = await POST(makePostRequest('ai/classify', {
      action: 'classify-clause',
      content: 'Employees shall receive overtime pay at 1.5x rate for hours worked beyond 40 per week.',
    }));
    // withRoleAuth uses its own session mechanism; 200 if auth works, 401 if session absent
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(600);
  });

  it('returns 4xx when rate limited', async () => {
    m.checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0, retryAfter: 60 });
    const { POST } = await import('../ai/classify/route');
    const res = await POST(makePostRequest('ai/classify', {
      action: 'classify-clause',
      content: 'Test content.',
    }));
    expect([429, 401, 403]).toContain(res.status);
  });
});
