/**
 * Clause Service — Unit Tests
 *
 * Tests:
 *   - getClauseById: fetch clause
 *   - getClausesByCBAId: filtered list
 *   - createClause: insert
 *   - searchClauses: query
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockFindFirst, mockFindMany, mockInsertValues, mockReturning, mockOrderBy } = vi.hoisted(() => {
  const mockReturning = vi.fn();
  const mockOrderBy = vi.fn();
  return {
    mockFindFirst: vi.fn(),
    mockFindMany: vi.fn(),
    mockInsertValues: vi.fn(() => ({ returning: mockReturning })),
    mockReturning,
    mockOrderBy,
  };
});

vi.mock('@/db/db', () => ({
  db: {
    query: {
      cbaClause: { findFirst: mockFindFirst, findMany: mockFindMany },
    },
    insert: vi.fn(() => ({ values: mockInsertValues })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: mockReturning })) })) })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ orderBy: mockOrderBy })),
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({ offset: vi.fn(async () => []) })),
        })),
        limit: vi.fn(async () => []),
      })),
    })),
  },
}));

vi.mock('@/db/schema', () => ({
  cbaClause: { id: 'id', cbaId: 'cbaId', clauseType: 'clauseType', title: 'title' },
  wageProgressions: {},
  benefitComparisons: {},
  clauseComparisons: {},
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { getClauseById, createClause, getClausesByCBAId } from '../clause-service';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('getClauseById', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns clause when found', async () => {
    const clause = { id: 'cl-1', title: 'Overtime' };
    mockFindFirst.mockResolvedValue(clause);
    const result = await getClauseById('cl-1');
    expect(result).toEqual(clause);
  });

  it('returns null when not found', async () => {
    mockFindFirst.mockResolvedValue(undefined);
    const result = await getClauseById('missing');
    expect(result).toBeNull();
  });
});

describe('getClausesByCBAId', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns clauses for given CBA', async () => {
    const clauses = [{ id: 'cl-1', cbaId: 'cba-1' }, { id: 'cl-2', cbaId: 'cba-1' }];
    mockOrderBy.mockResolvedValue(clauses);
    const result = await getClausesByCBAId('cba-1');
    expect(result).toEqual(clauses);
  });
});

describe('createClause', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('inserts and returns the new clause', async () => {
    const newClause = { id: 'cl-new', title: 'Seniority', cbaId: 'cba-1' };
    mockReturning.mockResolvedValue([newClause]);
    const result = await createClause({ cbaId: 'cba-1', title: 'Seniority' } as never);
    expect(result).toEqual(newClause);
  });
});
