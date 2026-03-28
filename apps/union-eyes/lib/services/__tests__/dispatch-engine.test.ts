/**
 * Dispatch Engine — Unit Tests
 *
 * Tests:
 *   - calculateDispatchPriority returns numeric score
 *   - higher seniority = higher score
 *   - skills match increases score
 *   - availability factor adds to score
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockInsertValues, mockReturning } = vi.hoisted(() => ({
  mockInsertValues: vi.fn(() => ({ returning: mockReturning })),
  mockReturning: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    insert: vi.fn(() => ({ values: mockInsertValues })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(async () => []),
        })),
      })),
    })),
  },
}));

vi.mock('@/db/schema/domains/dispatch/dispatch', () => ({
  dispatchRequests: {},
  dispatchAssignments: {},
  dispatchRules: {},
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

// ── Imports ──────────────────────────────────────────────────────────────────

import { calculateDispatchPriority, type MemberCandidate } from '../dispatch-engine';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('dispatch-engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseCandidate: MemberCandidate = {
    memberId: 'm-1',
    skills: ['welding', 'pipefitting'],
    seniorityYears: 5,
    available: true,
  };

  const rules = [
    { ruleType: 'seniority' as const, ruleDefinition: {}, priority: 1 },
    { ruleType: 'availability' as const, ruleDefinition: {}, priority: 1 },
    { ruleType: 'skills_match' as const, ruleDefinition: {}, priority: 1 },
  ];

  it('returns a numeric score', () => {
    const score = calculateDispatchPriority(baseCandidate, ['welding'], rules);
    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThan(0);
  });

  it('higher seniority = higher score', () => {
    const junior = { ...baseCandidate, seniorityYears: 1 };
    const senior = { ...baseCandidate, seniorityYears: 20 };

    const juniorScore = calculateDispatchPriority(junior, ['welding'], rules);
    const seniorScore = calculateDispatchPriority(senior, ['welding'], rules);
    expect(seniorScore).toBeGreaterThan(juniorScore);
  });

  it('skills match increases score', () => {
    const noSkills = { ...baseCandidate, skills: [] as string[] };
    const withSkills = { ...baseCandidate, skills: ['welding', 'pipefitting'] };

    const noSkillScore = calculateDispatchPriority(noSkills, ['welding', 'pipefitting'], rules);
    const withSkillScore = calculateDispatchPriority(withSkills, ['welding', 'pipefitting'], rules);
    expect(withSkillScore).toBeGreaterThan(noSkillScore);
  });

  it('availability factor adds to score', () => {
    const unavailable = { ...baseCandidate, available: false };
    const available = { ...baseCandidate, available: true };

    const unavailScore = calculateDispatchPriority(unavailable, ['welding'], rules);
    const availScore = calculateDispatchPriority(available, ['welding'], rules);
    expect(availScore).toBeGreaterThan(unavailScore);
  });
});
