/**
 * ARTIFACT TYPE: Migration behavioral proof (PGlite, in-process SQL engine)
 * DOCTRINE_VERSION: 1.0.0
 *
 * Behavioral proof of 20260921_workbook_credential_and_payment_authority.sql
 * against PGlite — a WASM build of the PostgreSQL SQL engine, in-process (same
 * pattern as strike-fund-disbursements-organization-provenance.test.ts). No
 * Docker or external server required, so this runs in CI rather than being
 * skipped.
 *
 * SCOPE OF THIS EVIDENCE: this proves the migration's TRIGGER + GRANT + RLS
 * geometry behaves correctly when the effective principal is switched with
 * SET ROLE within one PGlite session. It is SQL-engine enforcement evidence.
 * It is NOT the same as a separately-authenticated PostgreSQL server
 * connection where DATABASE_URL logs in as union_eyes_runtime and
 * SYSTEM_DATABASE_URL logs in as union_eyes_system — that server-principal
 * proof is release/runtime evidence and remains OPEN (see the completion
 * report).
 *
 * The migration's own SQL text is applied verbatim — the enforcement under
 * test is the shipped migration, not a paraphrase.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

const FORWARD_SQL = readFileSync(
  resolve(__dirname, '..', 'migrations', '20260921_workbook_credential_and_payment_authority.sql'),
  'utf8',
);

const UNCLAIMED = '00000000-0000-0000-0000-0000000000a1'; // fulfillable target
const UNCLAIMED_2 = '00000000-0000-0000-0000-0000000000a2'; // guarded-update target
const CONTENDED = '00000000-0000-0000-0000-0000000000a3'; // already has a payment ref
const CLAIMED_USER1 = '00000000-0000-0000-0000-0000000000b1'; // claimed, credential present
const CLAIMED_USER2 = '00000000-0000-0000-0000-0000000000b2'; // claimed, credential absent

async function buildFixture(): Promise<PGlite> {
  const db = new PGlite();

  // Non-superuser, non-bypass roles — same posture as 0108.
  await db.exec(`
    CREATE ROLE union_eyes_runtime NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS INHERIT NOLOGIN;
    CREATE ROLE union_eyes_system  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS INHERIT NOLOGIN;
  `);

  // Production-shape subset of the two tables under test.
  await db.exec(`
    CREATE TABLE workbooks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      status varchar(16) NOT NULL DEFAULT 'draft',
      report_tier_id varchar(64),
      stripe_payment_ref varchar(128),
      claim_email varchar(320),
      claim_token varchar(128),
      claim_token_expires_at timestamptz,
      claimed_by_user_id text,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE workbook_purchases (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workbook_id uuid NOT NULL REFERENCES workbooks(id) ON DELETE CASCADE,
      stripe_payment_ref varchar(128) NOT NULL UNIQUE,
      tier_id varchar(64) NOT NULL,
      amount_cents integer NOT NULL,
      currency varchar(8) NOT NULL DEFAULT 'CAD',
      customer_email varchar(320),
      captured_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  // Round58 RLS geometry (system full access + runtime user-isolation on
  // workbooks; workbook_purchases is system-only).
  await db.exec(`
    ALTER TABLE workbooks ENABLE ROW LEVEL SECURITY;
    ALTER TABLE workbooks FORCE ROW LEVEL SECURITY;
    CREATE POLICY ue_user_isolation_all ON workbooks FOR ALL TO union_eyes_runtime
      USING (claimed_by_user_id::text = current_setting('app.current_user_id', true))
      WITH CHECK (claimed_by_user_id::text = current_setting('app.current_user_id', true));
    CREATE POLICY ue_system_full_access ON workbooks FOR ALL TO union_eyes_system
      USING (true) WITH CHECK (true);

    ALTER TABLE workbook_purchases ENABLE ROW LEVEL SECURITY;
    ALTER TABLE workbook_purchases FORCE ROW LEVEL SECURITY;
    CREATE POLICY ue_system_full_access ON workbook_purchases FOR ALL TO union_eyes_system
      USING (true) WITH CHECK (true);
  `);

  // Round58 pre-migration grants (system has NO SELECT yet — the gap this
  // migration closes).
  await db.exec(`
    GRANT SELECT, INSERT, UPDATE ON TABLE workbooks TO union_eyes_runtime;
    GRANT UPDATE ON TABLE workbooks TO union_eyes_system;
    GRANT INSERT ON TABLE workbook_purchases TO union_eyes_system;
  `);

  // Apply the migration under test verbatim.
  await db.exec(FORWARD_SQL);

  // Base rows carry NO protected fields — safe to insert as the owner.
  await db.query(`INSERT INTO workbooks (id, status) VALUES ($1, 'awaiting_claim')`, [UNCLAIMED]);
  await db.query(`INSERT INTO workbooks (id, status) VALUES ($1, 'awaiting_claim')`, [UNCLAIMED_2]);
  await db.query(`INSERT INTO workbooks (id, status) VALUES ($1, 'awaiting_claim')`, [CONTENDED]);
  await db.query(
    `INSERT INTO workbooks (id, status, claimed_by_user_id) VALUES ($1, 'active', 'user-1')`,
    [CLAIMED_USER1],
  );
  await db.query(
    `INSERT INTO workbooks (id, status, claimed_by_user_id) VALUES ($1, 'active', 'user-2')`,
    [CLAIMED_USER2],
  );

  // Protected credential/payment fields are system-owned. The trigger now
  // admits union_eyes_system ONLY (no superuser/BYPASSRLS bypass), so even
  // fixture seeding of those fields must run under SET ROLE union_eyes_system.
  await db.exec('SET ROLE union_eyes_system');
  await db.query(
    `UPDATE workbooks SET stripe_payment_ref = 'pi_contended', claim_token = 'tok_contended',
           claim_token_expires_at = now() + interval '3 days' WHERE id = $1`,
    [CONTENDED],
  );
  await db.query(
    `UPDATE workbooks SET claim_token = 'tok_user1', claim_token_expires_at = now() + interval '3 days' WHERE id = $1`,
    [CLAIMED_USER1],
  );
  await db.exec('RESET ROLE');

  return db;
}

let db: PGlite;
beforeAll(async () => {
  db = await buildFixture();
});

async function asRuntime(userId: string) {
  await db.exec('RESET ROLE');
  await db.query(`SELECT set_config('app.current_user_id', $1, false)`, [userId]);
  await db.exec('SET ROLE union_eyes_runtime');
}
async function asSystem() {
  await db.exec('RESET ROLE');
  await db.exec('SET ROLE union_eyes_system');
}
async function asOwner() {
  await db.exec('RESET ROLE');
}

describe('runtime principal (union_eyes_runtime) is denied credential/payment authority', () => {
  it('cannot ISSUE a claim credential on its own claimed workbook', async () => {
    await asRuntime('user-2');
    await expect(
      db.query(
        `UPDATE workbooks SET claim_token = 'x', claim_token_expires_at = now() + interval '1 day' WHERE id = $1`,
        [CLAIMED_USER2],
      ),
    ).rejects.toThrow(/system-owned/i);
  });

  it('cannot ROTATE an existing claim credential', async () => {
    await asRuntime('user-1');
    await expect(
      db.query(`UPDATE workbooks SET claim_token = 'rotated', claim_token_expires_at = now() WHERE id = $1`, [
        CLAIMED_USER1,
      ]),
    ).rejects.toThrow(/system-owned/i);
  });

  it('cannot CLEAR a claim credential directly', async () => {
    await asRuntime('user-1');
    await expect(
      db.query(
        `UPDATE workbooks SET claim_token = NULL, claim_token_expires_at = NULL WHERE id = $1`,
        [CLAIMED_USER1],
      ),
    ).rejects.toThrow(/system-owned/i);
  });

  it('cannot manufacture a stripe_payment_ref', async () => {
    await asRuntime('user-2');
    await expect(
      db.query(`UPDATE workbooks SET stripe_payment_ref = 'pi_forged' WHERE id = $1`, [CLAIMED_USER2]),
    ).rejects.toThrow(/system-owned/i);
  });

  it('cannot write workbook_purchases (no grant)', async () => {
    await asRuntime('user-2');
    await expect(
      db.query(
        `INSERT INTO workbook_purchases (workbook_id, stripe_payment_ref, tier_id, amount_cents)
         VALUES ($1, 'pi_runtime', 'workbook_self_guided', 100)`,
        [CLAIMED_USER2],
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it('is rejected for a partial credential pair (pair-consistency, all principals)', async () => {
    await asRuntime('user-2');
    await expect(
      db.query(`UPDATE workbooks SET claim_token = 'half' WHERE id = $1`, [CLAIMED_USER2]),
    ).rejects.toThrow(/credential pair inconsistent/i);
  });

  it('CAN still perform an ordinary allowed workbook update (not made immutable)', async () => {
    await asRuntime('user-1');
    const res = await db.query(`UPDATE workbooks SET status = 'archived' WHERE id = $1`, [CLAIMED_USER1]);
    expect(res.affectedRows).toBe(1);
  });
});

describe('superuser / owner is NOT an application authority for protected fields', () => {
  it('the owning (superuser) role cannot issue a claim credential directly', async () => {
    await asOwner();
    await expect(
      db.query(
        `UPDATE workbooks SET claim_token = 'owner_tok', claim_token_expires_at = now() + interval '1 day' WHERE id = $1`,
        [UNCLAIMED],
      ),
    ).rejects.toThrow(/system-owned/i);
  });

  it('the owning (superuser) role cannot manufacture a stripe_payment_ref', async () => {
    await asOwner();
    await expect(
      db.query(`UPDATE workbooks SET stripe_payment_ref = 'pi_owner' WHERE id = $1`, [UNCLAIMED]),
    ).rejects.toThrow(/system-owned/i);
  });
});

describe('system principal (union_eyes_system) holds the required authority', () => {
  it('can ISSUE a complete credential pair and set the payment identity', async () => {
    await asSystem();
    const res = await db.query(
      `UPDATE workbooks
         SET report_tier_id = 'workbook_self_guided',
             stripe_payment_ref = 'pi_fresh',
             claim_token = 'tok_fresh',
             claim_token_expires_at = now() + interval '3 days',
             status = 'awaiting_claim'
       WHERE id = $1 RETURNING id`,
      [UNCLAIMED],
    );
    expect(res.affectedRows).toBe(1);
  });

  it('can CLEAR a complete credential pair', async () => {
    await asSystem();
    const res = await db.query(
      `UPDATE workbooks SET claim_token = NULL, claim_token_expires_at = NULL WHERE id = $1 RETURNING id`,
      [UNCLAIMED],
    );
    expect(res.affectedRows).toBe(1);
  });

  it('is still rejected for a partial credential pair', async () => {
    await asSystem();
    await expect(
      db.query(`UPDATE workbooks SET claim_token = 'only_token' WHERE id = $1`, [UNCLAIMED_2]),
    ).rejects.toThrow(/credential pair inconsistent/i);
  });

  it('can INSERT a workbook purchase reservation', async () => {
    await asSystem();
    const res = await db.query(
      `INSERT INTO workbook_purchases (workbook_id, stripe_payment_ref, tier_id, amount_cents)
       VALUES ($1, 'pi_reserve', 'workbook_self_guided', 12500)
       ON CONFLICT DO NOTHING RETURNING id, workbook_id`,
      [UNCLAIMED_2],
    );
    expect(res.affectedRows).toBe(1);
  });

  it('can SELECT the conflicting purchase by stripe_payment_ref (grant gap closed)', async () => {
    await asSystem();
    const res = await db.query(
      `SELECT workbook_id FROM workbook_purchases WHERE stripe_payment_ref = 'pi_reserve' LIMIT 1`,
    );
    expect(res.rows.length).toBe(1);
    expect((res.rows[0] as { workbook_id: string }).workbook_id).toBe(UNCLAIMED_2);
  });

  it('can execute the guarded, fulfillable-only workbook UPDATE ... RETURNING', async () => {
    await asSystem();
    const res = await db.query(
      `UPDATE workbooks
         SET stripe_payment_ref = 'pi_guarded',
             claim_token = 'tok_guarded',
             claim_token_expires_at = now() + interval '3 days'
       WHERE id = $1 AND stripe_payment_ref IS NULL AND claim_token IS NULL
       RETURNING id`,
      [UNCLAIMED_2],
    );
    expect(res.affectedRows).toBe(1);
  });
});

describe('reservation-first atomicity (transaction rollback then successful retry)', () => {
  it('rolls the reservation back when the guarded update finds zero fulfillable rows, then a retry succeeds', async () => {
    await asSystem();

    // Attempt 1: reserve, then a guarded update that matches zero rows
    // (CONTENDED already has a payment ref). The app throws on zero rows; we
    // model that abort with ROLLBACK and prove the reservation did not persist.
    await db.exec('BEGIN');
    await db.query(
      `INSERT INTO workbook_purchases (workbook_id, stripe_payment_ref, tier_id, amount_cents)
       VALUES ($1, 'pi_retry', 'workbook_self_guided', 12500) ON CONFLICT DO NOTHING`,
      [CONTENDED],
    );
    const guarded = await db.query(
      `UPDATE workbooks SET stripe_payment_ref = 'pi_retry'
       WHERE id = $1 AND stripe_payment_ref IS NULL AND claim_token IS NULL RETURNING id`,
      [CONTENDED],
    );
    expect(guarded.affectedRows).toBe(0);
    await db.exec('ROLLBACK');

    await asSystem();
    const gone = await db.query(`SELECT id FROM workbook_purchases WHERE stripe_payment_ref = 'pi_retry'`);
    expect(gone.rows.length).toBe(0);

    // Attempt 2: same payment ref against a genuinely fulfillable workbook.
    await asOwner();
    await db.query(`INSERT INTO workbooks (id, status) VALUES ($1, 'awaiting_claim')`, [
      '00000000-0000-0000-0000-0000000000a4',
    ]);
    await asSystem();
    await db.exec('BEGIN');
    await db.query(
      `INSERT INTO workbook_purchases (workbook_id, stripe_payment_ref, tier_id, amount_cents)
       VALUES ($1, 'pi_retry', 'workbook_self_guided', 12500) ON CONFLICT DO NOTHING`,
      ['00000000-0000-0000-0000-0000000000a4'],
    );
    const win = await db.query(
      `UPDATE workbooks SET stripe_payment_ref = 'pi_retry', claim_token = 'tok_retry',
             claim_token_expires_at = now() + interval '3 days'
       WHERE id = $1 AND stripe_payment_ref IS NULL AND claim_token IS NULL RETURNING id`,
      ['00000000-0000-0000-0000-0000000000a4'],
    );
    expect(win.affectedRows).toBe(1);
    await db.exec('COMMIT');

    await asSystem();
    const present = await db.query(`SELECT id FROM workbook_purchases WHERE stripe_payment_ref = 'pi_retry'`);
    expect(present.rows.length).toBe(1);
  });
});
