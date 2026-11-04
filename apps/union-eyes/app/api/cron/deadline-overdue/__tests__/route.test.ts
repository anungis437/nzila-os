import { beforeEach, describe, expect, it, vi } from 'vitest';

/** The overdue sweep records each organization's own zone on the overdue reminder it schedules (never a hard-coded UTC). */
const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  schedule: vi.fn(),
  audit: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: (_config: unknown, handler: () => Promise<unknown>) => handler }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: async (fn: (tx: { execute: typeof mocks.execute }) => Promise<unknown>) => fn({ execute: mocks.execute }),
}));
vi.mock('@nzila/os-core/telemetry', () => ({ createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }) }));
vi.mock('@/lib/deadline-engine', async () => {
  const day = await vi.importActual<typeof import('@/lib/deadline-engine/deadline-day')>('@/lib/deadline-engine/deadline-day');
  return {
    organizationTimeZone: day.organizationTimeZone,
    scheduleGrievanceDeadlineReminders: mocks.schedule,
    writeDeadlineAuditEvent: mocks.audit,
  };
});

const { POST } = await import('@/app/api/cron/deadline-overdue/route');

const row = (overrides: Record<string, unknown>) => ({
  id: 'd-1',
  grievance_id: 'g-1',
  organization_id: 'org-1',
  due_date: '2026-03-05T04:59:00.000Z',
  org_settings: {},
  org_province_territory: null,
  org_address: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.schedule.mockResolvedValue({ scheduled: [] });
});

describe('POST /api/cron/deadline-overdue', () => {
  it('reads the organization zone facts with each overdue deadline and passes the zone to the scheduler', async () => {
    mocks.execute.mockResolvedValueOnce([
      row({ id: 'd-1', org_settings: { timezone: 'America/Winnipeg' }, org_province_territory: 'ON' }),
      row({ id: 'd-2', org_province_territory: 'NL' }),
      row({ id: 'd-3', org_settings: null }),
    ]);

    await POST();

    const query = mocks.execute.mock.calls[0][0];
    const text = JSON.stringify(query);
    expect(text).toContain('left join organizations o on o.id = g.organization_id');
    expect(text).toContain('gd.due_date < now()');
    expect(mocks.schedule.mock.calls.map(([input]) => [input.sourceDeadlineId, input.timezone, input.reminderKind])).toEqual([
      ['d-1', 'America/Winnipeg', 'overdue'],
      ['d-2', 'America/St_Johns', 'overdue'],
      ['d-3', 'America/Toronto', 'overdue'],
    ]);
  });
});
