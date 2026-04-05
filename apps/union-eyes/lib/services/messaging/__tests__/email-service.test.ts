import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockResendSend = vi.hoisted(() => vi.fn());

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/email-service', () => ({
  getResendClient: () => ({ emails: { send: mockResendSend } }),
  getFromEmail: (label?: string) => label ? `${label} <noreply@unioneyes.app>` : 'noreply@unioneyes.app',
}));

import {
  EmailService,
  ResendAdapter,
  SendGridAdapter,
  type EmailProvider,
  type EmailMessage,
  type SendResult,
} from '../email-service';
import { logger } from '@/lib/logger';

// === Helpers ===
function createMockProvider(overrides: Partial<EmailProvider> = {}): EmailProvider {
  return {
    name: 'test-provider',
    send: vi.fn<(msg: EmailMessage) => Promise<SendResult>>().mockResolvedValue({ success: true, messageId: 'msg-1', provider: 'test' }),
    sendBatch: vi.fn<(msgs: EmailMessage[]) => Promise<SendResult[]>>().mockResolvedValue([{ success: true, messageId: 'msg-1', provider: 'test' }]),
    verifyConnection: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
    ...overrides,
  };
}

const testMessage: EmailMessage = {
  to: 'user@example.com',
  subject: 'Test',
  body: 'Hello',
};

describe('EmailService', () => {
  let primary: EmailProvider;
  let fallback: EmailProvider;
  let service: EmailService;

  beforeEach(() => {
    vi.clearAllMocks();
    primary = createMockProvider();
    fallback = createMockProvider({ name: 'fallback-provider' });
    service = new EmailService(primary, fallback);
  });

  describe('send', () => {
    it('sends via primary provider and returns messageId', async () => {
      const id = await service.send(testMessage);
      expect(id).toBe('msg-1');
      expect(primary.send).toHaveBeenCalledWith(testMessage);
    });

    it('falls back when primary fails', async () => {
      (primary.send as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false, error: 'down' });
      (fallback.send as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, messageId: 'fb-1' });

      const id = await service.send(testMessage);
      expect(id).toBe('fb-1');
      expect(logger.warn).toHaveBeenCalled();
    });

    it('throws when both primary and fallback fail', async () => {
      (primary.send as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false, error: 'fail1' });
      (fallback.send as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false, error: 'fail2' });

      await expect(service.send(testMessage)).rejects.toThrow('fail2');
    });

    it('throws when primary fails and no fallback configured', async () => {
      const noFallbackService = new EmailService(primary);
      (primary.send as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false, error: 'oops' });

      await expect(noFallbackService.send(testMessage)).rejects.toThrow('oops');
    });

    it('returns empty string when messageId is missing', async () => {
      (primary.send as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
      const id = await service.send(testMessage);
      expect(id).toBe('');
    });
  });

  describe('sendBatch', () => {
    it('sends batch via primary provider', async () => {
      const msgs = [testMessage, { ...testMessage, to: 'b@x.com' }];
      await service.sendBatch(msgs);
      expect(primary.sendBatch).toHaveBeenCalledWith(msgs);
    });

    it('falls back on batch failure', async () => {
      (primary.sendBatch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('batch fail'));
      (fallback.sendBatch as ReturnType<typeof vi.fn>).mockResolvedValue([{ success: true }]);

      const results = await service.sendBatch([testMessage]);
      expect(results).toHaveLength(1);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('throws when batch fails and no fallback', async () => {
      const noFallbackService = new EmailService(primary);
      (primary.sendBatch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('no go'));

      await expect(noFallbackService.sendBatch([testMessage])).rejects.toThrow('no go');
    });
  });

  describe('verifyConnection', () => {
    it('returns true on success', async () => {
      const result = await service.verifyConnection();
      expect(result).toBe(true);
    });

    it('returns false on error', async () => {
      (primary.verifyConnection as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
      const result = await service.verifyConnection();
      expect(result).toBe(false);
    });
  });
});

describe('ResendAdapter', () => {
  let adapter: ResendAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new ResendAdapter(undefined, 'from@test.com');
    mockResendSend.mockResolvedValue({ data: { id: 'resend-msg-1' }, error: null });
  });

  it('has name "resend"', () => {
    expect(adapter.name).toBe('resend');
  });

  it('sends email via Resend SDK', async () => {
    const result = await adapter.send(testMessage);
    expect(result.success).toBe(true);
    expect(result.messageId).toBe('resend-msg-1');
    expect(result.provider).toBe('resend');
  });

  it('returns error on SDK error', async () => {
    mockResendSend.mockResolvedValue({ data: null, error: { message: 'Invalid recipient' } });

    const result = await adapter.send(testMessage);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid recipient');
  });

  it('handles send exceptions', async () => {
    mockResendSend.mockRejectedValue(new Error('Network error'));

    const result = await adapter.send(testMessage);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
  });

  it('verifyConnection returns true when client exists', async () => {
    const ok = await adapter.verifyConnection();
    expect(ok).toBe(true);
  });
});

describe('SendGridAdapter', () => {
  let adapter: SendGridAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new SendGridAdapter('sg_test_key');
    global.fetch = vi.fn();
  });

  it('has name "sendgrid"', () => {
    expect(adapter.name).toBe('sendgrid');
  });

  it('sends email via SendGrid API', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      headers: { get: () => 'sg-msg-1' },
      json: () => Promise.resolve({}),
    });

    const result = await adapter.send(testMessage);
    expect(result.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.sendgrid.com/v3/mail/send',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
