import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── hoisted mocks ───
const mocks = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = { send: mocks.mockSend };
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  sendAwardReceivedEmail,
  sendApprovalRequestEmail,
  sendCreditExpirationEmail,
  sendRedemptionConfirmationEmail,
} from '../email-service';

describe('email-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockSend.mockResolvedValue({ data: { id: 'msg-1' }, error: null });
  });

  // ──────────────── sendAwardReceivedEmail ────────────────
  describe('sendAwardReceivedEmail', () => {
    const awardData = {
      recipientName: 'Alice',
      recipientEmail: 'alice@example.com',
      issuerName: 'Bob',
      awardTypeName: 'Team Player',
      message: 'Great job!',
      creditsAwarded: 100,
      awardId: 'award-1',
      orgName: 'TestOrg',
    };

    it('sends email successfully', async () => {
      const result = await sendAwardReceivedEmail(awardData);
      expect(result.success).toBe(true);
      expect(mocks.mockSend).toHaveBeenCalledTimes(1);
    });

    it('returns error when Resend returns error', async () => {
      mocks.mockSend.mockResolvedValue({ data: null, error: { message: 'rate limit' } });
      const result = await sendAwardReceivedEmail(awardData);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('handles thrown errors gracefully', async () => {
      mocks.mockSend.mockRejectedValue(new Error('Network failure'));
      const result = await sendAwardReceivedEmail(awardData);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('includes recipient email in the send payload', async () => {
      await sendAwardReceivedEmail(awardData);
      expect(mocks.mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'alice@example.com' })
      );
    });

    it('includes issuer name in the subject', async () => {
      await sendAwardReceivedEmail(awardData);
      expect(mocks.mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('Bob'),
        })
      );
    });
  });

  // ──────────────── sendApprovalRequestEmail ────────────────
  describe('sendApprovalRequestEmail', () => {
    const approvalData = {
      adminName: 'Admin',
      adminEmail: 'admin@example.com',
      awardTypeName: 'Innovation',
      recipientName: 'Carol',
      issuerName: 'Dave',
      message: 'Outstanding work',
      creditsToAward: 200,
      awardId: 'award-2',
      orgName: 'TestOrg',
    };

    it('sends approval request successfully', async () => {
      const result = await sendApprovalRequestEmail(approvalData);
      expect(result.success).toBe(true);
    });

    it('sends to admin email', async () => {
      await sendApprovalRequestEmail(approvalData);
      expect(mocks.mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'admin@example.com' })
      );
    });

    it('returns error on Resend failure', async () => {
      mocks.mockSend.mockResolvedValue({ data: null, error: { message: 'fail' } });
      const result = await sendApprovalRequestEmail(approvalData);
      expect(result.success).toBe(false);
    });

    it('handles thrown errors', async () => {
      mocks.mockSend.mockRejectedValue(new Error('timeout'));
      const result = await sendApprovalRequestEmail(approvalData);
      expect(result.success).toBe(false);
    });
  });

  // ──────────────── sendCreditExpirationEmail ────────────────
  describe('sendCreditExpirationEmail', () => {
    const expirationData = {
      recipientName: 'Eve',
      recipientEmail: 'eve@example.com',
      expiringAmount: 50,
      expirationDate: new Date('2026-04-01'),
      orgName: 'TestOrg',
    };

    it('sends expiration warning successfully', async () => {
      const result = await sendCreditExpirationEmail(expirationData);
      expect(result.success).toBe(true);
    });

    it('returns error on failure', async () => {
      mocks.mockSend.mockResolvedValue({ data: null, error: { message: 'error' } });
      const result = await sendCreditExpirationEmail(expirationData);
      expect(result.success).toBe(false);
    });

    it('handles thrown errors', async () => {
      mocks.mockSend.mockRejectedValue(new Error('crash'));
      const result = await sendCreditExpirationEmail(expirationData);
      expect(result.success).toBe(false);
    });
  });

  // ──────────────── sendRedemptionConfirmationEmail ────────────────
  describe('sendRedemptionConfirmationEmail', () => {
    const redemptionData = {
      recipientName: 'Frank',
      recipientEmail: 'frank@example.com',
      creditsRedeemed: 75,
      redemptionId: 'red-1',
      orgName: 'TestOrg',
    };

    it('sends redemption confirmation successfully', async () => {
      const result = await sendRedemptionConfirmationEmail(redemptionData);
      expect(result.success).toBe(true);
    });

    it('includes credits in subject line', async () => {
      await sendRedemptionConfirmationEmail(redemptionData);
      expect(mocks.mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('75'),
        })
      );
    });

    it('returns error on Resend error', async () => {
      mocks.mockSend.mockResolvedValue({ data: null, error: { message: 'blocked' } });
      const result = await sendRedemptionConfirmationEmail(redemptionData);
      expect(result.success).toBe(false);
    });

    it('handles thrown errors', async () => {
      mocks.mockSend.mockRejectedValue(new Error('server error'));
      const result = await sendRedemptionConfirmationEmail(redemptionData);
      expect(result.success).toBe(false);
    });

    it('sends with optional checkoutUrl when provided', async () => {
      const dataWithUrl = { ...redemptionData, checkoutUrl: 'https://shop.example.com/checkout' };
      const result = await sendRedemptionConfirmationEmail(dataWithUrl);
      expect(result.success).toBe(true);
    });
  });
});
