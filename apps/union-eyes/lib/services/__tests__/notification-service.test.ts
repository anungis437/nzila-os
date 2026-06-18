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
  mockFirebaseSend: vi.fn(),
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

vi.mock('@/lib/email-service', () => ({
  sendResendEmail: mocks.mockResendSend,
  getFromEmail: (label?: string) => label ? `${label} <noreply@unioneyes.app>` : 'noreply@unioneyes.app',
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
  and: vi.fn((...conditions: any[]) => conditions),
  or: vi.fn((...conditions: any[]) => conditions),
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

vi.mock('firebase-admin', () => ({
  apps: [],
  app: vi.fn(() => ({ name: 'default' })),
  initializeApp: vi.fn(() => ({ name: 'default' })),
  credential: {
    cert: vi.fn(() => ({ projectId: 'demo' })),
  },
  messaging: vi.fn(() => ({ send: mocks.mockFirebaseSend })),
}));

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
function _setupSelectChain(rows: any[]) {
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
    mocks.mockResendSend.mockResolvedValue({ success: true, messageId: 'msg-1' });
  });

  it('sends email successfully', async () => {
    const provider = new ResendEmailProvider();
    const result = await provider.send({ ...emailPayload });
    expect(result.status).toBe('sent');
    expect(result.id).toBe('msg-1');
    expect(result.sentAt).toBeInstanceOf(Date);
  });

  it('returns failed status on send error', async () => {
    mocks.mockResendSend.mockRejectedValue(new Error('API error'));
    const provider = new ResendEmailProvider();
    const result = await provider.send({ ...emailPayload });
    expect(result.status).toBe('failed');
    expect(result.failureReason).toBe('API error');
  });

  it('returns failed when Resend returns error object', async () => {
    mocks.mockResendSend.mockResolvedValue({ success: false, error: 'Invalid domain' });
    const provider = new ResendEmailProvider();
    const result = await provider.send({ ...emailPayload });
    expect(result.status).toBe('failed');
    expect(result.failureReason).toContain('Invalid domain');
  });

  it('generates uuid when data has no id', async () => {
    mocks.mockResendSend.mockResolvedValue({ success: true });
    const provider = new ResendEmailProvider();
    const result = await provider.send({ ...emailPayload });
    expect(result.status).toBe('sent');
    // Falls back to rs-{uuid}
    expect(result.id).toContain('test-uuid-1');
  });

  it('requires recipient email', async () => {
    const provider = new ResendEmailProvider();
    const result = await provider.send({
      organizationId: 'org-1',
      type: 'email',
      body: 'Hello',
    });
    expect(result.status).toBe('failed');
    expect(result.failureReason).toContain('email');
  });

  it('uses htmlBody when provided', async () => {
    mocks.mockResendSend.mockResolvedValue({ success: true, messageId: 'msg-2' });
    const provider = new ResendEmailProvider();
    await provider.send({
      ...emailPayload,
      htmlBody: '<h1>Hello</h1>',
    });
    expect(mocks.mockResendSend).toHaveBeenCalledWith(
      expect.objectContaining({ html: '<h1>Hello</h1>' }),
      expect.anything(),
    );
  });

  it('falls back to default subject and generic failure reason', async () => {
    mocks.mockResendSend.mockResolvedValue({ success: false });
    const provider = new ResendEmailProvider();
    const result = await provider.send({
      organizationId: 'org-1',
      recipientEmail: 'user@test.com',
      type: 'email',
      body: 'Body only',
    });

    expect(mocks.mockResendSend).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Notification', html: '<p>Body only</p>' }),
      expect.anything(),
    );
    expect(result.status).toBe('failed');
    expect(result.failureReason).toBe('Resend send error');
  });
  it('returns generic failure when resend throws non-Error', async () => {
    mocks.mockResendSend.mockRejectedValue('resend exploded');
    const provider = new ResendEmailProvider();
    const result = await provider.send({ ...emailPayload });
    expect(result.status).toBe('failed');
    expect(result.failureReason).toBe('Unknown error');
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

  it('throws if constructor relies on empty env API key', () => {
    delete process.env.SENDGRID_API_KEY;
    expect(() => new SendGridEmailProvider()).toThrow('SendGrid API key not configured');
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

  it('falls back to the default subject when missing', async () => {
    mocks.mockFetch.mockResolvedValue({ ok: true, status: 202 });
    const provider = new SendGridEmailProvider('sg-key');
    await provider.send({
      organizationId: 'org-1',
      recipientEmail: 'user@test.com',
      type: 'email',
      body: 'Hello from SendGrid',
    });

    const body = JSON.parse(mocks.mockFetch.mock.calls[0][1].body);
    expect(body.subject).toBe('Notification');
    expect(body.personalizations[0].subject).toBe('Notification');
  });
  it('uses env API key in constructor when key arg is omitted', () => {
    process.env.SENDGRID_API_KEY = 'sg-from-env';
    const provider = new SendGridEmailProvider();
    expect(provider.name).toBe('sendgrid');
    delete process.env.SENDGRID_API_KEY;
  });
  it('returns generic failure when fetch throws non-Error', async () => {
    mocks.mockFetch.mockRejectedValue('sendgrid exploded');
    const provider = new SendGridEmailProvider('sg-key');
    const result = await provider.send({ ...emailPayload });
    expect(result.status).toBe('failed');
    expect(result.failureReason).toBe('Unknown error');
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
  it('falls back to generated id when sid is missing', async () => {
    mocks.mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ status: 'queued' }),
    });
    mocks.mockUuid.mockReturnValue('sms-fallback-id');

    const provider = new TwilioSMSProvider('AC123', 'token', '+15551234567');
    const result = await provider.send({
      organizationId: 'org-1',
      recipientPhone: '+15559876543',
      type: 'sms',
      body: 'Test',
    });
    expect(result.status).toBe('sent');
    expect(result.id).toBe('sms-sms-fallback-id');
  });
  it('returns generic failure when twilio call throws non-Error', async () => {
    mocks.mockFetch.mockRejectedValue('twilio exploded');
    const provider = new TwilioSMSProvider('AC123', 'token', '+15551234567');
    const result = await provider.send({
      organizationId: 'org-1',
      recipientPhone: '+15559876543',
      type: 'sms',
      body: 'Test',
    });
    expect(result.status).toBe('failed');
    expect(result.failureReason).toBe('Unknown error');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// FIREBASE PUSH PROVIDER
// ══════════════════════════════════════════════════════════════════════════════

describe('FirebasePushProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockUuid.mockReturnValue('push-uuid');
    delete process.env.FIREBASE_SERVICE_ACCOUNT;
    delete (globalThis as any).window;
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
    expect(result.status).toBe('failed');
  });
  it('returns generic failure when firebase send throws non-Error', async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
      project_id: 'demo',
      private_key: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n',
      client_email: 'firebase-adminsdk@example.com',
    });
    mocks.mockFirebaseSend.mockRejectedValue('firebase exploded');

    const provider = new FirebasePushProvider();
    const result = await provider.send({
      organizationId: 'org-1',
      recipientFirebaseToken: 'token-abc',
      type: 'push',
      body: 'Push notification',
      title: undefined,
    });

    expect(result.status).toBe('failed');
    expect(result.failureReason).toBe('Unknown error');
  });

  it('returns failed immediately in browser-like environments', async () => {
    (globalThis as any).window = {};

    const provider = new FirebasePushProvider();
    const result = await provider.send({
      organizationId: 'org-1',
      recipientFirebaseToken: 'token-browser',
      type: 'push',
      body: 'Push notification',
      title: 'Test',
    });

    expect(result.status).toBe('failed');
    expect(result.failureReason).toContain('Firebase messaging not initialized');
  });

  it('sends push notification when firebase credentials are configured', async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
      project_id: 'demo',
      private_key: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n',
      client_email: 'firebase-adminsdk@example.com',
    });
    mocks.mockFirebaseSend.mockResolvedValue('fcm-123');

    const provider = new FirebasePushProvider();
    const result = await provider.send({
      organizationId: 'org-1',
      recipientFirebaseToken: 'token-abc',
      type: 'push',
      body: 'Push notification',
      title: 'Test',
      metadata: { accountId: 42, urgent: true },
    });

    expect(result.status).toBe('sent');
    expect(result.id).toBe('fcm-123');
  });

  it('reuses an existing firebase app instance', async () => {
    vi.resetModules();
    const firebaseAdminModule = await import('firebase-admin');
    firebaseAdminModule.apps.push({} as never);
    process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
      project_id: 'demo',
      private_key: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n',
      client_email: 'firebase-adminsdk@example.com',
    });
    mocks.mockFirebaseSend.mockResolvedValue('fcm-456');

    const { FirebasePushProvider: FreshFirebasePushProvider } = await import('../notification-service');
    const provider = new FreshFirebasePushProvider();
    const first = await provider.send({
      organizationId: 'org-1',
      recipientFirebaseToken: 'token-abc',
      type: 'push',
      body: 'Push notification',
      title: 'Test',
    });
    const second = await provider.send({
      organizationId: 'org-1',
      recipientFirebaseToken: 'token-def',
      type: 'push',
      body: 'Push notification',
      title: 'Test',
    });

    expect(first.status).toBe('sent');
    expect(second.status).toBe('sent');
    firebaseAdminModule.apps.length = 0;
  });

  it('returns failed when firebase-admin cannot be imported', async () => {
    vi.resetModules();
    vi.doUnmock('firebase-admin');
    vi.doMock('firebase-admin', () => {
      throw new Error('module missing');
    });

    const { FirebasePushProvider: FreshFirebasePushProvider } = await import('../notification-service');
    const provider = new FreshFirebasePushProvider();
    const result = await provider.send({
      organizationId: 'org-1',
      recipientFirebaseToken: 'token-import-fail',
      type: 'push',
      body: 'Push notification',
      title: 'Test',
    });

    expect(result.status).toBe('failed');

    vi.doMock('firebase-admin', () => ({
      apps: [],
      app: vi.fn(() => ({ name: 'default' })),
      initializeApp: vi.fn(() => ({ name: 'default' })),
      credential: {
        cert: vi.fn(() => ({ projectId: 'demo' })),
      },
      messaging: vi.fn(() => ({ send: mocks.mockFirebaseSend })),
    }));
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
    delete process.env.EMAIL_PROVIDER;
    delete process.env.RESEND_API_KEY;
    delete process.env.SENDGRID_API_KEY;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;
    delete process.env.FIREBASE_SERVICE_ACCOUNT;
    service = new NotificationService();
  });

  it('instantiates successfully', () => {
    expect(service).toBeDefined();
  });

  it('registers resend provider when configured', () => {
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.RESEND_API_KEY = 'resend-key';
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'token';
    process.env.TWILIO_PHONE_NUMBER = '+15551234567';
    const resendService = new NotificationService();
    expect((resendService as any).providers.get('email')?.name).toBe('resend');
  });

  it('falls back on unsupported email provider', () => {
    process.env.EMAIL_PROVIDER = 'unsupported';
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'token';
    process.env.TWILIO_PHONE_NUMBER = '+15551234567';
    const warnSpy = vi.spyOn(console, 'warn');
    expect(() => new NotificationService()).not.toThrow();
    warnSpy.mockRestore();
  });

  it('registers SendGrid provider when configured', () => {
    process.env.EMAIL_PROVIDER = 'sendgrid';
    process.env.SENDGRID_API_KEY = 'sg-configured-key';
    const sendgridService = new NotificationService();
    expect((sendgridService as any).providers.get('email')?.name).toBe('sendgrid');
  });

  it('handles push provider registration failure in constructor', () => {
    const originalSet = Map.prototype.set;
    const setSpy = vi.spyOn(Map.prototype, 'set').mockImplementation(function (this: Map<unknown, unknown>, key: unknown, value: unknown) {
      if (key === 'push') {
        throw new Error('push provider init failed');
      }
      return originalSet.call(this, key, value);
    });

    expect(() => new NotificationService()).not.toThrow();
    setSpy.mockRestore();
  });
  it('handles non-Error thrown while registering push provider', () => {
    const originalSet = Map.prototype.set;
    const setSpy = vi.spyOn(Map.prototype, 'set').mockImplementation(function (this: Map<unknown, unknown>, key: unknown, value: unknown) {
      if (key === 'push') {
        throw 'push string failure';
      }
      return originalSet.call(this, key, value);
    });

    expect(() => new NotificationService()).not.toThrow();
    setSpy.mockRestore();
  });

  it('defaults to resend provider when EMAIL_PROVIDER is unset but RESEND_API_KEY exists', () => {
    delete process.env.EMAIL_PROVIDER;
    process.env.RESEND_API_KEY = 'resend-key';
    const resendDefaultService = new NotificationService();
    expect((resendDefaultService as any).providers.get('email')?.name).toBe('resend');
  });

  it('handles non-Error thrown while registering email provider', () => {
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.RESEND_API_KEY = 'resend-key';

    const originalSet = Map.prototype.set;
    const setSpy = vi.spyOn(Map.prototype, 'set').mockImplementation(function (this: Map<unknown, unknown>, key: unknown, value: unknown) {
      if (key === 'email') {
        throw 'email string failure';
      }
      return originalSet.call(this, key, value);
    });

    expect(() => new NotificationService()).not.toThrow();
    setSpy.mockRestore();
  });

  it('handles non-Error thrown while registering sms provider', () => {
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.RESEND_API_KEY = 'resend-key';
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'token';
    process.env.TWILIO_PHONE_NUMBER = '+15551234567';

    const originalSet = Map.prototype.set;
    const setSpy = vi.spyOn(Map.prototype, 'set').mockImplementation(function (this: Map<unknown, unknown>, key: unknown, value: unknown) {
      if (key === 'sms') {
        throw 'sms string failure';
      }
      return originalSet.call(this, key, value);
    });

    expect(() => new NotificationService()).not.toThrow();
    setSpy.mockRestore();
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

    it('uses phone in audit description fallback when email is absent', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).providers.set('sms', {
        name: 'mock-sms',
        send: vi.fn().mockResolvedValue({ id: 'sms-1', status: 'sent', sentAt: new Date() }),
      });

      await service.send({
        organizationId: 'org-1',
        type: 'sms',
        body: 'hello',
        recipientPhone: '+15550001111',
        userId: 'user-1',
      });

      expect(mocks.mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining('+15550001111'),
        }),
      );
    });

    it('uses recipientId in audit description fallback when email and phone are absent', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).providers.set('in_app', {
        name: 'mock-app',
        send: vi.fn().mockResolvedValue({ id: 'app-1', status: 'sent', sentAt: new Date() }),
      });

      await service.send({
        organizationId: 'org-1',
        type: 'in_app',
        body: 'hello',
        recipientId: 'member-42',
        userId: 'user-1',
      });

      expect(mocks.mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining('member-42'),
        }),
      );
    });

    it('executes persistence and audit catch callbacks without failing send', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).providers.set('email', {
        name: 'mock',
        send: vi.fn().mockResolvedValue({ id: 'msg-catch', status: 'sent', sentAt: new Date() }),
      });

      mocks.mockInsert.mockReturnValue({
        values: vi.fn(() => Promise.reject(new Error('insert catch path'))),
      });
      mocks.mockCreateAuditLog.mockRejectedValue(new Error('audit catch path'));

      await expect(service.send({ ...emailPayload, userId: 'user-2' })).resolves.toEqual(
        expect.objectContaining({ status: 'sent' }),
      );
    });
    it('handles non-Error catch values from persistence and audit callbacks', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).providers.set('email', {
        name: 'mock',
        send: vi.fn().mockResolvedValue({ id: 'msg-catch-string', status: 'sent', sentAt: new Date() }),
      });

      mocks.mockInsert.mockReturnValue({
        values: vi.fn(() => Promise.reject('insert string failure')),
      });
      mocks.mockCreateAuditLog.mockRejectedValue('audit string failure');

      await expect(service.send({ ...emailPayload, userId: 'user-2' })).resolves.toEqual(
        expect.objectContaining({ status: 'sent' }),
      );
    });

    it('handles synchronous database persistence errors and still returns provider response', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).providers.set('email', {
        name: 'mock',
        send: vi.fn().mockResolvedValue({ id: 'msg-sync-db', status: 'sent', sentAt: new Date() }),
      });

      mocks.mockInsert.mockImplementation(() => {
        throw new Error('sync insert failure');
      });

      await expect(service.send({ ...emailPayload })).resolves.toEqual(
        expect.objectContaining({ id: 'msg-sync-db', status: 'sent' }),
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

    it('handles queued insert rejection callback and still returns ID', async () => {
      mocks.mockInsert.mockReturnValue({
        values: vi.fn(() => Promise.reject(new Error('queue catch path'))),
      });

      const id = await service.queue({
        organizationId: 'org-1',
        type: 'email',
        body: 'Queued notification',
      });

      expect(id).toBe('notif-uuid');
    });
    it('handles queue insert callback rejection with non-Error reason', async () => {
      mocks.mockInsert.mockReturnValue({
        values: vi.fn(() => Promise.reject('queue string failure')),
      });

      const id = await service.queue({
        organizationId: 'org-1',
        type: 'email',
        body: 'Queued notification',
      });

      expect(id).toBe('notif-uuid');
    });

    it('throws when queue insert fails synchronously', async () => {
      mocks.mockInsert.mockImplementation(() => {
        throw new Error('sync queue insert failure');
      });

      await expect(service.queue({
        organizationId: 'org-1',
        type: 'email',
        body: 'Queued notification',
      })).rejects.toThrow('sync queue insert failure');
    });
  });

  describe('private queue internals', () => {
    it('processQueue legacy method resolves cleanly', async () => {
      await expect((service as any).processQueue()).resolves.toBeUndefined();
    });

    it('scheduleRetry returns immediately when max retries reached', async () => {
      await expect((service as any).scheduleRetry({ organizationId: 'org-1', type: 'email', body: 'retry' }, 3)).resolves.toBeUndefined();
    });

    it('scheduleRetry handles insert rejection callback path', async () => {
      mocks.mockInsert.mockReturnValue({
        values: vi.fn(() => Promise.reject(new Error('retry catch path'))),
      });

      await expect((service as any).scheduleRetry({ organizationId: 'org-1', type: 'email', body: 'retry' }, 1)).resolves.toBeUndefined();
    });
    it('scheduleRetry handles insert callback rejection with non-Error reason', async () => {
      mocks.mockInsert.mockReturnValue({
        values: vi.fn(() => Promise.reject('retry string failure')),
      });

      await expect((service as any).scheduleRetry({ organizationId: 'org-1', type: 'email', body: 'retry' }, 1)).resolves.toBeUndefined();
    });

    it('scheduleRetry handles synchronous insert errors', async () => {
      mocks.mockInsert.mockImplementation(() => {
        throw new Error('sync retry insert failure');
      });

      await expect((service as any).scheduleRetry({ organizationId: 'org-1', type: 'email', body: 'retry' }, 1)).resolves.toBeUndefined();
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
    it('returns unknown failure reason for non-Error bulk rejection', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).providers.set('email', {
        name: 'mock',
        send: vi.fn().mockRejectedValue('bulk string failure'),
      });

      const results = await service.sendBulk([
        { organizationId: 'org-1', type: 'email', body: 'will fail', recipientEmail: 'a@test.com' },
      ]);

      expect(results[0].status).toBe('failed');
      expect(results[0].failureReason).toBe('Unknown error');
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

    it('preserves unresolved placeholders when template data key is missing', async () => {
      const mockSend = vi.fn().mockResolvedValue({ id: 'tmpl-raw', status: 'sent', sentAt: new Date() });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).providers.set('email', {
        name: 'mock',
        send: mockSend,
      });

      mocks.mockLimit.mockResolvedValue([{
        id: 'tmpl-raw',
        templateKey: 'raw-template',
        subject: 'Hello {{name}}',
        bodyTemplate: 'Value: {{missing}}',
        htmlBodyTemplate: '<p>{{missing}}</p>',
        channels: ['email'],
      }]);
      mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit });
      mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
      mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

      const result = await service.sendFromTemplate('org-1', 'raw-template', 'user@test.com', undefined, { name: 'Alice' });
      expect(result.status).toBe('sent');
      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
        subject: 'Hello Alice',
        body: 'Value: {{missing}}',
      }));
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

    it('determines push type from template channels and handles null template text', async () => {
      const mockSend = vi.fn().mockResolvedValue({ id: 'push-msg', status: 'sent', sentAt: new Date() });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).providers.set('push', { name: 'firebase', send: mockSend });

      mocks.mockLimit.mockResolvedValue([{
        id: 'tmpl-push',
        templateKey: 'push-alert',
        subject: null,
        bodyTemplate: null,
        htmlBodyTemplate: null,
        channels: ['push'],
      }]);
      mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit });
      mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
      mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

      const result = await service.sendFromTemplate('org-1', 'push-alert');
      expect(result.status).toBe('sent');
      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ type: 'push', body: '' }));
    });

    it('returns failed with unknown error text for non-Error throw', async () => {
      mocks.mockSelect.mockImplementation(() => {
        throw 'template exploded';
      });

      const result = await service.sendFromTemplate('org-1', 'broken-template');
      expect(result.status).toBe('failed');
      expect(result.failureReason).toBe('Unknown error');
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

    it('marks retries as failed when provider returns non-sent status', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).providers.set('email', {
        name: 'mock',
        send: vi.fn().mockResolvedValue({ id: 'retry-failed', status: 'failed', failureReason: 'temporary' }),
      });

      const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
      mocks.mockSet.mockReturnValue({ where: mockUpdateWhere });
      mocks.mockUpdate.mockReturnValue({ set: mocks.mockSet });

      mocks.mockLimit.mockResolvedValue([
        {
          id: 'q-fail-1',
          payload: { organizationId: 'org-1', type: 'email', body: 'retry me', recipientEmail: 'a@test.com' },
          attemptCount: '1',
          status: 'failed',
        },
      ]);
      mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit });
      mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
      mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

      const result = await service.retryFailed();
      expect(result).toEqual({ retried: 1, succeeded: 0, failed: 1 });
    });

    it('continues when queued item payload is missing', async () => {
      mocks.mockLimit.mockResolvedValue([
        { id: 'q-empty', payload: null, attemptCount: '0', status: 'failed' },
      ]);
      mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit });
      mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
      mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

      const result = await service.retryFailed();
      expect(result).toEqual({ retried: 0, succeeded: 0, failed: 0 });
    });

    it('handles provider throw and update failure while retrying', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).providers.set('email', {
        name: 'mock',
        send: vi.fn().mockRejectedValue('non-error failure'),
      });

      const mockUpdateWhere = vi.fn().mockRejectedValue(new Error('update failed'));
      mocks.mockSet.mockReturnValue({ where: mockUpdateWhere });
      mocks.mockUpdate.mockReturnValue({ set: mocks.mockSet });

      mocks.mockLimit.mockResolvedValue([
        {
          id: 'q-throw-1',
          payload: { organizationId: 'org-1', type: 'email', body: 'retry me', recipientEmail: 'a@test.com' },
          attemptCount: '3',
          status: 'failed',
        },
      ]);
      mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit });
      mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
      mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

      const result = await service.retryFailed(undefined, 3);
      expect(result).toEqual({ retried: 1, succeeded: 0, failed: 1 });
    });

    it('updates retry queue with unknown error when throw is non-Error and attempts remain', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).providers.set('email', {
        name: 'mock',
        send: vi.fn().mockRejectedValue('string-failure'),
      });

      const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
      mocks.mockSet.mockReturnValue({ where: mockUpdateWhere });
      mocks.mockUpdate.mockReturnValue({ set: mocks.mockSet });

      mocks.mockLimit.mockResolvedValue([
        {
          id: 'q-throw-else',
          payload: { organizationId: 'org-1', type: 'email', body: 'retry me', recipientEmail: 'a@test.com' },
          attemptCount: '1',
          status: 'failed',
        },
      ]);
      mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit });
      mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
      mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

      const result = await service.retryFailed(undefined, 3);
      expect(result).toEqual({ retried: 1, succeeded: 0, failed: 1 });
      expect(mocks.mockSet).toHaveBeenCalledWith(expect.objectContaining({
        status: 'retrying',
        attemptCount: '2',
        errorMessage: 'Unknown error',
      }));
    });
    it('updates failed status with Error message when max retries reached', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).providers.set('email', {
        name: 'mock',
        send: vi.fn().mockRejectedValue(new Error('hard failure')),
      });

      const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
      mocks.mockSet.mockReturnValue({ where: mockUpdateWhere });
      mocks.mockUpdate.mockReturnValue({ set: mocks.mockSet });

      mocks.mockLimit.mockResolvedValue([
        {
          id: 'q-max-retries',
          payload: { organizationId: 'org-1', type: 'email', body: 'retry me', recipientEmail: 'a@test.com' },
          attemptCount: '3',
          status: 'failed',
        },
      ]);
      mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit });
      mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
      mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

      const result = await service.retryFailed(undefined, 3);
      expect(result).toEqual({ retried: 1, succeeded: 0, failed: 1 });
      expect(mocks.mockSet).toHaveBeenCalledWith(expect.objectContaining({
        status: 'failed',
        errorMessage: 'hard failure',
      }));
    });

    it('updates retrying status with Error message when attempts remain', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).providers.set('email', {
        name: 'mock',
        send: vi.fn().mockRejectedValue(new Error('transient failure')),
      });

      const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
      mocks.mockSet.mockReturnValue({ where: mockUpdateWhere });
      mocks.mockUpdate.mockReturnValue({ set: mocks.mockSet });

      mocks.mockLimit.mockResolvedValue([
        {
          id: 'q-retry-err',
          payload: { organizationId: 'org-1', type: 'email', body: 'retry me', recipientEmail: 'a@test.com' },
          attemptCount: '1',
          status: 'failed',
        },
      ]);
      mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit });
      mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
      mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

      const result = await service.retryFailed(undefined, 3);
      expect(result).toEqual({ retried: 1, succeeded: 0, failed: 1 });
      expect(mocks.mockSet).toHaveBeenCalledWith(expect.objectContaining({
        status: 'retrying',
        attemptCount: '2',
        errorMessage: 'transient failure',
      }));
    });

    it('uses attemptCount fallback of 0 when attemptCount is missing in success path', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).providers.set('email', {
        name: 'mock',
        send: vi.fn().mockResolvedValue({ id: 'retry-failed', status: 'failed', failureReason: 'temporary' }),
      });

      const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
      mocks.mockSet.mockReturnValue({ where: mockUpdateWhere });
      mocks.mockUpdate.mockReturnValue({ set: mocks.mockSet });

      mocks.mockLimit.mockResolvedValue([
        {
          id: 'q-no-attempt',
          payload: { organizationId: 'org-1', type: 'email', body: 'retry me', recipientEmail: 'a@test.com' },
          status: 'failed',
        },
      ]);
      mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit });
      mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
      mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

      const result = await service.retryFailed(undefined, 3);
      expect(result).toEqual({ retried: 1, succeeded: 0, failed: 1 });
      expect(mocks.mockSet).toHaveBeenCalledWith(expect.objectContaining({ attemptCount: '1' }));
    });

    it('uses attemptCount fallback of 0 in catch branch when provider throws', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).providers.set('email', {
        name: 'mock',
        send: vi.fn().mockRejectedValue(new Error('catch fallback failure')),
      });

      const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
      mocks.mockSet.mockReturnValue({ where: mockUpdateWhere });
      mocks.mockUpdate.mockReturnValue({ set: mocks.mockSet });

      mocks.mockLimit.mockResolvedValue([
        {
          id: 'q-catch-no-attempt',
          payload: { organizationId: 'org-1', type: 'email', body: 'retry me', recipientEmail: 'a@test.com' },
          status: 'failed',
        },
      ]);
      mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit });
      mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
      mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

      const result = await service.retryFailed(undefined, 3);
      expect(result).toEqual({ retried: 1, succeeded: 0, failed: 1 });
      expect(mocks.mockSet).toHaveBeenCalledWith(expect.objectContaining({
        status: 'retrying',
        attemptCount: '1',
      }));
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
    const service = getNotificationService();
    vi.spyOn(service, 'send')
      .mockResolvedValueOnce({ id: 'delivered-1', status: 'delivered', sentAt: new Date() } as never)
      .mockResolvedValueOnce({ id: 'failed-1', status: 'failed', failureReason: 'nope' } as never);

    mocks.mockLimit.mockResolvedValue([
      { id: 'q-0', payload: null },
      { id: 'q-1', payload: { organizationId: 'org-1', type: 'email', body: 'ok', recipientEmail: 'a@test.com' } },
      { id: 'q-2', payload: { organizationId: 'org-1', type: 'email', body: 'fail', recipientEmail: 'b@test.com' } },
    ]);
    mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit });
    mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
    mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

    const result = await processPendingNotifications(10);
    expect(result).toEqual({ processed: 2, succeeded: 1, failed: 1 });
  });

  it('returns zeros on error', async () => {
    mocks.mockSelect.mockImplementation(() => { throw new Error('DB err'); });
    const result = await processPendingNotifications();
    expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0 });
  });

  it('counts item as failed when service.send throws for a queued payload', async () => {
    const service = getNotificationService();
    vi.spyOn(service, 'send')
      .mockRejectedValueOnce(new Error('send exploded'));

    mocks.mockLimit.mockResolvedValue([
      { id: 'q-throw', payload: { organizationId: 'org-1', type: 'email', body: 'ok', recipientEmail: 'a@test.com' } },
    ]);
    mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit });
    mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
    mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

    const result = await processPendingNotifications(10);
    expect(result).toEqual({ processed: 1, succeeded: 0, failed: 1 });
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

  it('returns zeros when retry job throws', async () => {
    const retrySpy = vi.spyOn(NotificationService.prototype, 'retryFailed').mockRejectedValueOnce(new Error('job failed'));
    const result = await retryFailedNotificationsJob();
    expect(result).toEqual({ retried: 0, succeeded: 0, failed: 0 });
    retrySpy.mockRestore();
  });
});

describe('retryFailed nextRetryAt fallback branches', () => {
  it('uses now fallback when organizationId is provided', async () => {
    vi.resetModules();
    vi.doMock('@/db/schema/domains/communications', () => ({
      notificationQueue: {
        id: 'id', status: 'status', organizationId: 'organization_id',
        nextRetryAt: undefined,
        attemptCount: 'attempt_count',
        templateKey: 'template_key',
      },
      notificationDeliveryLog: { id: 'id' },
      notificationTemplates: { id: 'id', templateKey: 'template_key' },
    }));

    const mod = await import('../notification-service');
    const service = new mod.NotificationService();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).providers.set('email', {
      name: 'mock',
      send: vi.fn().mockResolvedValue({ id: 'retry-ok', status: 'sent', sentAt: new Date() }),
    });

    const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
    mocks.mockSet.mockReturnValue({ where: mockUpdateWhere });
    mocks.mockUpdate.mockReturnValue({ set: mocks.mockSet });

    mocks.mockLimit.mockResolvedValue([
      {
        id: 'q-fallback-org',
        payload: { organizationId: 'org-1', type: 'email', body: 'retry me', recipientEmail: 'a@test.com' },
        attemptCount: '1',
        status: 'failed',
      },
    ]);
    mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit });
    mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
    mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

    const result = await service.retryFailed('org-1', 3);
    expect(result.retried).toBe(1);
  });

  it('uses now fallback when organizationId is omitted', async () => {
    vi.resetModules();
    vi.doMock('@/db/schema/domains/communications', () => ({
      notificationQueue: {
        id: 'id', status: 'status', organizationId: 'organization_id',
        nextRetryAt: undefined,
        attemptCount: 'attempt_count',
        templateKey: 'template_key',
      },
      notificationDeliveryLog: { id: 'id' },
      notificationTemplates: { id: 'id', templateKey: 'template_key' },
    }));

    const mod = await import('../notification-service');
    const service = new mod.NotificationService();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).providers.set('email', {
      name: 'mock',
      send: vi.fn().mockResolvedValue({ id: 'retry-ok', status: 'sent', sentAt: new Date() }),
    });

    const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
    mocks.mockSet.mockReturnValue({ where: mockUpdateWhere });
    mocks.mockUpdate.mockReturnValue({ set: mocks.mockSet });

    mocks.mockLimit.mockResolvedValue([
      {
        id: 'q-fallback-global',
        payload: { organizationId: 'org-1', type: 'email', body: 'retry me', recipientEmail: 'a@test.com' },
        attemptCount: '1',
        status: 'failed',
      },
    ]);
    mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit });
    mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
    mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

    const result = await service.retryFailed(undefined, 3);
    expect(result.retried).toBe(1);
  });
});
