import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'crypto';
import { NextRequest } from 'next/server';
import type { PGlite } from '@electric-sql/pglite';
import { campaigns, communicationPreferences, consentRecords, messageLog } from '@/db/schema';
import { notificationDeliveryLog } from '@/db/schema/domains/communications';
import { createTableDatabase } from './support/pglite-tables';

// The Resend webhook against a real SQL engine. Provider events are redelivered and arrive out of order, so these tests pin
// what the stored row, the campaign statistics and the recipient's consent state do when that happens.

const state = vi.hoisted(() => ({ db: null as any, event: null as unknown, audit: null as null | (() => Promise<void>) }));

vi.mock('@/db', async () => {
  const { lateBoundDb } = await import('./support/pglite-tables');
  return { db: lateBoundDb(state) };
});
// A real transaction, so a failure part-way rolls back everything the handler had already written.
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: async (fn: (tx: unknown) => Promise<unknown>) => state.db.transaction((tx: unknown) => fn(tx)),
}));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
const audit = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: audit }));
vi.mock('resend', () => ({
  Resend: class {
    webhooks = { verify: () => state.event };
  },
}));

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const CAMPAIGN = '33333333-3333-4333-8333-333333333333';

let pg: PGlite;

async function insertCampaign(id: string, organizationId: string) {
  await pg.query(
    `INSERT INTO campaigns (id, organization_id, name, type, channel, status, stats, created_by)
     VALUES ($1, $2, 'campaign', 'broadcast', 'email', 'draft', '{}'::jsonb, 'user-1')`,
    [id, organizationId],
  );
}

async function insertLog(organizationId: string, recipientId: string, providerMessageId: string, status = 'sent') {
  const id = crypto.randomUUID();
  await pg.query(
    `INSERT INTO message_log (id, organization_id, campaign_id, recipient_id, channel_type, provider_message_id, status)
     VALUES ($1, $2, $3, $4, 'email', $5, $6)`,
    [id, organizationId, organizationId === ORG_A ? CAMPAIGN : null, recipientId, providerMessageId, status],
  );
  return id;
}

async function row(id: string) {
  return (await pg.query<{
    status: string; sent_at: string | null; delivered_at: string | null; opened_at: string | null; bounced_at: string | null;
    error_message: string | null; metadata: Record<string, unknown>;
  }>('SELECT status, sent_at, delivered_at, opened_at, bounced_at, error_message, metadata FROM message_log WHERE id = $1', [id])).rows[0];
}
const stats = async () => (await pg.query<{ stats: Record<string, number> }>('SELECT stats FROM campaigns WHERE id = $1', [CAMPAIGN])).rows[0].stats;
const count = async (table: string) => Number((await pg.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${table}`)).rows[0].n);

async function send(type: string, providerId: string, extra: Record<string, unknown> = {}, svixId = crypto.randomUUID()) {
  state.event = { type, created_at: '2026-01-01T00:00:00.000Z', data: { email_id: providerId, to: ['u@example.com'], ...extra } };
  const { POST } = await import('../communications/webhooks/resend/route');
  return POST(new NextRequest('http://localhost/api/communications/webhooks/resend', {
    method: 'POST',
    body: '{}',
    headers: { 'svix-id': svixId, 'svix-timestamp': String(Date.now()), 'svix-signature': 'sig' },
  }));
}

beforeAll(async () => {
  const created = await createTableDatabase([campaigns, messageLog, communicationPreferences, consentRecords, notificationDeliveryLog]);
  pg = created.pg;
  state.db = created.db;
  process.env.RESEND_API_KEY = 're_test';
  process.env.RESEND_WEBHOOK_SECRET = 'whsec_test';
});
afterAll(async () => {
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_WEBHOOK_SECRET;
  await pg.close();
});
beforeEach(async () => {
  audit.mockReset();
  audit.mockResolvedValue(undefined);
  await pg.exec('TRUNCATE consent_records, communication_preferences, message_log, campaigns, notification_delivery_log');
  await insertCampaign(CAMPAIGN, ORG_A);
});

describe('resend webhook — redelivery', () => {
  it('counts a message once however many times the same event is redelivered', async () => {
    const id = await insertLog(ORG_A, 'r1', 'prov-1');
    for (const svixId of ['evt-a', 'evt-a', 'evt-b']) {
      expect((await send('email.failed', 'prov-1', { failed: { reason: 'mailbox_full' } }, svixId)).status).toBe(200);
    }
    expect(await stats()).toEqual({ failed: 1 });
    expect((await row(id)).error_message).toBe('mailbox_full');
  });

  it('counts a delivery once and fills the timestamp once', async () => {
    const id = await insertLog(ORG_A, 'r1', 'prov-2');
    await send('email.delivered', 'prov-2');
    await send('email.delivered', 'prov-2');
    expect(await stats()).toEqual({ delivered: 1 });
    expect((await row(id)).status).toBe('delivered');
  });

  it('adds to counters another event has already advanced instead of overwriting them', async () => {
    await pg.query(`UPDATE campaigns SET stats = '{"delivered": 41, "sent": 50}'::jsonb WHERE id = $1`, [CAMPAIGN]);
    await insertLog(ORG_A, 'r1', 'prov-3');
    await send('email.delivered', 'prov-3');
    expect(await stats()).toEqual({ delivered: 42, sent: 50 });
  });
});

describe('resend webhook — out-of-order events', () => {
  it('never lets a late sent, delivered or opened event overwrite a bounce', async () => {
    const id = await insertLog(ORG_A, 'r1', 'prov-4', 'queued');
    await send('email.bounced', 'prov-4');
    for (const late of ['email.sent', 'email.delivered', 'email.opened']) await send(late, 'prov-4');

    const after = await row(id);
    expect(after.status).toBe('bounced');
    // the late events are still facts about the message
    expect(after.sent_at).not.toBeNull();
    expect(after.delivered_at).not.toBeNull();
    expect(after.opened_at).not.toBeNull();
    expect(after.bounced_at).not.toBeNull();
    expect(await stats()).toEqual({ bounced: 1, sent: 1, delivered: 1, opened: 1 });
  });

  it('lets a complaint follow a delivery, and keeps it after later events', async () => {
    const id = await insertLog(ORG_A, 'r1', 'prov-5');
    await send('email.delivered', 'prov-5');
    await send('email.complained', 'prov-5');
    await send('email.opened', 'prov-5');
    expect((await row(id)).status).toBe('complained');
  });

  it('keeps a click above an open, and counts the open a click implies once', async () => {
    const id = await insertLog(ORG_A, 'r1', 'prov-6');
    await send('email.clicked', 'prov-6');
    await send('email.opened', 'prov-6');
    expect((await row(id)).status).toBe('clicked');
    expect(await stats()).toEqual({ clicked: 1, opened: 1 });
  });

  it('keeps what the row already stores in its metadata', async () => {
    const id = await insertLog(ORG_A, 'r1', 'prov-7');
    await pg.query(`UPDATE message_log SET metadata = '{"campaignStep": 3}'::jsonb WHERE id = $1`, [id]);
    await send('email.delivered', 'prov-7');
    expect((await row(id)).metadata).toMatchObject({ campaignStep: 3, resendEventType: 'email.delivered', resendCounted: ['delivered'] });
  });
});

describe('resend webhook — suppression', () => {
  it('creates the preference row when the recipient never had one, with a consent record and an audit entry', async () => {
    await insertLog(ORG_A, 'r-new', 'prov-8');
    expect((await send('email.complained', 'prov-8')).status).toBe(200);

    const prefs = await pg.query<{ email_enabled: boolean; globally_unsubscribed: boolean; unsubscribe_reason: string }>(
      `SELECT email_enabled, globally_unsubscribed, unsubscribe_reason FROM communication_preferences WHERE organization_id = $1 AND user_id = 'r-new'`, [ORG_A]);
    expect(prefs.rows).toEqual([{ email_enabled: false, globally_unsubscribed: true, unsubscribe_reason: 'complaint' }]);
    const consent = await pg.query<{ status: string; channel: string; method: string }>('SELECT status, channel, method FROM consent_records');
    expect(consent.rows).toEqual([{ status: 'revoked', channel: 'email', method: 'provider_webhook' }]);
    expect(audit).toHaveBeenCalledTimes(1);
  });

  it('applies a redelivered suppression once: one consent record, one audit entry, one count', async () => {
    await insertLog(ORG_A, 'r-dup', 'prov-9');
    await send('email.suppressed', 'prov-9', {}, 'evt-1');
    await send('email.suppressed', 'prov-9', {}, 'evt-1');
    expect(await count('consent_records')).toBe(1);
    expect(await count('communication_preferences')).toBe(1);
    expect(audit).toHaveBeenCalledTimes(1);
    expect(await stats()).toEqual({ unsubscribed: 1 });
  });

  it('suppresses only the organization that owns the message', async () => {
    await insertLog(ORG_A, 'shared-recipient', 'prov-10');
    await pg.query(
      `INSERT INTO communication_preferences (id, organization_id, user_id, email_enabled) VALUES ($1, $2, 'shared-recipient', true)`,
      [crypto.randomUUID(), ORG_B]);
    await send('email.complained', 'prov-10');
    const other = await pg.query<{ email_enabled: boolean }>('SELECT email_enabled FROM communication_preferences WHERE organization_id = $1', [ORG_B]);
    expect(other.rows).toEqual([{ email_enabled: true }]);
  });

  it('rolls back the row, the statistics, the preference and the consent record when the audit entry cannot be written', async () => {
    const id = await insertLog(ORG_A, 'r-rb', 'prov-11');
    audit.mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(send('email.complained', 'prov-11')).rejects.toThrow('audit unavailable');

    expect((await row(id)).status).toBe('sent');
    expect(await stats()).toEqual({});
    expect(await count('communication_preferences')).toBe(0);
    expect(await count('consent_records')).toBe(0);

    // the provider's retry then applies it, exactly once
    expect((await send('email.complained', 'prov-11')).status).toBe(200);
    expect(await count('consent_records')).toBe(1);
    expect(await stats()).toEqual({ complained: 1 });
  });
});

describe('resend webhook — events that match no message', () => {
  it('asks the provider to retry instead of acknowledging an event it could not place', async () => {
    const response = await send('email.delivered', 'not-stored-yet');
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ retryable: true });
  });

  it('applies the event on the provider retry once the sender has stored the provider message id', async () => {
    expect((await send('email.delivered', 'late-id', {}, 'evt-r')).status).toBe(404);
    const id = await insertLog(ORG_A, 'r1', 'late-id', 'queued');
    expect((await send('email.delivered', 'late-id', {}, 'evt-r')).status).toBe(200);
    expect((await row(id)).status).toBe('delivered');
  });

  it('refuses to guess the organization when two rows carry the same provider message id', async () => {
    const a = await insertLog(ORG_A, 'r1', 'dup-id');
    const b = await insertLog(ORG_B, 'r2', 'dup-id');
    const response = await send('email.delivered', 'dup-id');
    expect(response.status).toBe(409);
    expect((await row(a)).status).toBe('sent');
    expect((await row(b)).status).toBe('sent');
    expect(await stats()).toEqual({});
  });
});
