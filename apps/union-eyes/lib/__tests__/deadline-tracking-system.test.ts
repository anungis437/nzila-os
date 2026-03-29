import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockSet: vi.fn(),
  mockValues: vi.fn(),
  mockReturning: vi.fn(),
  mockLimit: vi.fn(),
  mockOrderBy: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    select: mocks.mockSelect.mockReturnValue({
      from: mocks.mockFrom.mockReturnValue({
        where: mocks.mockWhere.mockReturnValue({
          orderBy: mocks.mockOrderBy.mockReturnValue({
            limit: mocks.mockLimit.mockResolvedValue([]),
          }),
          limit: mocks.mockLimit.mockResolvedValue([]),
        }),
      }),
    }),
    insert: mocks.mockInsert.mockReturnValue({
      values: mocks.mockValues.mockReturnValue({
        returning: mocks.mockReturning.mockResolvedValue([{ id: 'dl-1' }]),
      }),
    }),
    update: mocks.mockUpdate.mockReturnValue({
      set: mocks.mockSet.mockReturnValue({
        where: mocks.mockWhere.mockResolvedValue([]),
      }),
    }),
  },
}));

vi.mock('@/db/schema', () => ({
  grievanceDeadlines: {},
  claims: { id: 'id' },
  notifications: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...a: unknown[]) => a),
  and: vi.fn((...a: unknown[]) => a),
  asc: vi.fn((a: unknown) => a),
  lte: vi.fn((...a: unknown[]) => a),
  relations: vi.fn(() => ({})),
}));

vi.mock('date-fns', () => ({
  addDays: vi.fn((d: Date, n: number) => new Date(d.getTime() + n * 86400000)),
  addBusinessDays: vi.fn((d: Date, n: number) => new Date(d.getTime() + n * 86400000)),
  differenceInDays: vi.fn((_a: Date, _b: Date) => 5),
}));

describe('deadline-tracking-system', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports DEFAULT_DEADLINE_RULES with correct count', async () => {
    const { DEFAULT_DEADLINE_RULES } = await import('../deadline-tracking-system');
    expect(DEFAULT_DEADLINE_RULES.length).toBeGreaterThanOrEqual(7);
  });

  it('DEFAULT_DEADLINE_RULES includes filing_deadline', async () => {
    const { DEFAULT_DEADLINE_RULES } = await import('../deadline-tracking-system');
    const filingRule = DEFAULT_DEADLINE_RULES.find((r) => r.type === 'filing_deadline');
    expect(filingRule).toBeDefined();
    expect(filingRule!.businessDays).toBe(30);
    expect(filingRule!.priority).toBe('critical');
  });

  it('DEFAULT_DEADLINE_RULES has step_1_response with 10 business days', async () => {
    const { DEFAULT_DEADLINE_RULES } = await import('../deadline-tracking-system');
    const step1 = DEFAULT_DEADLINE_RULES.find((r) => r.type === 'step_1_response');
    expect(step1).toBeDefined();
    expect(step1!.businessDays).toBe(10);
  });

  it('DeadlineType type is correctly exported', async () => {
    const mod = await import('../deadline-tracking-system');
    expect(mod.DEFAULT_DEADLINE_RULES[0].type).toBe('filing_deadline');
  });

  it('each rule has reminderSchedule', async () => {
    const { DEFAULT_DEADLINE_RULES } = await import('../deadline-tracking-system');
    for (const rule of DEFAULT_DEADLINE_RULES) {
      expect(Array.isArray(rule.reminderSchedule)).toBe(true);
      expect(rule.reminderSchedule.length).toBeGreaterThan(0);
    }
  });
});
