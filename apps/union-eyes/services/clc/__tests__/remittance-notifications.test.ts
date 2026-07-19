import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'from', 'where', 'limit', 'orderBy', 'innerJoin', 'leftJoin', 'set', 'values', 'returning', 'insert', 'update', 'delete']) {
      chain[m] = () => chain;
    }
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const v = queue.length ? queue.shift() : [];
      return (v instanceof Error ? Promise.reject(v) : Promise.resolve(v)).then(res, rej);
    };
    return chain;
  };
  const db = { select: () => makeChain(), insert: () => makeChain() };
  return {
    queue,
    db,
    sendResendEmail: vi.fn(async () => ({ success: true, messageId: 'm1' })),
    sendSms: vi.fn(async () => ({ success: true, twilioSid: 't1' })),
  };
});

vi.mock('@/db', () => ({ db: h.db }));
vi.mock('@/db/schema', () => new Proxy({}, {
  has: () => true,
  get: (_t, n) => (n === '__esModule' ? false : new Proxy({}, { get: (_o, c) => ({ __col: c }) })),
}));
vi.mock('@/lib/email-service', () => ({
  getFromEmail: vi.fn(() => 'CLC <noreply@clc.ca>'),
  sendResendEmail: h.sendResendEmail,
}));
vi.mock('@/services/twilio-sms-service', () => ({ sendSms: h.sendSms }));
vi.mock('drizzle-orm', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  lte: vi.fn(() => ({})),
  isNull: vi.fn(() => ({})),
}));

import {
  sendOverdueAlert,
  sendPaymentConfirmation,
  sendMonthlyReminder,
  sendExecutiveEscalation,
  sendBulkMonthlyReminders,
  processOverdueRemittances,
} from '../remittance-notifications';

const push = (...items: unknown[]) => h.queue.push(...items);
const daysAgo = (n: number) => new Date(Date.now() - (n * 86400000 + 3600000)).toISOString();

const fetchRow = (over: Record<string, unknown> = {}) => [{
  remittance: {
    id: 'r1', organizationId: 'o1', dueDate: daysAgo(30), paidDate: null,
    remittanceYear: 2024, remittanceMonth: 3, totalAmount: '450', remittableMembers: 90, status: 'pending',
    ...over,
  },
  organization: { id: 'o1', name: 'Local 1', charterNumber: 'CH1' },
}];
const contacts = () => [{ name: 'Alice', email: 'alice@x.com', phone: '+15550000', isPrimary: true }];

beforeEach(() => {
  h.queue.length = 0;
  h.sendResendEmail.mockReset().mockResolvedValue({ success: true, messageId: 'm1' });
  h.sendSms.mockReset().mockResolvedValue({ success: true, twilioSid: 't1' });
});

describe('sendOverdueAlert', () => {
  it('sends a critical (30-day) alert across email and SMS plus executive', async () => {
    push(fetchRow(), contacts(), []);
    const results = await sendOverdueAlert('r1', 30);
    expect(results.some((r) => r.channel === 'email')).toBe(true);
    expect(results.some((r) => r.channel === 'sms')).toBe(true);
  });

  it('sends an email-only 7-day alert', async () => {
    push(fetchRow(), contacts(), []);
    const results = await sendOverdueAlert('r1', 7);
    expect(results.every((r) => r.channel === 'email')).toBe(true);
  });

  it('sends a 14-day alert', async () => {
    push(fetchRow(), contacts(), []);
    const results = await sendOverdueAlert('r1', 14);
    expect(results.length).toBeGreaterThan(0);
  });

  it('throws when the remittance is not found', async () => {
    push([]);
    await expect(sendOverdueAlert('r1', 30)).rejects.toThrow('not found');
  });

  it('records email failures in the results', async () => {
    h.sendResendEmail.mockResolvedValueOnce({ success: false, error: 'bounced' });
    push(fetchRow(), contacts(), []);
    const results = await sendOverdueAlert('r1', 7);
    expect(results[0].success).toBe(false);
  });
});

describe('sendPaymentConfirmation', () => {
  it('sends a payment confirmation', async () => {
    push(fetchRow({ paidDate: '2024-04-01' }), contacts(), []);
    const results = await sendPaymentConfirmation('r1');
    expect(results.length).toBeGreaterThan(0);
  });

  it('throws when the remittance is not found', async () => {
    push([]);
    await expect(sendPaymentConfirmation('r1')).rejects.toThrow('not found');
  });
});

describe('sendMonthlyReminder', () => {
  it('returns empty when a remittance already exists', async () => {
    push([{ id: 'existing' }]);
    const r = await sendMonthlyReminder('o1', new Date(2025, 0, 1));
    expect(r).toEqual([]);
  });

  it('throws when the organization is not found', async () => {
    push([], []); // no existing remittance, org lookup empty
    await expect(sendMonthlyReminder('o1', new Date(2025, 0, 1))).rejects.toThrow('not found');
  });

  it('sends a reminder when no remittance exists yet', async () => {
    push([], [{ id: 'o1', name: 'Local 1', charterNumber: 'CH1' }], contacts(), []);
    const r = await sendMonthlyReminder('o1', new Date(2025, 0, 1));
    expect(r.length).toBeGreaterThan(0);
  });
});

describe('sendExecutiveEscalation', () => {
  it('returns empty when no valid remittances are found', async () => {
    push([], []); // both fetches empty
    const r = await sendExecutiveEscalation(['a', 'b']);
    expect(r).toEqual([]);
  });

  it('sends an escalation email and logs per remittance', async () => {
    push(fetchRow({ id: 'a' }), fetchRow({ id: 'b' }), [], []); // 2 fetches, then 2 log inserts
    const r = await sendExecutiveEscalation(['a', 'b']);
    expect(r[0].channel).toBe('email');
  });
});

describe('sendBulkMonthlyReminders', () => {
  it('tallies sent, skipped, and failed organizations', async () => {
    push([{ id: 'o1' }, { id: 'o2' }, { id: 'o3' }]); // allOrgs
    // o1 -> sent
    push([], [{ id: 'o1', name: 'Local 1', charterNumber: 'CH1' }], contacts(), []);
    // o2 -> skipped (existing remittance)
    push([{ id: 'existing' }]);
    // o3 -> failed (org lookup throws)
    push([], new Error('db error'));
    const result = await sendBulkMonthlyReminders(new Date(2025, 0, 1));
    expect(result.sent).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.failed).toBe(1);
  });
});

describe('processOverdueRemittances', () => {
  it('sends alerts and escalates 30-day-overdue remittances', async () => {
    push([{ id: 'r30', dueDate: daysAgo(30), paidDate: null }]); // overdue query
    // sendOverdueAlert('r30', 30): fetch, recipients, log
    push(fetchRow({ id: 'r30' }), contacts(), []);
    // sendExecutiveEscalation(['r30']): fetch, log
    push(fetchRow({ id: 'r30' }), []);
    const summary = await processOverdueRemittances();
    expect(summary.day30).toBe(1);
  });
});
