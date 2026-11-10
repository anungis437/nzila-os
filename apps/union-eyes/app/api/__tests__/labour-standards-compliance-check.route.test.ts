import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
}));

vi.mock('@/lib/api/with-api', () => ({ withApi: m.withApi }));
vi.mock('@/lib/api/errors', () => ({ ApiError: { badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }) } }));
vi.mock('@/lib/canadian-labour-standards/rule-resolver', () => ({
  resolveStatutoryRules: vi.fn(async () => ({
    status: 'governed',
    rules: [
      { category: 'break_rule', version: 1, payload: { type: 'meal', consecutiveHoursTrigger: 5, durationMinutes: 30 }, source: { uri: 'https://example.test/breaks' } },
      { category: 'overtime', version: 1, payload: { weeklyThresholdHours: 44, multiplier: 1.5 }, source: { uri: 'https://example.test/overtime' } },
      { category: 'termination_notice', version: 1, payload: { tiers: [{ minYears: 3, weeks: 3 }] }, source: { uri: 'https://example.test/termination' } },
      { category: 'statutory_holidays', version: 1, payload: { requiredCount: 9 }, source: { uri: 'https://example.test/holidays' } },
      { category: 'anti_scab', version: 1, payload: { prohibited: true }, source: { uri: 'https://example.test/anti-scab' } },
      { category: 'pay_equity', version: 1, payload: { proactive: true }, source: { uri: 'https://example.test/pay-equity' } },
    ],
  })),
}));
vi.mock('@/lib/canadian-labour-standards', () => ({
  BREAK_RULES: { ON: [{ type: 'meal', consecutiveHoursTrigger: 5, durationMinutes: 30, statute: 'ESA', article: 'A1' }] },
  OVERTIME_RULES: { ON: { multiplier: 1.5, statute: 'ESA', article: 'OT' } },
  TERMINATION_NOTICE: { ON: { statute: 'ESA', article: 'TN' } },
  STATUTORY_HOLIDAYS: { ON: ['h1', 'h2'] },
  hasAntiScabLaw: vi.fn(() => true),
  hasProactivePayEquity: vi.fn(() => true),
  calculateOvertime: vi.fn(() => ({ overtimeHours: 3 })),
  calculateTerminationNotice: vi.fn(() => ({ weeks: 2 })),
}));

async function loadRoute() {
  return import('../labour-standards/[jurisdiction]/compliance-check/route');
}

describe('labour-standards compliance-check route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: any) =>
      async (_request: Request, ctx: any = { params: { jurisdiction: 'ON' }, body: {} }) => {
        try {
          const data = await handler(ctx);
          return new Response(JSON.stringify(data), { status: 200 });
        } catch (err) {
          return new Response(JSON.stringify({ error: (err as Error).message }), { status: (err as any).status ?? 500 });
        }
      });
  });

  it('returns 400 for invalid jurisdiction', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/labour-standards/xx/compliance-check', { method: 'POST' }), {
      params: { jurisdiction: 'xx' },
      body: {},
    });

    expect(response.status).toBe(400);
  });

  it('returns violations and warnings for non-compliant inputs', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/labour-standards/ON/compliance-check', { method: 'POST' }), {
      params: { jurisdiction: 'ON' },
      body: {
        dailyHours: 8,
        mealBreakProvided: false,
        tenureYears: 3,
        terminationNoticeWeeks: 1,
        statutoryHolidaysObserved: 1,
        usingReplacementWorkers: true,
        payEquityCompleted: false,
        weeklyHours: 45,
        eventDate: new Date('2026-01-15T00:00:00.000Z'),
      },
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.violations).toBeGreaterThanOrEqual(1);
    expect(json.warnings).toBeGreaterThanOrEqual(1);
    expect(json.totalFindings).toBeGreaterThanOrEqual(3);
  });
});
