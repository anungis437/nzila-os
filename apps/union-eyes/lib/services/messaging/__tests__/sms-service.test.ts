import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/decimal-safe', () => ({
  moneyToNumber: vi.fn((v: string) => parseFloat(v)),
}));

import {
  SMSService,
  TwilioAdapter,
  MockSMSAdapter,
  type SMSProvider,
  type SMSMessage,
  type SMSResult,
} from '../sms-service';
import { logger } from '@/lib/logger';

function createMockProvider(overrides: Partial<SMSProvider> = {}): SMSProvider {
  return {
    name: 'test-sms',
    send: vi.fn<(msg: SMSMessage) => Promise<SMSResult>>().mockResolvedValue({ success: true, messageId: 'sms-1', provider: 'test-sms' }),
    sendBatch: vi.fn<(msgs: SMSMessage[]) => Promise<SMSResult[]>>().mockResolvedValue([{ success: true, messageId: 'sms-1' }]),
    verifyConnection: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
    checkBalance: vi.fn<() => Promise<number>>().mockResolvedValue(100),
    ...overrides,
  };
}

const validMsg: SMSMessage = { to: '+15551234567', body: 'Hello' };

describe('SMSService', () => {
  let primary: SMSProvider;
  let fallback: SMSProvider;
  let service: SMSService;

  beforeEach(() => {
    vi.clearAllMocks();
    primary = createMockProvider();
    fallback = createMockProvider({ name: 'fallback-sms' });
    service = new SMSService(primary, fallback);
  });

  describe('send', () => {
    it('sends via primary and returns messageId', async () => {
      const id = await service.send(validMsg);
      expect(id).toBe('sms-1');
      expect(primary.send).toHaveBeenCalledWith(validMsg);
    });

    it('rejects invalid E.164 phone numbers', async () => {
      await expect(service.send({ to: '555-1234', body: 'Hi' }))
        .rejects.toThrow('Invalid phone number format');
    });

    it('rejects messages longer than 1600 characters', async () => {
      await expect(service.send({ to: '+15551234567', body: 'a'.repeat(1601) }))
        .rejects.toThrow('SMS message too long');
    });

    it('falls back when primary fails', async () => {
      (primary.send as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false, error: 'out' });
      (fallback.send as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, messageId: 'fb-1' });

      const id = await service.send(validMsg);
      expect(id).toBe('fb-1');
      expect(logger.warn).toHaveBeenCalled();
    });

    it('throws when both providers fail', async () => {
      (primary.send as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false, error: 'e1' });
      (fallback.send as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false, error: 'e2' });

      await expect(service.send(validMsg)).rejects.toThrow('e2');
    });

    it('throws when primary fails with no fallback', async () => {
      const noFb = new SMSService(primary);
      (primary.send as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false, error: 'solo' });
      await expect(noFb.send(validMsg)).rejects.toThrow('solo');
    });
  });

  describe('sendBatch', () => {
    it('validates all numbers before sending', async () => {
      await expect(service.sendBatch([
        { to: '+15551234567', body: 'ok' },
        { to: 'bad', body: 'nope' },
      ])).rejects.toThrow('Invalid phone number in batch');
    });

    it('sends batch via primary', async () => {
      const msgs = [validMsg, { ...validMsg, to: '+15559876543' }];
      await service.sendBatch(msgs);
      expect(primary.sendBatch).toHaveBeenCalledWith(msgs);
    });

    it('falls back on batch error', async () => {
      (primary.sendBatch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('batch'));
      (fallback.sendBatch as ReturnType<typeof vi.fn>).mockResolvedValue([{ success: true }]);

      const results = await service.sendBatch([validMsg]);
      expect(results).toHaveLength(1);
    });
  });

  describe('verifyConnection', () => {
    it('returns true on success', async () => {
      expect(await service.verifyConnection()).toBe(true);
    });

    it('returns false on error', async () => {
      (primary.verifyConnection as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('x'));
      expect(await service.verifyConnection()).toBe(false);
    });
  });

  describe('checkBalance', () => {
    it('returns balance from provider', async () => {
      expect(await service.checkBalance()).toBe(100);
    });

    it('returns null when provider has no checkBalance', async () => {
      const noBalance = createMockProvider();
      delete noBalance.checkBalance;
      const svc = new SMSService(noBalance);
      expect(await svc.checkBalance()).toBeNull();
    });

    it('returns null on error', async () => {
      (primary.checkBalance as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('x'));
      expect(await service.checkBalance()).toBeNull();
    });
  });

  describe('calculateSegments', () => {
    it('returns 1 for short GSM messages', () => {
      expect(service.calculateSegments('Hello')).toBe(1);
    });

    it('returns 1 for exactly 160 chars', () => {
      expect(service.calculateSegments('a'.repeat(160))).toBe(1);
    });

    it('calculates multiple segments for long messages', () => {
      expect(service.calculateSegments('a'.repeat(320))).toBe(3); // ceil(320/153)
    });

    it('uses unicode segment sizes for non-ASCII', () => {
      // 71 chars of unicode = 2 segments (70 single, 67 concat)
      expect(service.calculateSegments('é'.repeat(71))).toBe(2);
    });
  });
});

describe('TwilioAdapter', () => {
  let adapter: TwilioAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new TwilioAdapter('AC_test', 'auth_token', '+15550001111');
    global.fetch = vi.fn();
  });

  it('has name "twilio"', () => {
    expect(adapter.name).toBe('twilio');
  });

  it('sends SMS via Twilio API', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sid: 'SM123', num_segments: 1 }),
    });

    const result = await adapter.send(validMsg);
    expect(result.success).toBe(true);
    expect(result.messageId).toBe('SM123');
    expect(result.segments).toBe(1);
  });

  it('returns error on non-ok response', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: 'Bad number' }),
    });

    const result = await adapter.send(validMsg);
    expect(result.success).toBe(false);
  });

  it('handles network errors', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('timeout'));
    const result = await adapter.send(validMsg);
    expect(result.success).toBe(false);
    expect(result.error).toBe('timeout');
  });

  it('verifyConnection checks account', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    expect(await adapter.verifyConnection()).toBe(true);
  });
});

describe('MockSMSAdapter', () => {
  it('stores sent messages', async () => {
    const mock = new MockSMSAdapter();
    await mock.send(validMsg);
    expect(mock.getSentMessages()).toHaveLength(1);
  });

  it('clears stored messages', async () => {
    const mock = new MockSMSAdapter();
    await mock.send(validMsg);
    mock.clear();
    expect(mock.getSentMessages()).toHaveLength(0);
  });

  it('checkBalance returns 1000', async () => {
    const mock = new MockSMSAdapter();
    expect(await mock.checkBalance()).toBe(1000);
  });
});
