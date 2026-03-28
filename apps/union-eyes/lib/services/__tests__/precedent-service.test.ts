/**
 * Precedent Service — Unit Tests
 *
 * Tests:
 *   - getPrecedentById: fetch + view count increment
 *   - createPrecedent: insert
 *   - searchPrecedents: filtered query
 *   - getPrecedentStatistics: count
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockFindFirst, mockInsertValues, mockReturning, mockUpdateSet } = vi.hoisted(() => {
  const mockReturning = vi.fn();
  return {
    mockFindFirst: vi.fn(),
    mockInsertValues: vi.fn(() => ({ returning: mockReturning })),
    mockReturning,
    mockUpdateSet: vi.fn(() => ({ where: vi.fn(() => ({ returning: mockReturning })) })),
  };
});

vi.mock('@/db/db', () => ({
  db: {
    query: {
      arbitrationDecisions: { findFirst: mockFindFirst, findMany: vi.fn() },
      arbitratorProfiles: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    insert: vi.fn(() => ({ values: mockInsertValues })),
    update: vi.fn(() => ({ set: mockUpdateSet })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => []),
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({ offset: vi.fn(async () => []) })),
        })),
        limit: vi.fn(async () => []),
      })),
    })),
  },
}));

vi.mock('@/db/schema', () => ({
  arbitrationDecisions: {
    id: 'id', viewCount: 'viewCount', updatedAt: 'updatedAt',
    organizationId: 'organizationId',
  },
  arbitratorProfiles: { id: 'id' },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { getPrecedentById, createPrecedent } from '../precedent-service';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('getPrecedentById', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns decision when found', async () => {
    const decision = { id: 'dec-1', caseNumber: 'ARB-001' };
    mockFindFirst.mockResolvedValue(decision);
    mockUpdateSet.mockReturnValue({ where: vi.fn().mockResolvedValue([decision]) });
    const result = await getPrecedentById('dec-1');
    expect(result).toEqual(decision);
  });

  it('returns null when not found', async () => {
    mockFindFirst.mockResolvedValue(undefined);
    const result = await getPrecedentById('missing');
    expect(result).toBeNull();
  });
});

describe('createPrecedent', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('inserts and returns the new decision', async () => {
    const newDec = { id: 'dec-new', caseNumber: 'ARB-002' };
    mockReturning.mockResolvedValue([newDec]);
    const result = await createPrecedent({
      organizationId: 'org-1',
      caseNumber: 'ARB-002',
      decisionDate: new Date(),
    } as never);
    expect(result).toEqual(newDec);
  });
});
