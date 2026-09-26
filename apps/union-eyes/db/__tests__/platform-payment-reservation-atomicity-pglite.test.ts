/**
 * ARTIFACT TYPE: PGLITE_FINANCIAL_ATOMICITY_PROOF (SQL-engine proof)
 *
 * This is an in-process PGlite (WASM PostgreSQL) proof of the reservation
 * invariant and payment+fee transaction atomicity. It is NOT a server-principal
 * proof — it exercises the SQL engine's ON CONFLICT + transaction semantics
 * against the exact partial unique index the forward migration installs.
 */
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

const ORG_A = '00000000-0000-0000-0000-00000000000a';
const ORG_B = '00000000-0000-0000-0000-00000000000b';

let db: PGlite;

async function n(sql: string, params: unknown[] = []): Promise<number> {
  const res = await db.query<{ n: number }>(sql, params);
  return res.rows[0]?.n ?? 0;
}

beforeEach(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE TABLE platform_payments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL,
      external_reference varchar(255),
      method varchar(50) NOT NULL DEFAULT 'stripe',
      amount numeric(14,2) NOT NULL
    );
    CREATE UNIQUE INDEX platform_payments_org_external_reference_uq
      ON platform_payments (organization_id, external_reference)
      WHERE external_reference IS NOT NULL;

    CREATE TABLE transaction_fee_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      idempotency_key varchar(255) NOT NULL UNIQUE,
      fee_amount numeric(14,2) NOT NULL
    );
  `);
});

afterEach(async () => {
  await db.close();
});

const reserve = (org: string, ref: string | null, amount: string) =>
  db.query<{ id: string }>(
    `INSERT INTO platform_payments (organization_id, external_reference, amount)
     VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING id`,
    [org, ref, amount],
  );

describe('platform payment reservation + atomicity (PGlite)', () => {
  it('reserves at most one durable identity for a duplicate (organization, reference)', async () => {
    const r1 = await reserve(ORG_A, 'evt_1', '10.00');
    const r2 = await reserve(ORG_A, 'evt_1', '10.00');

    expect(r1.rows.length).toBe(1); // fresh reservation wins
    expect(r2.rows.length).toBe(0); // replay: no new identity
    expect(
      await n(
        `SELECT count(*)::int AS n FROM platform_payments WHERE organization_id=$1 AND external_reference=$2`,
        [ORG_A, 'evt_1'],
      ),
    ).toBe(1);
  });

  it('allows the same human reference across different organizations', async () => {
    const a = await reserve(ORG_A, 'bank-ref-1', '5.00');
    const b = await reserve(ORG_B, 'bank-ref-1', '5.00');
    expect(a.rows.length).toBe(1);
    expect(b.rows.length).toBe(1);
  });

  it('allows multiple NULL external_reference rows per organization', async () => {
    await reserve(ORG_A, null, '1.00');
    await reserve(ORG_A, null, '2.00');
    expect(
      await n(
        `SELECT count(*)::int AS n FROM platform_payments WHERE organization_id=$1 AND external_reference IS NULL`,
        [ORG_A],
      ),
    ).toBe(2);
  });

  it('rolls back BOTH the payment and the fee when a core step fails', async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.query(
          `INSERT INTO platform_payments (organization_id, external_reference, amount) VALUES ($1,$2,$3)`,
          [ORG_A, 'evt_atomic', '10.00'],
        );
        await tx.query(
          `INSERT INTO transaction_fee_events (idempotency_key, fee_amount) VALUES ($1,$2)`,
          ['fee-evt_atomic', '1.00'],
        );
        throw new Error('ledger failure');
      }),
    ).rejects.toThrow('ledger failure');

    expect(
      await n(`SELECT count(*)::int AS n FROM platform_payments WHERE external_reference=$1`, [
        'evt_atomic',
      ]),
    ).toBe(0);
    expect(
      await n(`SELECT count(*)::int AS n FROM transaction_fee_events WHERE idempotency_key=$1`, [
        'fee-evt_atomic',
      ]),
    ).toBe(0);
  });

  it('a Stripe retry after a rolled-back transaction succeeds exactly once', async () => {
    // First attempt fails after both writes.
    await db
      .transaction(async (tx) => {
        await tx.query(
          `INSERT INTO platform_payments (organization_id, external_reference, amount) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [ORG_A, 'evt_retry', '10.00'],
        );
        await tx.query(
          `INSERT INTO transaction_fee_events (idempotency_key, fee_amount) VALUES ($1,$2) ON CONFLICT (idempotency_key) DO NOTHING`,
          ['fee-evt_retry', '1.00'],
        );
        throw new Error('transient failure');
      })
      .catch(() => undefined);

    // Retry commits cleanly.
    await db.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO platform_payments (organization_id, external_reference, amount) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [ORG_A, 'evt_retry', '10.00'],
      );
      await tx.query(
        `INSERT INTO transaction_fee_events (idempotency_key, fee_amount) VALUES ($1,$2) ON CONFLICT (idempotency_key) DO NOTHING`,
        ['fee-evt_retry', '1.00'],
      );
    });

    expect(
      await n(`SELECT count(*)::int AS n FROM platform_payments WHERE external_reference=$1`, [
        'evt_retry',
      ]),
    ).toBe(1);
    expect(
      await n(`SELECT count(*)::int AS n FROM transaction_fee_events WHERE idempotency_key=$1`, [
        'fee-evt_retry',
      ]),
    ).toBe(1);
  });
});
