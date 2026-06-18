import { describe, expect, it, vi } from 'vitest';

const { sendEmailViaResendMock, loggerInfoMock } = vi.hoisted(() => ({
  sendEmailViaResendMock: vi.fn(),
  loggerInfoMock: vi.fn(),
}));

vi.mock('@/lib/email-service', () => ({
  sendEmail: sendEmailViaResendMock,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: loggerInfoMock, warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { sendEmail } from '../email';

describe('services/email', () => {
  it('delegates to the Resend-backed service and maps the result', async () => {
    sendEmailViaResendMock.mockResolvedValue({ success: true, messageId: 'msg-123' });

    const result = await sendEmail({
      to: 'member@example.test',
      subject: 'Hello',
      html: '<p>Hi</p>',
    });

    expect(result).toEqual({ success: true, id: 'msg-123' });
    expect(loggerInfoMock).toHaveBeenCalledWith('Sending email', {
      to: 'member@example.test',
      subject: 'Hello',
    });
    expect(sendEmailViaResendMock).toHaveBeenCalledWith({
      to: [{ email: 'member@example.test', name: 'member@example.test' }],
      subject: 'Hello',
      html: '<p>Hi</p>',
    });
  });

  it('propagates a failed delivery result', async () => {
    sendEmailViaResendMock.mockResolvedValue({ success: false });

    const result = await sendEmail({
      to: 'member@example.test',
      subject: 'Subject',
      html: '<p>Body</p>',
    });

    expect(result.success).toBe(false);
    expect(result.id).toBeUndefined();
  });
});
