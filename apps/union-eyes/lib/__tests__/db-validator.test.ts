import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  dbExecute: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/db', () => ({
  db: { execute: mocks.dbExecute },
}));

vi.mock('drizzle-orm', () => ({
  sql: (strings: TemplateStringsArray, ..._values: any[]) => strings.join(''),
  relations: vi.fn(() => ({})),
}));

vi.mock('./logger', () => ({ logger: mocks.logger }));
vi.mock('@/lib/logger', () => ({ logger: mocks.logger }));

import {
  checkDatabaseHealth,
  validateDatabaseConnection,
  testDatabaseQuery,
  validateDatabaseSchema,
} from '../db-validator';

describe('db-validator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkDatabaseHealth', () => {
    it('returns healthy status when DB responds', async () => {
      mocks.dbExecute.mockResolvedValue([{
        version: 'PostgreSQL 17.0',
        database: 'nzila_automation',
      }]);

      const result = await checkDatabaseHealth();

      expect(result.healthy).toBe(true);
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.details?.connected).toBe(true);
    });

    it('returns unhealthy status on error', async () => {
      mocks.dbExecute.mockRejectedValue(new Error('connection refused'));

      const result = await checkDatabaseHealth();

      expect(result.healthy).toBe(false);
      expect(result.error).toContain('connection refused');
    });

    it('returns unhealthy on timeout', async () => {
      mocks.dbExecute.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 10000)),
      );

      const result = await checkDatabaseHealth(50);

      expect(result.healthy).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });

  describe('validateDatabaseConnection', () => {
    it('returns true on successful connection', async () => {
      mocks.dbExecute.mockResolvedValue([{ version: 'PG17' }]);

      const result = await validateDatabaseConnection(1);
      expect(result).toBe(true);
    });

    it('retries on failure and returns false after max retries', async () => {
      mocks.dbExecute.mockRejectedValue(new Error('fail'));

      const result = await validateDatabaseConnection(2, 10);
      expect(result).toBe(false);
    });
  });

  describe('testDatabaseQuery', () => {
    it('returns true when query succeeds', async () => {
      mocks.dbExecute.mockResolvedValue([{ count: 42 }]);

      const result = await testDatabaseQuery();
      expect(result).toBe(true);
    });

    it('returns false on query error', async () => {
      mocks.dbExecute.mockRejectedValue(new Error('query failed'));

      const result = await testDatabaseQuery();
      expect(result).toBe(false);
    });
  });

  describe('validateDatabaseSchema', () => {
    it('returns valid when all critical tables exist', async () => {
      mocks.dbExecute.mockResolvedValue([
        { table_name: 'users' },
        { table_name: 'organizations' },
        { table_name: 'profiles' },
        { table_name: 'claims' },
        { table_name: 'other_table' },
      ]);

      const result = await validateDatabaseSchema();
      expect(result.valid).toBe(true);
      expect(result.missingTables).toHaveLength(0);
      expect(result.tableCount).toBe(5);
    });

    it('returns invalid when critical tables are missing', async () => {
      mocks.dbExecute.mockResolvedValue([
        { table_name: 'users' },
      ]);

      const result = await validateDatabaseSchema();
      expect(result.valid).toBe(false);
      expect(result.missingTables).toContain('organizations');
      expect(result.missingTables).toContain('profiles');
      expect(result.missingTables).toContain('claims');
    });
  });
});
