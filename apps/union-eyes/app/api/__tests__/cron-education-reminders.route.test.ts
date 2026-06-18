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
          return new Response(JSON.stringify(result), { status: 200 });
        },
    );
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.batchSendSessionReminders.mockResolvedValue({ sent: 0, failed: 0, errors: [] });
    m.batchSendExpiryWarnings.mockResolvedValue({ sent: 0, failed: 0, errors: [] });
  });

  it('GET returns success with empty reminder batches', async () => {
    const { GET } = await loadRoute();
    m.executeQueue.push([], []);

    const response = await GET(new NextRequest('http://localhost/api/cron/education-reminders'));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.results.sessionReminders.sent).toBe(0);
    expect(json.results.expiryWarnings.sent).toBe(0);
  });

  it('GET processes session reminders when query returns rows', async () => {
    const { GET } = await loadRoute();
    m.executeQueue.push(
      [
        {
          email: 'member@example.com',
          first_name: 'Sam',
          last_name: 'Member',
          course_name: 'Steward Training',
          session_date: '2026-07-01',
          session_time: '09:00',
          location: 'Hall A',
          duration_hours: 4,
          instructor_first_name: 'Dana',
          instructor_last_name: 'Instructor',
          days_until: 7,
        },
      ],
      [],
    );
    m.batchSendSessionReminders.mockResolvedValueOnce({ sent: 1, failed: 0, errors: [] });

    const response = await GET(new NextRequest('http://localhost/api/cron/education-reminders'));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.results.sessionReminders.sent).toBe(1);
    expect(m.batchSendSessionReminders).toHaveBeenCalledTimes(1);
  });

  it('GET processes expiry warnings when query returns rows', async () => {
    const { GET } = await loadRoute();
    m.executeQueue.push(
      [],
      [
        {
          email: 'member@example.com',
          first_name: 'Sam',
          last_name: 'Member',
          certification_name: 'WSIB',
          certificate_number: 'CERT-1',
          expiry_date: '2026-09-01',
          days_until_expiry: 30,
        },
      ],
    );
    m.batchSendExpiryWarnings.mockResolvedValueOnce({ sent: 1, failed: 0, errors: [] });

    const response = await GET(new NextRequest('http://localhost/api/cron/education-reminders'));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.results.expiryWarnings.sent).toBe(1);
    expect(m.batchSendExpiryWarnings).toHaveBeenCalledTimes(1);
  });

  it('GET calls withSystemContext for both queries', async () => {
    const { GET } = await loadRoute();
    m.executeQueue.push([], []);

    const response = await GET(new NextRequest('http://localhost/api/cron/education-reminders'));
    expect(response.status).toBe(200);
    expect(m.withSystemContext).toHaveBeenCalledTimes(2);
  });

  it('GET includes timestamp and message in response', async () => {
    const { GET } = await loadRoute();
    m.executeQueue.push([], []);

    const response = await GET(new NextRequest('http://localhost/api/cron/education-reminders'));
    const json = await response.json();
    expect(typeof json.results.timestamp).toBe('string');
    expect(json.message).toContain('Education reminders processed successfully');
  });
});
