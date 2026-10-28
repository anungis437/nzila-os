import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';

// DEF-0B11-PRP-REWARDS-CRON-ANNIVERSARY-AWARDS-REPEAT-ON-EVERY-CALL-ON-AN-ANNIVERSARY-DAY
// Real SQL: a second run on the same day must not award the same member again.

const state = vi.hoisted(() => ({ db: null as unknown, created: [] as string[], issued: [] as string[] }));

vi.mock('@/db', () => ({
  db: new Proxy({}, {
    get(_t, prop) {
      if (prop === 'query') return { recognitionAwardTypes: { findFirst: async () => ({ id: AWARD_TYPE, programId: 'p-1', requiresApproval: false }) } };
      // drizzle's pglite driver wraps rows; the production driver returns the rows themselves.
      if (prop === 'execute') return async (query: unknown) => ((state.db as { execute(q: unknown): Promise<{ rows: unknown[] }> }).execute(query)).then((r) => r.rows);
      const real = state.db as Record<PropertyKey, unknown>;
      const value = real?.[prop];
      return typeof value === 'function' ? value.bind(real) : value;
    },
  }),
}));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../award-service', () => ({
  createAwardRequest: async (input: { orgId: string; recipientUserId: string; awardTypeId: string }) => {
    const pg = (globalThis as unknown as { __pg: PGlite }).__pg;
    const id = crypto.randomUUID();
    await pg.query(
      `INSERT INTO recognition_awards (id, org_id, recipient_user_id, award_type_id, status) VALUES ($1::uuid, $2::uuid, $3, $4::uuid, 'approved')`,
      [id, input.orgId, input.recipientUserId, input.awardTypeId],
    );
    state.created.push(`${input.orgId}:${input.recipientUserId}`);
    return { id };
  },
  issueAward: async ({ awardId }: { awardId: string }) => {
    state.issued.push(awardId);
    return { award: { id: awardId }, newBalance: 1 };
  },
}));

import { processAnniversaryAwards } from '../automation-service';

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const AWARD_TYPE = '33333333-3333-4333-8333-333333333333';
let pg: PGlite;

beforeAll(async () => {
  const { PGlite: Engine } = await import('@electric-sql/pglite');
  pg = new Engine();
  (globalThis as unknown as { __pg: PGlite }).__pg = pg;
  state.db = drizzle(pg);
  await pg.exec(`
    CREATE TABLE organization_members (id uuid primary key default gen_random_uuid(), organization_id uuid not null,
      user_id text not null, user_name text, joined_at timestamptz);
    CREATE TABLE recognition_awards (id uuid primary key, org_id uuid not null, recipient_user_id text not null,
      award_type_id uuid not null, status text not null, created_at timestamptz not null default now());
  `);
  // Align the job's "today" (JavaScript) with the database's CURRENT_DATE.
  const { rows } = await pg.query<{ y: number; m: number; d: number }>(
    `SELECT EXTRACT(YEAR FROM CURRENT_DATE)::int AS y, EXTRACT(MONTH FROM CURRENT_DATE)::int AS m, EXTRACT(DAY FROM CURRENT_DATE)::int AS d`,
  );
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(Date.UTC(rows[0].y, rows[0].m - 1, rows[0].d, 12)));
});

afterAll(async () => {
  vi.useRealTimers();
  await pg.close();
});

beforeEach(async () => {
  state.created.length = 0;
  state.issued.length = 0;
  await pg.exec('TRUNCATE organization_members, recognition_awards');
  await pg.query(`INSERT INTO organization_members (organization_id, user_id, user_name, joined_at) VALUES ($1::uuid, 'member-1', 'One', CURRENT_DATE - interval '2 years')`, [ORG_A]);
  await pg.query(`INSERT INTO organization_members (organization_id, user_id, user_name, joined_at) VALUES ($1::uuid, 'member-2', 'Two', CURRENT_DATE - interval '5 years')`, [ORG_A]);
});

describe('processAnniversaryAwards — one award per member per anniversary day', () => {
  it('awards each member once, however many times the job runs that day', async () => {
    const first = await processAnniversaryAwards(ORG_A);
    const second = await processAnniversaryAwards(ORG_A);
    const third = await processAnniversaryAwards(ORG_A);

    expect(first).toMatchObject({ success: true, processed: 2 });
    expect(second).toMatchObject({ success: true, processed: 0 });
    expect(third).toMatchObject({ success: true, processed: 0 });
    expect(state.created.sort()).toEqual([`${ORG_A}:member-1`, `${ORG_A}:member-2`]);
    expect(state.issued).toHaveLength(2);
    const { rows } = await pg.query('SELECT count(*)::int AS n FROM recognition_awards');
    expect(rows[0]).toEqual({ n: 2 });
  });

  it('is not suppressed by another organization\'s award for the same user id', async () => {
    await pg.query(`INSERT INTO recognition_awards (id, org_id, recipient_user_id, award_type_id, status) VALUES (gen_random_uuid(), $1::uuid, 'member-1', $2::uuid, 'issued')`, [ORG_B, AWARD_TYPE]);
    const result = await processAnniversaryAwards(ORG_A);
    expect(result).toMatchObject({ processed: 2 });
  });

  it('is not suppressed by an award created on an earlier day (a new anniversary)', async () => {
    await pg.query(`INSERT INTO recognition_awards (id, org_id, recipient_user_id, award_type_id, status, created_at) VALUES (gen_random_uuid(), $1::uuid, 'member-1', $2::uuid, 'issued', now() - interval '1 year')`, [ORG_A, AWARD_TYPE]);
    const result = await processAnniversaryAwards(ORG_A);
    expect(result).toMatchObject({ processed: 2 });
  });

  it('skips a member who already has today\'s award in any state, awarding only the other', async () => {
    await pg.query(`INSERT INTO recognition_awards (id, org_id, recipient_user_id, award_type_id, status) VALUES (gen_random_uuid(), $1::uuid, 'member-1', $2::uuid, 'pending')`, [ORG_A, AWARD_TYPE]);
    const result = await processAnniversaryAwards(ORG_A);
    expect(result).toMatchObject({ processed: 1 });
    expect(state.created).toEqual([`${ORG_A}:member-2`]);
  });
});
