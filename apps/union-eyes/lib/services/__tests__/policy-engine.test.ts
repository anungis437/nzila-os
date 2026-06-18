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

const { mockSelectWhere, mockInsertValues, mockLimit } = vi.hoisted(() => ({
  mockSelectWhere: vi.fn(),
  mockInsertValues: vi.fn(),
  mockLimit: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: (...args: unknown[]) => {
          const whereValue = mockSelectWhere(...args);
          return {
            limit: (...limitArgs: unknown[]) => mockLimit(...limitArgs),
            then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
              Promise.resolve(whereValue).then(onFulfilled, onRejected),
            catch: (onRejected: (reason: unknown) => unknown) =>
              Promise.resolve(whereValue).catch(onRejected),
          };
        },
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
    mockLimit.mockResolvedValue([]);
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

  it('supports numeric and string comparison operators', async () => {
    mockSelectWhere
      .mockResolvedValueOnce([
        {
          id: 'rule-3',
          ruleType: 'risk',
          category: 'screening',
          status: 'active',
          enforced: true,
          conditions: [
            { field: 'score', operator: 'greater_or_equal', value: 80 },
            { field: 'tier', operator: 'less_than', value: 'z' },
          ],
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await engine.evaluate('risk', 'screening', {
      subjectType: 'member',
      subjectId: 'member-2',
      inputData: { score: 85, tier: 'm' },
    });

    expect(result.passed).toBe(true);
  });

  it('returns retention policy or null', async () => {
    mockLimit.mockResolvedValueOnce([{ id: 'ret-1', retentionPeriodYears: 3 }]);
    const found = await engine.getRetentionPolicy('org-1', 'claims');
    expect(found).toMatchObject({ id: 'ret-1', retentionPeriodYears: 3 });

    mockLimit.mockResolvedValueOnce([]);
    const missing = await engine.getRetentionPolicy('org-1', 'claims');
    expect(missing).toBeNull();
  });

  it('checkLegalHold returns true when active hold exists and false otherwise', async () => {
    mockSelectWhere.mockResolvedValueOnce([{ id: 'hold-1' }]);
    await expect(engine.checkLegalHold('org-1', 'claims', new Date('2026-01-01'))).resolves.toBe(true);

    mockSelectWhere.mockResolvedValueOnce([]);
    await expect(engine.checkLegalHold('org-1', 'claims')).resolves.toBe(false);
  });

  it('canDelete denies for legal hold, missing policy, or unexpired retention and allows after expiry', async () => {
    const date = new Date('2026-01-01');

    // Case 1: legal hold
    mockSelectWhere.mockResolvedValueOnce([{ id: 'hold-1' }]);
    let result = await engine.canDelete('org-1', 'claims', date);
    expect(result.canDelete).toBe(false);
    expect(result.reason).toContain('legal hold');

    // Case 2: no legal hold, no policy
    mockSelectWhere.mockResolvedValueOnce([]);
    mockLimit.mockResolvedValueOnce([]);
    result = await engine.canDelete('org-1', 'claims', date);
    expect(result.canDelete).toBe(false);
    expect(result.reason).toContain('No retention policy');

    // Case 3: no legal hold, policy exists but not expired
    mockSelectWhere.mockResolvedValueOnce([]);
    mockLimit.mockResolvedValueOnce([{ retentionPeriodYears: 50 }]);
    result = await engine.canDelete('org-1', 'claims', date);
    expect(result.canDelete).toBe(false);
    expect(result.reason).toContain('Retention period not expired');

    // Case 4: no legal hold, policy exists and expired
    mockSelectWhere.mockResolvedValueOnce([]);
    mockLimit.mockResolvedValueOnce([{ retentionPeriodYears: 1 }]);
    result = await engine.canDelete('org-1', 'claims', new Date('2000-01-01'));
    expect(result.canDelete).toBe(true);
  });
});
