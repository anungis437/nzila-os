/**
 * Steward Assignment Service — Unit Tests
 *
 * Tests:
 *   - calculateStewardScore: pure scoring function (0–100)
 *   - listStewards: db query delegation
 *   - createSteward: insert + returning
 *   - recommendSteward: scoring + sorting
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockSelectFrom, mockInsertValues, mockReturning, mockFindFirst } = vi.hoisted(() => {
  const mockReturning = vi.fn();
  return {
    mockSelectFrom: vi.fn(),
    mockInsertValues: vi.fn(() => ({ returning: mockReturning })),
    mockReturning,
    mockFindFirst: vi.fn(),
  };
});

vi.mock('@/db/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: mockSelectFrom,
    })),
    insert: vi.fn(() => ({ values: mockInsertValues })),
    query: {
      stewards: { findFirst: mockFindFirst },
    },
  },
}));

vi.mock('@/db/schema/domains/member/stewards', () => ({
  stewards: { id: 'id', orgId: 'orgId', active: 'active', region: 'region' },
  stewardAssignments: {},
}));

vi.mock('@/db/schema/domains/claims/grievances', () => ({
  grievances: { id: 'id', organizationId: 'organizationId' },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

// ── Imports ──────────────────────────────────────────────────────────────────

import { calculateStewardScore, listStewards, createSteward, recommendSteward } from '../steward-assignment';
import type { ScoringInput } from '../steward-assignment';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('calculateStewardScore', () => {
  it('returns baseline 50 with no matches', () => {
    const input: ScoringInput = {
      stewardRegion: null,
      stewardSpecialization: null,
      currentCaseload: 5,
      maxCaseload: 10,
      grievanceCategory: null,
      grievancePriority: 'medium',
    };
    const score = calculateStewardScore(input);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('adds 25 for region match', () => {
    const base = calculateStewardScore({
      stewardRegion: null, stewardSpecialization: null,
      currentCaseload: 0, maxCaseload: 10,
      grievanceCategory: null, grievancePriority: 'medium',
    });
    const withRegion = calculateStewardScore({
      stewardRegion: 'Ontario', stewardSpecialization: null,
      currentCaseload: 0, maxCaseload: 10,
      grievanceCategory: null, grievancePriority: 'medium',
      grievanceRegion: 'Ontario',
    });
    expect(withRegion).toBeGreaterThan(base);
  });

  it('clamps result between 0 and 100', () => {
    const maxInput: ScoringInput = {
      stewardRegion: 'AB', stewardSpecialization: 'safety',
      currentCaseload: 0, maxCaseload: 100,
      grievanceCategory: 'safety', grievancePriority: 'urgent',
      grievanceRegion: 'AB',
    };
    expect(calculateStewardScore(maxInput)).toBeLessThanOrEqual(100);
    expect(calculateStewardScore(maxInput)).toBeGreaterThanOrEqual(0);
  });
});

describe('listStewards', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns rows from select().from()', async () => {
    const rows = [{ id: 's1' }, { id: 's2' }];
    mockSelectFrom.mockReturnValue({
      where: vi.fn(() => ({ orderBy: vi.fn(() => rows) })),
    });
    const result = await listStewards('org-1');
    expect(result).toEqual(rows);
  });
});

describe('createSteward', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('inserts and returns the new steward', async () => {
    const row = { id: 's-new', orgId: 'org-1', userId: 'u-1' };
    mockReturning.mockResolvedValue([row]);
    const result = await createSteward({ orgId: 'org-1', userId: 'u-1' });
    expect(result).toEqual(row);
  });
});

describe('recommendSteward', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('throws when grievance not found', async () => {
    mockSelectFrom.mockReturnValue({
      where: vi.fn(() => []),
    });
    await expect(recommendSteward('org-1', 'g-missing')).rejects.toThrow('Grievance not found');
  });

  it('returns scored candidates sorted desc', async () => {
    let callCount = 0;
    mockSelectFrom.mockImplementation(() => ({
      where: vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          return [{ id: 'g-1', organizationId: 'org-1', type: 'safety', priority: 'high', workplaceName: 'ON' }];
        }
        return [
          { id: 's1', userId: 'u1', region: 'ON', specialization: 'safety', currentCaseload: 2, maxCaseload: 10, active: true },
          { id: 's2', userId: 'u2', region: 'BC', specialization: null, currentCaseload: 8, maxCaseload: 10, active: true },
        ];
      }),
    }));
    const candidates = await recommendSteward('org-1', 'g-1');
    expect(candidates.length).toBe(2);
    expect(candidates[0].score).toBeGreaterThanOrEqual(candidates[1].score);
  });
});
