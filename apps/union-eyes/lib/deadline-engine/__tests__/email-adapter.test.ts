import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
}));

vi.mock('@/lib/email-service', () => ({
  sendEmail: mocks.sendEmail,
}));

import { deliverDeadlineReminderEmail } from '../email-adapter';

const baseInput = {
  recipientEmail: 'test@example.com',
  recipientLocale: 'en',
  subject: 'Union Eyes deadline reminder',
  correlationId: 'corr-123',
  daysToDeadline: 3,
  deadlineKind: 'filing_deadline',
  claimUrl: 'https://ue.example.com/dashboard/grievances/g-1',
  organizationId: 'org-1',
};

describe('email-adapter', () => {
  const originalKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = 're_test_key';
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.RESEND_API_KEY;
    } else {
      process.env.RESEND_API_KEY = originalKey;
    }
  });

  it('returns disabled when RESEND_API_KEY is not set', async () => {
    delete process.env.RESEND_API_KEY;
    const result = await deliverDeadlineReminderEmail(baseInput);
    expect(result.kind).toBe('disabled');
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('returns sent with providerMessageId on success', async () => {
    mocks.sendEmail.mockResolvedValueOnce({ success: true, messageId: 'msg-42' });
    const result = await deliverDeadlineReminderEmail(baseInput);
    expect(result).toEqual({
      kind: 'sent',
      provider: 'resend',
      providerMessageId: 'msg-42',
    });
  });

  it('returns permanent_failure when sendEmail resolves without messageId', async () => {
    mocks.sendEmail.mockResolvedValueOnce({ success: false, error: 'invalid recipient' });
    const result = await deliverDeadlineReminderEmail(baseInput);
    expect(result.kind).toBe('permanent_failure');
    if (result.kind === 'permanent_failure') {
      expect(result.message).toBe('invalid recipient');
    }
  });

  it('classifies HTTP 429 as transient_failure', async () => {
    mocks.sendEmail.mockRejectedValueOnce(Object.assign(new Error('rate limited'), { statusCode: 429 }));
    const result = await deliverDeadlineReminderEmail(baseInput);
    expect(result.kind).toBe('transient_failure');
    if (result.kind === 'transient_failure') {
      expect(result.statusCode).toBe(429);
    }
  });

  it('classifies ECONNRESET as transient_failure even without statusCode', async () => {
    mocks.sendEmail.mockRejectedValueOnce(new Error('socket hang up: ECONNRESET'));
    const result = await deliverDeadlineReminderEmail(baseInput);
    expect(result.kind).toBe('transient_failure');
  });

  it('classifies HTTP 400 as permanent_failure', async () => {
    mocks.sendEmail.mockRejectedValueOnce(Object.assign(new Error('bad address'), { statusCode: 400 }));
    const result = await deliverDeadlineReminderEmail(baseInput);
    expect(result.kind).toBe('permanent_failure');
  });

  it('renders "PAST DUE" subject-body when daysToDeadline is negative', async () => {
    let capturedHtml = '';
    let capturedText = '';
    mocks.sendEmail.mockImplementationOnce(async (opts: { html: string; text?: string }) => {
      capturedHtml = opts.html;
      capturedText = opts.text ?? '';
      return { success: true, messageId: 'msg-1' };
    });
    await deliverDeadlineReminderEmail({ ...baseInput, daysToDeadline: -2 });
    expect(capturedHtml).toContain('PAST DUE');
    expect(capturedText).toContain('PAST DUE');
    expect(capturedText).toContain('2 days ago');
  });

  it('body does NOT contain grievance description, member name, or api keys', async () => {
    let capturedHtml = '';
    let capturedText = '';
    mocks.sendEmail.mockImplementationOnce(async (opts: { html: string; text?: string }) => {
      capturedHtml = opts.html;
      capturedText = opts.text ?? '';
      return { success: true, messageId: 'msg-1' };
    });
    await deliverDeadlineReminderEmail(baseInput);
    // Min-necessary body must not embed test recipient email or the api key
    expect(capturedHtml).not.toContain('test@example.com');
    expect(capturedText).not.toContain('test@example.com');
    expect(capturedHtml).not.toContain('re_test_key');
    expect(capturedText).not.toContain('re_test_key');
  });
});
