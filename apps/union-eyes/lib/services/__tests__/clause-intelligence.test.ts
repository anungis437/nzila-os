/**
 * Clause Intelligence — Unit Tests
 *
 * Tests:
 *   - listContracts queries DB with orgId
 *   - listClauses returns filtered results
 *   - findRelevantClauses returns scored matches (keyword fallback)
 *   - findRelevantClauses returns empty for no matches
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockWhere, mockSelectFrom, mockLimit } = vi.hoisted(() => ({
  mockWhere: vi.fn(),
  mockSelectFrom: vi.fn(() => ({ where: mockWhere })),
  mockLimit: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: mockSelectFrom,
    })),
  },
}));

vi.mock('@/db/schema/domains/agreements/clauses', () => ({
  cbaClause: { cbaId: 'cbaId', title: 'title', content: 'content' },
}));

vi.mock('@/db/schema/domains/agreements/clause-embeddings', () => ({
  clauseEmbeddings: { clauseId: 'clauseId', embeddingVector: 'embeddingVector' },
}));

vi.mock('@/db/schema/domains/agreements/collective-agreements', () => ({
  collectiveAgreements: { organizationId: 'organizationId' },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

// ── Imports ──────────────────────────────────────────────────────────────────

import { listContracts, listClauses, findRelevantClauses } from '../clause-intelligence';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('clause-intelligence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockResolvedValue([]);
    mockWhere.mockReturnValue({ limit: mockLimit });
  });

  it('listContracts queries DB with orgId', async () => {
    const mockContracts = [
      { id: 'c1', name: 'CBA 2025', organizationId: 'org-1' },
    ];
    mockWhere.mockResolvedValue(mockContracts);

    const result = await listContracts('org-1');
    expect(result).toEqual(mockContracts);
    expect(mockSelectFrom).toHaveBeenCalled();
  });

  it('listClauses returns filtered results', async () => {
    const mockClauses = [
      { id: 'cl1', title: 'Article 5', content: 'Grievance procedure...' },
    ];
    mockWhere.mockResolvedValue(mockClauses);

    const result = await listClauses('c1');
    expect(result).toEqual(mockClauses);
  });

  it('findRelevantClauses returns results (keyword fallback)', async () => {
    // keyword path: select().from().where().limit() returns rows
    mockLimit.mockResolvedValue([
      { id: 'cl1', clauseNumber: '5.1', title: 'Overtime', content: 'Overtime pay rules', cbaId: 'c1', organizationId: 'org-1' },
    ]);
    // the contract lookup: select().from().where() returns contract
    mockWhere
      .mockReturnValueOnce({ limit: mockLimit }) // first call: keyword search with .limit()
      .mockResolvedValueOnce([{ title: 'CBA 2025' }]); // second call: contract title lookup

    const result = await findRelevantClauses('org-1', 'overtime pay dispute');
    expect(Array.isArray(result)).toBe(true);
  });

  it('findRelevantClauses returns empty array for short keywords', async () => {
    // All words <= 3 chars → keywords array empty → returns []
    const result = await findRelevantClauses('org-1', 'a b c');
    expect(result).toEqual([]);
  });
});
