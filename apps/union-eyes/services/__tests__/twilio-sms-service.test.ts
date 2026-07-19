import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
  process.env.TWILIO_ACCOUNT_SID = 'AC_test';
  process.env.TWILIO_AUTH_TOKEN = 'tok_test';
  process.env.TWILIO_PHONE_NUMBER = '+15550000000';
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.test';
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;

  const queue: unknown[] = [];
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    const methods = [
      'select', 'from', 'where', 'limit', 'orderBy', 'groupBy',
      'innerJoin', 'leftJoin', 'insert', 'update', 'set', 'values', 'returning', 'delete',
    ];
    for (const m of methods) chain[m] = vi.fn(() => chain);
    (chain as { then: unknown }).then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
      const item = queue.length ? queue.shift() : [];
      if (item instanceof Error) return Promise.reject(item).catch(reject);
      return Promise.resolve(item).then(resolve);
    };
    return chain;
  };
  const db = {
    select: vi.fn(() => makeChain()),
    insert: vi.fn(() => makeChain()),
    update: vi.fn(() => makeChain()),
    delete: vi.fn(() => makeChain()),
  };
  const twilioCreate = vi.fn(async () => ({ sid: 'SM_NEW' }));
  return { queue, db, twilioCreate };
});

const pushSel = (...items: unknown[]) => { h.queue.push(...items); };

vi.mock('@/db', () => ({ db: h.db }));
vi.mock('twilio', () => ({ default: vi.fn(() => ({ messages: { create: h.twilioCreate } })) }));
vi.mock('@upstash/redis', () => ({ Redis: class { get = vi.fn(); pipeline = vi.fn(); } }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/db/schema/domains/communications', () => new Proxy({}, {
  has: () => true,
  get: (_t, n) => (n === '__esModule' ? false : new Proxy({}, { get: (_o, c) => ({ __col: c }) })),
}));
vi.mock('@/db/schema-organizations', () => new Proxy({}, {
  has: () => true,
  get: (_t, n) => (n === '__esModule' ? false : new Proxy({}, { get: (_o, c) => ({ __col: c }) })),
}));
vi.mock('drizzle-orm', async (orig) => ({
  ...(await (orig() as Promise<Record<string, unknown>>)),
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  sql: vi.fn(() => ({})),
}));

import {
  validatePhoneNumber,
  calculateSmsSegments,
  calculateSmsCost,
  renderSmsTemplate,
  isPhoneOptedOut,
  sendSms,
  sendBulkSms,
  handleTwilioWebhook,
  handleInboundSms,
  handleOptOut,
  getSmsTemplate,
  renderSmsFromTemplate,
} from '../twilio-sms-service';

beforeEach(() => {
  h.queue.length = 0;
  h.db.select.mockClear();
  h.db.insert.mockClear();
  h.db.update.mockClear();
  h.db.delete.mockClear();
  h.twilioCreate.mockReset();
  h.twilioCreate.mockResolvedValue({ sid: 'SM_NEW' });
});

describe('twilio-sms-service helpers', () => {
  it('validatePhoneNumber validates E.164', () => {
    expect(validatePhoneNumber('+14155552671')).toBe(true);
    expect(validatePhoneNumber('notaphone')).toBe(false);
  });

  it('calculateSmsSegments handles empty, single and multi-segment', () => {
    expect(calculateSmsSegments('')).toBe(0);
    expect(calculateSmsSegments('hi')).toBe(1);
    expect(calculateSmsSegments('x'.repeat(200))).toBe(2);
  });

  it('calculateSmsCost multiplies segments by per-segment cost', () => {
    expect(calculateSmsCost('hi')).toBeCloseTo(0.0075);
  });

  it('renderSmsTemplate substitutes variables', () => {
    expect(renderSmsTemplate('Hi ${name}', { name: 'Jo' })).toBe('Hi Jo');
  });
});

describe('isPhoneOptedOut', () => {
  it('returns true when an opt-out row exists', async () => {
    pushSel([{ id: 'o1' }]);
    expect(await isPhoneOptedOut('org1', '+14155552671')).toBe(true);
  });

  it('returns false when no opt-out exists', async () => {
    pushSel([]);
    expect(await isPhoneOptedOut('org1', '+14155552671')).toBe(false);
  });
});

describe('sendSms', () => {
  const base = { organizationId: 'org1', userId: 'u1', phoneNumber: '+14155552671', message: 'hello' };

  it('fails without an organizationId', async () => {
    const r = await sendSms({ ...base, organizationId: undefined });
    expect(r.success).toBe(false);
    expect(r.error).toContain('organizationId');
  });

  it('fails for an invalid phone number', async () => {
    const r = await sendSms({ ...base, phoneNumber: 'bad' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('E.164');
  });

  it('fails when the number has opted out', async () => {
    pushSel([{ id: 'o1' }]); // isPhoneOptedOut → true
    const r = await sendSms(base);
    expect(r.success).toBe(false);
    expect(r.error).toContain('opted out');
  });

  it('sends successfully and records the message', async () => {
    pushSel([], [{ id: 'm1' }], []); // optout none, insert returning, update
    const r = await sendSms(base);
    expect(r.success).toBe(true);
    expect(r.twilioSid).toBe('SM_NEW');
    expect(h.twilioCreate).toHaveBeenCalledOnce();
  });

  it('records a failure when Twilio throws', async () => {
    const err = Object.assign(new Error('twilio down'), { code: 'E500' });
    h.twilioCreate.mockRejectedValueOnce(err);
    pushSel([], [{ id: 'm1' }], []); // optout none, insert returning, catch insert
    const r = await sendSms(base);
    expect(r.success).toBe(false);
    expect(r.error).toBe('twilio down');
  });
});

describe('sendBulkSms', () => {
  it('fails everything when organizationId is missing', async () => {
    const r = await sendBulkSms({
      userId: 'u1',
      organizationId: undefined,
      recipients: [{ phoneNumber: '+14155552671' }],
      message: 'hi',
    });
    expect(r.success).toBe(false);
    expect(r.failed).toBe(1);
    expect(r.errors[0].error).toContain('organizationId');
  });

  it('sends to valid recipients and reports failures', async () => {
    pushSel([], [{ id: 'm1' }], []); // first recipient: optout none, insert, update
    const r = await sendBulkSms({
      organizationId: 'org1',
      userId: 'u1',
      recipients: [{ phoneNumber: '+14155552671' }, { phoneNumber: 'bad' }],
      message: 'hi',
    });
    expect(r.sent).toBe(1);
    expect(r.failed).toBe(1);
  });
});

describe('handleTwilioWebhook', () => {
  it('returns when the message is not found', async () => {
    pushSel([]);
    await handleTwilioWebhook({ MessageSid: 'SM1', MessageStatus: 'delivered', To: 'a', From: 'b' });
    expect(h.db.update).not.toHaveBeenCalled();
  });

  it('updates a delivered message without a campaign', async () => {
    pushSel([{ id: 'm1', campaignId: null }], []); // select, update
    await handleTwilioWebhook({ MessageSid: 'SM1', MessageStatus: 'delivered', To: 'a', From: 'b' });
    expect(h.db.update).toHaveBeenCalled();
  });

  it('updates a failed campaign message and refreshes campaign stats', async () => {
    pushSel(
      [{ id: 'm1', campaignId: 'c1' }], // select message
      [], // update message
      [{ sent: 2, delivered: 1, failed: 1, totalCost: 0.5 }], // campaign stats select
      [], // campaign update
    );
    await handleTwilioWebhook({ MessageSid: 'SM1', MessageStatus: 'failed', To: 'a', From: 'b', ErrorCode: '30001', ErrorMessage: 'oops' });
    expect(h.db.update).toHaveBeenCalled();
  });
});

describe('handleInboundSms', () => {
  it('returns when no organization resolves', async () => {
    pushSel([]); // resolveOrganizationIdFromPhoneNumber → none
    await handleInboundSms({ MessageSid: 'SM1', MessageStatus: 'received', To: '+15550000000', From: '+14155552671', Body: 'hi' });
    expect(h.db.insert).not.toHaveBeenCalled();
  });

  it('handles an opt-out keyword', async () => {
    pushSel([{ id: 'org1' }]); // org resolved
    await handleInboundSms({ MessageSid: 'SM1', MessageStatus: 'received', To: '+15550000000', From: '+14155552671', Body: 'STOP' });
    expect(h.db.insert).not.toHaveBeenCalled();
  });

  it('stores a normal inbound message and auto-replies', async () => {
    pushSel([{ id: 'org1' }], []); // org resolved, insert conversation
    await handleInboundSms({ MessageSid: 'SM1', MessageStatus: 'received', To: '+15550000000', From: '+14155552671', Body: 'help me' });
    expect(h.db.insert).toHaveBeenCalled();
    expect(h.twilioCreate).toHaveBeenCalledOnce();
  });
});

describe('handleOptOut', () => {
  it('returns early when already opted out', async () => {
    pushSel([{ id: 'o1' }]); // isPhoneOptedOut → true
    await handleOptOut('org1', '+14155552671');
    expect(h.db.insert).not.toHaveBeenCalled();
  });

  it('records a new opt-out and confirms', async () => {
    pushSel([], []); // isPhoneOptedOut none, insert opt-out
    await handleOptOut('org1', '+14155552671', 'reply_stop');
    expect(h.db.insert).toHaveBeenCalled();
    expect(h.twilioCreate).toHaveBeenCalledOnce();
  });
});

describe('templates', () => {
  it('getSmsTemplate returns a template', async () => {
    pushSel([{ id: 't1', messageTemplate: 'Hi ${name}' }]);
    const r = await getSmsTemplate('t1', 'org1');
    expect(r).toEqual({ id: 't1', messageTemplate: 'Hi ${name}' });
  });

  it('renderSmsFromTemplate returns null when the template is missing', async () => {
    pushSel([]);
    expect(await renderSmsFromTemplate('t1', 'org1', { name: 'Jo' })).toBeNull();
  });

  it('renderSmsFromTemplate renders the template', async () => {
    pushSel([{ id: 't1', messageTemplate: 'Hi ${name}' }]);
    expect(await renderSmsFromTemplate('t1', 'org1', { name: 'Jo' })).toBe('Hi Jo');
  });
});
