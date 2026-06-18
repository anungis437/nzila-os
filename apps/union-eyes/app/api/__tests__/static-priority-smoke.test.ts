/**
 * Static-priority API smoke matrix.
 *
 * These are the heaviest non-dynamic route modules by executable line count.
 * The goal is not perfect branch coverage yet; it is to execute real handler
 * bodies cheaply and lift route line coverage fast.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import {
  collectRouteFiles,
  makeRequestForHandler,
  routeSlug,
} from './route-invocation-helpers';

const TEST_USER = {
  id: 'user_test_001',
  organizationId: '00000000-0000-0000-0000-000000000001',
  role: 'steward',
  roles: ['steward'],
  email: 'test@example.com',
};

const PRIORITY_SLUGS = [
  'social-media/analytics',
  'payments/webhooks/stripe',
  'grievances/import',
  'social-media/campaigns',
  'social-media/accounts',
  'ml/predictions/churn-risk',
  'precedents',
  'communications/webhooks/resend',
  'documents',
  'cron/external-data-sync',
  'bargaining-notes',
  'cron/calendar-sync',
  'integrations/shopify/webhooks',
  'icra/submit',
  'social-media/posts',
  'gdpr/data-export',
  'payments/webhooks/paypal',
  'documents/repository',
  'grievances',
  'reports/execute',
  'search/universal',
  'compliance/validate',
  'ready',
  'workflow/transition',
  'communications/track/click',
  'cron/sla-watchdog',
  'documents/upload',
  'ai/ingest',
  'finance/billing',
  'pilot/onboarding',
  'carbon/validate',
  'ai/search',
  'employer-execution/remittance-runs',
  'pilot/demo-data',
  'dashboard/export-csv',
  'users/me/organizations',
  'cases/intake',
  'ai/classify',
  'exit-interviews/expertise-map',
  'icra/checkout',
] as const;

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
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    having: vi.fn().mockReturnThis(),
  }),
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: 'test-id' }]),
      onConflictDoNothing: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockReturnThis(),
    }),
  }),
  update: vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'test-id' }]),
      }),
    }),
  }),
  delete: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue([]),
  }),
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
vi.mock('@nzila/platform-auth/entra/config', () => ({ handlers: { GET: vi.fn(), POST: vi.fn() } }));
vi.mock('server-only', () => ({}));
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
const routeFiles = collectRouteFiles(API_ROOT).filter((filePath) => !filePath.includes('/__tests__/'));
const routeBySlug = new Map(routeFiles.map((absolutePath) => [routeSlug(API_ROOT, absolutePath), absolutePath]));

beforeEach(() => {
  vi.clearAllMocks();
  m.getCurrentUser.mockResolvedValue(TEST_USER);
  m.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 99 });
  m.requireEntitlement.mockResolvedValue(undefined);
  m.checkEntitlement.mockResolvedValue(true);
  m.withRLSContext.mockImplementation(
    (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ execute: vi.fn().mockResolvedValue([]) })
  );
  m.evaluateRoutePolicy.mockResolvedValue({ allow: true, directives: {} });
});

describe('union-eyes static priority smoke matrix', () => {
  it('covers the intended route set', () => {
    expect(PRIORITY_SLUGS.every((slug) => routeBySlug.has(slug))).toBe(true);
  });

  for (const slug of PRIORITY_SLUGS) {
    it(`${slug} executes its exported handlers without throwing`, async () => {
      const absolutePath = routeBySlug.get(slug);
      expect(absolutePath).toBeTruthy();
      const mod = await import(pathToFileURL(absolutePath!).href);
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
        const response = await handler(request, { params: {} });
        expect(response).toBeDefined();
      }
    });
  }
});
