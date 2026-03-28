/**
 * Policy Engine — Unit Tests
 *
 * Tests:
 *   - evaluate returns allow when no rules match
 *   - evaluate enforces active rules
 *   - evaluate respects exceptions
 *
 * NOTE: imports from `@/db` (not `@/db/db`)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockSelectWhere, mockInsertValues } = vi.hoisted(() => ({
  mockSelectWhere: vi.fn(),
  mockInsertValues: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: mockSelectWhere,
      })),
    })),
    insert: vi.fn(() => ({ values: mockInsertValues })),
  },
}));

vi.mock('@/db/schema/policy-engine-schema', () => ({
  policyRules: {
    ruleType: 'ruleType',
    category: 'category',
    status: 'status',
    enforced: 'enforced',
  },
  policyEvaluations: {},
  retentionPolicies: {},
  legalHolds: {},
  policyExceptions: {
    ruleId: 'ruleId',
    subjectType: 'subjectType',
    subjectId: 'subjectId',
    expiresAt: 'expiresAt',
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

import { PolicyEngine } from '../policy-engine';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('PolicyEngine', () => {
  let engine: PolicyEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new PolicyEngine();
    mockSelectWhere.mockResolvedValue([]);
    mockInsertValues.mockResolvedValue(undefined);
  });

  it('returns allow when no rules match', async () => {
    mockSelectWhere.mockResolvedValue([]); // no rules

    const result = await engine.evaluate('access_control', 'member_data', {
      subjectType: 'member',
      subjectId: 'member-1',
      inputData: { action: 'read' },
    });

    expect(result.passed).toBe(true);
    expect(result.actionTaken).toBe('allowed');
    expect(result.applicableRules).toEqual([]);
  });

  it('enforces active rules — denies when condition fails', async () => {
    // First call: get rules → returns a rule
    // Second call: checkException → returns [] (no exception)
    // Third+ calls: insert evaluations
    mockSelectWhere
      .mockResolvedValueOnce([
        {
          id: 'rule-1',
          ruleType: 'access_control',
          category: 'member_data',
          status: 'active',
          enforced: true,
          conditions: { field: 'role', operator: 'equals', value: 'admin' },
        },
      ])
      .mockResolvedValueOnce([]); // no exceptions

    const result = await engine.evaluate('access_control', 'member_data', {
      subjectType: 'user',
      subjectId: 'user-1',
      inputData: { role: 'viewer' }, // does NOT match 'admin'
    });

    expect(result.passed).toBe(false);
    expect(result.actionTaken).toBe('denied');
    expect(result.failureReason).toContain('role');
  });

  it('allows when condition passes', async () => {
    mockSelectWhere
      .mockResolvedValueOnce([
        {
          id: 'rule-2',
          ruleType: 'access_control',
          category: 'member_data',
          status: 'active',
          enforced: true,
          conditions: { field: 'role', operator: 'equals', value: 'admin' },
        },
      ])
      .mockResolvedValueOnce([]); // no exceptions

    const result = await engine.evaluate('access_control', 'member_data', {
      subjectType: 'user',
      subjectId: 'user-1',
      inputData: { role: 'admin' }, // matches
    });

    expect(result.passed).toBe(true);
    expect(result.actionTaken).toBe('allowed');
  });
});
