import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests for the legacy PostgreSQL bootstrap in `db/db.ts`. The module lazily
 * creates the postgres client + drizzle instance behind Proxies, and exposes
 * health-check helpers. We mock the postgres driver, drizzle, the unified
 * multi-db client and the logger so no real connection is attempted.
 *
 * NOTE: the `client` Proxy declares an `apply` trap, but its target is a plain
 * object (non-callable), so the trap is unreachable by construction — invoking
 * `client()` throws "client is not a function" before the trap runs. It is the
 * single intentionally-uncovered function in this module.
 */

const h = vi.hoisted(() => {
  const postgres = vi.fn(() => {
    const fakeClient = vi.fn((..._args: unknown[]) => ({ rows: [] }));
    Object.assign(fakeClient, { end: vi.fn(), __tag: 'pg-client' });
    return fakeClient;
  });
  const drizzle = vi.fn(() => ({ __tag: 'drizzle-db', query: {} }));
  const checkDatabaseHealth = vi.fn(async () => ({ ok: true, message: 'healthy' }));
  const getDatabase = vi.fn(() => ({ __tag: 'unified-db' }));
  const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };
  return { postgres, drizzle, checkDatabaseHealth, getDatabase, logger };
});

vi.mock('postgres', () => ({ default: h.postgres }));
vi.mock('drizzle-orm/postgres-js', () => ({ drizzle: h.drizzle }));
vi.mock('@/lib/database/multi-db-client', () => ({
  getDatabase: h.getDatabase,
  checkDatabaseHealth: h.checkDatabaseHealth,
}));
vi.mock('@/lib/logger', () => ({ logger: h.logger }));
vi.mock('dotenv', () => ({ config: vi.fn() }));

describe('db/db.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('lazily creates the postgres client and drizzle db on first access', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pass@localhost:5432/db');
    const mod = await import('../db');

    // Accessing the db Proxy triggers getDb -> getClient -> postgres().
    void (mod.db as unknown as Record<string, unknown>).query;
    expect(h.postgres).toHaveBeenCalledTimes(1);
    expect(h.drizzle).toHaveBeenCalledTimes(1);

    // Accessing the client Proxy reuses the already-created client.
    void (mod.client as unknown as Record<string, unknown>).__tag;
    expect(h.postgres).toHaveBeenCalledTimes(1);

    // getDatabase is re-exported from the unified client.
    expect(mod.getDatabase).toBe(h.getDatabase);
  });

  it('throws a clear error when DATABASE_URL is missing', async () => {
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('NODE_ENV', 'test');
    const mod = await import('../db');

    expect(() => (mod.client as unknown as Record<string, unknown>).__tag).toThrow(
      /Missing required environment variable: DATABASE_URL/,
    );
  });

  it('checkDatabaseConnection delegates to the unified health check', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://localhost/db');
    h.checkDatabaseHealth.mockResolvedValueOnce({ ok: true, message: 'all good' });
    const mod = await import('../db');

    await expect(mod.checkDatabaseConnection()).resolves.toEqual({
      ok: true,
      message: 'all good',
    });
  });

  it('logDatabaseConnectionStatus logs info when healthy', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://localhost/db');
    h.checkDatabaseHealth.mockResolvedValueOnce({ ok: true, message: 'connected' });
    const mod = await import('../db');

    await mod.logDatabaseConnectionStatus();
    expect(h.logger.info).toHaveBeenCalledWith('connected');
    expect(h.logger.error).not.toHaveBeenCalled();
  });

  it('logDatabaseConnectionStatus logs error when unhealthy', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://localhost/db');
    h.checkDatabaseHealth.mockResolvedValueOnce({ ok: false, message: 'down' });
    const mod = await import('../db');

    await mod.logDatabaseConnectionStatus();
    expect(h.logger.error).toHaveBeenCalledWith('down');
  });

  it('logDatabaseConnectionStatus catches health-check failures', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://localhost/db');
    h.checkDatabaseHealth.mockRejectedValueOnce(new Error('boom'));
    const mod = await import('../db');

    await mod.logDatabaseConnectionStatus();
    expect(h.logger.error).toHaveBeenCalledWith(
      'Failed to check database connection',
      expect.objectContaining({ error: expect.any(Error) }),
    );
  });
});
