/**
 * Full API handler smoke matrix for union-eyes.
 *
 * This executes every exported route handler once with a generic request and
 * inferred params. It is the scalable line-coverage layer after the import matrix.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import {
  collectRouteFiles,
  makeRequestForHandler,
  routeParamsFromSlug,
  routeSlug,
} from './route-invocation-helpers';

const TEST_USER = {
  id: 'user_test_001',
  organizationId: '00000000-0000-0000-0000-000000000001',
  role: 'steward',
  roles: ['steward'],
  email: 'test@example.com',
};

const GENERIC_ROW = {
  id: 'test-id',
  featureKey: 'test.feature',
  profilePayload: {},
  organizationId: '00000000-0000-0000-0000-000000000001',
  organizationName: 'Test Organization',
  organizationType: 'local',
  contactName: 'Test Contact',
  contactEmail: 'test@example.com',
  memberCount: 250,
  jurisdictions: [],
  sectors: [],
  currentSystem: 'legacy',
  challenges: [],
  goals: [],
  readinessScore: 72,
  responses: {
    organizationId: '00000000-0000-0000-0000-000000000001',
    commercialState: 'proposal_ready',
    championScore: 70,
    activityScore: 65,
  },
};

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

function makeQueryable(result: unknown[] = [GENERIC_ROW]) {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    offset: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    groupBy: vi.fn(() => chain),
    having: vi.fn(() => chain),
    values: vi.fn(() => chain),
    set: vi.fn(() => chain),
    returning: vi.fn().mockResolvedValue(result),
    onConflictDoNothing: vi.fn(() => chain),
    onConflictDoUpdate: vi.fn(() => chain),
    then: (onFulfilled: (value: unknown[]) => unknown) => Promise.resolve(onFulfilled(result)),
  };
  return chain;
}

vi.mock('@/lib/api-auth-guard', async (orig) => {
  const actual = await orig<typeof import('@/lib/api-auth-guard')>();
  return {
    ...actual,
    getCurrentUser: m.getCurrentUser,
    withRoleAuth: vi.fn(
      (_role: string, handler: (req: unknown, ctx: unknown) => Promise<unknown>) =>
        (req: unknown, ctx: unknown) =>
          handler(req, {
            userId: TEST_USER.id,
            organizationId: TEST_USER.organizationId,
            role: TEST_USER.role,
            ...(typeof ctx === 'object' && ctx !== null ? ctx : {}),
          })
    ),
    withApiAuth: vi.fn(
      (handler: (req: unknown, ctx: unknown) => Promise<unknown>) =>
        (req: unknown, ctx: unknown) =>
          handler(req, {
            userId: TEST_USER.id,
            organizationId: TEST_USER.organizationId,
            role: TEST_USER.role,
            ...(typeof ctx === 'object' && ctx !== null ? ctx : {}),
          })
    ),
  };
});

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  createRateLimitHeaders: m.createRateLimitHeaders,
  RATE_LIMITS: {
    DEFAULT: { requests: 100, window: 60 },
    STRICT: { requests: 10, window: 60 },
    AI_INFERENCE: { requests: 20, window: 60 },
    FINANCIAL_READ: { requests: 50, window: 60 },
    FINANCIAL_WRITE: { requests: 20, window: 60 },
    DATA_EXPORT: { requests: 10, window: 60 },
    WEBHOOK: { requests: 100, window: 60 },
    CRON: { requests: 5, window: 3600 },
    ADMIN: { requests: 200, window: 60 },
    PUBLIC: { requests: 500, window: 60 },
    SEARCH: { requests: 30, window: 60 },
  },
  // Generic per-key proxy so any RATE_LIMITS_PER_IP.<NAME> (present or future)
  // resolves to a usable config without this smoke test needing to enumerate
  // every preset (PR #752 round 20 added PILOT_APPLY).
  RATE_LIMITS_PER_IP: new Proxy(
    {},
    { get: (_target, prop) => ({ limit: 100, window: 3600, identifier: String(prop) }) },
  ),
}));

vi.mock('@/services/platform-economics/entitlement-guard', () => ({
  requireEntitlement: m.requireEntitlement,
  checkEntitlement: m.checkEntitlement,
  PLATFORM_MODULES: {
    CORE: 'core',
    AI: 'ai',
    ANALYTICS: 'analytics',
    SOCIAL_MEDIA: 'social_media',
    PENSION: 'pension',
    PILOT: 'pilot',
    ELECTIONS: 'elections',
    CBA_INTELLIGENCE: 'cba_intelligence',
    WORKBOOK: 'workbook',
    ICRA: 'icra',
    FINANCE: 'finance',
    DOCUMENTS: 'documents',
    EMPLOYER_EXECUTION: 'employer_execution',
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/audit-logger', () => ({
  auditLog: m.auditLog,
  auditDataAccess: m.auditDataAccess,
  AuditEventType: {
    DATA_ACCESS: 'data.access',
    DATA_CREATE: 'data.create',
    DATA_UPDATE: 'data.update',
    DATA_DELETE: 'data.delete',
    DATA_EXPORT: 'data.export',
    ADMIN_CONFIG_CHANGED: 'admin.config_changed',
    AUTH_LOGIN: 'auth.login',
    AUTH_LOGOUT: 'auth.logout',
    AUTH_FAILED: 'auth.failed',
  },
  AuditSeverity: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical',
  },
}));

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: m.withRLSContext,
  withSystemRLSContext: vi.fn().mockImplementation(
    (_reason: string, fn: (tx: unknown) => Promise<unknown>) =>
      fn(mockDb)
  ),
  withSystemContext: vi.fn().mockImplementation(
    (fn: (tx: unknown) => Promise<unknown>) =>
      fn(mockDb)
  ),
}));

const mockDb = {
  execute: vi.fn().mockResolvedValue([GENERIC_ROW]),
  select: vi.fn(() => makeQueryable()),
  insert: vi.fn(() => makeQueryable()),
  update: vi.fn(() => makeQueryable()),
  delete: vi.fn(() => makeQueryable([])),
  transaction: vi.fn(async (fn: (tx: typeof mockDb) => Promise<unknown>) => fn(mockDb)),
  query: new Proxy({}, { get: () => vi.fn().mockResolvedValue([]) }),
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
vi.mock('@/lib/evidence', () => ({ buildUnionEvidencePack: vi.fn().mockResolvedValue({ packId: 'test-pack' }) }));
vi.mock('@/lib/pilot-metrics', () => ({ recordUnionEyesCaseCreated: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/services/entitlements', () => ({ checkEntitlement: vi.fn().mockResolvedValue(true) }));
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));
vi.mock('@/lib/organization-middleware', () => ({
  withOrganizationAuth: vi.fn(
    (handler: (req: unknown, ctx: unknown, params?: unknown) => Promise<unknown>) =>
      (req: unknown, ctx?: { params?: unknown }, params?: unknown) =>
        handler(
          req,
          {
            userId: TEST_USER.id,
            organizationId: TEST_USER.organizationId,
            role: TEST_USER.role,
          },
          params ?? ctx?.params,
        )
  ),
}));
vi.mock('@nzila/platform-auth/entra/config', () => ({
  handlers: {
    GET: vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
    POST: vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
  },
}));
vi.mock('server-only', () => ({}));
vi.mock('resend', () => ({
  Resend: function Resend() {
    return {
      webhooks: {
        verify: vi.fn(() => ({
          type: 'email.sent',
          created_at: '2026-01-01T00:00:00.000Z',
          data: { email_id: 'email_test', to: ['test@example.com'] },
        })),
      },
    };
  },
}));
vi.mock('@/lib/social-media/meta-api-client', () => ({
  createMetaClient: vi.fn(() => ({
    getAuthorizationUrl: vi.fn(() => 'https://example.com/meta-auth'),
  })),
}));
vi.mock('@/lib/social-media/twitter-api-client', () => ({
  createTwitterClient: vi.fn(() => ({
    getAuthorizationUrl: vi.fn(() => 'https://example.com/twitter-auth'),
  })),
  generatePKCE: vi.fn(() => ({ verifier: 'verifier', challenge: 'challenge' })),
}));
vi.mock('@/lib/social-media/linkedin-api-client', () => ({
  createLinkedInClient: vi.fn(() => ({
    getAuthorizationUrl: vi.fn(() => 'https://example.com/linkedin-auth'),
  })),
}));
vi.mock('@/services/platform-economics', () => ({
  evaluateFee: vi.fn().mockResolvedValue(null),
  captureTransactionFee: vi.fn().mockResolvedValue(undefined),
  reverseTransactionFee: vi.fn().mockResolvedValue(undefined),
  reconcileExternalInvoicePayment: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('next-auth/providers/microsoft-entra-id', () => ({
  default: vi.fn(() => ({ id: 'microsoft-entra-id', name: 'Microsoft Entra ID', type: 'oauth' })),
}));
vi.mock('@/lib/services/ai/auto-classification-service', () => ({
  classifyClause: vi.fn().mockResolvedValue({ classification: 'wages', confidence: 0.9 }),
  generateClauseTags: vi.fn().mockResolvedValue(['wages']),
  detectCrossReferences: vi.fn().mockResolvedValue([]),
  classifyPrecedent: vi.fn().mockResolvedValue({ type: 'binding' }),
  enrichClauseMetadata: vi.fn().mockResolvedValue({ enriched: true }),
  batchClassifyClauses: vi.fn().mockResolvedValue([]),
}));

const API_ROOT = resolve(__dirname, '..');
const routeFiles = collectRouteFiles(API_ROOT)
  .filter((filePath) => !filePath.includes('/__tests__/'))
  .sort();

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  process.env.RESEND_API_KEY = 're_test';
  process.env.RESEND_WEBHOOK_SECRET = 'whsec_test';
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  m.getCurrentUser.mockResolvedValue(TEST_USER);
  m.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 99 });
  m.requireEntitlement.mockResolvedValue(undefined);
  m.checkEntitlement.mockResolvedValue(true);
  m.withRLSContext.mockImplementation(
    (fn: (tx: unknown) => Promise<unknown>) =>
      fn(mockDb)
  );
  m.evaluateRoutePolicy.mockResolvedValue({ allow: true, directives: {} });
});

describe('union-eyes full api smoke matrix', () => {
  it('discovers the full route surface', () => {
    expect(routeFiles.length).toBeGreaterThan(900);
  });

  for (const absolutePath of routeFiles) {
    const slug = routeSlug(API_ROOT, absolutePath);
    const params = routeParamsFromSlug(slug);

    it(`${slug} executes exported handlers without throwing`, async () => {
      const mod = await import(pathToFileURL(absolutePath).href);
      const handlerEntries = [
        ['GET', mod.GET],
        ['POST', mod.POST],
        ['PUT', mod.PUT],
        ['PATCH', mod.PATCH],
        ['DELETE', mod.DELETE],
      ].filter(([, handler]) => typeof handler === 'function') as Array<[string, (req: unknown, ctx?: unknown) => Promise<unknown>]>;

      expect(handlerEntries.length).toBeGreaterThan(0);

      for (const [method, handler] of handlerEntries) {
        const request = makeRequestForHandler(method, slug);
        const response = await handler(request, { params });
        expect(response).toBeDefined();
      }
    });
  }
});
