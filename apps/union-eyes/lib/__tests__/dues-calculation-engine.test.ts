import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockLeftJoin: vi.fn(),
  mockWhere: vi.fn(),
  mockLimit: vi.fn(),
  mockOrderBy: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    select: mocks.mockSelect.mockReturnValue({
      from: mocks.mockFrom.mockReturnValue({
        leftJoin: mocks.mockLeftJoin.mockReturnValue({
          where: mocks.mockWhere.mockReturnValue({
            limit: mocks.mockLimit.mockResolvedValue([]),
          }),
        }),
      }),
    }),
  },
}));

vi.mock('@/services/financial-service/src/db/schema', () => ({
  duesRules: {
    id: 'id',
    calculationType: 'calculationType',
    flatAmount: 'flatAmount',
    percentageRate: 'percentageRate',
    baseField: 'baseField',
    hourlyRate: 'hourlyRate',
    hoursPerPeriod: 'hoursPerPeriod',
    tierStructure: 'tierStructure',
    customFormula: 'customFormula',
    billingFrequency: 'billingFrequency',
    ruleName: 'ruleName',
  },
  memberDuesAssignments: {
    memberId: 'memberId',
    organizationId: 'organizationId',
    isActive: 'isActive',
    effectiveDate: 'effectiveDate',
    endDate: 'endDate',
    ruleId: 'ruleId',
    overrideAmount: 'overrideAmount',
  },
  duesTransactions: {
    organizationId: 'organizationId',
    memberId: 'memberId',
    createdAt: 'createdAt',
    metadata: 'metadata',
  },
  members: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...a: unknown[]) => a),
  and: vi.fn((...a: unknown[]) => a),
  or: vi.fn((...a: unknown[]) => a),
  sql: vi.fn(),
  lte: vi.fn((...a: unknown[]) => a),
  gte: vi.fn((...a: unknown[]) => a),
  isNull: vi.fn((...a: unknown[]) => a),
  desc: vi.fn((a: unknown) => a),
  relations: vi.fn(() => ({})),
}));

describe('DuesCalculationEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calculateMemberDues returns null when no assignment found', async () => {
    mocks.mockLimit.mockResolvedValue([]);

    const { DuesCalculationEngine } = await import('../dues-calculation-engine');
    const result = await DuesCalculationEngine.calculateMemberDues({
      organizationId: 'org1',
      memberId: 'mem1',
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-01-31'),
    });

    expect(result).toBeNull();
  });

  it('calculates flat_rate dues', async () => {
    mocks.mockLimit.mockResolvedValue([{
      assignment: { overrideAmount: null },
      rule: {
        id: 'rule1',
        ruleName: 'Standard Flat',
        calculationType: 'flat_rate',
        flatAmount: '45.00',
        billingFrequency: 'monthly',
      },
    }]);

    const { DuesCalculationEngine } = await import('../dues-calculation-engine');
    const result = await DuesCalculationEngine.calculateMemberDues({
      organizationId: 'org1',
      memberId: 'mem1',
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-01-31'),
    });

    expect(result).not.toBeNull();
    expect(result!.amount).toBe(45);
    expect(result!.calculationType).toBe('flat_rate');
  });

  it('uses override amount when present', async () => {
    mocks.mockLimit.mockResolvedValue([{
      assignment: { overrideAmount: '99.99' },
      rule: {
        id: 'rule1',
        ruleName: 'Override Rule',
        calculationType: 'flat_rate',
        flatAmount: '50.00',
        billingFrequency: 'monthly',
      },
    }]);

    const { DuesCalculationEngine } = await import('../dues-calculation-engine');
    const result = await DuesCalculationEngine.calculateMemberDues({
      organizationId: 'org1',
      memberId: 'mem1',
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-01-31'),
    });

    expect(result!.amount).toBe(99.99);
    expect(result!.calculationType).toBe('override');
  });

  it('calculates percentage dues', async () => {
    mocks.mockLimit.mockResolvedValue([{
      assignment: { overrideAmount: null },
      rule: {
        id: 'rule2',
        ruleName: 'Percentage',
        calculationType: 'percentage',
        percentageRate: '2.5',
        baseField: 'grossWages',
        billingFrequency: 'monthly',
      },
    }]);

    const { DuesCalculationEngine } = await import('../dues-calculation-engine');
    const result = await DuesCalculationEngine.calculateMemberDues({
      organizationId: 'org1',
      memberId: 'mem1',
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-01-31'),
      memberData: { grossWages: 4000 },
    });

    expect(result!.amount).toBe(100); // 4000 * 2.5%
  });

  it('calculates hourly dues', async () => {
    mocks.mockLimit.mockResolvedValue([{
      assignment: { overrideAmount: null },
      rule: {
        id: 'rule3',
        ruleName: 'Hourly',
        calculationType: 'hourly',
        hourlyRate: '0.50',
        hoursPerPeriod: '160',
        billingFrequency: 'monthly',
      },
    }]);

    const { DuesCalculationEngine } = await import('../dues-calculation-engine');
    const result = await DuesCalculationEngine.calculateMemberDues({
      organizationId: 'org1',
      memberId: 'mem1',
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-01-31'),
      memberData: { hoursWorked: 160 },
    });

    expect(result!.amount).toBe(80); // 160 * 0.50
  });

  it('returns null for unknown calculation type', async () => {
    mocks.mockLimit.mockResolvedValue([{
      assignment: { overrideAmount: null },
      rule: {
        id: 'rule4',
        ruleName: 'Unknown',
        calculationType: 'unknown_type',
        billingFrequency: 'monthly',
      },
    }]);

    const { DuesCalculationEngine } = await import('../dues-calculation-engine');
    const result = await DuesCalculationEngine.calculateMemberDues({
      organizationId: 'org1',
      memberId: 'mem1',
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-01-31'),
    });

    expect(result).toBeNull();
  });
});
