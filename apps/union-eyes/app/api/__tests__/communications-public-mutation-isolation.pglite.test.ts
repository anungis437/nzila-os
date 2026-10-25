import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'crypto';
import { NextRequest } from 'next/server';
import type { PGlite } from '@electric-sql/pglite';
import { campaigns, communicationPreferences, consentRecords, messageLog } from '@/db/schema';
import { createTableDatabase } from './support/pglite-tables';

// UE-CONV-K-006: the public/callback communications routes run with no tenant bound. Every statement derives the
// organization from the verified parent row (message log / campaign) and carries it in its own WHERE clause.

const state = vi.hoisted(() => ({
  db: null as unknown,
  event: null as unknown,
}));

vi.mock('@/db', async () => {
  const { lateBoundDb } = await import('./support/pglite-tables');
  return { db: lateBoundDb(state) };
});
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: async (fn: (tx: unknown) => Promise<unknown>) => fn(state.db),
}));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn(async () => undefined) }));
vi.mock('resend', () => ({
  Resend: class {
    webhooks = { verify: () => state.event };
  },
}));

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const CAMPAIGN_A = '33333333-3333-4333-8333-333333333333';
const CAMPAIGN_OF_B = '44444444-4444-4444-8444-444444444444';
const SECRET = 'secret';

let pg: PGlite;

function sign(payload: string) {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
}

async function insertCampaign(id: string, organizationId: string) {
  await pg.query(
    `INSERT INTO campaigns (id, organization_id, name, type, channel, status, stats, created_by)
     VALUES ($1, $2, 'campaign', 'broadcast', 'email', 'draft', '{}'::jsonb, 'user-1')`,
    [id, organizationId],
  );
}

async function insertLog(organizationId: string, campaignId: string | null, recipientId: string, providerMessageId: string, status = 'sent') {
  const id = crypto.randomUUID();
  await pg.query(
    `INSERT INTO message_log (id, organization_id, campaign_id, recipient_id, channel_type, provider_message_id, status)
     VALUES ($1, $2, $3, $4, 'email', $5, $6)`,
    [id, organizationId, campaignId, recipientId, providerMessageId, status],
  );
  return id;
}

async function insertPreference(organizationId: string, userId: string) {
  const id = crypto.randomUUID();
  await pg.query(
    `INSERT INTO communication_preferences (id, organization_id, user_id, email_enabled, globally_unsubscribed)
     VALUES ($1, $2, $3, true, false)`,
    [id, organizationId, userId],
  );
  return id;
}

async function logRow(id: string) {
  return (await pg.query<{ status: string; opened_at: string | null; clicked_at: string | null }>(
    'SELECT status, opened_at, clicked_at FROM message_log WHERE id = $1',
    [id],
  )).rows[0];
}

async function stats(id: string) {
  return (await pg.query<{ stats: Record<string, number> }>('SELECT stats FROM campaigns WHERE id = $1', [id])).rows[0].stats;
}

async function preference(id: string) {
  return (await pg.query<{ email_enabled: boolean; globally_unsubscribed: boolean }>(
    'SELECT email_enabled, globally_unsubscribed FROM communication_preferences WHERE id = $1',
    [id],
  )).rows[0];
}

beforeAll(async () => {
  const created = await createTableDatabase([campaigns, messageLog, communicationPreferences, consentRecords]);
  pg = created.pg;
  state.db = created.db;
  process.env.COMMUNICATIONS_TRACKING_SECRET = SECRET;
  process.env.RESEND_API_KEY = 're_test';
  process.env.RESEND_WEBHOOK_SECRET = 'whsec_test';
});

afterAll(async () => {
  delete process.env.COMMUNICATIONS_TRACKING_SECRET;
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_WEBHOOK_SECRET;
  await pg.close();
});

beforeEach(async () => {
  await pg.exec('TRUNCATE consent_records, communication_preferences, message_log, campaigns');
  await insertCampaign(CAMPAIGN_A, ORG_A);
  await insertCampaign(CAMPAIGN_OF_B, ORG_B);
});

describe('communications/track/click — organization-bound mutation', () => {
  const target = 'https://example.org/page';

  async function click(campaignId: string, recipientId: string, messageId: string) {
    const { GET } = await import('../communications/track/click/route');
    const token = sign(`${campaignId}:${recipientId}:${messageId}:${target}`);
    return GET(new NextRequest(`http://localhost/api/communications/track/click?campaignId=${campaignId}&recipientId=${recipientId}&messageId=${messageId}&token=${token}&url=${encodeURIComponent(target)}`));
  }

  it('records the click and bumps the campaign of the same organization', async () => {
    const id = await insertLog(ORG_A, CAMPAIGN_A, 'r1', 'prov-click-1');

    const response = await click(CAMPAIGN_A, 'r1', 'prov-click-1');

    expect(response.status).toBe(302);
    expect((await logRow(id)).status).toBe('clicked');
    expect(await stats(CAMPAIGN_A)).toMatchObject({ clicked: 1, opened: 1 });
  });

  it('does not modify a campaign owned by another organization when the log row names it', async () => {
    const id = await insertLog(ORG_A, CAMPAIGN_OF_B, 'r2', 'prov-click-2');

    const response = await click(CAMPAIGN_OF_B, 'r2', 'prov-click-2');

    expect(response.status).toBe(302);
    expect((await logRow(id)).status).toBe('clicked');
    expect(await stats(CAMPAIGN_OF_B)).toEqual({});
  });
});

describe('communications/track/open — organization-bound mutation', () => {
  async function open(campaignId: string, recipientId: string, messageId: string) {
    const { GET } = await import('../communications/track/open/[campaignId]/[recipientId]/route');
    const token = sign(`${campaignId}:${recipientId}:${messageId}`);
    return GET(
      new NextRequest(`http://localhost/api/communications/track/open/${campaignId}/${recipientId}?messageId=${messageId}&token=${token}`),
      { params: Promise.resolve({ campaignId, recipientId }) },
    );
  }

  it('records the open and bumps the campaign of the same organization', async () => {
    const id = await insertLog(ORG_A, CAMPAIGN_A, 'r1', 'prov-open-1');

    const response = await open(CAMPAIGN_A, 'r1', 'prov-open-1');

    expect(response.status).toBe(200);
    expect((await logRow(id)).status).toBe('opened');
    expect(await stats(CAMPAIGN_A)).toMatchObject({ opened: 1 });
  });

  it('does not modify a campaign owned by another organization when the log row names it', async () => {
    const id = await insertLog(ORG_A, CAMPAIGN_OF_B, 'r2', 'prov-open-2');

    const response = await open(CAMPAIGN_OF_B, 'r2', 'prov-open-2');

    expect(response.status).toBe(200);
    expect((await logRow(id)).status).toBe('opened');
    expect(await stats(CAMPAIGN_OF_B)).toEqual({});
  });
});

describe('communications/unsubscribe — organization-bound mutation', () => {
  async function unsubscribe(recipientId: string, campaignId?: string) {
    const { GET } = await import('../communications/unsubscribe/[recipientId]/route');
    const token = sign(campaignId ? `${campaignId}:${recipientId}:unsubscribe` : `${recipientId}:unsubscribe`);
    const query = `${campaignId ? `campaignId=${campaignId}&` : ''}token=${token}`;
    return GET(new NextRequest(`http://localhost/api/communications/unsubscribe/${recipientId}?${query}`), {
      params: Promise.resolve({ recipientId }),
    });
  }

  it('unsubscribes only within the organization that owns the verified campaign', async () => {
    const own = await insertLog(ORG_A, CAMPAIGN_A, 'r1', 'prov-u-1');
    const foreign = await insertLog(ORG_B, CAMPAIGN_A, 'r1', 'prov-u-2');
    const ownPref = await insertPreference(ORG_A, 'r1');
    const foreignPref = await insertPreference(ORG_B, 'r1');

    const response = await unsubscribe('r1', CAMPAIGN_A);

    expect(response.status).toBe(200);
    expect((await logRow(own)).status).toBe('unsubscribed');
    expect((await logRow(foreign)).status).toBe('sent');
    expect(await preference(ownPref)).toEqual({ email_enabled: false, globally_unsubscribed: true });
    expect(await preference(foreignPref)).toEqual({ email_enabled: true, globally_unsubscribed: false });
    expect(await stats(CAMPAIGN_A)).toMatchObject({ unsubscribed: 1 });
    const consents = await pg.query<{ organization_id: string }>('SELECT organization_id FROM consent_records');
    expect(consents.rows.map((r) => r.organization_id)).toEqual([ORG_A]);
  });

  it('without a campaign, updates only the recipient\'s own preference rows, each under its own organization', async () => {
    const prefA = await insertPreference(ORG_A, 'r1');
    const prefB = await insertPreference(ORG_B, 'r1');
    const otherUser = await insertPreference(ORG_A, 'someone-else');

    const response = await unsubscribe('r1');

    expect(response.status).toBe(200);
    expect(await preference(prefA)).toEqual({ email_enabled: false, globally_unsubscribed: true });
    expect(await preference(prefB)).toEqual({ email_enabled: false, globally_unsubscribed: true });
    expect(await preference(otherUser)).toEqual({ email_enabled: true, globally_unsubscribed: false });
  });
});

describe('communications/webhooks/resend — organization-bound mutation', () => {
  async function deliver(type: string, emailId: string) {
    state.event = { type, created_at: '2026-01-01T00:00:00.000Z', data: { email_id: emailId, to: ['member@example.org'] } };
    const { POST } = await import('../communications/webhooks/resend/route');
    return POST(new NextRequest('http://localhost/api/communications/webhooks/resend', {
      method: 'POST',
      headers: { 'svix-id': 'msg_1', 'svix-timestamp': '1', 'svix-signature': 'v1,sig' },
      body: '{}',
    }));
  }

  it('updates the log row and the campaign of the same organization', async () => {
    const id = await insertLog(ORG_A, CAMPAIGN_A, 'r1', 'prov-w-1');

    const response = await deliver('email.delivered', 'prov-w-1');

    expect(response.status).toBe(200);
    expect((await logRow(id)).status).toBe('delivered');
    expect(await stats(CAMPAIGN_A)).toMatchObject({ delivered: 1 });
  });

  it('does not modify a campaign owned by another organization when the log row names it', async () => {
    const id = await insertLog(ORG_A, CAMPAIGN_OF_B, 'r1', 'prov-w-2');

    const response = await deliver('email.delivered', 'prov-w-2');

    expect(response.status).toBe(200);
    expect((await logRow(id)).status).toBe('delivered');
    expect(await stats(CAMPAIGN_OF_B)).toEqual({});
  });

  it('suppresses only the preference of the log row\'s own organization', async () => {
    await insertLog(ORG_A, CAMPAIGN_A, 'r1', 'prov-w-3');
    const ownPref = await insertPreference(ORG_A, 'r1');
    const foreignPref = await insertPreference(ORG_B, 'r1');

    const response = await deliver('email.complained', 'prov-w-3');

    expect(response.status).toBe(200);
    expect(await preference(ownPref)).toEqual({ email_enabled: false, globally_unsubscribed: true });
    expect(await preference(foreignPref)).toEqual({ email_enabled: true, globally_unsubscribed: false });
  });
});
