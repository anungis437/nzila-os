import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { rewardWalletLedger } from '@/db/schema/domains/infrastructure/rewards';
import { inAppNotifications } from '@/db/schema/domains/communications/notifications';
import { createTableDatabase } from '@/app/api/__tests__/support/pglite-tables';

// DEF-0B11-PRP-REWARDS-CRON-EXPIRATION-TASK-READS-AN-EXPIRY...: against real SQL, who is warned, when, and for how much.

const state = vi.hoisted(() => ({ db: null as unknown, sent: [] as Array<{ recipientEmail: string; expiringAmount: number }>, failFor: null as string | null }));

vi.mock('@/db', async () => {
  const { lateBoundDb } = await import('@/app/api/__tests__/support/pglite-tables');
  return { db: lateBoundDb(state) };
});
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../email-service', () => ({
  sendAwardReceivedEmail: vi.fn(),
  sendApprovalRequestEmail: vi.fn(),
  sendRedemptionConfirmationEmail: vi.fn(),
  sendCreditExpirationEmail: async (input: { recipientEmail: string; expiringAmount: number }) => {
    if (state.failFor === input.recipientEmail) throw new Error('smtp refused');
    state.sent.push({ recipientEmail: input.recipientEmail, expiringAmount: input.expiringAmount });
  },
}));

import { getExpiringCreditsUsers, sendBatchExpirationWarnings } from '../notification-service';

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
let pg: PGlite;

const daysAhead = (days: number, hour = 12) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
};

async function earn(org: string, user: string, amount: number, expiresInDays: number, balanceAfter = amount) {
  await pg.query(
    `INSERT INTO reward_wallet_ledger (org_id, user_id, event_type, amount_credits, balance_after, source_type, expires_at)
     VALUES ($1::uuid, $2, 'earn', $3, $4, 'award', $5)`,
    [org, user, amount, balanceAfter, daysAhead(expiresInDays)],
  );
}
async function spend(org: string, user: string, amount: number, balanceAfter: number) {
  // created_at later than the earn row, so it is the latest ledger entry
  await pg.query(
    `INSERT INTO reward_wallet_ledger (org_id, user_id, event_type, amount_credits, balance_after, source_type, created_at)
     VALUES ($1::uuid, $2, 'spend', $3, $4, 'redemption', now() + interval '1 minute')`,
    [org, user, -amount, balanceAfter],
  );
}

beforeAll(async () => {
  const created = await createTableDatabase([rewardWalletLedger, inAppNotifications], [
    `CREATE UNIQUE INDEX uq_in_app_notifications_dedupe ON in_app_notifications (organization_id, user_id, ((data->>'dedupeKey'))) WHERE data ? 'dedupeKey'`,
    `CREATE SCHEMA IF NOT EXISTS user_management`,
    `CREATE TABLE user_management.users (user_id text primary key, email text, display_name text)`,
    `CREATE TABLE organizations (id uuid primary key, name text)`,
    `CREATE TABLE organization_members (id uuid primary key default gen_random_uuid(), organization_id uuid not null, user_id text not null, name text)`,
  ]);
  pg = created.pg;
  state.db = created.db;
});
afterAll(async () => { await pg.close(); });
beforeEach(async () => {
  state.sent.length = 0;
  state.failFor = null;
  await pg.exec('TRUNCATE in_app_notifications, reward_wallet_ledger, user_management.users, organizations, organization_members');
  await pg.query(`INSERT INTO organizations (id, name) VALUES ($1::uuid, 'Local 7'), ($2::uuid, 'Local 9')`, [ORG_A, ORG_B]);
  for (const user of ['u7', 'u6', 'u14', 'u30', 'u20', 'u-spent', 'u-partial', 'u-b']) {
    await pg.query(`INSERT INTO user_management.users (user_id, email) VALUES ($1, $1 || '@x.ca')`, [user]);
  }
});

describe('credit expiration warnings', () => {
  it('warns an earning once per tier: on the day it is exactly 30, 14 or 7 days out, and on no other day', async () => {
    await earn(ORG_A, 'u7', 100, 7);
    await earn(ORG_A, 'u6', 100, 6);
    await earn(ORG_A, 'u14', 100, 14);
    await earn(ORG_A, 'u30', 100, 30);
    await earn(ORG_A, 'u20', 100, 20);

    const result = await sendBatchExpirationWarnings();
    expect(result).toMatchObject({ success: true, usersNotified7Days: 1, usersNotified14Days: 1, usersNotified30Days: 1 });
    expect(state.sent.map((s) => s.recipientEmail).sort()).toEqual(['u14@x.ca', 'u30@x.ca', 'u7@x.ca']);
  });

  it('selects an earning in exactly one tier even though the windows used to overlap', async () => {
    await earn(ORG_A, 'u6', 100, 6);
    const day = async (days: number) => (await getExpiringCreditsUsers(days, 100, undefined, { exactDay: true })).map((e) => e.userId);
    expect(await day(7)).toEqual([]);
    expect(await day(14)).toEqual([]);
    expect(await day(30)).toEqual([]);
    // the open-ended window the other callers use still sees it
    expect((await getExpiringCreditsUsers(7, 100)).map((e) => e.userId)).toEqual(['u6']);
  });

  it('warns about no more than the member still holds, and not at all for credits already spent', async () => {
    await earn(ORG_A, 'u-partial', 100, 7);
    await spend(ORG_A, 'u-partial', 70, 30);
    await earn(ORG_A, 'u-spent', 100, 7);
    await spend(ORG_A, 'u-spent', 100, 0);

    await sendBatchExpirationWarnings();
    expect(state.sent).toEqual([{ recipientEmail: 'u-partial@x.ca', expiringAmount: 30 }]);
  });

  it('reports who was mailed per organization, so each can audit its own run', async () => {
    await earn(ORG_A, 'u7', 100, 7);
    await earn(ORG_B, 'u-b', 50, 7);
    const result = await sendBatchExpirationWarnings() as { byOrganization: Record<string, { sent: number; failed: number }> };
    expect(result.byOrganization).toEqual({ [ORG_A]: { sent: 1, failed: 0 }, [ORG_B]: { sent: 1, failed: 0 } });
  });

  it('answers failure, naming the count, when an e-mail could not be sent', async () => {
    await earn(ORG_A, 'u7', 100, 7);
    state.failFor = 'u7@x.ca';
    const result = await sendBatchExpirationWarnings() as { success: boolean; errors: string[]; byOrganization: Record<string, { sent: number; failed: number }> };
    expect(result.success).toBe(false);
    expect(result.errors).toEqual(['Failed for 7 days: 1 e-mail(s) were not sent']);
    expect(result.byOrganization[ORG_A]).toEqual({ sent: 0, failed: 1 });
  });

  it('mails an earning once per tier: a second run on the same day, or a retry, sends nothing more', async () => {
    await earn(ORG_A, 'u7', 100, 7);
    await earn(ORG_A, 'u14', 100, 14);
    expect(await sendBatchExpirationWarnings()).toMatchObject({ success: true, usersNotified7Days: 1, usersNotified14Days: 1 });
    const second = await sendBatchExpirationWarnings() as { success: boolean; usersNotified7Days: number; byOrganization: Record<string, unknown> };
    expect(second).toMatchObject({ success: true, usersNotified7Days: 0 });
    expect(second.byOrganization).toEqual({});
    expect(state.sent).toHaveLength(2);
    const notices = await pg.query<{ n: number }>(`SELECT count(*)::int AS n FROM in_app_notifications`);
    expect(notices.rows[0].n).toBe(2);
  });

  it('releases the record of a warning that could not be sent, so the next run tries again', async () => {
    await earn(ORG_A, 'u7', 100, 7);
    state.failFor = 'u7@x.ca';
    await sendBatchExpirationWarnings();
    expect((await pg.query(`SELECT 1 FROM in_app_notifications`)).rows).toHaveLength(0);
    state.failFor = null;
    await sendBatchExpirationWarnings();
    expect(state.sent.map((s) => s.recipientEmail)).toEqual(['u7@x.ca']);
  });
});
