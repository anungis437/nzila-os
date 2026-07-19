import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApiAuth: vi.fn(),
  getCurrentUser: vi.fn(),
  hasMinRole: vi.fn(),
  manualTriggerReminders: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/api-auth-guard', () => ({ withApiAuth: m.withApiAuth, getCurrentUser: m.getCurrentUser, hasMinRole: m.hasMinRole }));
vi.mock('@/lib/jobs/dues-reminder-scheduler', () => ({ manualTriggerReminders: m.manualTriggerReminders }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { AUTH_REQUIRED: 'AUTH_REQUIRED', FORBIDDEN: 'FORBIDDEN', INTERNAL_ERROR: 'INTERNAL_ERROR' },
  standardErrorResponse: vi.fn((code: string, message: string) => new Response(JSON.stringify({ message }), { status: code === 'AUTH_REQUIRED' ? 401 : code === 'FORBIDDEN' ? 403 : 500 })),
  standardSuccessResponse: vi.fn((data: any) => new Response(JSON.stringify(data), { status: 200 })),
}));

async function loadRoute() {
  return import('../admin/dues/send-reminders/route');
}

describe('admin/dues/send-reminders route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApiAuth.mockImplementation((handler: any) => (request: NextRequest) => handler(request));
    m.getCurrentUser.mockResolvedValue({ id: 'u1' });
    m.hasMinRole.mockResolvedValue(true);
    m.manualTriggerReminders.mockResolvedValue({
      totalProcessed: 4,
      remindersSent: 3,
      remindersFailed: 1,
      breakdown: { sevenDayReminders: 1, oneDayReminders: 1, overdueNotices: 1 },
    });
  });

  it('returns 401 when unauthenticated', async () => {
    const { POST } = await loadRoute();
    m.getCurrentUser.mockResolvedValueOnce(null);

    const response = await POST(new NextRequest('http://localhost/api/admin/dues/send-reminders', { method: 'POST' }));

    expect(response.status).toBe(401);
  });

  it('returns 403 when lacking platform lead role', async () => {
    const { POST } = await loadRoute();
    m.hasMinRole.mockResolvedValueOnce(false);

    const response = await POST(new NextRequest('http://localhost/api/admin/dues/send-reminders', { method: 'POST' }));

    expect(response.status).toBe(403);
  });

  it('returns trigger summary on success', async () => {
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/admin/dues/send-reminders', { method: 'POST' }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ totalProcessed: 4, remindersSent: 3, remindersFailed: 1 });
    expect(payload.message).toContain('Processed 4 transactions');
  });

  it('returns 500 when trigger execution throws', async () => {
    const { POST } = await loadRoute();
    m.manualTriggerReminders.mockRejectedValueOnce(new Error('job failed'));

    const response = await POST(new NextRequest('http://localhost/api/admin/dues/send-reminders', { method: 'POST' }));

    expect(response.status).toBe(500);
  });
});