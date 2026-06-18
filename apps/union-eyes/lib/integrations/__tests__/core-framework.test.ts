/**
 * Integration Framework Core — Unit Tests
 *
 * Covers the dependency-light core: error classes (errors.ts + types.ts),
 * BaseIntegration (via a concrete test subclass) + its standalone helpers,
 * and the IntegrationRegistry singleton. None of these modules import the
 * database, node-cron, or adapters, so no heavy mocking is required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  BaseIntegration,
  needsTokenRefresh,
  createHealthCheckResult,
  createSyncResult,
} from '../base-integration';
import { IntegrationRegistry } from '../registry';
import {
  IntegrationType,
  IntegrationProvider,
  ConnectionStatus,
  type IntegrationCapabilities,
  type IntegrationConfig,
  type HealthCheckResult,
  type SyncOptions,
  type SyncResult,
  type WebhookEvent,
  IntegrationError,
  ConnectionError,
  AuthenticationError,
  SyncError,
  WebhookError,
  RateLimitError,
} from '../types';
import {
  IntegrationError as ErrIntegrationError,
  AuthenticationError as ErrAuthenticationError,
  RateLimitError as ErrRateLimitError,
} from '../errors';

// ---------------------------------------------------------------------------
// types.ts — error classes
// ---------------------------------------------------------------------------
describe('types.ts error classes', () => {
  it('IntegrationError carries provider/code/details', () => {
    const e = new IntegrationError('boom', IntegrationProvider.XERO, 'CODE', { a: 1 });
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('IntegrationError');
    expect(e.provider).toBe(IntegrationProvider.XERO);
    expect(e.code).toBe('CODE');
    expect(e.details).toEqual({ a: 1 });
  });
  it('ConnectionError/AuthenticationError/SyncError/WebhookError set names + codes', () => {
    const conn = new ConnectionError('c', IntegrationProvider.SLACK, { x: 1 });
    expect(conn.name).toBe('ConnectionError');
    expect(conn.code).toBe('CONNECTION_ERROR');
    const auth = new AuthenticationError('a', IntegrationProvider.ADP);
    expect(auth.name).toBe('AuthenticationError');
    expect(auth.code).toBe('AUTHENTICATION_ERROR');
    const sync = new SyncError('s', IntegrationProvider.WORKDAY);
    expect(sync.name).toBe('SyncError');
    expect(sync.code).toBe('SYNC_ERROR');
    const wh = new WebhookError('w', IntegrationProvider.QUICKBOOKS);
    expect(wh.name).toBe('WebhookError');
    expect(wh.code).toBe('WEBHOOK_ERROR');
  });
  it('RateLimitError exposes retryAfter', () => {
    const e = new RateLimitError('limit', IntegrationProvider.XERO, 30, { d: 1 });
    expect(e.name).toBe('RateLimitError');
    expect(e.code).toBe('RATE_LIMIT_ERROR');
    expect(e.retryAfter).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// errors.ts — standalone error classes
// ---------------------------------------------------------------------------
describe('errors.ts error classes', () => {
  it('IntegrationError defaults and instanceof chain', () => {
    const e = new ErrIntegrationError('m', 'C', 500, { d: 1 });
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('IntegrationError');
    expect(e.statusCode).toBe(500);
  });
  it('AuthenticationError default message + 401', () => {
    const e = new ErrAuthenticationError();
    expect(e).toBeInstanceOf(ErrIntegrationError);
    expect(e.name).toBe('AuthenticationError');
    expect(e.statusCode).toBe(401);
    expect(e.code).toBe('AUTH_ERROR');
    expect(e.message).toBe('Authentication failed');
  });
  it('RateLimitError default message + retryAfter + 429', () => {
    const e = new ErrRateLimitError('slow down', 60, { d: 1 });
    expect(e).toBeInstanceOf(ErrIntegrationError);
    expect(e.name).toBe('RateLimitError');
    expect(e.statusCode).toBe(429);
    expect(e.retryAfter).toBe(60);
    const def = new ErrRateLimitError();
    expect(def.message).toBe('Rate limit exceeded');
  });
});

// ---------------------------------------------------------------------------
// base-integration.ts
// ---------------------------------------------------------------------------
const oauthCaps: IntegrationCapabilities = {
  supportsFullSync: true,
  supportsIncrementalSync: true,
  supportsWebhooks: true,
  supportsRealTime: false,
  supportedEntities: ['x'],
  requiresOAuth: true,
};
const apiKeyCaps: IntegrationCapabilities = { ...oauthCaps, requiresOAuth: false };

class TestIntegration extends BaseIntegration {
  async connect(): Promise<void> {
    this.connected = true;
  }
  async disconnect(): Promise<void> {
    this.connected = false;
  }
  async healthCheck(): Promise<HealthCheckResult> {
    return createHealthCheckResult(true, ConnectionStatus.CONNECTED);
  }
  async sync(_options: SyncOptions): Promise<SyncResult> {
    return createSyncResult(true, 0);
  }
  async verifyWebhook(): Promise<boolean> {
    return true;
  }
  async processWebhook(_event: WebhookEvent): Promise<void> {
    /* no-op */
  }
  // expose protected members
  callEnsureInit() {
    this.ensureInitialized();
  }
  callEnsureConnected() {
    this.ensureConnected();
  }
  callLogOp() {
    this.logOperation('op', { k: 'v' });
  }
  callLogErr() {
    this.logError('op', new Error('x'), { k: 'v' });
  }
}

function cfg(over: Partial<IntegrationConfig> = {}): IntegrationConfig {
  return {
    organizationId: 'org1',
    type: IntegrationType.ACCOUNTING,
    provider: IntegrationProvider.XERO,
    credentials: { clientId: 'id', clientSecret: 'secret', apiKey: 'key' },
    enabled: true,
    ...over,
  };
}

describe('BaseIntegration', () => {
  it('initialize validates + sets state and logs', async () => {
    const i = new TestIntegration(IntegrationType.ACCOUNTING, IntegrationProvider.XERO, oauthCaps);
    await i.initialize(cfg());
    expect(() => i.callEnsureInit()).not.toThrow();
    i.callLogOp();
    i.callLogErr();
  });
  it('ensureInitialized throws when not initialized', () => {
    const i = new TestIntegration(IntegrationType.ACCOUNTING, IntegrationProvider.XERO, oauthCaps);
    expect(() => i.callEnsureInit()).toThrow(/not initialized/);
  });
  it('ensureConnected throws when initialized but not connected', async () => {
    const i = new TestIntegration(IntegrationType.ACCOUNTING, IntegrationProvider.XERO, oauthCaps);
    await i.initialize(cfg());
    expect(() => i.callEnsureConnected()).toThrow(/not connected/);
    await i.connect();
    expect(() => i.callEnsureConnected()).not.toThrow();
  });
  it('validateConfig rejects missing organizationId', async () => {
    const i = new TestIntegration(IntegrationType.ACCOUNTING, IntegrationProvider.XERO, oauthCaps);
    await expect(i.initialize(cfg({ organizationId: '' }))).rejects.toThrow(/Organization ID/);
  });
  it('validateConfig rejects missing OAuth credentials', async () => {
    const i = new TestIntegration(IntegrationType.ACCOUNTING, IntegrationProvider.XERO, oauthCaps);
    await expect(
      i.initialize(cfg({ credentials: { apiKey: 'k' } })),
    ).rejects.toThrow(/OAuth credentials/);
  });
  it('validateConfig rejects missing apiKey when not OAuth', async () => {
    const i = new TestIntegration(IntegrationType.ACCOUNTING, IntegrationProvider.BAMBOOHR, apiKeyCaps);
    await expect(i.initialize(cfg({ credentials: {} }))).rejects.toThrow(/API key required/);
  });
});

describe('base-integration helpers', () => {
  it('needsTokenRefresh: false when no expiry, true within 5min, false when far out', () => {
    expect(needsTokenRefresh(cfg())).toBe(false);
    expect(needsTokenRefresh(cfg({ credentials: { expiresAt: new Date(Date.now() + 60_000) } }))).toBe(true);
    expect(
      needsTokenRefresh(cfg({ credentials: { expiresAt: new Date(Date.now() + 60 * 60_000) } })),
    ).toBe(false);
  });
  it('createHealthCheckResult populates options', () => {
    const r = createHealthCheckResult(true, ConnectionStatus.CONNECTED, {
      latencyMs: 5,
      rateLimitRemaining: 9,
      lastError: 'e',
    });
    expect(r.healthy).toBe(true);
    expect(r.latencyMs).toBe(5);
    expect(r.lastCheckedAt).toBeInstanceOf(Date);
  });
  it('createSyncResult applies defaults and options', () => {
    expect(createSyncResult(true, 3)).toMatchObject({
      success: true,
      recordsProcessed: 3,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
    });
    const withOpts = createSyncResult(false, 2, {
      recordsCreated: 1,
      recordsUpdated: 1,
      recordsFailed: 1,
      cursor: 'c',
    });
    expect(withOpts.cursor).toBe('c');
    expect(withOpts.recordsFailed).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// registry.ts
// ---------------------------------------------------------------------------
describe('IntegrationRegistry', () => {
  const reg = IntegrationRegistry.getInstance();

  it('getInstance is a singleton', () => {
    expect(IntegrationRegistry.getInstance()).toBe(reg);
  });
  it('registers built-ins and exposes metadata', () => {
    expect(reg.getMetadata(IntegrationProvider.WORKDAY)?.name).toBe('Workday');
    expect(reg.getMetadata(IntegrationProvider.CUSTOM)).toBeUndefined();
  });
  it('getByType / getAll', () => {
    expect(reg.getByType(IntegrationType.HRIS).length).toBeGreaterThan(0);
    expect(reg.getAll().length).toBeGreaterThan(0);
  });
  it('isAvailable true for available/beta, false otherwise', () => {
    expect(reg.isAvailable(IntegrationProvider.WORKDAY)).toBe(true); // available
    expect(reg.isAvailable(IntegrationProvider.SUNLIFE)).toBe(true); // beta
    expect(reg.isAvailable(IntegrationProvider.CUSTOM)).toBe(false); // unregistered
  });
  it('register adds a custom provider', () => {
    reg.register({
      type: IntegrationType.CALENDAR,
      provider: IntegrationProvider.CUSTOM,
      name: 'Custom',
      description: 'd',
      capabilities: oauthCaps,
      requiredEnvVars: [],
      status: 'available',
    });
    expect(reg.isAvailable(IntegrationProvider.CUSTOM)).toBe(true);
  });
  it('updateHealth + getHealth + getAllHealth (new and existing)', () => {
    reg.updateHealth(IntegrationProvider.XERO, { status: ConnectionStatus.CONNECTED, rateLimitRemaining: 5 });
    expect(reg.getHealth(IntegrationProvider.XERO)?.status).toBe(ConnectionStatus.CONNECTED);
    // existing branch (no status provided -> keeps prior)
    reg.updateHealth(IntegrationProvider.XERO, { lastError: 'oops' });
    const h = reg.getHealth(IntegrationProvider.XERO);
    expect(h?.status).toBe(ConnectionStatus.CONNECTED);
    expect(h?.lastError).toBe('oops');
    expect(reg.getAllHealth().length).toBeGreaterThan(0);
  });
  it('getHealth undefined for unknown provider', () => {
    expect(reg.getHealth(IntegrationProvider.DROPBOX)).toBeUndefined();
  });
  it('checkEnvironmentVars: missing metadata, missing env, present env', () => {
    expect(reg.checkEnvironmentVars(IntegrationProvider.GOOGLE_DRIVE)).toEqual({
      available: false,
      missing: [],
    });
    delete process.env.WORKDAY_CLIENT_ID;
    delete process.env.WORKDAY_CLIENT_SECRET;
    delete process.env.WORKDAY_TENANT_ID;
    expect(reg.checkEnvironmentVars(IntegrationProvider.WORKDAY).available).toBe(false);
    process.env.WORKDAY_CLIENT_ID = 'a';
    process.env.WORKDAY_CLIENT_SECRET = 'b';
    process.env.WORKDAY_TENANT_ID = 'c';
    expect(reg.checkEnvironmentVars(IntegrationProvider.WORKDAY)).toEqual({
      available: true,
      missing: [],
    });
    delete process.env.WORKDAY_CLIENT_ID;
    delete process.env.WORKDAY_CLIENT_SECRET;
    delete process.env.WORKDAY_TENANT_ID;
  });
});
