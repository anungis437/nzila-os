/**
 * SQL-engine regression for the exact deployed payment-reference migration.
 * PGlite is not native PG15/16, RLS, or deployed runtime qualification.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

const migration = readFileSync(
  resolve(__dirname, '..', 'migrations', '20260921_platform_payment_external_reference_uniqueness.sql'),
  'utf8',
);
const orgA = '00000000-0000-0000-0000-00000000000a';
const orgB = '00000000-0000-0000-0000-00000000000b';

async function withDb(run: (db: PGlite) => Promise<void>) {
  const db = new PGlite();
  try {
    await run(db);
  } finally {
    await db.close();
  }
}

const createLedger = `
  CREATE TABLE platform_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    external_reference varchar(255),
    amount numeric(14,2) NOT NULL
  );
`;

describe('payment-reference migration — actual SQL engine execution', () => {
  it('refuses to install when the ledger table is absent', async () => {
    await withDb(async (db) => {
      await expect(db.exec(migration)).rejects.toThrow(/platform_payments is missing/);
      const result = await db.query<{ exists: string | null }>(
        "SELECT to_regclass('platform_payments_org_external_reference_uq')::text AS exists",
      );
      expect(result.rows[0]?.exists).toBeNull();
    });
  });

  it('refuses duplicate legacy references without deleting financial rows', async () => {
    await withDb(async (db) => {
      await db.exec(createLedger);
      await db.query(
        'INSERT INTO platform_payments (organization_id, external_reference, amount) VALUES ($1,$2,10),($1,$2,20)',
        [orgA, 'duplicate'],
      );
      await expect(db.exec(migration)).rejects.toThrow(/duplicate.*group/i);
      const count = await db.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM platform_payments',
      );
      expect(count.rows[0]?.n).toBe(2);
      const index = await db.query<{ exists: string | null }>(
        "SELECT to_regclass('platform_payments_org_external_reference_uq')::text AS exists",
      );
      expect(index.rows[0]?.exists).toBeNull();
    });
  });


  it('refuses a same-name nonunique index instead of silently accepting it', async () => {
    await withDb(async (db) => {
      await db.exec(createLedger);
      await db.exec('CREATE INDEX platform_payments_org_external_reference_uq ON platform_payments (organization_id)');
      await expect(db.exec(migration)).rejects.toThrow(/unexpected definition/);
      const indexes = await db.query<{ unique: boolean }>(
        `SELECT indisunique AS unique FROM pg_index WHERE indexrelid = 'platform_payments_org_external_reference_uq'::regclass`,
      );
      expect(indexes.rows[0]?.unique).toBe(false);
    });
  });

  it('refuses a same-name index attached to an unrelated table', async () => {
    await withDb(async (db) => {
      await db.exec(createLedger);
      await db.exec(`
        CREATE TABLE unrelated_payments (
          organization_id uuid NOT NULL,
          external_reference varchar(255)
        );
        CREATE UNIQUE INDEX platform_payments_org_external_reference_uq
          ON unrelated_payments (organization_id, external_reference)
          WHERE external_reference IS NOT NULL;
      `);
      await expect(db.exec(migration)).rejects.toThrow(/unexpected definition/);
      const index = await db.query<{ table_name: string }>(
        `SELECT indrelid::regclass::text AS table_name FROM pg_index
         WHERE indexrelid = 'platform_payments_org_external_reference_uq'::regclass`,
      );
      expect(index.rows[0]?.table_name).toBe('unrelated_payments');
      const paymentCount = await db.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM platform_payments',
      );
      expect(paymentCount.rows[0]?.n).toBe(0);
    });
  });

  it('refuses a same-name unique index with an incorrect predicate', async () => {
    await withDb(async (db) => {
      await db.exec(createLedger);
      await db.exec(
        'CREATE UNIQUE INDEX platform_payments_org_external_reference_uq ON platform_payments (organization_id, external_reference) WHERE amount > 0',
      );
      await expect(db.exec(migration)).rejects.toThrow(/unexpected definition/);
      const index = await db.query<{ predicate: string | null }>(
        `SELECT pg_get_expr(indpred, indrelid) AS predicate
         FROM pg_index WHERE indexrelid = 'platform_payments_org_external_reference_uq'::regclass`,
      );
      expect(index.rows[0]?.predicate).toMatch(/amount/);
    });
  });

  it('refuses a same-name unique index with reversed key columns', async () => {
    await withDb(async (db) => {
      await db.exec(createLedger);
      await db.exec(
        'CREATE UNIQUE INDEX platform_payments_org_external_reference_uq ON platform_payments (external_reference, organization_id) WHERE external_reference IS NOT NULL',
      );
      await expect(db.exec(migration)).rejects.toThrow(/unexpected definition/);
      const keys = await db.query<{ first_key: string }>(
        `SELECT a.attname AS first_key FROM pg_index ix
         JOIN pg_attribute a ON a.attrelid = ix.indrelid AND a.attnum = ix.indkey[0]
         WHERE ix.indexrelid = 'platform_payments_org_external_reference_uq'::regclass`,
      );
      expect(keys.rows[0]?.first_key).toBe('external_reference');
    });
  });

  it('refuses a same-name unique index with an unexpected included column', async () => {
    await withDb(async (db) => {
      await db.exec(createLedger);
      await db.exec(
        'CREATE UNIQUE INDEX platform_payments_org_external_reference_uq ON platform_payments (organization_id, external_reference) INCLUDE (amount) WHERE external_reference IS NOT NULL',
      );
      await expect(db.exec(migration)).rejects.toThrow(/unexpected definition/);
      const attrs = await db.query<{ n: number }>(
        `SELECT indnatts::int AS n FROM pg_index
         WHERE indexrelid = 'platform_payments_org_external_reference_uq'::regclass`,
      );
      expect(attrs.rows[0]?.n).toBe(3);
    });
  });

  it('refuses a same-name full unique index that would reject legitimate NULL references', async () => {
    await withDb(async (db) => {
      await db.exec(createLedger);
      await db.exec(
        'CREATE UNIQUE INDEX platform_payments_org_external_reference_uq ON platform_payments (organization_id, external_reference)',
      );
      await expect(db.exec(migration)).rejects.toThrow(/unexpected definition/);
      const index = await db.query<{ predicate: string | null }>(
        `SELECT pg_get_expr(indpred, indrelid) AS predicate FROM pg_index
         WHERE indexrelid = 'platform_payments_org_external_reference_uq'::regclass`,
      );
      expect(index.rows[0]?.predicate).toBeNull();
    });
  });

  it('can be reapplied without weakening an already installed idempotency constraint', async () => {
    await withDb(async (db) => {
      await db.exec(createLedger);
      await db.exec(migration);
      await db.exec(migration);
      const index = await db.query<{ unique: boolean; valid: boolean; ready: boolean }>(
        `SELECT indisunique AS unique, indisvalid AS valid, indisready AS ready
         FROM pg_index WHERE indexrelid = 'platform_payments_org_external_reference_uq'::regclass`,
      );
      expect(index.rows).toEqual([{ unique: true, valid: true, ready: true }]);
      await db.query(
        'INSERT INTO platform_payments (organization_id, external_reference, amount) VALUES ($1,$2,10)',
        [orgA, 'replay-after-rerun'],
      );
      await expect(db.query(
        'INSERT INTO platform_payments (organization_id, external_reference, amount) VALUES ($1,$2,20)',
        [orgA, 'replay-after-rerun'],
      )).rejects.toThrow();
    });
  });

  it('installs the scoped index and rejects replay while permitting cross-org and NULL references', async () => {
    await withDb(async (db) => {
      await db.exec(createLedger);
      await db.exec(migration);
      await db.query(
        'INSERT INTO platform_payments (organization_id, external_reference, amount) VALUES ($1,$2,10)',
        [orgA, 'evt_1'],
      );
      await expect(
        db.query(
          'INSERT INTO platform_payments (organization_id, external_reference, amount) VALUES ($1,$2,10)',
          [orgA, 'evt_1'],
        ),
      ).rejects.toThrow();
      await db.query(
        'INSERT INTO platform_payments (organization_id, external_reference, amount) VALUES ($1,$2,10)',
        [orgB, 'evt_1'],
      );
      await db.query(
        'INSERT INTO platform_payments (organization_id, external_reference, amount) VALUES ($1,NULL,10),($1,NULL,20)',
        [orgA],
      );
      const count = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM platform_payments');
      expect(count.rows[0]?.n).toBe(4);
    });
  });
});
