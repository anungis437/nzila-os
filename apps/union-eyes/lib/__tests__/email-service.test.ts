import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  process.env.RESEND_API_KEY = 'test-key';
  return {
    mockSend: vi.fn(),
    mockInfo: vi.fn(),
    mockWarn: vi.fn(),
    mockError: vi.fn(),
    mockDebug: vi.fn(),
    suppressed: vi.fn(),
  };
});

// Disclosed addition (F06 A2): the sending function consults the platform-wide address suppression list. The list is a seam here; its own
// behaviour is proven in lib/communications/__tests__/address-suppression.test.ts and the native database test.
vi.mock('@/lib/communications/address-suppression', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/communications/address-suppression')>()),
  suppressedAddressHashes: mocks.suppressed,
}));

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
    mocks.suppressed.mockResolvedValue(new Set());
    process.env.RESEND_API_KEY = 'test-key-123';
  });

  describe('platform-wide address suppression', () => {
    const hash = async (a: string) => (await import('@/lib/communications/address-suppression')).addressSha256(a);
    const send = async (to: { email: string; name: string }[]) => (await import('../email-service')).sendEmail({ to, subject: 'S', html: '<p>x</p>' });

    it('does not send to an address that is suppressed, and says so', async () => {
      mocks.suppressed.mockResolvedValue(new Set([await hash('Complained@Example.com')]));
      const result = await send([{ email: 'complained@example.com', name: 'C' }]);
      expect(result).toMatchObject({ success: false, code: 'ADDRESS_SUPPRESSED' });
      expect(mocks.mockSend).not.toHaveBeenCalled();
    });

    it('sends to the recipients that are not suppressed and drops only the suppressed one', async () => {
      mocks.mockSend.mockResolvedValue({ data: { id: 'm-9' }, error: null });
      mocks.suppressed.mockResolvedValue(new Set([await hash('bad@example.com')]));
      const result = await send([{ email: 'bad@example.com', name: 'Bad' }, { email: 'good@example.com', name: 'Good' }]);
      expect(result.success).toBe(true);
      expect(mocks.mockSend.mock.calls[0][0].to).toEqual(['Good <good@example.com>']);
    });

    it('refuses to send, rather than sending unchecked, when the suppression list cannot be read', async () => {
      mocks.suppressed.mockRejectedValue(new Error('database unavailable'));
      const result = await send([{ email: 'a@example.com', name: 'A' }]);
      expect(result).toMatchObject({ success: false, code: 'SUPPRESSION_CHECK_UNAVAILABLE' });
      expect(mocks.mockSend).not.toHaveBeenCalled();
    });
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

  it('sendEmail returns error when RESEND_API_KEY is not set', async () => {
    vi.resetModules();
    delete process.env.RESEND_API_KEY;

    const { sendEmail } = await import('../email-service');
    const result = await sendEmail({
      to: [{ email: 'test@test.com', name: 'Test' }],
      subject: 'Hello',
      html: '<p>Hi</p>',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Email service not configured');
  });

  it('sendEmail passes explicit text instead of stripping html', async () => {
    mocks.mockSend.mockResolvedValue({ data: { id: 'msg-2' }, error: null });

    const { sendEmail } = await import('../email-service');
    await sendEmail({
      to: [{ email: 'test@test.com', name: 'Test' }],
      subject: 'Hello',
      html: '<p>Hi</p>',
      text: 'Plain text body',
    });

    expect(mocks.mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Plain text body' }),
    );
  });

  it('sendEmail handles error object without message', async () => {
    mocks.mockSend.mockResolvedValue({
      data: null,
      error: { name: 'SomeError' },
    });

    const { sendEmail } = await import('../email-service');
    const result = await sendEmail({
      to: [{ email: 'test@test.com', name: 'Test' }],
      subject: 'Hello',
      html: '<p>Hi</p>',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to send email');
  });

  it('sendEmail handles non-Error thrown exception', async () => {
    mocks.mockSend.mockRejectedValue('string error');

    const { sendEmail } = await import('../email-service');
    const result = await sendEmail({
      to: [{ email: 'test@test.com', name: 'Test' }],
      subject: 'Hello',
      html: '<p>Hi</p>',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unknown error');
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
