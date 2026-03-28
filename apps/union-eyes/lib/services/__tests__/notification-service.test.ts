import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  notificationQueue: { id: 'id', status: 'status', organizationId: 'organization_id' },
  notificationDeliveryLog: { id: 'id' },
  notificationTemplates: { id: 'id' },
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
  NotificationService,
  getNotificationService,
} from '../notification-service';

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
    const result = await provider.send({
      organizationId: 'org-1',
      recipientEmail: 'user@test.com',
      type: 'email',
      body: 'Hello',
      subject: 'Test',
    });
    expect(result.status).toBe('sent');
    expect(result.id).toBe('msg-1');
  });

  it('returns failed status on error', async () => {
    mocks.mockResendSend.mockRejectedValue(new Error('API error'));
    const provider = new ResendEmailProvider('test-key');
    const result = await provider.send({
      organizationId: 'org-1',
      recipientEmail: 'user@test.com',
      type: 'email',
      body: 'Hello',
    });
    expect(result.status).toBe('failed');
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
});

describe('SendGridEmailProvider', () => {
  it('throws if no API key', () => {
    expect(() => new SendGridEmailProvider('')).toThrow('SendGrid API key not configured');
  });
});

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockUuid.mockReturnValue('notif-uuid');
    service = new NotificationService();
  });

  it('instantiates successfully', () => {
    expect(service).toBeDefined();
  });
});

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
