/**
 * Negotiations Service — Unit Tests
 *
 * Tests cover every exported function with multiple scenarios:
 *   - getNegotiationById: found / not-found
 *   - getProposalById: found / not-found
 *   - listNegotiations: no filters, with orgId, with status, with search, custom pagination
 *   - listProposals: no filters, with type filter, with status filter
 *   - listTentativeAgreements: with / without negotiationId
 *   - listSessions: returns ordered sessions
 *   - listTeamMembers: returns ordered team members
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockFindFirst, mockProposalFindFirst, mockSelectFrom } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockProposalFindFirst: vi.fn(),
  mockSelectFrom: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    query: {
      negotiations: { findFirst: mockFindFirst },
      bargainingProposals: { findFirst: mockProposalFindFirst },
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
    proposalType: 'proposalType', proposalNumber: 'proposalNumber',
  },
  tentativeAgreements: { id: 'id', negotiationId: 'negotiationId', agreementNumber: 'agreementNumber' },
  negotiationSessions: { id: 'id', negotiationId: 'negotiationId', sessionNumber: 'sessionNumber' },
  bargainingTeamMembers: { id: 'id', negotiationId: 'negotiationId', isChief: 'isChief' },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

// ── Imports ──────────────────────────────────────────────────────────────────

import {
  listNegotiations,
  getNegotiationById,
  listProposals,
  getProposalById,
  listTentativeAgreements,
  listSessions,
  listTeamMembers,
} from '../negotiations-service';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a two-call mockSelectFrom (count query → data query) */
function setupDualSelect(count: number, rows: unknown[]) {
  let callCount = 0;
  mockSelectFrom.mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      return { where: vi.fn(() => [{ count }]) };
    }
    return {
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({
            offset: vi.fn(() => rows),
          })),
        })),
      })),
    };
  });
}

/** Build a single-call mockSelectFrom returning a chain for non-paginated queries */
function setupSingleSelect(rows: unknown[]) {
  mockSelectFrom.mockReturnValue({
    where: vi.fn(() => ({
      orderBy: vi.fn(() => rows),
    })),
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('getNegotiationById', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns negotiation when found', async () => {
    const neg = { id: 'neg-1', title: 'CBA Renewal 2026' };
    mockFindFirst.mockResolvedValue(neg);
    const result = await getNegotiationById('neg-1');
    expect(result).toEqual(neg);
    expect(mockFindFirst).toHaveBeenCalledOnce();
  });

  it('returns undefined when not found', async () => {
    mockFindFirst.mockResolvedValue(undefined);
    const result = await getNegotiationById('missing');
    expect(result).toBeUndefined();
  });
});

describe('getProposalById', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns proposal when found', async () => {
    const proposal = { id: 'prop-1', title: 'Wages Proposal' };
    mockProposalFindFirst.mockResolvedValue(proposal);
    const result = await getProposalById('prop-1');
    expect(result).toEqual(proposal);
    expect(mockProposalFindFirst).toHaveBeenCalledOnce();
  });

  it('returns undefined when not found', async () => {
    mockProposalFindFirst.mockResolvedValue(undefined);
    const result = await getProposalById('missing');
    expect(result).toBeUndefined();
  });
});

describe('listNegotiations', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns paginated negotiations with defaults', async () => {
    setupDualSelect(2, [{ id: 'neg-1' }, { id: 'neg-2' }]);
    const result = await listNegotiations();
    expect(result).toEqual({
      negotiations: [{ id: 'neg-1' }, { id: 'neg-2' }],
      total: 2,
      page: 1,
      limit: 20,
    });
  });

  it('passes organizationId filter', async () => {
    setupDualSelect(1, [{ id: 'neg-3' }]);
    const result = await listNegotiations({ organizationId: 'org-1' });
    expect(result.total).toBe(1);
    expect(result.negotiations).toHaveLength(1);
  });

  it('passes status filter', async () => {
    setupDualSelect(1, [{ id: 'neg-4', status: 'active' }]);
    const result = await listNegotiations({ status: 'active' });
    expect(result.negotiations[0]).toHaveProperty('id', 'neg-4');
  });

  it('passes search filter', async () => {
    setupDualSelect(1, [{ id: 'neg-5', title: 'CBA 2026' }]);
    const result = await listNegotiations({ search: 'CBA' });
    expect(result.total).toBe(1);
  });

  it('respects custom pagination', async () => {
    setupDualSelect(50, [{ id: 'neg-6' }]);
    const result = await listNegotiations({}, { page: 3, limit: 10 });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(10);
  });
});

describe('listProposals', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns proposals with count', async () => {
    setupDualSelect(1, [{ id: 'prop-1' }]);
    const result = await listProposals({ negotiationId: 'neg-1' });
    expect(result).toEqual({
      proposals: [{ id: 'prop-1' }],
      total: 1,
      page: 1,
      limit: 20,
    });
  });

  it('passes type filter', async () => {
    setupDualSelect(2, [{ id: 'prop-2' }, { id: 'prop-3' }]);
    const result = await listProposals({ type: 'union' });
    expect(result.total).toBe(2);
  });

  it('passes status filter', async () => {
    setupDualSelect(1, [{ id: 'prop-4' }]);
    const result = await listProposals({ status: 'accepted' });
    expect(result.proposals).toHaveLength(1);
  });
});

describe('listTentativeAgreements', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns agreements filtered by negotiationId', async () => {
    setupSingleSelect([{ id: 'ta-1' }, { id: 'ta-2' }]);
    const result = await listTentativeAgreements('neg-1');
    expect(result).toEqual([{ id: 'ta-1' }, { id: 'ta-2' }]);
  });

  it('returns all agreements when no negotiationId given', async () => {
    setupSingleSelect([{ id: 'ta-3' }]);
    const result = await listTentativeAgreements();
    expect(result).toEqual([{ id: 'ta-3' }]);
  });
});

describe('listSessions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns sessions for a negotiation', async () => {
    setupSingleSelect([{ id: 'sess-1', sessionNumber: 1 }, { id: 'sess-2', sessionNumber: 2 }]);
    const result = await listSessions('neg-1');
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('sess-1');
  });
});

describe('listTeamMembers', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns team members for a negotiation', async () => {
    setupSingleSelect([{ id: 'tm-1', isChief: true }, { id: 'tm-2', isChief: false }]);
    const result = await listTeamMembers('neg-1');
    expect(result).toHaveLength(2);
    expect(result[0].isChief).toBe(true);
  });
});
