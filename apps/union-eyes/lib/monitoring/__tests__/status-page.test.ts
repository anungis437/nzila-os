import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockExecute: vi.fn(),
  probeCache: vi.fn(),
  probeStorage: vi.fn(),
  probeQueue: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: { execute: mocks.mockExecute },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/logger', () => ({
  logger: { error: mocks.logError, warn: vi.fn(), info: vi.fn() },
}));

vi.mock('react', () => ({
  cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

vi.mock('@/lib/operations/service-probes', () => ({
  probeCache: mocks.probeCache,
  probeStorage: mocks.probeStorage,
  probeQueue: mocks.probeQueue,
}));

import {
  checkDatabaseHealth,
  checkRedisHealth,
  checkStorageHealth,
  checkQueueHealth,
  getSystemStatus,
} from '../status-page';

const ok = { state: 'ok', ms: 12 } as const;
const VERSION_ENV = ['APP_VERSION', 'RELEASE_ID', 'ARTIFACT_ID', 'GITHUB_SHA', 'VERCEL_GIT_COMMIT_SHA'] as const;
const savedEnv: Record<string, string | undefined> = {};

describe('status-page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const name of VERSION_ENV) {
      savedEnv[name] = process.env[name];
      delete process.env[name];
    }
    mocks.mockExecute.mockResolvedValue([{ health: 1 }]);
    mocks.probeCache.mockResolvedValue(ok);
    mocks.probeStorage.mockResolvedValue(ok);
    mocks.probeQueue.mockResolvedValue(ok);
  });

  afterEach(() => {
    for (const name of VERSION_ENV) {
      if (savedEnv[name] === undefined) delete process.env[name];
      else process.env[name] = savedEnv[name];
    }
  });

  describe('checkDatabaseHealth', () => {
    it('returns healthy when DB responds fast', async () => {
      const result = await checkDatabaseHealth();
      expect(result.name).toBe('Database');
      expect(result.status).toBe('healthy');
      expect(result.responseTime).toBeDefined();
    });

    it('returns down when DB throws, without publishing the error text', async () => {
      mocks.mockExecute.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.5:5432'));
      const result = await checkDatabaseHealth();
      expect(result.status).toBe('down');
      expect(result.message).toBe('Connection failed');
      expect(JSON.stringify(result)).not.toContain('10.0.0.5');
      expect(mocks.logError).toHaveBeenCalled();
    });
  });

  describe('the cache, storage and queue answer from the shared probes, not from their configuration', () => {
    it('is healthy only when the probe measured it', async () => {
      expect(await checkRedisHealth()).toMatchObject({ name: 'Redis', status: 'healthy', message: 'Operational', responseTime: 12 });
      expect(await checkStorageHealth()).toMatchObject({ name: 'Storage', status: 'healthy', message: 'Operational', responseTime: 12 });
      expect(await checkQueueHealth()).toMatchObject({ name: 'Queue', status: 'healthy', message: 'Operational', responseTime: 12 });
    });

    it('reports a service that is not configured as degraded, with the reason, never as operational', async () => {
      mocks.probeCache.mockResolvedValue({ state: 'degraded', note: 'Redis not configured: rate limiting is degraded' });
      mocks.probeQueue.mockResolvedValue({ state: 'degraded', note: 'The background-job backend (Django) is not configured' });
      expect(await checkRedisHealth()).toMatchObject({ status: 'degraded', message: 'Redis not configured: rate limiting is degraded' });
      expect(await checkQueueHealth()).toMatchObject({ status: 'degraded', message: 'The background-job backend (Django) is not configured' });
    });

    it('reports a service that is configured and does not answer as down', async () => {
      mocks.probeStorage.mockResolvedValue({ state: 'fail', ms: 3001, note: 'Document storage is not reachable or not configured' });
      const result = await checkStorageHealth();
      expect(result.status).toBe('down');
      expect(result.message).toBe('Document storage is not reachable or not configured');
      expect(result.responseTime).toBe(3001);
    });

    it('does not read the variables of the integrations the application does not use', async () => {
      const source = (await import('node:fs')).readFileSync(new URL('../status-page.ts', import.meta.url), 'utf8');
      for (const name of ['BLOB_READ_WRITE_TOKEN', 'AWS_S3_BUCKET', 'QUEUE_URL', 'KV_REST_API_URL']) expect(source).not.toContain(name);
      expect(source).not.toMatch(/simulate/i);
    });
  });

  describe('getSystemStatus', () => {
    it('returns overall healthy when every service was measured healthy', async () => {
      const status = await getSystemStatus();
      expect(status.status).toBe('healthy');
      expect(status.services.map((service) => service.name)).toEqual(['Database', 'Redis', 'Storage', 'Queue']);
      expect(status.uptime).toBeGreaterThanOrEqual(0);
    });

    it('is degraded when a service is not configured, and down when one does not answer', async () => {
      mocks.probeCache.mockResolvedValue({ state: 'degraded', note: 'Redis not configured' });
      expect((await getSystemStatus()).status).toBe('degraded');
      mocks.probeStorage.mockResolvedValue({ state: 'fail', note: 'unreachable' });
      expect((await getSystemStatus()).status).toBe('down');
    });

    it('returns down when the database is down', async () => {
      mocks.mockExecute.mockRejectedValue(new Error('DB down'));
      const status = await getSystemStatus();
      expect(status.status).toBe('down');
    });

    it('reports a probe that threw as down without its error text', async () => {
      mocks.probeQueue.mockRejectedValue(new Error('getaddrinfo ENOTFOUND django.internal'));
      const status = await getSystemStatus();
      const queue = status.services.find((service) => service.name === 'Queue');
      expect(queue).toMatchObject({ status: 'down', message: 'Health check failed' });
      expect(JSON.stringify(status)).not.toContain('django.internal');
    });

    it('names the version the operator set', async () => {
      process.env.APP_VERSION = '2.5.0';
      expect((await getSystemStatus()).version).toBe('2.5.0');
    });

    it('names the release or commit the build came from when no label is set, and says "unknown" rather than inventing a number', async () => {
      process.env.GITHUB_SHA = 'abc1234def';
      expect((await getSystemStatus()).version).toBe('abc1234def');
      delete process.env.GITHUB_SHA;
      expect((await getSystemStatus()).version).toBe('unknown');
    });

    it('includes timestamp', async () => {
      const status = await getSystemStatus();
      expect(status.timestamp).toBeInstanceOf(Date);
    });
  });
});
