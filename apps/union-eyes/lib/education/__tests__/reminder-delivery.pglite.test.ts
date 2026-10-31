import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { inAppNotifications } from '@/db/schema/domains/communications/notifications';
import { createTableDatabase, lateBoundDb } from '@/app/api/__tests__/support/pglite-tables';

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/db', () => ({ db: lateBoundDb(state) }));
import { claimEducationReminder, educationReminderKey, releaseEducationReminder } from '../reminder-delivery';

const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const SOURCE = '33333333-3333-4333-8333-333333333333';
const identity = { organizationId: ORG, userId: 'u1', sourceId: SOURCE, kind: 'session' as const, leadDays: 7 };
let pg: PGlite;
beforeAll(async () => {
  const created = await createTableDatabase([inAppNotifications], [
    'CREATE TABLE organizations (id uuid primary key, name text)',
    `CREATE UNIQUE INDEX uq_in_app_notifications_dedupe ON in_app_notifications (organization_id, user_id, ((data->>'dedupeKey'))) WHERE data ? 'dedupeKey'`,
  ]);
  pg = created.pg;
  state.db = created.db;
});
afterAll(async () => { await pg.close(); });
beforeEach(async () => {
  await pg.exec('TRUNCATE in_app_notifications, organizations');
  await pg.query(`INSERT INTO organizations (id, name) VALUES ($1::uuid, 'A'), ($2::uuid, 'B')`, [ORG, OTHER]);
});

describe('education reminder durable delivery claims', () => {
  it('claims only once for overlapping runs and a repeated cron, but independently per tier', async () => {
    expect(await claimEducationReminder(identity)).toBe(true);
    expect(await claimEducationReminder(identity)).toBe(false);
    expect(await claimEducationReminder({ ...identity, leadDays: 3 })).toBe(true);
    expect((await pg.query('SELECT id FROM in_app_notifications')).rows).toHaveLength(2);
  });
  it('isolates organizations, members, sources and reminder kinds', async () => {
    expect(await claimEducationReminder(identity)).toBe(true);
    expect(await claimEducationReminder({ ...identity, organizationId: OTHER })).toBe(true);
    expect(await claimEducationReminder({ ...identity, userId: 'u2' })).toBe(true);
    expect(await claimEducationReminder({ ...identity, sourceId: '44444444-4444-4444-8444-444444444444' })).toBe(true);
    expect(await claimEducationReminder({ ...identity, kind: 'certification', leadDays: 30 })).toBe(true);
    expect((await pg.query('SELECT id FROM in_app_notifications')).rows).toHaveLength(5);
  });
  it('releases only the failed delivery identity, permitting a safe retry', async () => {
    await claimEducationReminder(identity);
    await claimEducationReminder({ ...identity, organizationId: OTHER });
    await releaseEducationReminder(identity);
    expect(await claimEducationReminder(identity)).toBe(true);
    expect(await claimEducationReminder({ ...identity, organizationId: OTHER })).toBe(false);
  });
  it('rejects missing scope and unsupported reminder tiers before any write', async () => {
    expect(() => educationReminderKey({ ...identity, organizationId: '' })).toThrow();
    expect(() => educationReminderKey({ ...identity, sourceId: 'not-a-uuid' })).toThrow();
    expect(() => educationReminderKey({ ...identity, leadDays: 365 })).toThrow();
    expect((await pg.query('SELECT id FROM in_app_notifications')).rows).toHaveLength(0);
  });
});
