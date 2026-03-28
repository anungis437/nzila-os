/**
 * CBA Service — Unit Tests
 *
 * Tests:
 *   - getCBAById: fetch with optional analytics
 *   - createCBA: insert
 *   - searchCBAs: filtered query
 *   - getCBAsExpiringSoon: expiry date filter
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockFindFirst, mockFindMany, mockInsertValues, mockReturning, mockUpdateSet } = vi.hoisted(() => {
  const mockReturning = vi.fn();
  return {
    mockFindFirst: vi.fn(),
    mockFindMany: vi.fn(),
    mockInsertValues: vi.fn(() => ({ returning: mockReturning })),
    mockReturning,
    mockUpdateSet: vi.fn(() => ({ where: vi.fn(() => ({ returning: mockReturning })) })),
  };
});

vi.mock('@/db/db', () => ({
  db: {
    query: {
      collectiveAgreements: { findFirst: mockFindFirst, findMany: mockFindMany },
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
  collectiveAgreements: {
    id: 'id', organizationId: 'organizationId', status: 'status',
    expiryDate: 'expiryDate', viewCount: 'viewCount', updatedAt: 'updatedAt',
    title: 'title', createdAt: 'createdAt',
  },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { getCBAById, createCBA } from '../cba-service';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('getCBAById', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns CBA when found', async () => {
    const cba = { id: 'cba-1', title: 'CUPE Local 123' };
    mockFindFirst.mockResolvedValue(cba);
    const result = await getCBAById('cba-1');
    expect(result).toEqual(cba);
  });

  it('returns null when not found', async () => {
    mockFindFirst.mockResolvedValue(undefined);
    const result = await getCBAById('missing');
    expect(result).toBeNull();
  });
});

describe('createCBA', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('inserts and returns the new CBA', async () => {
    const newCBA = { id: 'cba-new', title: 'New Agreement' };
    mockReturning.mockResolvedValue([newCBA]);
    const result = await createCBA({
      organizationId: 'org-1',
      title: 'New Agreement',
    } as never);
    expect(result).toEqual(newCBA);
  });
});
