import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  claim: vi.fn(), release: vi.fn(), send: vi.fn(),
  context: vi.fn(async (fn: () => Promise<unknown>) => fn()),
}));

vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.context }));
vi.mock('@/lib/education/reminder-delivery', () => ({
  claimEducationReminder: m.claim,
  releaseEducationReminder: m.release,
}));
vi.mock('@/lib/email-service', () => ({
  getFromEmail: () => 'test@example.test',
  sendResendEmail: m.send,
}));
vi.mock('@/emails/training/session-reminder', () => ({ default: () => null }));
vi.mock('@/emails/training/certification-expiry-warning', () => ({ default: () => null }));
vi.mock('@/emails/training/registration-confirmation', () => ({ default: () => null }));
vi.mock('@/emails/training/completion-certificate', () => ({ default: () => null }));
vi.mock('@/emails/training/program-milestone', () => ({ default: () => null }));

import { batchSendSessionReminders, batchSendExpiryWarnings } from '../training-notifications';

const identity = {
  organizationId: '11111111-1111-4111-8111-111111111111',
  userId: 'member-1',
  sourceId: '33333333-3333-4333-8333-333333333333',
};
const session = {
  ...identity, toEmail: 'member@example.test', memberName: 'Member',
  courseName: 'Training', sessionDate: 'November 7, 2026',
  sessionTime: '09:00', daysUntilSession: 7,
};
const cert = {
  ...identity, toEmail: 'member@example.test', memberName: 'Member',
  certificationName: 'First Aid', certificateNumber: 'CERT-1',
  expiryDate: 'December 1, 2026', daysUntilExpiry: 30,
};

describe('education batch delivery claims', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.context.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.claim.mockResolvedValue(true);
    m.release.mockResolvedValue(undefined);
    m.send.mockResolvedValue({ success: true });
  });

  it('claims a tenant/member/registration/tier before sending, and reports actual sends', async () => {
    expect(await batchSendSessionReminders([session])).toMatchObject({ sent: 1, failed: 0 });
    expect(m.claim).toHaveBeenCalledWith({ ...identity, kind: 'session', leadDays: 7 });
    expect(m.send).toHaveBeenCalledTimes(1);
    expect(m.release).not.toHaveBeenCalled();
  });

  it('skips an already-claimed reminder without pretending to send it', async () => {
    m.claim.mockResolvedValue(false);
    expect(await batchSendSessionReminders([session])).toMatchObject({ sent: 0, failed: 0 });
    expect(m.send).not.toHaveBeenCalled();
  });

  it('fails closed if durable claim storage is unavailable', async () => {
    m.claim.mockRejectedValue(new Error('database unavailable'));
    expect(await batchSendSessionReminders([session])).toMatchObject({ sent: 0, failed: 1 });
    expect(m.send).not.toHaveBeenCalled();
  });

  it('releases the claim on a definite provider refusal, without disclosing member email in errors', async () => {
    m.send.mockResolvedValue({ success: false, error: 'smtp refused' });
    const result = await batchSendExpiryWarnings([cert]);
    expect(result).toMatchObject({ sent: 0, failed: 1 });
    expect(m.claim).toHaveBeenCalledWith({ ...identity, kind: 'certification', leadDays: 30 });
    expect(m.release).toHaveBeenCalledWith({ ...identity, kind: 'certification', leadDays: 30 });
    expect(result.errors.join(' ')).not.toContain(cert.toEmail);
  });

  it('retains a claim after an unexpected exception instead of risking duplicate delivery', async () => {
    m.send.mockRejectedValue(new Error('unknown provider state'));
    expect(await batchSendSessionReminders([session])).toMatchObject({ sent: 0, failed: 1 });
    expect(m.release).not.toHaveBeenCalled();
  });
});
