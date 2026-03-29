import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { SchemaError, wrapSchemaQuery } from '../schema-error';

describe('schema-error', () => {
  describe('SchemaError', () => {
    it('sets code and name', () => {
      const err = new SchemaError('bad column', { table: 'users' });
      expect(err.code).toBe('SCHEMA_MISMATCH');
      expect(err.name).toBe('SchemaError');
      expect(err.message).toBe('bad column');
    });

    it('stores context', () => {
      const ctx = { table: 'claims', column: 'status', route: '/api/claims' };
      const err = new SchemaError('missing column', ctx);
      expect(err.context).toEqual(ctx);
    });

    it('produces structured log', () => {
      const err = new SchemaError('test', { table: 'tbl', column: 'col' });
      const log = err.toStructuredLog();
      expect(log.error_code).toBe('SCHEMA_MISMATCH');
      expect(log.table).toBe('tbl');
      expect(log.column).toBe('col');
      expect(log.timestamp).toBeDefined();
    });
  });

  describe('wrapSchemaQuery', () => {
    it('returns result on success', async () => {
      const result = await wrapSchemaQuery(
        () => Promise.resolve('ok'),
        { table: 'users' },
      );
      expect(result).toBe('ok');
    });

    it('re-throws as SchemaError for schema-related failures', async () => {
      await expect(
        wrapSchemaQuery(
          () => Promise.reject(new Error('column "foo" does not exist')),
          { table: 'users' },
        ),
      ).rejects.toBeInstanceOf(SchemaError);
    });

    it('passes through non-schema errors', async () => {
      const err = new Error('connection refused');
      await expect(
        wrapSchemaQuery(
          () => Promise.reject(err),
          { table: 'users' },
        ),
      ).rejects.toBe(err);
    });

    /* ── Batch 33: non-Error thrown ── */

    it('handles non-Error thrown values', async () => {
      await expect(
        wrapSchemaQuery(
          () => Promise.reject('string error'),
          { table: 'users' },
        ),
      ).rejects.toBe('string error');
    });
  });
});
