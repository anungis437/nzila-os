import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Hoisted mocks                                                     */
/* ------------------------------------------------------------------ */
const mocks = vi.hoisted(() => ({
  mockExecute: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: { execute: mocks.mockExecute },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('react', () => ({
  cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

/* ------------------------------------------------------------------ */
/*  Import SUT                                                        */
/* ------------------------------------------------------------------ */
import {
  checkDatabaseHealth,
  checkRedisHealth,
  checkStorageHealth,
  checkQueueHealth,
  getSystemStatus,
} from '../status-page';

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */
describe('status-page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.REDIS_URL;
    delete process.env.KV_REST_API_URL;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.AWS_S3_BUCKET;
    delete process.env.QUEUE_URL;
    delete process.env.APP_VERSION;
  });

  // ---------- checkDatabaseHealth ----------------------------------------
  describe('checkDatabaseHealth', () => {
    it('returns healthy when DB responds fast', async () => {
      mocks.mockExecute.mockResolvedValue([{ health: 1 }]);
      const result = await checkDatabaseHealth();
      expect(result.name).toBe('Database');
      expect(result.status).toBe('healthy');
      expect(result.responseTime).toBeDefined();
    });

    it('returns down when DB throws', async () => {
      mocks.mockExecute.mockRejectedValue(new Error('Connection refused'));
      const result = await checkDatabaseHealth();
      expect(result.status).toBe('down');
      expect(result.message).toBe('Connection refused');
    });
  });

  // ---------- checkRedisHealth -------------------------------------------
  describe('checkRedisHealth', () => {
    it('returns healthy when Redis is not configured', async () => {
      const result = await checkRedisHealth();
      expect(result.name).toBe('Redis');
      expect(result.status).toBe('healthy');
      expect(result.message).toContain('Not configured');
    });

    it('returns healthy when REDIS_URL is set', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const result = await checkRedisHealth();
      expect(result.status).toBe('healthy');
    });

    it('returns healthy when KV_REST_API_URL is set', async () => {
      process.env.KV_REST_API_URL = 'https://kv.example.com';
      const result = await checkRedisHealth();
      expect(result.status).toBe('healthy');
    });
  });

  // ---------- checkStorageHealth -----------------------------------------
  describe('checkStorageHealth', () => {
    it('returns healthy local storage when not configured', async () => {
      const result = await checkStorageHealth();
      expect(result.name).toBe('Storage');
      expect(result.status).toBe('healthy');
      expect(result.message).toContain('Local storage');
    });

    it('returns healthy when BLOB_READ_WRITE_TOKEN is set', async () => {
      process.env.BLOB_READ_WRITE_TOKEN = 'token123';
      const result = await checkStorageHealth();
      expect(result.status).toBe('healthy');
    });
  });

  // ---------- checkQueueHealth -------------------------------------------
  describe('checkQueueHealth', () => {
    it('returns healthy in-process queue when not configured', async () => {
      const result = await checkQueueHealth();
      expect(result.name).toBe('Queue');
      expect(result.status).toBe('healthy');
      expect(result.message).toContain('In-process');
    });

    it('returns healthy when QUEUE_URL is set', async () => {
      process.env.QUEUE_URL = 'amqp://localhost';
      const result = await checkQueueHealth();
      expect(result.status).toBe('healthy');
    });
  });

  // ---------- getSystemStatus --------------------------------------------
  describe('getSystemStatus', () => {
    it('returns overall healthy when all services healthy', async () => {
      mocks.mockExecute.mockResolvedValue([{ health: 1 }]);
      const status = await getSystemStatus();
      expect(status.status).toBe('healthy');
      expect(status.services).toHaveLength(4);
      expect(status.uptime).toBeGreaterThanOrEqual(0);
      expect(status.version).toBe('1.0.0');
    });

    it('uses APP_VERSION env var', async () => {
      process.env.APP_VERSION = '2.5.0';
      mocks.mockExecute.mockResolvedValue([{ health: 1 }]);
      const status = await getSystemStatus();
      expect(status.version).toBe('2.5.0');
    });

    it('returns down when database is down', async () => {
      mocks.mockExecute.mockRejectedValue(new Error('DB down'));
      const status = await getSystemStatus();
      expect(status.status).toBe('down');
    });

    it('includes timestamp', async () => {
      mocks.mockExecute.mockResolvedValue([{ health: 1 }]);
      const status = await getSystemStatus();
      expect(status.timestamp).toBeInstanceOf(Date);
    });
  });
});
