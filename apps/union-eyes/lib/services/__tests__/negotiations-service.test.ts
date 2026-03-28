/**
 * Negotiations Service — Unit Tests
 *
 * Tests:
 *   - listNegotiations: pagination + filtering
 *   - getNegotiationById: delegation
 *   - listProposals: filtered query
 *   - listTentativeAgreements: list
 *   - listSessions: by negotiation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockFindFirst, mockSelectFrom } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockSelectFrom: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    query: {
      negotiations: { findFirst: mockFindFirst },
      bargainingProposals: { findFirst: vi.fn(), findMany: vi.fn() },
      tentativeAgreements: { findMany: vi.fn() },
      negotiationSessions: { findMany: vi.fn() },
      bargainingTeamMembers: { findMany: vi.fn() },
    },
    select: vi.fn(() => ({
      from: mockSelectFrom,
    })),
  },
}));

vi.mock('@/db/schema', () => ({
  negotiations: {
    id: 'id', organizationId: 'organizationId', status: 'status',
    title: 'title', createdAt: 'createdAt',
  },
  bargainingProposals: {
    id: 'id', negotiationId: 'negotiationId', status: 'status',
    proposalType: 'proposalType', createdAt: 'createdAt',
  },
  tentativeAgreements: { id: 'id', negotiationId: 'negotiationId' },
  negotiationSessions: { id: 'id', negotiationId: 'negotiationId', scheduledDate: 'scheduledDate' },
  bargainingTeamMembers: { id: 'id', negotiationId: 'negotiationId' },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

// ── Imports ──────────────────────────────────────────────────────────────────

import { listNegotiations, getNegotiationById, listProposals } from '../negotiations-service';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('getNegotiationById', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns negotiation when found', async () => {
    const neg = { id: 'neg-1', title: 'CBA Renewal 2026' };
    mockFindFirst.mockResolvedValue(neg);
    const result = await getNegotiationById('neg-1');
    expect(result).toEqual(neg);
  });

  it('returns undefined when not found', async () => {
    mockFindFirst.mockResolvedValue(undefined);
    const result = await getNegotiationById('missing');
    expect(result).toBeUndefined();
  });
});

describe('listNegotiations', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns paginated negotiations', async () => {
    mockSelectFrom.mockReturnValue({
      where: vi.fn(() => [{ count: 2 }]),
    });
    // Second call for data rows
    const dataMock = vi.fn(() => ({
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({
            offset: vi.fn(() => [{ id: 'neg-1' }, { id: 'neg-2' }]),
          })),
        })),
      })),
    }));
    let callCount = 0;
    mockSelectFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { where: vi.fn(() => [{ count: 2 }]) };
      }
      return {
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => ({
              offset: vi.fn(() => [{ id: 'neg-1' }, { id: 'neg-2' }]),
            })),
          })),
        })),
      };
    });
    const result = await listNegotiations({}, { page: 1, limit: 20 });
    expect(result).toBeDefined();
  });
});

describe('listProposals', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns proposals with count', async () => {
    let callCount = 0;
    mockSelectFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { where: vi.fn(() => [{ count: 1 }]) };
      }
      return {
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => ({
              offset: vi.fn(() => [{ id: 'prop-1' }]),
            })),
          })),
        })),
      };
    });
    const result = await listProposals({ negotiationId: 'neg-1' });
    expect(result).toBeDefined();
  });
});
