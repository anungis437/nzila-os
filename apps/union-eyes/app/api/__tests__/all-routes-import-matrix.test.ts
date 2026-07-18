/**
 * Full API route import matrix for union-eyes.
 *
 * Purpose:
 * - import every app/api route module
 * - verify each module exports at least one handler
 * - maximize top-level route coverage before behavior-specific tests
 *
 * This is intentionally broad and shallow. It is the prep layer for the
 * route-coverage campaign and should stay stable as new routes are added.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const TEST_USER = {
  id: 'user_test_001',
  organizationId: '00000000-0000-0000-0000-000000000001',
  role: 'steward',
  roles: ['steward'],
  email: 'test@example.com',
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
vi.mock('@nzila/platform-auth/entra/config', () => ({
  handlers: {
    GET: vi.fn(),
    POST: vi.fn(),
  },
}));
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

function collectRouteFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const abs = resolve(dir, entry);
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      files.push(...collectRouteFiles(abs));
      continue;
    }
    if (entry === 'route.ts') files.push(abs);
  }
  return files;
}

const API_ROOT = resolve(__dirname, '..');
const routeFiles = collectRouteFiles(API_ROOT)
  .filter((filePath) => !filePath.includes('/__tests__/'))
  .sort();

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

describe('union-eyes api route import matrix', () => {
  it('discovers the full route surface', () => {
    expect(routeFiles.length).toBeGreaterThan(900);
  });

  for (const absolutePath of routeFiles) {
    const label = relative(API_ROOT, absolutePath);
    it(label + ' imports and exports a handler', async () => {
      const mod = await import(pathToFileURL(absolutePath).href);
      const handlers = [mod.GET, mod.POST, mod.PUT, mod.PATCH, mod.DELETE].filter(Boolean);
      expect(handlers.length).toBeGreaterThan(0);
    });
  }

  it('covers the auth_core health route explicitly', async () => {
    const mod = await import(pathToFileURL(resolve(API_ROOT, 'auth_core/health/route.ts')).href);
    expect(typeof mod.GET).toBe('function');
  });

  it('covers the version route explicitly', async () => {
    const mod = await import(pathToFileURL(resolve(API_ROOT, 'version/route.ts')).href);
    expect(typeof mod.GET).toBe('function');
  });

  it('keeps the route inventory stable enough to matter', () => {
    // Normalize to forward slashes so this assertion is platform-portable
    // (path.relative uses '\\' on Windows).
    const relativePaths = routeFiles.map((filePath) =>
      relative(API_ROOT, filePath).replace(/\\/g, '/'),
    );
    expect(relativePaths).toContain('version/route.ts');
    expect(relativePaths).toContain('ready/route.ts');
    expect(relativePaths).toContain('auth_core/health/route.ts');
  });
});
