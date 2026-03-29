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

vi.mock('drizzle-orm', () => ({
  sql: Object.assign(
    (strings: TemplateStringsArray, ...vals: unknown[]) => ({
      queryChunks: [strings.join('?')],
      values: vals,
    }),
    {
      raw: (val: string) => val,
      join: (parts: unknown[], sep: unknown) => parts,
    },
  ),
  SQL: class {},
  relations: vi.fn(() => ({})),
}));

vi.mock('@/lib/safe-sql-identifiers', () => ({
  safeTableName: vi.fn((name: string) => name),
  safeColumnName: vi.fn((name: string) => name),
  safeIdentifier: vi.fn((name: string) => name),
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { ReportExecutor, DATA_SOURCES } from '../report-executor';

describe('report-executor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('DATA_SOURCES', () => {
    it('contains claims data source', () => {
      const claims = DATA_SOURCES.find(ds => ds.id === 'claims');
      expect(claims).toBeDefined();
      expect(claims!.fields.length).toBeGreaterThan(0);
    });

    it('contains organization_members data source', () => {
      const members = DATA_SOURCES.find(ds => ds.id === 'organization_members');
      expect(members).toBeDefined();
    });

    it('contains claim_deadlines data source', () => {
      const deadlines = DATA_SOURCES.find(ds => ds.id === 'claim_deadlines');
      expect(deadlines).toBeDefined();
    });
  });

  describe('ReportExecutor', () => {
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
    });
  });
});
