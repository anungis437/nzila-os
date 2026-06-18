import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('@/lib/email-service', () => ({
  sendEmail: mocks.sendEmail,
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: mocks.error, warn: mocks.warn },
}));

import {
  sendMagicLinkEmail,
  sendInviteEmail,
  sendPasswordResetEmail,
  logEmailDeliveryFailure,
} from '../auth-emails';

const future = (ms: number) => new Date(Date.now() + ms);

describe('lib/auth-emails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendEmail.mockResolvedValue({ success: true, messageId: 'm1' });
  });

  describe('sendMagicLinkEmail', () => {
    it('includes the verify link, validity window and IP line', async () => {
      await sendMagicLinkEmail({
        to: 'user@example.com',
        token: 'tok&en',
        expiresAt: future(15 * 60000),
        ipAddress: '1.2.3.4',
      });

      const call = mocks.sendEmail.mock.calls[0][0];
      expect(call.subject).toContain('sign-in link');
      expect(call.html).toContain('/magic-link/verify?token=tok%26en');
      expect(call.html).toContain('IP 1.2.3.4');
    });

    it('omits the IP line when no address is provided', async () => {
      await sendMagicLinkEmail({
        to: 'user@example.com',
        token: 'tok',
        expiresAt: future(60000),
      });
      const call = mocks.sendEmail.mock.calls[0][0];
      expect(call.html).not.toContain('Request came from IP');
    });
  });

  describe('sendInviteEmail', () => {
    it('renders inviter, organization and a pluralized validity window', async () => {
      await sendInviteEmail({
        to: 'invitee@example.com',
        token: 't',
        expiresAt: future(3 * 24 * 60 * 60 * 1000),
        role: 'steward',
        organizationName: 'Local 99',
        inviterName: 'Pat <Lead>',
      });
      const call = mocks.sendEmail.mock.calls[0][0];
      expect(call.html).toContain('Local 99');
      expect(call.html).toContain('Pat &lt;Lead&gt;');
      expect(call.html).toContain('3 days');
    });

    it('uses fallbacks and singular day wording', async () => {
      await sendInviteEmail({
        to: 'invitee@example.com',
        token: 't',
        expiresAt: future(24 * 60 * 60 * 1000),
        role: 'member',
      });
      const call = mocks.sendEmail.mock.calls[0][0];
      expect(call.html).toContain('A colleague');
      expect(call.html).toContain('their organization');
      expect(call.html).toContain('1 day');
      expect(call.html).not.toContain('1 days');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('includes the reset URL and validity window', async () => {
      await sendPasswordResetEmail({
        to: 'user@example.com',
        token: 'rt',
        expiresAt: future(30 * 60000),
      });
      const call = mocks.sendEmail.mock.calls[0][0];
      expect(call.subject).toContain('Reset your UnionEyes password');
      expect(call.html).toContain('/reset-password?token=rt');
    });
  });

  describe('logEmailDeliveryFailure', () => {
    it('logs an error and a warning', () => {
      logEmailDeliveryFailure('magic_link', 'user@example.com', 'SMTP down');
      expect(mocks.error).toHaveBeenCalled();
      expect(mocks.warn).toHaveBeenCalledWith('Auth email not delivered', {
        kind: 'magic_link',
        to: 'user@example.com',
      });
    });

    it('falls back to Unknown when no error string is given', () => {
      logEmailDeliveryFailure('invite', 'user@example.com', undefined);
      const errArg = mocks.error.mock.calls[0][1] as Error;
      expect(errArg.message).toBe('Unknown');
    });
  });
});
