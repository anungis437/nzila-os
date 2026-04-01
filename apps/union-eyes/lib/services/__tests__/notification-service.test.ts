import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockValues: vi.fn(),
  mockReturning: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockLimit: vi.fn(),
  mockOrderBy: vi.fn(),
  mockSet: vi.fn(),
  mockResendSend: vi.fn(),
  mockUuid: vi.fn(),
  mockCreateAuditLog: vi.fn(),
  mockFetch: vi.fn(),
  mockCatch: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    insert: mocks.mockInsert,
    select: mocks.mockSelect,
    update: mocks.mockUpdate,
    delete: mocks.mockDelete,
  },
}));

vi.mock('uuid', () => ({
  v4: mocks.mockUuid,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = { send: mocks.mockResendSend };
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../audit-service', () => ({
  createAuditLog: mocks.mockCreateAuditLog,
}));

vi.mock('@/db/schema/domains/communications', () => ({
  notificationQueue: {
    id: 'id', status: 'status', organizationId: 'organization_id',
    nextRetryAt: 'next_retry_at', attemptCount: 'attempt_count',
    templateKey: 'template_key',
  },
  notificationDeliveryLog: { id: 'id' },
  notificationTemplates: { id: 'id', templateKey: 'template_key' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b })),
  and: vi.fn((...conditions: unknown[]) => conditions),
  or: vi.fn((...conditions: unknown[]) => conditions),
  lt: vi.fn((a, b) => ({ field: a, value: b })),
  desc: vi.fn((col) => ({ column: col, direction: 'desc' })),
  asc: vi.fn((col) => ({ column: col, direction: 'asc' })),
  sql: vi.fn(),
  gt: vi.fn((a, b) => ({ field: a, value: b })),
  gte: vi.fn((a, b) => ({ field: a, value: b })),
  lte: vi.fn((a, b) => ({ field: a, value: b })),
  inArray: vi.fn((a, b) => ({ field: a, values: b })),
  isNull: vi.fn((a) => ({ field: a, op: 'isNull' })),
  between: vi.fn((a, b, c) => ({ field: a, from: b, to: c })),
  like: vi.fn((a, b) => ({ field: a, pattern: b })),
  ilike: vi.fn((a, b) => ({ field: a, pattern: b })),
  not: vi.fn((a) => ({ op: 'not', value: a })),
  ne: vi.fn((a, b) => ({ field: a, value: b })),
  count: vi.fn(),
  sum: vi.fn(),
  avg: vi.fn(),
  min: vi.fn(),
  max: vi.fn(),
  relations: vi.fn(() => ({})),
}));

vi.mock('firebase-admin', () => null);

import {
  ResendEmailProvider,
  SendGridEmailProvider,
  TwilioSMSProvider,
  FirebasePushProvider,
  NotificationService,
  NotificationTemplates,
  getNotificationService,
  processPendingNotifications,
  retryFailedNotificationsJob,
} from '../notification-service';

// ── Helper to set up DB insert chain ─────────────────────────────────────────
function setupInsertChain() {
  const catchFn = vi.fn().mockResolvedValue(undefined);
  mocks.mockReturning.mockResolvedValue([{ id: 'rec-1' }]);
  mocks.mockValues.mockReturnValue({
    returning: mocks.mockReturning,
    catch: catchFn,
  });
  mocks.mockInsert.mockReturnValue({
    values: mocks.mockValues,
  });
  return catchFn;
}

// ── Helper to set up DB select chain ─────────────────────────────────────────
function _setupSelectChain(rows: unknown[]) {
  mocks.mockLimit.mockResolvedValue(rows);
  mocks.mockWhere.mockReturnValue({
    orderBy: vi.fn().mockReturnValue({ limit: mocks.mockLimit }),
    limit: mocks.mockLimit,
  });
  mocks.mockWhere.mockResolvedValue(rows);
  mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere, limit: mocks.mockLimit });
  mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });
}

// ── Helper payload ───────────────────────────────────────────────────────────
const emailPayload = {
  organizationId: 'org-1',
  recipientEmail: 'user@test.com',
  type: 'email' as const,
  body: 'Hello',
  subject: 'Test',
};

// ══════════════════════════════════════════════════════════════════════════════
// RESEND EMAIL PROVIDER
// ══════════════════════════════════════════════════════════════════════════════

describe('ResendEmailProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockUuid.mockReturnValue('test-uuid-1');
  });

  it('throws if no API key', () => {
    expect(() => new ResendEmailProvider('')).toThrow('Resend API key not configured');
  });

  it('sends email successfully', async () => {
    mocks.mockResendSend.mockResolvedValue({ data: { id: 'msg-1' }, error: null });
    const provider = new ResendEmailProvider('test-key');
    const result = await provider.send({ ...emailPayload });
    expect(result.status).toBe('sent');
    expect(result.id).toBe('msg-1');
    expect(result.sentAt).toBeInstanceOf(Date);
  });

  it('returns failed status on send error', async () => {
    mocks.mockResendSend.mockRejectedValue(new Error('API error'));
    const provider = new ResendEmailProvider('test-key');
    const result = await provider.send({ ...emailPayload });
    expect(result.status).toBe('failed');
    expect(result.failureReason).toBe('API error');
  });

  it('returns failed when Resend returns error object', async () => {
    mocks.mockResendSend.mockResolvedValue({ data: null, error: { message: 'Invalid domain' } });
    const provider = new ResendEmailProvider('test-key');
    const result = await provider.send({ ...emailPayload });
    expect(result.status).toBe('failed');
    expect(result.failureReason).toContain('Invalid domain');
  });

  it('generates uuid when data has no id', async () => {
    mocks.mockResendSend.mockResolvedValue({ data: {}, error: null });
    const provider = new ResendEmailProvider('test-key');
    const result = await provider.send({ ...emailPayload });
    expect(result.status).toBe('sent');
    // Falls back to rs-{uuid}
    expect(result.id).toContain('test-uuid-1');
  });

  it('requires recipient email', async () => {
    const provider = new ResendEmailProvider('test-key');
    const result = await provider.send({
      organizationId: 'org-1',
      type: 'email',
      body: 'Hello',
    });
    expect(result.status).toBe('failed');
    expect(result.failureReason).toContain('email');
  });

  it('uses htmlBody when provided', async () => {
    mocks.mockResendSend.mockResolvedValue({ data: { id: 'msg-2' }, error: null });
    const provider = new ResendEmailProvider('test-key');
    await provider.send({
      ...emailPayload,
      htmlBody: '<h1>Hello</h1>',
    });
    expect(mocks.mockResendSend).toHaveBeenCalledWith(
      expect.objectContaining({ html: '<h1>Hello</h1>' }),
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SENDGRID EMAIL PROVIDER
// ══════════════════════════════════════════════════════════════════════════════

describe('SendGridEmailProvider', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockUuid.mockReturnValue('sg-test-uuid');
    globalThis.fetch = mocks.mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('throws if no API key', () => {
    expect(() => new SendGridEmailProvider('')).toThrow('SendGrid API key not configured');
  });

  it('sends email via SendGrid API', async () => {
    mocks.mockFetch.mockResolvedValue({ ok: true, status: 202 });
    const provider = new SendGridEmailProvider('sg-test-key');
    const result = await provider.send({ ...emailPayload, priority: 'high' });
    expect(result.status).toBe('sent');
    expect(result.sentAt).toBeInstanceOf(Date);
    expect(mocks.mockFetch).toHaveBeenCalledWith(
      'https://api.sendgrid.com/v3/mail/send',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns failed on SendGrid API error', async () => {
    mocks.mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: vi.fn().mockResolvedValue('Unauthorized'),
    });
    const provider = new SendGridEmailProvider('sg-bad-key');
    const result = await provider.send({ ...emailPayload });
    expect(result.status).toBe('failed');
    expect(result.failureReason).toContain('SendGrid API error');
  });

  it('returns failed when no recipient email', async () => {
    const provider = new SendGridEmailProvider('sg-test-key');
    const result = await provider.send({
      organizationId: 'org-1',
      type: 'email',
      body: 'Hello',
    });
    expect(result.status).toBe('failed');
    expect(result.failureReason).toContain('email');
  });

  it('includes reply_to and tracking when configured', async () => {
    process.env.SENDGRID_REPLY_TO_EMAIL = 'reply@test.com';
    mocks.mockFetch.mockResolvedValue({ ok: true, status: 202 });
    const provider = new SendGridEmailProvider('sg-key');
    await provider.send({
      ...emailPayload,
      actionUrl: 'https://example.com/action',
      metadata: { key: 'value' },
    });
    const body = JSON.parse(mocks.mockFetch.mock.calls[0][1].body);
    expect(body.reply_to).toBeDefined();
    expect(body.tracking_settings).toBeDefined();
    delete process.env.SENDGRID_REPLY_TO_EMAIL;
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TWILIO SMS PROVIDER
// ══════════════════════════════════════════════════════════════════════════════

describe('TwilioSMSProvider', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockUuid.mockReturnValue('sms-uuid');
    globalThis.fetch = mocks.mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('throws if credentials missing', () => {
    expect(() => new TwilioSMSProvider('', '', '')).toThrow('Twilio credentials not configured');
  });

  it('sends SMS via Twilio API', async () => {
    mocks.mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ sid: 'SM123', status: 'sent' }),
    });
    const provider = new TwilioSMSProvider('AC123', 'token', '+15551234567');
    const result = await provider.send({
      organizationId: 'org-1',
      recipientPhone: '+15559876543',
      type: 'sms',
      body: 'Test SMS message',
    });
    expect(result.status).toBe('sent');
    expect(result.id).toBe('SM123');
    expect(mocks.mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('api.twilio.com'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns failed when no phone number', async () => {
    const provider = new TwilioSMSProvider('AC123', 'token', '+15551234567');
    const result = await provider.send({
      organizationId: 'org-1',
      type: 'sms',
      body: 'Test',
    });
    expect(result.status).toBe('failed');
    expect(result.failureReason).toContain('phone');
  });

  it('returns failed on Twilio API error', async () => {
    mocks.mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: vi.fn().mockResolvedValue('Invalid From number'),
    });
    const provider = new TwilioSMSProvider('AC123', 'token', '+15551234567');
    const result = await provider.send({
      organizationId: 'org-1',
      recipientPhone: '+15559876543',
      type: 'sms',
      body: 'Test',
    });
    expect(result.status).toBe('failed');
    expect(result.failureReason).toContain('Twilio API error');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// FIREBASE PUSH PROVIDER
// ══════════════════════════════════════════════════════════════════════════════

describe('FirebasePushProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockUuid.mockReturnValue('push-uuid');
  });

  it('returns failed when no Firebase token', async () => {
    const provider = new FirebasePushProvider();
    const result = await provider.send({
      organizationId: 'org-1',
      type: 'push',
      body: 'Push notification',
    });
    expect(result.status).toBe('failed');
    expect(result.failureReason).toContain('Firebase token');
  });

  it('returns failed when firebase messaging not available', async () => {
    const provider = new FirebasePushProvider();
    const result = await provider.send({
      organizationId: 'org-1',
      recipientFirebaseToken: 'token-abc',
      type: 'push',
      body: 'Push notification',
      title: 'Test',
    });
    // firebase-admin is mocked to null, so messaging init fails
    expect(result.status).toBe('failed');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION SERVICE
// ══════════════════════════════════════════════════════════════════════════════

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockUuid.mockReturnValue('notif-uuid');
    setupInsertChain();
    service = new NotificationService();
  });

  it('instantiates successfully', () => {
    expect(service).toBeDefined();
  });

  describe('send', () => {
    it('throws when no provider for type', async () => {
      // NotificationService constructor doesn't register push (firebase mock null)
      // and doesn't register sms (no env vars), but let's test with a type that has no provider
      await expect(service.send({
        organizationId: 'org-1',
        type: 'in_app',
        body: 'In-app notification',
      })).rejects.toThrow('No provider configured');
    });

    it('creates audit log when userId present', async () => {
      // Register a mock provider manually for testing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).providers.set('email', {
        name: 'mock',
        send: vi.fn().mockResolvedValue({ id: 'msg-1', status: 'sent', sentAt: new Date() }),
      });
      mocks.mockCreateAuditLog.mockResolvedValue(undefined);

      await service.send({
        ...emailPayload,
        userId: 'user-1',
      });

      expect(mocks.mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'NOTIFICATION_SENT',
          userId: 'user-1',
        }),
      );
    });
  });

  describe('queue', () => {
    it('returns notification ID', async () => {
      const id = await service.queue({
        organizationId: 'org-1',
        type: 'email',
        body: 'Queued notification',
      });
      expect(id).toBe('notif-uuid');
      expect(mocks.mockInsert).toHaveBeenCalled();
    });
  });

  describe('sendBulk', () => {
    it('sends multiple notifications', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).providers.set('email', {
        name: 'mock',
        send: vi.fn().mockResolvedValue({ id: 'msg-1', status: 'sent', sentAt: new Date() }),
      });

      const results = await service.sendBulk([
        { organizationId: 'org-1', type: 'email', body: 'first', recipientEmail: 'a@test.com' },
        { organizationId: 'org-1', type: 'email', body: 'second', recipientEmail: 'b@test.com' },
      ]);

      expect(results).toHaveLength(2);
    });

    it('returns failed status for errored notifications', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).providers.set('email', {
        name: 'mock',
        send: vi.fn().mockRejectedValue(new Error('bulk fail')),
      });

      const results = await service.sendBulk([
        { organizationId: 'org-1', type: 'email', body: 'will fail', recipientEmail: 'a@test.com' },
      ]);

      expect(results[0].status).toBe('failed');
      expect(results[0].failureReason).toBe('bulk fail');
    });
  });

  describe('sendFromTemplate', () => {
    it('sends notification from database template', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).providers.set('email', {
        name: 'mock',
        send: vi.fn().mockResolvedValue({ id: 'tmpl-msg', status: 'sent', sentAt: new Date() }),
      });

      // Mock template query
      mocks.mockLimit.mockResolvedValue([{
        id: 'tmpl-1',
        templateKey: 'welcome',
        subject: 'Welcome {{name}}',
        bodyTemplate: 'Hello {{name}}, welcome!',
        htmlBodyTemplate: '<p>Hello {{name}}</p>',
        channels: ['email'],
      }]);
      mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit });
      mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
      mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

      const result = await service.sendFromTemplate(
        'org-1',
        'welcome',
        'user@test.com',
        undefined,
        { name: 'Alice' },
        'user-1',
      );

      expect(result.status).toBe('sent');
    });

    it('returns failed when template not found', async () => {
      mocks.mockLimit.mockResolvedValue([]);
      mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit });
      mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
      mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

      const result = await service.sendFromTemplate('org-1', 'missing-tmpl');
      expect(result.status).toBe('failed');
      expect(result.failureReason).toContain('Template not found');
    });

    it('determines SMS type from template channels', async () => {
       
      const mockSend = vi.fn().mockResolvedValue({ id: 'sms-msg', status: 'sent', sentAt: new Date() });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).providers.set('sms', { name: 'twilio', send: mockSend });

      mocks.mockLimit.mockResolvedValue([{
        id: 'tmpl-sms',
        templateKey: 'sms-alert',
        subject: null,
        bodyTemplate: 'SMS: {{msg}}',
        htmlBodyTemplate: null,
        channels: ['sms'],
      }]);
      mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit });
      mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
      mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

      const result = await service.sendFromTemplate(
        'org-1', 'sms-alert', undefined, '+15551234567', { msg: 'Hello' },
      );
      expect(result.status).toBe('sent');
    });
  });

  describe('retryFailed', () => {
    it('retries failed notifications from queue', async () => {
      // Mock provider
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).providers.set('email', {
        name: 'mock',
        send: vi.fn().mockResolvedValue({ id: 'retry-msg', status: 'sent', sentAt: new Date() }),
      });

      // Mock select for failed notifications
      const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
      mocks.mockSet.mockReturnValue({ where: mockUpdateWhere });
      mocks.mockUpdate.mockReturnValue({ set: mocks.mockSet });

      mocks.mockLimit.mockResolvedValue([
        {
          id: 'q-1',
          payload: { organizationId: 'org-1', type: 'email', body: 'retry me', recipientEmail: 'a@test.com' },
          attemptCount: '1',
          status: 'failed',
        },
      ]);
      mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit });
      mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
      mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

      const result = await service.retryFailed('org-1');
      expect(result.retried).toBe(1);
      expect(result.succeeded).toBe(1);
    });

    it('returns zeros on error', async () => {
      mocks.mockSelect.mockImplementation(() => { throw new Error('DB down'); });
      const result = await service.retryFailed();
      expect(result).toEqual({ retried: 0, succeeded: 0, failed: 0 });
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION TEMPLATES
// ══════════════════════════════════════════════════════════════════════════════

describe('NotificationTemplates', () => {
  it('exports expected template keys', () => {
    expect(NotificationTemplates.PAYMENT_RECEIVED).toBeDefined();
    expect(NotificationTemplates.PAYMENT_FAILED).toBeDefined();
    expect(NotificationTemplates.DUES_REMINDER).toBeDefined();
    expect(NotificationTemplates.DUES_OVERDUE).toBeDefined();
    expect(NotificationTemplates.VOTING_OPEN).toBeDefined();
    expect(NotificationTemplates.VOTING_REMINDER).toBeDefined();
  });

  it('each template has subject, title, body', () => {
    for (const tmpl of Object.values(NotificationTemplates)) {
      expect(tmpl).toHaveProperty('subject');
      expect(tmpl).toHaveProperty('title');
      expect(tmpl).toHaveProperty('body');
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SINGLETON & STANDALONE FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

describe('getNotificationService', () => {
  it('returns a notification service instance', () => {
    const svc = getNotificationService();
    expect(svc).toBeDefined();
    expect(svc).toBeInstanceOf(NotificationService);
  });

  it('returns singleton', () => {
    const a = getNotificationService();
    const b = getNotificationService();
    expect(a).toBe(b);
  });
});

describe('processPendingNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupInsertChain();
  });

  it('processes pending notifications from queue', async () => {
    mocks.mockLimit.mockResolvedValue([]);
    mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit });
    mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
    mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

    const result = await processPendingNotifications(10);
    expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0 });
  });

  it('returns zeros on error', async () => {
    mocks.mockSelect.mockImplementation(() => { throw new Error('DB err'); });
    const result = await processPendingNotifications();
    expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0 });
  });
});

describe('retryFailedNotificationsJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupInsertChain();
  });

  it('delegates to NotificationService.retryFailed', async () => {
    mocks.mockLimit.mockResolvedValue([]);
    mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit });
    mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
    mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

    const result = await retryFailedNotificationsJob();
    expect(result).toHaveProperty('retried');
    expect(result).toHaveProperty('succeeded');
    expect(result).toHaveProperty('failed');
  });
});
