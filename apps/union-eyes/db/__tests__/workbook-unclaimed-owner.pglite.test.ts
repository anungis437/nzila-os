/**
 * In-process proof that an unclaimed workbook can be fulfilled or claimed once.
 * PGlite is one connection, so the two transactions serialize. A second session
 * against native PostgreSQL stays READY_FOR_VS_EXECUTION.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { sql } from 'drizzle-orm'

const CALLER_A = '11111111-1111-4111-8111-111111111111'
const CALLER_B = '22222222-2222-4222-8222-222222222222'
const WORKBOOK = '33333333-3333-4333-8333-333333333333'

let pg: PGlite
let db: ReturnType<typeof drizzle>

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(`
    CREATE ROLE union_eyes_runtime NOSUPERUSER NOBYPASSRLS NOLOGIN;
    CREATE ROLE union_eyes_system NOSUPERUSER NOBYPASSRLS NOLOGIN;
    CREATE TABLE workbooks (
      id uuid PRIMARY KEY,
      status text NOT NULL DEFAULT 'draft',
      stripe_payment_ref text,
      claim_token text,
      claim_token_expires_at timestamptz,
      claimed_by_user_id text,
      claimed_org_id uuid,
      claimed_at timestamptz
    );
    ALTER TABLE workbooks ENABLE ROW LEVEL SECURITY;
    ALTER TABLE workbooks FORCE ROW LEVEL SECURITY;
    CREATE POLICY ue_user_isolation_all ON workbooks FOR ALL TO union_eyes_runtime
      USING (claimed_by_user_id = current_setting('app.current_user_id', true))
      WITH CHECK (claimed_by_user_id = current_setting('app.current_user_id', true));
    CREATE POLICY ue_system_full_access ON workbooks FOR ALL TO union_eyes_system
      USING (true) WITH CHECK (true);
    GRANT SELECT, UPDATE ON workbooks TO union_eyes_runtime;
    GRANT SELECT, UPDATE ON workbooks TO union_eyes_system;
  `)
  db = drizzle(pg)
})

afterAll(async () => {
  await pg?.close()
})

async function reset(state: { token?: string | null; claimedBy?: string | null; claimedOrg?: string | null; payment?: string | null }) {
  await pg.exec('RESET ROLE')
  await pg.query(
    `INSERT INTO workbooks (id, status, claim_token, claim_token_expires_at, claimed_by_user_id, claimed_org_id, stripe_payment_ref)
     VALUES ($1, 'draft', $2, now() + interval '1 day', $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET
       claim_token = EXCLUDED.claim_token,
       claim_token_expires_at = EXCLUDED.claim_token_expires_at,
       claimed_by_user_id = EXCLUDED.claimed_by_user_id,
       claimed_org_id = EXCLUDED.claimed_org_id,
       claimed_at = CASE WHEN EXCLUDED.claimed_by_user_id IS NULL THEN NULL ELSE now() END,
       stripe_payment_ref = EXCLUDED.stripe_payment_ref,
       status = 'draft'`,
    [WORKBOOK, state.token ?? null, state.claimedBy ?? null, state.claimedOrg ?? null, state.payment ?? null],
  )
  await pg.exec('SET ROLE union_eyes_system')
}

async function claim(userId: string, organizationId: string) {
  return db.transaction(async (tx) => {
    const result = await tx.execute(sql`
      UPDATE workbooks
         SET claimed_by_user_id = ${userId},
             claimed_org_id = ${organizationId}::uuid,
             claimed_at = now(),
             claim_token = NULL,
             claim_token_expires_at = NULL,
             status = 'active'
       WHERE id = ${WORKBOOK}::uuid
         AND claim_token = 'token-0123456789'
         AND claimed_at IS NULL
         AND claimed_by_user_id IS NULL
         AND claim_token_expires_at > now()
       RETURNING id
    `) as unknown as { rows: Array<{ id: string }> }
    return result.rows.length
  })
}

describe('workbook unclaimed owner', () => {
  it('lets one of two claims win and stores that caller organization', async () => {
    await reset({ token: 'token-0123456789' })
    const [a, b] = await Promise.all([
      claim('user-a', CALLER_A),
      claim('user-b', CALLER_B),
    ])
    expect([a, b].sort()).toEqual([0, 1])
    await pg.exec('RESET ROLE')
    const row = (await pg.query<{ claimed_by_user_id: string; claimed_org_id: string }>(
      'SELECT claimed_by_user_id, claimed_org_id FROM workbooks WHERE id = $1',
      [WORKBOOK],
    )).rows[0]
    const winner = row.claimed_by_user_id === 'user-a'
      ? { userId: 'user-a', organizationId: CALLER_A }
      : { userId: 'user-b', organizationId: CALLER_B }
    expect(row).toEqual({ claimed_by_user_id: winner.userId, claimed_org_id: winner.organizationId })
  })

  it('does not move a claimed workbook to another user or organization', async () => {
    await reset({ token: 'token-0123456789', claimedBy: 'user-a', claimedOrg: CALLER_A })
    expect(await claim('user-b', CALLER_B)).toBe(0)
    await pg.exec('RESET ROLE')
    const row = (await pg.query<{ claimed_by_user_id: string; claimed_org_id: string }>(
      'SELECT claimed_by_user_id, claimed_org_id FROM workbooks WHERE id = $1',
      [WORKBOOK],
    )).rows[0]
    expect(row).toEqual({ claimed_by_user_id: 'user-a', claimed_org_id: CALLER_A })
  })

  it('hides the claimed workbook from the other user', async () => {
    await reset({ token: null, claimedBy: 'user-a', claimedOrg: CALLER_A })
    await pg.exec('RESET ROLE')
    await pg.query(`SELECT set_config('app.current_user_id', 'user-b', false)`)
    await pg.exec('SET ROLE union_eyes_runtime')
    const visible = await pg.query('SELECT id FROM workbooks WHERE id = $1', [WORKBOOK])
    expect(visible.rows).toEqual([])
  })

  it('does not fulfil a workbook that already has an owner', async () => {
    await reset({ claimedBy: 'user-a', claimedOrg: CALLER_A })
    const updated = await db.transaction(async (tx) => {
      const result = await tx.execute(sql`
        UPDATE workbooks
           SET stripe_payment_ref = 'pi_late',
               claim_token = 'token-0123456789',
               claim_token_expires_at = now() + interval '3 days',
               status = 'awaiting_claim'
         WHERE id = ${WORKBOOK}::uuid
           AND stripe_payment_ref IS NULL
           AND claim_token IS NULL
           AND claimed_by_user_id IS NULL
         RETURNING id
      `) as unknown as { rows: unknown[] }
      return result.rows.length
    })
    expect(updated).toBe(0)
  })

  it('lets one of two fulfilments win and leaves the workbook unclaimed', async () => {
    await reset({})
    const fulfil = (paymentRef: string) => db.transaction(async (tx) => {
      const result = await tx.execute(sql`
        UPDATE workbooks
           SET stripe_payment_ref = ${paymentRef},
               claim_token = 'token-0123456789',
               claim_token_expires_at = now() + interval '3 days',
               status = 'awaiting_claim'
         WHERE id = ${WORKBOOK}::uuid
           AND stripe_payment_ref IS NULL
           AND claim_token IS NULL
           AND claimed_by_user_id IS NULL
         RETURNING id
      `) as unknown as { rows: unknown[] }
      return result.rows.length
    })
    const [a, b] = await Promise.all([fulfil('pi_a'), fulfil('pi_b')])
    expect([a, b].sort()).toEqual([0, 1])
    await pg.exec('RESET ROLE')
    const row = (await pg.query<{ stripe_payment_ref: string; claimed_by_user_id: string | null }>(
      'SELECT stripe_payment_ref, claimed_by_user_id FROM workbooks WHERE id = $1',
      [WORKBOOK],
    )).rows[0]
    expect(row.claimed_by_user_id).toBeNull()
    expect(['pi_a', 'pi_b']).toContain(row.stripe_payment_ref)
  })

  it('keeps the route predicates on the unclaimed owner', () => {
    const root = path.resolve(__dirname, '../..')
    const claim = readFileSync(path.join(root, 'app/api/workbook/[id]/claim/route.ts'), 'utf8')
    const stripe = readFileSync(path.join(root, 'app/api/payments/webhooks/stripe/route.ts'), 'utf8')
    expect(claim).toContain('isNull(workbooks.claimedByUserId)')
    expect(claim).toContain('getOrganizationIdForUser(userId)')
    expect(claim).not.toContain('organizationId: z')
    expect(stripe).toContain('isNull(workbooks.claimedByUserId)')
    expect(stripe).toContain('isNull(workbooks.stripePaymentRef)')
    expect(stripe).toContain('isNull(workbooks.claimToken)')
  })
})
