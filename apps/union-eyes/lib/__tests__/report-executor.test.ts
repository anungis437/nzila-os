/**
 * Tests for report-executor.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockExecute: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    execute: mocks.mockExecute,
  },
}));

vi.mock('drizzle-orm', () => {
  const sqlFn = Object.assign(
    (strings: TemplateStringsArray, ...vals: unknown[]) => ({
      queryChunks: [strings.reduce((acc, str, i) => acc + str + (vals[i] !== undefined ? String(vals[i]) : ''), '')],
      values: vals,
      _tag: 'sql',
    }),
    {
      raw: (val: string) => val,
      join: (parts: unknown[], sep: unknown) => ({
        queryChunks: parts.map(p => typeof p === 'object' && p !== null && 'queryChunks' in p ? (p as { queryChunks: string[] }).queryChunks.join('') : String(p)),
        _tag: 'sql.join',
        _sep: sep,
      }),
    },
  );
  return {
    sql: sqlFn,
    SQL: class {},
    relations: vi.fn(() => ({})),
  };
});

vi.mock('@/lib/safe-sql-identifiers', () => ({
  safeTableName: vi.fn((name: string) => ({ queryChunks: [name], _tag: 'safeTable' })),
  safeColumnName: vi.fn((name: string) => ({ queryChunks: [name], _tag: 'safeColumn' })),
  safeIdentifier: vi.fn((name: string) => ({ queryChunks: [name], _tag: 'safeId' })),
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import {
  ReportExecutor,
  DATA_SOURCES,
  getDataSource,
  getAllDataSources,
  validateField,
  getFieldMetadata,
} from '../report-executor';
import type { ReportConfig } from '../report-executor';

describe('report-executor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockExecute.mockResolvedValue([]);
  });

  // ── DATA_SOURCES registry ──────────────────────────────────────────

  describe('DATA_SOURCES', () => {
    it('contains claims data source', () => {
      const claims = DATA_SOURCES.find(ds => ds.id === 'claims');
      expect(claims).toBeDefined();
      expect(claims!.table).toBe('claims');
      expect(claims!.fields.length).toBeGreaterThan(0);
    });

    it('contains organization_members data source', () => {
      const members = DATA_SOURCES.find(ds => ds.id === 'organization_members');
      expect(members).toBeDefined();
      expect(members!.table).toBe('organization_members');
    });

    it('contains claim_deadlines data source', () => {
      const deadlines = DATA_SOURCES.find(ds => ds.id === 'claim_deadlines');
      expect(deadlines).toBeDefined();
    });

    it('contains dues_assignments data source', () => {
      const dues = DATA_SOURCES.find(ds => ds.id === 'dues_assignments');
      expect(dues).toBeDefined();
      expect(dues!.fields.some(f => f.id === 'amount')).toBe(true);
    });

    it('claims data source has joinable references', () => {
      const claims = DATA_SOURCES.find(ds => ds.id === 'claims')!;
      expect(claims.joinable).toContain('organization_members');
      expect(claims.joinable).toContain('claim_deadlines');
    });

    it('each field has required metadata properties', () => {
      for (const ds of DATA_SOURCES) {
        for (const f of ds.fields) {
          expect(f).toHaveProperty('id');
          expect(f).toHaveProperty('name');
          expect(f).toHaveProperty('column');
          expect(f).toHaveProperty('type');
          expect(['string', 'number', 'date', 'boolean', 'json']).toContain(f.type);
        }
      }
    });
  });

  // ── Helper functions ───────────────────────────────────────────────

  describe('getDataSource', () => {
    it('returns matching data source', () => {
      const ds = getDataSource('claims');
      expect(ds).toBeDefined();
      expect(ds!.id).toBe('claims');
    });

    it('returns undefined for unknown data source', () => {
      expect(getDataSource('nonexistent')).toBeUndefined();
    });
  });

  describe('getAllDataSources', () => {
    it('returns all data sources', () => {
      const all = getAllDataSources();
      expect(all).toBe(DATA_SOURCES);
      expect(all.length).toBe(4);
    });
  });

  describe('validateField', () => {
    it('returns true for valid field', () => {
      expect(validateField('claims', 'status')).toBe(true);
    });

    it('returns false for invalid field', () => {
      expect(validateField('claims', 'nonexistent_field')).toBe(false);
    });

    it('returns false for invalid data source', () => {
      expect(validateField('nonexistent', 'id')).toBe(false);
    });
  });

  describe('getFieldMetadata', () => {
    it('returns field metadata for valid field', () => {
      const meta = getFieldMetadata('claims', 'status');
      expect(meta).toBeDefined();
      expect(meta!.column).toBe('status');
      expect(meta!.type).toBe('string');
      expect(meta!.aggregatable).toBe(true);
    });

    it('returns undefined for unknown field', () => {
      expect(getFieldMetadata('claims', 'fakefield')).toBeUndefined();
    });

    it('returns undefined for unknown data source', () => {
      expect(getFieldMetadata('fake_ds', 'id')).toBeUndefined();
    });
  });

  // ── ReportExecutor validation ──────────────────────────────────────

  describe('ReportExecutor - validation', () => {
    it('rejects missing data source ID', async () => {
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: '',
        fields: [{ fieldId: 'id', fieldName: 'ID' }],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Data source ID is required');
    });

    it('rejects empty fields', async () => {
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('At least one field');
    });

    it('rejects invalid data source', async () => {
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'nonexistent',
        fields: [{ fieldId: 'id', fieldName: 'ID' }],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid data source');
    });

    it('rejects custom formulas for security', async () => {
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [{
          fieldId: 'id',
          fieldName: 'ID',
          formula: 'DROP TABLE claims;--',
        }],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('not supported');
    });

    it('rejects invalid field ID in config', async () => {
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [{ fieldId: 'nonexistent_field', fieldName: 'Bad' }],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid field');
    });
  });

  // ── ReportExecutor - successful execution ──────────────────────────

  describe('ReportExecutor - execution', () => {
    it('executes valid report config', async () => {
      mocks.mockExecute.mockResolvedValue([
        { id: '1', status: 'open' },
        { id: '2', status: 'closed' },
      ]);

      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [
          { fieldId: 'id', fieldName: 'Claim ID' },
          { fieldId: 'status', fieldName: 'Status' },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(2);
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.sql).toBeDefined();
    });

    it('applies default limit (1000) and offset (0)', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      const executor = new ReportExecutor('org-1');
      await executor.execute({
        dataSourceId: 'claims',
        fields: [{ fieldId: 'id', fieldName: 'ID' }],
      });
      expect(mocks.mockExecute).toHaveBeenCalledOnce();
    });

    it('uses custom limit and offset', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [{ fieldId: 'id', fieldName: 'ID' }],
        limit: 50,
        offset: 100,
      });
      expect(result.success).toBe(true);
    });

    it('returns error result on db failure', async () => {
      mocks.mockExecute.mockRejectedValue(new Error('connection failed'));
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [{ fieldId: 'id', fieldName: 'ID' }],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('connection failed');
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ── Aggregations ───────────────────────────────────────────────────

  describe('ReportExecutor - aggregations', () => {
    it.each([
      'count', 'sum', 'avg', 'min', 'max', 'count_distinct', 'string_agg',
    ] as const)('supports %s aggregation', async (agg) => {
      mocks.mockExecute.mockResolvedValue([{ result: 42 }]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [{
          fieldId: 'status',
          fieldName: 'Status',
          aggregation: agg,
        }],
        groupBy: ['status'],
      });
      expect(result.success).toBe(true);
    });

    it('applies alias to aggregated field', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [{
          fieldId: 'status',
          fieldName: 'Status',
          aggregation: 'count',
          alias: 'total_count',
        }],
        groupBy: ['status'],
      });
      expect(result.success).toBe(true);
    });
  });

  // ── Aliases ────────────────────────────────────────────────────────

  describe('ReportExecutor - aliases', () => {
    it('accepts valid alias format', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [{
          fieldId: 'status',
          fieldName: 'Status',
          alias: 'claim_status',
        }],
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid alias format (SQL injection attempt)', async () => {
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [{
          fieldId: 'status',
          fieldName: 'Status',
          alias: 'bad; DROP TABLE--',
        }],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid alias format');
    });
  });

  // ── Table-qualified fields ─────────────────────────────────────────

  describe('ReportExecutor - table-qualified fields', () => {
    it('uses table prefix when specified', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [{
          fieldId: 'status',
          fieldName: 'Status',
          table: 'claims',
        }],
      });
      expect(result.success).toBe(true);
    });
  });

  // ── JOINs ──────────────────────────────────────────────────────────

  describe('ReportExecutor - joins', () => {
    it('builds INNER JOIN', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [{ fieldId: 'id', fieldName: 'ID' }],
        joins: [{
          table: 'organization_members',
          type: 'inner',
          on: { leftField: 'claims.member_id', rightField: 'organization_members.id' },
        }],
      });
      expect(result.success).toBe(true);
    });

    it('builds LEFT JOIN', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [{ fieldId: 'id', fieldName: 'ID' }],
        joins: [{
          table: 'claim_deadlines',
          type: 'left',
          on: { leftField: 'claims.id', rightField: 'claim_deadlines.claim_id' },
        }],
      });
      expect(result.success).toBe(true);
    });

    it('supports custom operator in join', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [{ fieldId: 'id', fieldName: 'ID' }],
        joins: [{
          table: 'claim_deadlines',
          type: 'left',
          on: { leftField: 'claims.id', rightField: 'claim_deadlines.claim_id', operator: '!=' },
        }],
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid join type', async () => {
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [{ fieldId: 'id', fieldName: 'ID' }],
        joins: [{
          table: 'claim_deadlines',
          type: 'cross' as 'inner',
          on: { leftField: 'a', rightField: 'b' },
        }],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid join type');
    });

    it('rejects invalid join operator', async () => {
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [{ fieldId: 'id', fieldName: 'ID' }],
        joins: [{
          table: 'claim_deadlines',
          type: 'inner',
          on: { leftField: 'a', rightField: 'b', operator: 'LIKE' as '=' },
        }],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid join operator');
    });

    it('rejects join to unknown table', async () => {
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [{ fieldId: 'id', fieldName: 'ID' }],
        joins: [{
          table: 'drop_table_evil',
          type: 'inner',
          on: { leftField: 'a', rightField: 'b' },
        }],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid join table');
    });
  });

  // ── Filters ────────────────────────────────────────────────────────

  describe('ReportExecutor - filters', () => {
    const baseConfig = (filters: ReportConfig['filters']): ReportConfig => ({
      dataSourceId: 'claims',
      fields: [{ fieldId: 'id', fieldName: 'ID' }],
      filters,
    });

    it.each([
      'eq', 'ne', 'gt', 'lt', 'gte', 'lte',
    ] as const)('supports %s filter operator', async (op) => {
      mocks.mockExecute.mockResolvedValue([]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute(baseConfig([
        { fieldId: 'status', operator: op, value: 'open' },
      ]));
      expect(result.success).toBe(true);
    });

    it('supports like filter', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute(baseConfig([
        { fieldId: 'status', operator: 'like', value: 'open' },
      ]));
      expect(result.success).toBe(true);
    });

    it('supports ilike filter', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute(baseConfig([
        { fieldId: 'status', operator: 'ilike', value: 'OPEN' },
      ]));
      expect(result.success).toBe(true);
    });

    it('supports in filter', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute(baseConfig([
        { fieldId: 'status', operator: 'in', values: ['open', 'closed'] },
      ]));
      expect(result.success).toBe(true);
    });

    it('supports not_in filter', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute(baseConfig([
        { fieldId: 'status', operator: 'not_in', values: ['archived'] },
      ]));
      expect(result.success).toBe(true);
    });

    it('supports is_null filter', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute(baseConfig([
        { fieldId: 'resolved_at', operator: 'is_null' },
      ]));
      expect(result.success).toBe(true);
    });

    it('supports is_not_null filter', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute(baseConfig([
        { fieldId: 'resolved_at', operator: 'is_not_null' },
      ]));
      expect(result.success).toBe(true);
    });

    it('supports between filter', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute(baseConfig([
        { fieldId: 'created_at', operator: 'between', values: ['2025-01-01', '2025-12-31'] },
      ]));
      expect(result.success).toBe(true);
    });

    it('supports OR logical operator between conditions', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute(baseConfig([
        { fieldId: 'status', operator: 'eq', value: 'open', logicalOperator: 'OR' },
        { fieldId: 'status', operator: 'eq', value: 'pending', logicalOperator: 'OR' },
      ]));
      expect(result.success).toBe(true);
    });

    it('transitions from AND to OR groups', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute(baseConfig([
        { fieldId: 'status', operator: 'eq', value: 'open', logicalOperator: 'AND' },
        { fieldId: 'priority', operator: 'eq', value: 'high', logicalOperator: 'OR' },
        { fieldId: 'priority', operator: 'eq', value: 'critical', logicalOperator: 'OR' },
      ]));
      expect(result.success).toBe(true);
    });

    it('uses fieldName when provided', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute(baseConfig([
        { fieldId: 'status', fieldName: 'claims.status', operator: 'eq', value: 'open' },
      ]));
      expect(result.success).toBe(true);
    });
  });

  // ── GROUP BY and HAVING ────────────────────────────────────────────

  describe('ReportExecutor - groupBy & having', () => {
    it('applies GROUP BY clause', async () => {
      mocks.mockExecute.mockResolvedValue([{ status: 'open', count: 5 }]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [
          { fieldId: 'status', fieldName: 'Status' },
          { fieldId: 'id', fieldName: 'Count', aggregation: 'count' },
        ],
        groupBy: ['status'],
      });
      expect(result.success).toBe(true);
    });

    it('applies HAVING clause with aggregation filter', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [
          { fieldId: 'status', fieldName: 'Status' },
          { fieldId: 'id', fieldName: 'Count', aggregation: 'count' },
        ],
        groupBy: ['status'],
        having: [{ fieldId: 'id', operator: 'gt', value: 5 }],
      });
      expect(result.success).toBe(true);
    });
  });

  // ── ORDER BY ───────────────────────────────────────────────────────

  describe('ReportExecutor - sorting', () => {
    it('sorts ascending by default', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [{ fieldId: 'id', fieldName: 'ID' }],
        sortBy: [{ fieldId: 'created_at', direction: 'asc' }],
      });
      expect(result.success).toBe(true);
    });

    it('sorts descending', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [{ fieldId: 'id', fieldName: 'ID' }],
        sortBy: [{ fieldId: 'created_at', direction: 'desc' }],
      });
      expect(result.success).toBe(true);
    });

    it('supports NULLS FIRST', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [{ fieldId: 'id', fieldName: 'ID' }],
        sortBy: [{ fieldId: 'resolved_at', direction: 'asc', nulls: 'first' }],
      });
      expect(result.success).toBe(true);
    });

    it('supports NULLS LAST', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [{ fieldId: 'id', fieldName: 'ID' }],
        sortBy: [{ fieldId: 'resolved_at', direction: 'desc', nulls: 'last' }],
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid nulls direction', async () => {
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [{ fieldId: 'id', fieldName: 'ID' }],
        sortBy: [{ fieldId: 'id', direction: 'asc', nulls: 'middle' as 'first' }],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid nulls direction');
    });

    it('supports multiple sort rules', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [{ fieldId: 'id', fieldName: 'ID' }],
        sortBy: [
          { fieldId: 'status', direction: 'asc' },
          { fieldId: 'created_at', direction: 'desc' },
        ],
      });
      expect(result.success).toBe(true);
    });
  });

  // ── Complex query (all clauses combined) ───────────────────────────

  describe('ReportExecutor - complex query', () => {
    it('combines joins, filters, groupBy, having, sorting, limit', async () => {
      mocks.mockExecute.mockResolvedValue([{ status: 'open', total: 10 }]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [
          { fieldId: 'status', fieldName: 'Status' },
          { fieldId: 'id', fieldName: 'Total', aggregation: 'count', alias: 'total' },
        ],
        joins: [{
          table: 'claim_deadlines',
          type: 'left',
          on: { leftField: 'claims.id', rightField: 'claim_deadlines.claim_id' },
        }],
        filters: [
          { fieldId: 'status', operator: 'in', values: ['open', 'pending'] },
        ],
        groupBy: ['status'],
        having: [{ fieldId: 'id', operator: 'gte', value: 1 }],
        sortBy: [{ fieldId: 'status', direction: 'asc' }],
        limit: 25,
        offset: 0,
      });
      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(1);
    });
  });

  /* ── Batch 32: branch gap-fill (aggregation, filters, errors) ── */

  describe('ReportExecutor - aggregation types', () => {
    it('builds SUM aggregation', async () => {
      mocks.mockExecute.mockResolvedValue([{ amount_sum: 1000 }]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [{ fieldId: 'id', fieldName: 'Sum', aggregation: 'sum' }],
        groupBy: ['status'],
      });
      expect(result.success).toBe(true);
    });

    it('builds AVG aggregation', async () => {
      mocks.mockExecute.mockResolvedValue([{ avg: 42 }]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [{ fieldId: 'id', fieldName: 'Avg', aggregation: 'avg' }],
        groupBy: ['status'],
      });
      expect(result.success).toBe(true);
    });

    it('builds MIN aggregation', async () => {
      mocks.mockExecute.mockResolvedValue([{ min: 1 }]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [{ fieldId: 'id', fieldName: 'Min', aggregation: 'min' }],
        groupBy: ['status'],
      });
      expect(result.success).toBe(true);
    });

    it('builds MAX aggregation', async () => {
      mocks.mockExecute.mockResolvedValue([{ max: 999 }]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [{ fieldId: 'id', fieldName: 'Max', aggregation: 'max' }],
        groupBy: ['status'],
      });
      expect(result.success).toBe(true);
    });

    it('builds COUNT(DISTINCT) aggregation', async () => {
      mocks.mockExecute.mockResolvedValue([{ ct: 5 }]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [{ fieldId: 'status', fieldName: 'Unique', aggregation: 'count_distinct' }],
        groupBy: ['priority'],
      });
      expect(result.success).toBe(true);
    });

    it('builds STRING_AGG aggregation', async () => {
      mocks.mockExecute.mockResolvedValue([{ agg: 'a, b' }]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [{ fieldId: 'status', fieldName: 'Statuses', aggregation: 'string_agg' }],
        groupBy: ['priority'],
      });
      expect(result.success).toBe(true);
    });

    it('falls back to raw column for unknown aggregation', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [{ fieldId: 'status', fieldName: 'Status', aggregation: 'median' as 'count' }],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('ReportExecutor - error handling', () => {
    it('returns error result on query failure', async () => {
      mocks.mockExecute.mockRejectedValue(new Error('syntax error'));
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [{ fieldId: 'id', fieldName: 'ID' }],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('syntax error');
    });
  });

  describe('ReportExecutor - filter operators (ne/gt/lt)', () => {
    it('applies ne (not equal) filter', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [{ fieldId: 'id', fieldName: 'ID' }],
        filters: [{ fieldId: 'status', operator: 'ne', value: 'closed' }],
      });
      expect(result.success).toBe(true);
    });

    it('applies gt (greater than) filter', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [{ fieldId: 'id', fieldName: 'ID' }],
        filters: [{ fieldId: 'priority', operator: 'gt', value: 3 }],
      });
      expect(result.success).toBe(true);
    });

    it('applies lt (less than) filter', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [{ fieldId: 'id', fieldName: 'ID' }],
        filters: [{ fieldId: 'priority', operator: 'lt', value: 5 }],
      });
      expect(result.success).toBe(true);
    });

    it('applies lte (less than or equal) filter', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [{ fieldId: 'id', fieldName: 'ID' }],
        filters: [{ fieldId: 'priority', operator: 'lte', value: 3 }],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('ReportExecutor - field with table prefix', () => {
    it('uses table-qualified column name when field.table is set', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      const executor = new ReportExecutor('org-1');
      const result = await executor.execute({
        dataSourceId: 'claims',
        fields: [{ fieldId: 'id', fieldName: 'ID', table: 'claims' }],
      });
      expect(result.success).toBe(true);
    });
  });
});
