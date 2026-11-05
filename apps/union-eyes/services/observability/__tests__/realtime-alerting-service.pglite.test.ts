import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { alertExecutions, alertRules, inAppNotifications, organizationMembers } from '@/db/schema';
import { createTableDatabase } from '@/app/api/__tests__/support/pglite-tables';

// The sweep against real SQL: who is told, that a rerun tells nobody twice, and that a failure in one organization's alert
// rolls back only that alert.

const state = vi.hoisted(() => ({ db: null as any }));
const audit = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('@/db', async () => {
  const { lateBoundDb } = await import('@/app/api/__tests__/support/pglite-tables');
  return { db: lateBoundDb(state) };
});
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: async (fn: (tx: unknown) => Promise<unknown>) => state.db.transaction((tx: unknown) => fn(tx)),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: audit }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';

let pg: PGlite;

async function member(org: string, userId: string, role: string, status = 'active', deleted = false) {
  await pg.query(
    `INSERT INTO organization_members (id, user_id, organization_id, name, email, role, status, is_primary, created_at, deleted_at)
     VALUES (gen_random_uuid(), $1, $2, 'n', $1 || '@x.ca', $3, $4, false, now(), $5)`,
    [userId, org, role, status, deleted ? new Date() : null],
  );
}
const failedBatch = (org: string) => pg.query(`INSERT INTO ingestion_batches (organization_id, status, created_at) VALUES ($1, 'failed', now())`, [org]);
const sweep = async () => (await import('../realtime-alerting-service')).runRealtimeObservabilitySweep();
const notices = async () => (await pg.query<{ user_id: string; organization_id: string; type: string; data: Record<string, any> }>(
  'SELECT user_id, organization_id, type, data FROM in_app_notifications ORDER BY user_id')).rows;
const count = async (table: string) => Number((await pg.query<{ n: string }>(`SELECT count(*)::text n FROM ${table}`)).rows[0].n);

beforeAll(async () => {
  const created = await createTableDatabase([alertRules, alertExecutions, inAppNotifications, organizationMembers], [
    `CREATE TABLE ml_predictions (organization_id uuid, prediction_type text, model_version text, predicted_value text, created_at timestamptz default now())`,
    `CREATE TABLE ingestion_batches (organization_id uuid, status text, created_at timestamptz default now())`,
    `CREATE TABLE platform_payments (organization_id uuid, status text, created_at timestamptz default now())`,
  ]);
  pg = created.pg;
  state.db = created.db;
  await pg.exec(readFileSync(resolve(__dirname, '../../../db/migrations/20261103_in_app_notifications_dedupe_key.sql'), 'utf8'));
});
afterAll(async () => { await pg.close(); });
beforeEach(async () => {
  audit.mockReset();
  audit.mockResolvedValue(undefined);
  await pg.exec('TRUNCATE alert_executions, alert_rules, in_app_notifications, organization_members, ml_predictions, ingestion_batches, platform_payments CASCADE');
});

describe('runRealtimeObservabilitySweep', () => {
  it('never emits a model-based alert from a legacy caller-controlled v1 SLA prediction', async () => {
    await member(ORG_A, 'admin-1', 'admin');
    await pg.query(`INSERT INTO ml_predictions (organization_id, prediction_type, model_version, predicted_value, created_at)
      VALUES ($1, 'sla_breach_risk', 'sla-risk-v1', '0.99', now())`, [ORG_A]);
    const result = await sweep();
    expect(result.emitted).toBe(0);
    expect(result.byKind.sla_breach_imminent).toBe(0);
    expect(await notices()).toEqual([]);
  });

  it('tells the organization\'s active administrators, and nobody else, and records only the channel that delivered', async () => {
    await member(ORG_A, 'admin-1', 'admin');
    await member(ORG_A, 'pres-1', 'president');
    await member(ORG_A, 'steward-1', 'steward');
    await member(ORG_A, 'admin-gone', 'admin', 'inactive');
    await member(ORG_A, 'admin-deleted', 'admin', 'active', true);
    await member(ORG_B, 'admin-other-org', 'admin');
    await failedBatch(ORG_A);

    const result = await sweep();
    expect(result).toMatchObject({ emitted: 1, failures: [] });
    expect((await notices()).map((n) => [n.user_id, n.organization_id])).toEqual([['admin-1', ORG_A], ['pres-1', ORG_A]]);

    const execution = (await pg.query<{ status: string; actions_executed: any; error_message: string | null }>('SELECT status, actions_executed, error_message FROM alert_executions')).rows;
    expect(execution).toEqual([{ status: 'success', actions_executed: { channels: ['in_app'], recipients: 2 }, error_message: null }]);
    expect(audit).toHaveBeenCalledTimes(1);
  });

  it('tells nobody twice when the sweep runs again in the same hour', async () => {
    await member(ORG_A, 'admin-1', 'admin');
    await failedBatch(ORG_A);
    expect((await sweep()).emitted).toBe(1);
    const again = await sweep();
    expect(again).toMatchObject({ emitted: 0, alreadyAlerted: 1 });
    expect(await count('in_app_notifications')).toBe(1);
    expect(await count('alert_executions')).toBe(1);
    expect(audit).toHaveBeenCalledTimes(1);
  });

  it('reports an alert nobody could receive as a failure with a failed execution, instead of recording success', async () => {
    await member(ORG_A, 'steward-1', 'steward');
    await failedBatch(ORG_A);
    const result = await sweep();
    expect(result.emitted).toBe(0);
    expect(result.failures).toEqual([{ organizationId: ORG_A, kind: 'ingestion_failures', reason: 'no active administrator to notify' }]);
    expect((await pg.query<{ status: string }>('SELECT status FROM alert_executions')).rows).toEqual([{ status: 'failed' }]);
    expect(await count('in_app_notifications')).toBe(0);
  });

  it('rolls back only the alert whose audit cannot be written, and reports it', async () => {
    await member(ORG_A, 'admin-a', 'admin');
    await member(ORG_B, 'admin-b', 'admin');
    await failedBatch(ORG_A);
    await failedBatch(ORG_B);
    audit.mockRejectedValueOnce(new Error('audit unavailable'));

    const result = await sweep();
    expect(result.emitted).toBe(1);
    expect(result.failures).toEqual([expect.objectContaining({ kind: 'ingestion_failures', reason: 'alert write failed' })]);
    // the failed one left nothing behind: no inbox row, no execution
    expect(await count('in_app_notifications')).toBe(1);
    expect(await count('alert_executions')).toBe(1);

    // the next run completes it
    expect(await sweep()).toMatchObject({ emitted: 1, alreadyAlerted: 1, failures: [] });
    expect(await count('in_app_notifications')).toBe(2);
  });
});
