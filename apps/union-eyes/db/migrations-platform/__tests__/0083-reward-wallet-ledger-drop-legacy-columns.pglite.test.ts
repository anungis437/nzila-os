import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const migrationsDir = join(__dirname, '..')
const migration = readFileSync(
  join(migrationsDir, '0083_reward_wallet_ledger_drop_legacy_columns.sql'),
  'utf8',
)
const rollback = readFileSync(
  join(migrationsDir, '0083_reward_wallet_ledger_drop_legacy_columns.rollback.sql'),
  'utf8',
)

let db: PGlite

beforeEach(async () => {
  db = new PGlite()
  await db.exec(`
    CREATE TABLE public.reward_wallet_ledger (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id uuid NOT NULL,
      user_id text NOT NULL,
      event_type varchar(16) NOT NULL,
      amount_credits integer NOT NULL,
      balance_after integer NOT NULL,
      source_type varchar(32) NOT NULL,
      source_id uuid,
      memo text,
      expires_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      award_id uuid,
      description text,
      points_change integer,
      reference_id varchar(255),
      reference_type varchar(50),
      transaction_type varchar(50)
    );
  `)
})

afterEach(async () => {
  await db.close()
})

describe('migration 0083: reward_wallet_ledger drop legacy columns', () => {
  it('drops all six legacy columns when none hold data, leaving the current twelve-column shape intact', async () => {
    await db.query(
      `INSERT INTO reward_wallet_ledger (org_id, user_id, event_type, amount_credits, balance_after, source_type)
       VALUES (gen_random_uuid(), 'user-1', 'earn', 10, 10, 'award')`,
    )

    await db.exec(migration)

    const columns = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'reward_wallet_ledger' ORDER BY column_name`,
    )
    const names = columns.rows.map((row) => row.column_name)
    expect(names).toEqual(
      [
        'amount_credits', 'balance_after', 'created_at', 'event_type', 'expires_at', 'id',
        'memo', 'org_id', 'source_id', 'source_type', 'updated_at', 'user_id',
      ].sort(),
    )
    for (const legacy of ['award_id', 'description', 'points_change', 'reference_id', 'reference_type', 'transaction_type']) {
      expect(names).not.toContain(legacy)
    }

    const row = await db.query(`SELECT * FROM reward_wallet_ledger`)
    expect(row.rows.length).toBe(1)
  })

  it('refuses to run (fail-closed) when any legacy column still holds non-null data', async () => {
    await db.query(
      `INSERT INTO reward_wallet_ledger (org_id, user_id, event_type, amount_credits, balance_after, source_type, points_change)
       VALUES (gen_random_uuid(), 'user-1', 'earn', 10, 10, 'award', 5)`,
    )

    await expect(db.exec(migration)).rejects.toThrow(/refusing to drop without separate data-disposition review/)

    const columns = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'reward_wallet_ledger' AND column_name = 'points_change'`,
    )
    expect(columns.rows.length).toBe(1)
  })

  it('rollback re-adds all six legacy columns as nullable', async () => {
    await db.exec(migration)
    await db.exec(rollback)

    const columns = await db.query<{ column_name: string; is_nullable: string }>(
      `SELECT column_name, is_nullable FROM information_schema.columns
       WHERE table_name = 'reward_wallet_ledger'
         AND column_name IN ('award_id', 'description', 'points_change', 'reference_id', 'reference_type', 'transaction_type')
       ORDER BY column_name`,
    )
    expect(columns.rows.length).toBe(6)
    for (const row of columns.rows) {
      expect(row.is_nullable).toBe('YES')
    }

    await expect(
      db.query(
        `INSERT INTO reward_wallet_ledger (org_id, user_id, event_type, amount_credits, balance_after, source_type)
         VALUES (gen_random_uuid(), 'user-1', 'earn', 10, 10, 'award')`,
      ),
    ).resolves.toBeDefined()
  })
})
