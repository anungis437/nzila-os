import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  process.env.RESEND_API_KEY = 'test-key';
  return {
    mockSend: vi.fn(),
    mockInfo: vi.fn(),
    mockWarn: vi.fn(),
    mockError: vi.fn(),
    mockDebug: vi.fn(),
  };
});

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mocks.mockSend };
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: mocks.mockInfo,
    warn: mocks.mockWarn,
    error: mocks.mockError,
    debug: mocks.mockDebug,
  },
}));

describe('email-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = 'test-key-123';
  });

  it('sendEmail returns success with messageId', async () => {
    mocks.mockSend.mockResolvedValue({ data: { id: 'msg-1' }, error: null });

    const { sendEmail } = await import('../email-service');
    const result = await sendEmail({
      to: [{ email: 'test@test.com', name: 'Test' }],
      subject: 'Hello',
      html: '<p>Hi</p>',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg-1');
  });

  it('sendEmail returns error from Resend', async () => {
    mocks.mockSend.mockResolvedValue({
      data: null,
      error: { message: 'Rate limited' },
    });

    const { sendEmail } = await import('../email-service');
    const result = await sendEmail({
      to: [{ email: 'test@test.com', name: 'Test' }],
      subject: 'Hello',
      html: '<p>Hi</p>',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Rate limited');
  });

  it('sendEmail handles thrown exception', async () => {
    mocks.mockSend.mockRejectedValue(new Error('Network error'));

    const { sendEmail } = await import('../email-service');
    const result = await sendEmail({
      to: [{ email: 'test@test.com', name: 'Test' }],
      subject: 'Hello',
      html: '<p>Hi</p>',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
  });

  it('isValidEmail validates correct emails', async () => {
    const { isValidEmail } = await import('../email-service');
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('invalid')).toBe(false);
    expect(isValidEmail('no@')).toBe(false);
  });

  it('getValidRecipients filters invalid emails', async () => {
    const { getValidRecipients } = await import('../email-service');
    const result = getValidRecipients([
      { email: 'good@test.com', name: 'Good' },
      { email: 'bad', name: 'Bad' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].email).toBe('good@test.com');
  });
});
