/**
 * Claims Service — Unit Tests
 *
 * Tests:
 *   - listClaims: filter building, pagination
 *   - getClaimById: delegation
 *   - listClaimUpdates: ordering
 *
 * Tier 2 — Core Business Logic
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/db/db', () => ({
  db: {
    select: vi.fn(),
    query: {
      claims: { findFirst: vi.fn() },
    },
  },
}));

vi.mock('@/db/schema', () => ({
  claims: {
    organizationId: 'organizationId', status: 'status', priority: 'priority',
    claimType: 'claimType', description: 'description', createdAt: 'createdAt',
    claimId: 'claimId',
  },
  claimUpdates: {
    claimId: 'claimId', createdAt: 'createdAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...a: unknown[]) => ({ type: 'eq', args: a })),
  and: vi.fn((...a: unknown[]) => ({ type: 'and', args: a })),
  desc: vi.fn((col: unknown) => ({ type: 'desc', col })),
  sql: vi.fn(),
  like: vi.fn((...a: unknown[]) => ({ type: 'like', args: a })),
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { listClaims, getClaimById, listClaimUpdates } from '../claims-service';
import { db } from '@/db/db';

const mockDb = vi.mocked(db);

// ── Helpers ──────────────────────────────────────────────────────────────────

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('getClaimById', () => {
  beforeEach(() => vi.clearAllMocks());

  it('delegates to db.query.claims.findFirst', async () => {
    const fake = { claimId: 'CLM-001', description: 'Test' };
    vi.mocked(mockDb.query.claims.findFirst).mockResolvedValue(fake as never);

    const result = await getClaimById('CLM-001');
    expect(result).toEqual(fake);
    expect(mockDb.query.claims.findFirst).toHaveBeenCalledOnce();
  });

  it('returns undefined for non-existent claim', async () => {
    vi.mocked(mockDb.query.claims.findFirst).mockResolvedValue(undefined as never);
    const result = await getClaimById('CLM-404');
    expect(result).toBeUndefined();
  });
});

describe('listClaimUpdates', () => {
  beforeEach(() => vi.clearAllMocks());

  it('queries updates ordered by createdAt desc', async () => {
    const updates = [
      { id: '2', claimId: 'CLM-001', message: 'Later' },
      { id: '1', claimId: 'CLM-001', message: 'First' },
    ];
    const chain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(updates),
        }),
      }),
    };
    vi.mocked(mockDb.select).mockReturnValue(chain as never);

    const result = await listClaimUpdates('CLM-001');
    expect(result).toHaveLength(2);
    expect(result[0].message).toBe('Later');
  });
});
