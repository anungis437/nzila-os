import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  executeQueue: [] as unknown[][],
  batchSendSessionReminders: vi.fn(),
  batchSendExpiryWarnings: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const mockDb = {
  execute: vi.fn(async () => (m.executeQueue.shift() ?? []) as unknown[]),
};

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
}));

vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: m.withSystemContext,
}));

vi.mock('@/db', () => ({ db: mockDb }));

vi.mock('@/lib/email/training-notifications', () => ({
  batchSendSessionReminders: m.batchSendSessionReminders,
  batchSendExpiryWarnings: m.batchSendExpiryWarnings,
}));

vi.mock('@/lib/logger', () => ({ logger: m.logger }));

async function loadRoute() {
  return import('../cron/education-reminders/route');
}

describe('cron/education-reminders route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.executeQueue = [];
    m.withApi.mockImplementation(
      (_config: unknown, handler: () => Promise<unknown>) =>
        async (_request: NextRequest) => {
          const result = await handler();
          return result instanceof Response ? result : new Response(JSON.stringify(result), { status: 200 });
        },
    );
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.batchSendSessionReminders.mockResolvedValue({ sent: 0, failed: 0, errors: [] });
    m.batchSendExpiryWarnings.mockResolvedValue({ sent: 0, failed: 0, errors: [] });
  });

  it('POST returns success with empty reminder batches', async () => {
    const { POST } = await loadRoute();
    m.executeQueue.push([], []);

    const response = await POST(new NextRequest('http://localhost/api/cron/education-reminders'));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.results.sessionReminders.sent).toBe(0);
    expect(json.results.expiryWarnings.sent).toBe(0);
  });

  it('POST processes session reminders when query returns rows', async () => {
    const { POST } = await loadRoute();
    m.executeQueue.push(
      [
        {
          email: 'member@example.com',
          user_id: 'u-1',
          organization_id: '11111111-1111-4111-8111-111111111111',
          reminder_source_id: '33333333-3333-4333-8333-333333333333',
          member_name: 'Sam Member',
          course_name: 'Steward Training',
          session_date: '2026-07-01',
          location: 'Hall A',
          duration_hours: '4.00',
          lead_instructor_name: 'Dana Instructor',
          days_until: 7,
        },
      ],
      [],
    );
    m.batchSendSessionReminders.mockResolvedValueOnce({ sent: 1, failed: 0, errors: [] });

    const response = await POST(new NextRequest('http://localhost/api/cron/education-reminders'));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.results.sessionReminders.sent).toBe(1);
    expect(m.batchSendSessionReminders).toHaveBeenCalledWith([expect.objectContaining({
      organizationId: '11111111-1111-4111-8111-111111111111', userId: 'u-1',
      sourceId: '33333333-3333-4333-8333-333333333333', daysUntilSession: 7,
    })]);
  });

  it('POST answers 500 naming the failed batch when sends fail, keeping the counts', async () => {
    const { POST } = await loadRoute();
    m.executeQueue.push(
      [{ email: 'member@example.com', member_name: 'Sam Member', course_name: 'Steward Training', session_date: '2026-07-01', days_until: 3 }],
      [],
    );
    m.batchSendSessionReminders.mockResolvedValueOnce({ sent: 0, failed: 1, errors: ['smtp refused'] });

    const response = await POST(new NextRequest('http://localhost/api/cron/education-reminders'));
    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json).toMatchObject({ success: false, failed: 1, failures: [{ scope: 'session-reminders' }] });
    expect(json.results.sessionReminders.failed).toBe(1);
  });

  it('POST processes expiry warnings when query returns rows', async () => {
    const { POST } = await loadRoute();
    m.executeQueue.push(
      [],
      [
        {
          email: 'member@example.com',
          member_name: 'Sam Member',
          organization_id: '11111111-1111-4111-8111-111111111111',
          user_id: 'u-1',
          reminder_source_id: '44444444-4444-4444-8444-444444444444',
          certification_name: 'WSIB',
          certification_number: 'CERT-1',
          expiry_date: '2026-09-01',
          days_until_expiry: 30,
        },
      ],
    );
    m.batchSendExpiryWarnings.mockResolvedValueOnce({ sent: 1, failed: 0, errors: [] });

    const response = await POST(new NextRequest('http://localhost/api/cron/education-reminders'));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.results.expiryWarnings.sent).toBe(1);
    expect(m.batchSendExpiryWarnings).toHaveBeenCalledWith([expect.objectContaining({
      organizationId: '11111111-1111-4111-8111-111111111111', userId: 'u-1',
      sourceId: '44444444-4444-4444-8444-444444444444', daysUntilExpiry: 30,
    })]);
  });

  it('reports a capped batch as incomplete instead of a false scheduler success', async () => {
    const { POST } = await loadRoute();
    const row = {
      email: 'member@example.test', user_id: 'u-1',
      organization_id: '11111111-1111-4111-8111-111111111111',
      reminder_source_id: '33333333-3333-4333-8333-333333333333',
      member_name: 'Member', course_name: 'Training', session_date: '2026-11-07',
      days_until: 7, total_due: 421,
    };
    m.executeQueue.push(Array.from({ length: 301 }, () => row), []);
    m.batchSendSessionReminders.mockResolvedValueOnce({ sent: 300, failed: 0, errors: [] });

    const response = await POST(new NextRequest('http://localhost/api/cron/education-reminders'));
    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.results.truncated.sessionReminders).toBe(121);
    expect(json).toMatchObject({ failed: 1, failures: [{ scope: 'session-reminders' }] });
    expect(m.batchSendSessionReminders.mock.calls[0][0]).toHaveLength(300);
  });

  it('POST calls withSystemContext for both queries', async () => {
    const { POST } = await loadRoute();
    m.executeQueue.push([], []);

    const response = await POST(new NextRequest('http://localhost/api/cron/education-reminders'));
    expect(response.status).toBe(200);
    expect(m.withSystemContext).toHaveBeenCalledTimes(2);
  });

  it('POST includes timestamp and message in response', async () => {
    const { POST } = await loadRoute();
    m.executeQueue.push([], []);

    const response = await POST(new NextRequest('http://localhost/api/cron/education-reminders'));
    const json = await response.json();
    expect(typeof json.results.timestamp).toBe('string');
    expect(json.message).toContain('Education reminders processed successfully');
  });
});
