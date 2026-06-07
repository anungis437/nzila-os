import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockLeftJoin: vi.fn(),
  mockWhere: vi.fn(),
  mockLimit: vi.fn(),
  mockOrderBy: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock('@/db', () => {
  // Create a thenable whereResult so both `await where()` and `where().limit()` work
  const whereResult = Object.assign(
    Promise.resolve([]),
    {
      limit: mocks.mockLimit,
      orderBy: mocks.mockOrderBy.mockReturnValue({ limit: mocks.mockLimit }),
    }
  );
  return {
    db: {
      select: mocks.mockSelect.mockReturnValue({
        from: mocks.mockFrom.mockReturnValue({
          leftJoin: mocks.mockLeftJoin.mockReturnValue({
            where: mocks.mockWhere.mockReturnValue(whereResult),
          }),
          where: mocks.mockWhere,
        }),
      }),
      insert: mocks.mockInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
      update: mocks.mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    },
  };
});

vi.mock('@/services/financial-service/src/db/schema', () => ({
  duesRules: {
    id: 'id', calculationType: 'calculationType', flatAmount: 'flatAmount',
    percentageRate: 'percentageRate', baseField: 'baseField', hourlyRate: 'hourlyRate',
    hoursPerPeriod: 'hoursPerPeriod', tierStructure: 'tierStructure',
    customFormula: 'customFormula', billingFrequency: 'billingFrequency', ruleName: 'ruleName',
  },
  memberDuesAssignments: {
    memberId: 'memberId', organizationId: 'organizationId', isActive: 'isActive',
    effectiveDate: 'effectiveDate', endDate: 'endDate', ruleId: 'ruleId',
    overrideAmount: 'overrideAmount', id: 'id',
  },
  duesTransactions: {
    organizationId: 'organizationId', memberId: 'memberId', createdAt: 'createdAt',
    metadata: 'metadata', periodStart: 'periodStart', periodEnd: 'periodEnd',
    id: 'id', status: 'status', dueDate: 'dueDate', lateFeeAmount: 'lateFeeAmount',
    amount: 'amount',
  },
  members: { id: 'id', organizationId: 'organizationId', status: 'status' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...a: any[]) => a),
  and: vi.fn((...a: any[]) => a),
  or: vi.fn((...a: any[]) => a),
  sql: vi.fn(),
  lte: vi.fn((...a: any[]) => a),
  gte: vi.fn((...a: any[]) => a),
  isNull: vi.fn((...a: any[]) => a),
  desc: vi.fn((a: any) => a),
  relations: vi.fn(() => ({})),
}));

describe('DuesCalculationEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    // Re-establish mock chain defaults
    mocks.mockLimit.mockResolvedValue([]);
    const whereResult = Object.assign(
      Promise.resolve([]),
      { limit: mocks.mockLimit, orderBy: mocks.mockOrderBy.mockReturnValue({ limit: mocks.mockLimit }) }
    );
    mocks.mockWhere.mockReturnValue(whereResult);
    mocks.mockLeftJoin.mockReturnValue({ where: mocks.mockWhere });
    mocks.mockFrom.mockReturnValue({ leftJoin: mocks.mockLeftJoin, where: mocks.mockWhere });
    mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });
    mocks.mockInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
    mocks.mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
  });

  // ── calculateMemberDues ──────────────────────────────────────────────────

  it('returns null when no assignment found', async () => {
    mocks.mockLimit.mockResolvedValue([]);
    const { DuesCalculationEngine } = await import('../dues-calculation-engine');
    const result = await DuesCalculationEngine.calculateMemberDues({
      organizationId: 'org1', memberId: 'mem1',
      periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-01-31'),
    });
    expect(result).toBeNull();
  });

  it('returns null when assignment has no rule', async () => {
    mocks.mockLimit.mockResolvedValue([{ assignment: {}, rule: null }]);
    const { DuesCalculationEngine } = await import('../dues-calculation-engine');
    const result = await DuesCalculationEngine.calculateMemberDues({
      organizationId: 'org1', memberId: 'mem1',
      periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-01-31'),
    });
    expect(result).toBeNull();
  });

  it('uses override amount when present', async () => {
    mocks.mockLimit.mockResolvedValue([{
      assignment: { overrideAmount: '99.99' },
      rule: { id: 'r1', ruleName: 'Override', calculationType: 'flat_rate', flatAmount: '50', billingFrequency: 'monthly' },
    }]);
    const { DuesCalculationEngine } = await import('../dues-calculation-engine');
    const result = await DuesCalculationEngine.calculateMemberDues({
      organizationId: 'org1', memberId: 'mem1',
      periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-01-31'),
    });
    expect(result!.amount).toBe(99.99);
    expect(result!.calculationType).toBe('override');
  });

  it('calculates flat_rate dues', async () => {
    mocks.mockLimit.mockResolvedValue([{
      assignment: { overrideAmount: null },
      rule: { id: 'r1', ruleName: 'Standard Flat', calculationType: 'flat_rate', flatAmount: '45.00', billingFrequency: 'monthly' },
    }]);
    const { DuesCalculationEngine } = await import('../dues-calculation-engine');
    const result = await DuesCalculationEngine.calculateMemberDues({
      organizationId: 'org1', memberId: 'mem1',
      periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-01-31'),
    });
    expect(result!.amount).toBe(45);
    expect(result!.calculationType).toBe('flat_rate');
  });

  it('calculates percentage dues', async () => {
    mocks.mockLimit.mockResolvedValue([{
      assignment: { overrideAmount: null },
      rule: {
        id: 'r2', ruleName: 'Pct', calculationType: 'percentage',
        percentageRate: '2.5', baseField: 'grossWages', billingFrequency: 'monthly',
      },
    }]);
    const { DuesCalculationEngine } = await import('../dues-calculation-engine');
    const result = await DuesCalculationEngine.calculateMemberDues({
      organizationId: 'org1', memberId: 'mem1',
      periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-01-31'),
      memberData: { grossWages: 4000 },
    });
    expect(result!.amount).toBe(100); // 4000 * 2.5%
  });

  it('returns 0 for percentage with missing rate', async () => {
    mocks.mockLimit.mockResolvedValue([{
      assignment: { overrideAmount: null },
      rule: {
        id: 'r2', ruleName: 'Pct', calculationType: 'percentage',
        percentageRate: null, baseField: null, billingFrequency: 'monthly',
      },
    }]);
    const { DuesCalculationEngine } = await import('../dues-calculation-engine');
    const result = await DuesCalculationEngine.calculateMemberDues({
      organizationId: 'org1', memberId: 'mem1',
      periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-01-31'),
    });
    expect(result!.amount).toBe(0);
  });

  it('calculates hourly dues', async () => {
    mocks.mockLimit.mockResolvedValue([{
      assignment: { overrideAmount: null },
      rule: {
        id: 'r3', ruleName: 'Hourly', calculationType: 'hourly',
        hourlyRate: '0.50', hoursPerPeriod: '160', billingFrequency: 'monthly',
      },
    }]);
    const { DuesCalculationEngine } = await import('../dues-calculation-engine');
    const result = await DuesCalculationEngine.calculateMemberDues({
      organizationId: 'org1', memberId: 'mem1',
      periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-01-31'),
      memberData: { hoursWorked: 160 },
    });
    expect(result!.amount).toBe(80); // 160 * 0.50
  });

  it('returns 0 for hourly with no rate', async () => {
    mocks.mockLimit.mockResolvedValue([{
      assignment: { overrideAmount: null },
      rule: {
        id: 'r3', ruleName: 'Hourly', calculationType: 'hourly',
        hourlyRate: null, billingFrequency: 'monthly',
      },
    }]);
    const { DuesCalculationEngine } = await import('../dues-calculation-engine');
    const result = await DuesCalculationEngine.calculateMemberDues({
      organizationId: 'org1', memberId: 'mem1',
      periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-01-31'),
    });
    expect(result!.amount).toBe(0);
  });

  it('calculates tiered dues — matching tier', async () => {
    mocks.mockLimit.mockResolvedValue([{
      assignment: { overrideAmount: null },
      rule: {
        id: 'r4', ruleName: 'Tiered', calculationType: 'tiered',
        tierStructure: [
          { minAmount: 0, maxAmount: 3000, flatAmount: 30 },
          { minAmount: 3001, maxAmount: 6000, rate: 2 },
        ],
        billingFrequency: 'monthly',
      },
    }]);
    const { DuesCalculationEngine } = await import('../dues-calculation-engine');
    const result = await DuesCalculationEngine.calculateMemberDues({
      organizationId: 'org1', memberId: 'mem1',
      periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-01-31'),
      memberData: { grossWages: 5000 },
    });
    expect(result!.amount).toBe(100); // 5000 * 2%
    expect(result!.calculationType).toBe('tiered');
  });

  it('returns 0 for tiered with no matching tier', async () => {
    mocks.mockLimit.mockResolvedValue([{
      assignment: { overrideAmount: null },
      rule: {
        id: 'r4', ruleName: 'Tiered', calculationType: 'tiered',
        tierStructure: [{ minAmount: 10000, maxAmount: 20000, flatAmount: 100 }],
        billingFrequency: 'monthly',
      },
    }]);
    const { DuesCalculationEngine } = await import('../dues-calculation-engine');
    const result = await DuesCalculationEngine.calculateMemberDues({
      organizationId: 'org1', memberId: 'mem1',
      periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-01-31'),
      memberData: { grossWages: 5000 },
    });
    expect(result!.amount).toBe(0);
  });

  it('returns 0 for tiered with missing/invalid tierStructure', async () => {
    mocks.mockLimit.mockResolvedValue([{
      assignment: { overrideAmount: null },
      rule: {
        id: 'r4', ruleName: 'Tiered', calculationType: 'tiered',
        tierStructure: null, billingFrequency: 'monthly',
      },
    }]);
    const { DuesCalculationEngine } = await import('../dues-calculation-engine');
    const result = await DuesCalculationEngine.calculateMemberDues({
      organizationId: 'org1', memberId: 'mem1',
      periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-01-31'),
    });
    expect(result!.amount).toBe(0);
  });

  it('calculates formula-based dues', async () => {
    mocks.mockLimit.mockResolvedValue([{
      assignment: { overrideAmount: null },
      rule: {
        id: 'r5', ruleName: 'Formula', calculationType: 'formula',
        customFormula: 'grossWages * 0.02 + 10', billingFrequency: 'monthly',
      },
    }]);
    const { DuesCalculationEngine } = await import('../dues-calculation-engine');
    const result = await DuesCalculationEngine.calculateMemberDues({
      organizationId: 'org1', memberId: 'mem1',
      periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-01-31'),
      memberData: { grossWages: 5000 },
    });
    expect(result!.amount).toBe(110); // 5000 * 0.02 + 10
    expect(result!.calculationType).toBe('formula');
  });

  it('returns 0 for formula with no customFormula', async () => {
    mocks.mockLimit.mockResolvedValue([{
      assignment: { overrideAmount: null },
      rule: {
        id: 'r5', ruleName: 'Formula', calculationType: 'formula',
        customFormula: null, billingFrequency: 'monthly',
      },
    }]);
    const { DuesCalculationEngine } = await import('../dues-calculation-engine');
    const result = await DuesCalculationEngine.calculateMemberDues({
      organizationId: 'org1', memberId: 'mem1',
      periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-01-31'),
    });
    expect(result!.amount).toBe(0);
  });

  it('returns 0 for unsafe formula with eval keyword', async () => {
    mocks.mockLimit.mockResolvedValue([{
      assignment: { overrideAmount: null },
      rule: {
        id: 'r5', ruleName: 'Formula', calculationType: 'formula',
        customFormula: 'eval("process.exit()")', billingFrequency: 'monthly',
      },
    }]);
    const { DuesCalculationEngine } = await import('../dues-calculation-engine');
    const result = await DuesCalculationEngine.calculateMemberDues({
      organizationId: 'org1', memberId: 'mem1',
      periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-01-31'),
    });
    expect(result!.amount).toBe(0);
  });

  it('returns null for unknown calculation type', async () => {
    mocks.mockLimit.mockResolvedValue([{
      assignment: { overrideAmount: null },
      rule: { id: 'r6', ruleName: 'Unknown', calculationType: 'unknown_type', billingFrequency: 'monthly' },
    }]);
    const { DuesCalculationEngine } = await import('../dues-calculation-engine');
    const result = await DuesCalculationEngine.calculateMemberDues({
      organizationId: 'org1', memberId: 'mem1',
      periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-01-31'),
    });
    expect(result).toBeNull();
  });

  it('includes dueDate 15 days after periodEnd', async () => {
    mocks.mockLimit.mockResolvedValue([{
      assignment: { overrideAmount: null },
      rule: { id: 'r1', ruleName: 'Flat', calculationType: 'flat_rate', flatAmount: '10', billingFrequency: 'monthly' },
    }]);
    const { DuesCalculationEngine } = await import('../dues-calculation-engine');
    const result = await DuesCalculationEngine.calculateMemberDues({
      organizationId: 'org1', memberId: 'mem1',
      periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-01-31'),
    });
    const expectedDue = new Date('2026-01-31');
    expectedDue.setDate(expectedDue.getDate() + 15);
    expect(result!.dueDate.getDate()).toBe(expectedDue.getDate());
  });

  // ── generateBillingCycle ─────────────────────────────────────────────────

  it('generateBillingCycle returns 0 when no active members', async () => {
    mocks.mockWhere.mockResolvedValue([]);
    const { DuesCalculationEngine } = await import('../dues-calculation-engine');
    const result = await DuesCalculationEngine.generateBillingCycle(
      'org1', new Date('2026-01-01'), new Date('2026-01-31')
    );
    expect(result.success).toBe(true);
    expect(result.transactionsCreated).toBe(0);
  });

  // ── calculateLateFees ────────────────────────────────────────────────────

  it('calculateLateFees returns success with 0 updates when no overdue', async () => {
    mocks.mockWhere.mockResolvedValue([]);
    const { DuesCalculationEngine } = await import('../dues-calculation-engine');
    const result = await DuesCalculationEngine.calculateLateFees('org1');
    expect(result.success).toBe(true);
    expect(result.transactionsUpdated).toBe(0);
  });
});
