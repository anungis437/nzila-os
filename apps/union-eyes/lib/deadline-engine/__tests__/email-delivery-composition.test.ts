import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ send: vi.fn(), systemRows: vi.fn() }));
vi.mock('resend', () => ({ Resend: class { emails = { send: mocks.send }; } }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
// The suppression ledger is read through the system context; only that boundary is replaced, so the real lookup, digesting and screening run.
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: () => mocks.systemRows() }));

// Real canonical service + real deadline adapter. Only the provider SDK and the database boundary are mocked.
import { deliverDeadlineReminderEmail } from '../email-adapter';
import { addressSha256 } from '@/lib/communications/address-suppression';

const input = {
  recipientEmail: 'owned-fixture@example.test', recipientLocale: 'en', subject: 'Isolated composition test',
  correlationId: 'local-no-network', daysToDeadline: 1, deadlineKind: 'deadline',
  claimUrl: 'https://candidate.invalid/owned-fixture', organizationId: 'owned-fixture-org',
};
const previousKey = process.env.RESEND_API_KEY;

beforeEach(() => {
  mocks.send.mockReset();
  mocks.systemRows.mockReset().mockResolvedValue([]);
  process.env.RESEND_API_KEY = 're_local_mock_never_sent';
});
afterEach(() => {
  if (previousKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = previousKey;
});

describe('canonical email service and deadline adapter composition', () => {
  for (const statusCode of [408, 409, 425, 429, 500, 502, 503, 504]) {
    it(`preserves exhausted provider ${statusCode} as retryable to the worker`, async () => {
      mocks.send.mockResolvedValue({ data: null, error: { name: 'temporary_provider_error', message: 'Temporary provider failure', statusCode } });
      expect(await deliverDeadlineReminderEmail(input)).toMatchObject({ kind: 'transient_failure', statusCode, code: 'temporary_provider_error' });
      expect(mocks.send).toHaveBeenCalledTimes(3);
    });
  }

  for (const code of ['ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN']) {
    it(`preserves a caught transport ${code} without relying on its message`, async () => {
      mocks.send.mockRejectedValue(Object.assign(new Error('Transport failed'), { code }));
      expect(await deliverDeadlineReminderEmail(input)).toMatchObject({ kind: 'transient_failure', code });
      expect(mocks.send).toHaveBeenCalledTimes(1);
    });
  }

  for (const statusCode of [400, 401, 403]) {
    it(`keeps provider ${statusCode} permanent without retry`, async () => {
      mocks.send.mockResolvedValue({ data: null, error: { name: 'validation_error', message: 'Sending denied', statusCode } });
      expect(await deliverDeadlineReminderEmail(input)).toMatchObject({ kind: 'permanent_failure', statusCode, code: 'validation_error' });
      expect(mocks.send).toHaveBeenCalledTimes(1);
    });
  }

  it('requires the actual provider message ID for sent status', async () => {
    mocks.send.mockResolvedValue({ data: { id: 'owned-provider-receipt' }, error: null });
    expect(await deliverDeadlineReminderEmail(input)).toEqual({ kind: 'sent', provider: 'resend', providerMessageId: 'owned-provider-receipt' });
  });

  it('keeps explicit authorization denial permanent even with timeout wording', async () => {
    mocks.send.mockResolvedValue({ data: null, error: { name: 'validation_error', message: 'Permission denied after timeout', statusCode: 403 } });
    expect(await deliverDeadlineReminderEmail(input)).toMatchObject({ kind: 'permanent_failure', statusCode: 403 });
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it('does not claim delivery when the provider omits its message ID', async () => {
    mocks.send.mockResolvedValue({ data: {}, error: null });
    expect(await deliverDeadlineReminderEmail(input)).toMatchObject({ kind: 'permanent_failure', code: 'resend_no_message_id' });
  });

  it('keeps unconfigured delivery disabled without contacting the provider', async () => {
    delete process.env.RESEND_API_KEY;
    expect(await deliverDeadlineReminderEmail(input)).toMatchObject({ kind: 'disabled' });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('does not send to a suppressed address, and keeps that permanent: retrying cannot make it deliverable', async () => {
    mocks.systemRows.mockResolvedValue([{ hash: addressSha256(input.recipientEmail) }]);
    expect(await deliverDeadlineReminderEmail(input)).toMatchObject({ kind: 'permanent_failure', code: 'ADDRESS_SUPPRESSED' });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('retries, rather than dead-letters, a reminder when the suppression list cannot be read, and still sends nothing unchecked', async () => {
    mocks.systemRows.mockRejectedValue(new Error('connection terminated'));
    expect(await deliverDeadlineReminderEmail(input)).toMatchObject({ kind: 'transient_failure', code: 'SUPPRESSION_CHECK_UNAVAILABLE' });
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
