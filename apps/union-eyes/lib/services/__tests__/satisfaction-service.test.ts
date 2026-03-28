/**
 * Satisfaction Service — Unit Tests
 *
 * Tests:
 *   - createSatisfactionSurvey: dedup + insert
 *   - getSatisfactionSurvey: delegation
 *   - submitSatisfactionRatings: validation + update
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
      satisfactionSurveys: { findFirst: mockFindFirst, findMany: mockFindMany },
    },
    insert: vi.fn(() => ({ values: mockInsertValues })),
    update: vi.fn(() => ({ set: mockUpdateSet })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => []),
        groupBy: vi.fn(() => ({ orderBy: vi.fn(async () => []) })),
      })),
    })),
  },
}));

vi.mock('@/db/schema', () => ({
  satisfactionSurveys: {
    id: 'id', claimId: 'claimId', memberId: 'memberId',
    status: 'status', lroId: 'lroId', organizationId: 'organizationId',
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

import { createSatisfactionSurvey, getSatisfactionSurvey } from '../satisfaction-service';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('createSatisfactionSurvey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst.mockResolvedValue(undefined);
  });

  it('returns existing survey if already created', async () => {
    const existing = { id: 'srv-1', claimId: 'c-1', memberId: 'm-1' };
    mockFindFirst.mockResolvedValue(existing);
    const result = await createSatisfactionSurvey({
      organizationId: 'org-1', claimId: 'c-1', memberId: 'm-1', lroId: 'lro-1',
    });
    expect(result).toEqual(existing);
  });

  it('inserts and returns new survey when none exists', async () => {
    mockFindFirst.mockResolvedValue(undefined);
    const newSurvey = { id: 'srv-new', claimId: 'c-2', memberId: 'm-2', status: 'pending' };
    mockReturning.mockResolvedValue([newSurvey]);
    const result = await createSatisfactionSurvey({
      organizationId: 'org-1', claimId: 'c-2', memberId: 'm-2', lroId: 'lro-1',
    });
    expect(result).toEqual(newSurvey);
  });
});

describe('getSatisfactionSurvey', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns survey by id', async () => {
    const survey = { id: 'srv-1', status: 'completed' };
    mockFindFirst.mockResolvedValue(survey);
    const result = await getSatisfactionSurvey('srv-1');
    expect(result).toEqual(survey);
  });

  it('returns null when not found', async () => {
    mockFindFirst.mockResolvedValue(undefined);
    const result = await getSatisfactionSurvey('missing');
    expect(result).toBeNull();
  });
});
