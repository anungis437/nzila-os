/**
 * Governed financial duties (UE-CONV-D-001 / D-002 / D-003) against the COMBINED deployed schema (Django `migrate` + the
 * approved Drizzle bootstrap), with the real finance route adapter and arrears posting running as the `union_eyes_runtime`
 * role under forced row-level security and the exact grants the storage-authority manifest activates. Nothing is mirrored;
 * the PGlite suite (lib/finance/finance-duties.pglite.test.ts) has no roles, so everything role-, grant- and
 * policy-dependent is proved here.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a FRESH disposable database (same preparation
 * as thread-assignment.postgres.test.ts). The suite installs a fault trigger on the audit tables of that database. Not a
 * staging isolation pass, not a credentialed acceptance.
 */
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { seedMembership, U, type Db } from './authority-kernel-harness'
import { kit } from './authority-kernel-testkit'
import { membershipSourceVia } from '../../lib/authority/store/identity'
import type { SqlExecutor } from '../../lib/authority/store/executor'
import type { RLSTx } from '@/lib/db/with-rls-context'

const URL = process.env.UE_AUTHORITY_COMBINED_URL

const state = vi.hoisted(() => ({ db: null as unknown }))
const m = vi.hoisted(() => ({ audit: vi.fn() }))
// Only the best-effort refusal logger is a double; every transactional audit write is real.
vi.mock('@/lib/audit-logger', () => ({ auditLog: m.audit, AuditEventType: { AUTH_FAILED: 'AUTH_FAILED' }, AuditSeverity: { HIGH: 'HIGH' } }))

type Tx = { execute: (q: unknown) => Promise<unknown> }
type Role = 'union_eyes_runtime' | 'union_eyes_system'
async function inRole<T>(role: Role, org: string, user: string, work: (tx: RLSTx) => Promise<T>): Promise<T> {
  return (state.db as { transaction: (f: (tx: Tx) => Promise<T>) => Promise<T> }).transaction(async (tx) => {
    await tx.execute(sql.raw(`SET LOCAL ROLE ${role}`))
    await tx.execute(sql`SELECT set_config('app.current_user_id', ${user}, true), set_config('app.current_org_id', ${org}, true)`)
    return work(tx as unknown as RLSTx)
  })
}

const adapterModule = URL ? await import('@/lib/authority/store/finance-route-adapter') : null
const arrearsModule = URL ? await import('@/lib/dues/arrears-payment') : null
const responseModule = URL ? await import('@/lib/finance/financial-duty-response') : null

describe.skipIf(!URL)('governed financial duties on the combined deployed schema, as the runtime role', () => {
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  const sfx = randomUUID().slice(0, 8)
  const P = {
    treasurer: U.treasurer,
    vp: U.vp,
    president: U.president,
    reconciler: `fin-rec-${sfx}`,
    otherAccount: `fin-oth-${sfx}`,
    third: `fin-third-${sfx}`,
    member: `fin-mem-${sfx}`,
    member2: `fin-mem2-${sfx}`,
    foreign: `fin-foreign-${sfx}`,
  }
  const ACCT = randomUUID()
  const OTHER_ACCT = randomUUID()
  let admin: pg.Client
  let pool: pg.Pool
  let rtClient: pg.Client
  let sysClient: pg.Client
  let k: ReturnType<typeof kit>

  const scalar = async (query: string, params: unknown[] = []) => Number((await admin.query(query, params)).rows[0].n)
  const money = (account: string, over: Record<string, unknown> = {}) => ({ scope: { accountIds: [account] }, monetaryLimitMinor: 500_000, currency: 'CAD', ...over })
  const adapter = () => adapterModule!
  const arrears = () => arrearsModule!

  const addPayment = (id: string, amount: string, member: string | null, org = ORG_A, currency = 'CAD') =>
    admin.query(`INSERT INTO payments (id, organization_id, created_at, updated_at, type, method, amount, currency, member_id) VALUES ($1,$2,now(),now(),'dues','cash',$3,$4,$5)`, [id, org, amount, currency, member])
  const addArrears = (member: string, owed: string, org = ORG_A) =>
    admin.query(`INSERT INTO member_arrears (user_id, organization_id, total_owed, arrears_status) VALUES ($1,$2,$3,'warning')`, [member, org, owed])
  const steps = (pay: string, step: string) => scalar(`SELECT count(*) AS n FROM ue_authority_financial_steps WHERE subject_id = $1 AND step = $2`, [pay, step])
  const ledgerRows = (member: string) => scalar(`SELECT count(*) AS n FROM member_dues_ledger WHERE user_id = $1`, [member])
  const owed = async (member: string) => (await admin.query(`SELECT total_owed::text AS t FROM member_arrears WHERE user_id = $1`, [member])).rows[0].t as string

  // Canonical V2 writes the hash-chained public.audit_logs; otherwise the same transaction writes audit_security.audit_logs.
  const audits = (action: string, org = ORG_A) =>
    scalar(
      `SELECT (SELECT count(*) FROM audit_security.audit_logs WHERE action = $1 AND organization_id = $2) + (SELECT count(*) FROM public.audit_logs WHERE action = $1 AND organization_id = $2) AS n`,
      [action, org],
    )
  const failAudit = (action: string) => admin.query(`INSERT INTO ue_fin_audit_faults(action) VALUES ($1) ON CONFLICT DO NOTHING`, [action])
  const clearFaults = () => admin.query(`DELETE FROM ue_fin_audit_faults`)

  const faultRaised = async (promise: Promise<unknown>) => {
    const error = (await promise.then(() => null, (e: unknown) => e)) as { message?: string; cause?: { message?: string } } | null
    expect(error, 'expected the audit fault to abort the transaction').not.toBeNull()
    expect(`${error?.message} ${error?.cause?.message}`).toMatch(/injected audit fault/)
  }
  const refused = (promise: Promise<unknown>, code: string, status: number) => expect(promise).rejects.toMatchObject({ code, status })
  const dbRefused = async (promise: Promise<unknown>, pattern: RegExp) => {
    const error = (await promise.then(() => null, (e: unknown) => e)) as { message?: string; cause?: { message?: string } } | null
    expect(error, 'expected the statement to be refused').not.toBeNull()
    expect(`${error!.message} ${error!.cause?.message ?? ''}`).toMatch(pattern)
  }

  const step = (who: string, transactionId: string, kind: 'registered' | 'prepared' | 'approved' | 'executed' | 'reconciled', extra: Record<string, unknown> = {}, org = ORG_A) =>
    inRole('union_eyes_runtime', org, who, (tx) =>
      adapter().performFinancialDuty(tx, { userId: who, organizationId: org, transactionId, step: kind, ...extra }, undefined, { action: `finance.payment.${kind}`, resourceType: 'payments', resourceId: transactionId }),
    )
  const register = (who: string, pay: string, account = ACCT, org = ORG_A) => step(who, pay, 'registered', { accountId: account, requiredApprovals: 1 }, org)
  const post = (who: string, member: string, pay: string, amount: number) =>
    inRole('union_eyes_runtime', ORG_A, who, (tx) => arrears().recordArrearsPayment(tx, { userId: who, organizationId: ORG_A, memberId: member, paymentId: pay, amount }))
  const view = (who: string, pay: string, org = ORG_A) =>
    inRole('union_eyes_runtime', org, who, (tx) => adapter().readFinancialTransaction(tx, { userId: who, organizationId: org, transactionId: pay }))
  const duty = (who: string, pay: string, action: 'finance:view' | 'finance:approve', org = ORG_A) =>
    inRole('union_eyes_runtime', org, who, (tx) => adapter().requireFinancialDuty(tx, { userId: who, organizationId: org, transactionId: pay, action }))

  /** Registers, prepares and approves a payment through the real chain, leaving it ready for the executor. */
  async function approvedPayment(amount: string, member: string) {
    const pay = randomUUID()
    await addPayment(pay, amount, member)
    await register(P.treasurer, pay)
    await step(P.treasurer, pay, 'prepared')
    await step(P.vp, pay, 'approved')
    return pay
  }

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    const d: Db = { exec: (s) => admin.query(s), query: (s, p) => admin.query(s, p as unknown[]) as never }
    for (const [org, slug] of [[ORG_A, `fin-a-${sfx}`], [ORG_B, `fin-b-${sfx}`]]) {
      await admin.query(
        `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
         VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
        [org, slug, slug],
      )
    }
    const roles: Array<[string, string]> = [
      [U.president, 'president'], [U.vp, 'vice_president'], [U.treasurer, 'secretary_treasurer'], [P.reconciler, 'secretary_treasurer'],
      [P.otherAccount, 'secretary_treasurer'], [P.third, 'secretary_treasurer'], [P.member, 'member'], [P.member2, 'member'],
    ]
    for (const [user, role] of roles) await seedMembership(d, user, ORG_A, role)
    await seedMembership(d, P.foreign, ORG_B, 'secretary_treasurer')
    // Fault injection on both audit sinks of the disposable database, so rollback is proven against the real audit paths.
    await admin.query(`CREATE TABLE IF NOT EXISTS ue_fin_audit_faults (action text PRIMARY KEY)`)
    await admin.query(`GRANT SELECT ON ue_fin_audit_faults TO PUBLIC`)
    await admin.query(`CREATE OR REPLACE FUNCTION ue_fin_audit_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF EXISTS (SELECT 1 FROM ue_fin_audit_faults WHERE action = NEW.action) THEN RAISE EXCEPTION 'injected audit fault'; END IF; RETURN NEW; END $$`)
    for (const table of ['audit_security.audit_logs', 'public.audit_logs']) {
      await admin.query(`DROP TRIGGER IF EXISTS ue_fin_audit_fault_trg ON ${table}`)
      await admin.query(`CREATE TRIGGER ue_fin_audit_fault_trg BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION ue_fin_audit_fault()`)
    }
    pool = new pg.Pool({ connectionString: URL, max: 6 })
    state.db = drizzle(pool)
    // The institution's own ceremony runs as the runtime role; cross-principal identity reads go through the bounded system reader.
    rtClient = new pg.Client({ connectionString: URL })
    await rtClient.connect()
    await rtClient.query('SET ROLE union_eyes_runtime')
    sysClient = new pg.Client({ connectionString: URL })
    await sysClient.connect()
    await sysClient.query('SET ROLE union_eyes_system')
    k = kit({ exec: (s) => rtClient.query(s), query: (s, p) => rtClient.query(s, p as unknown[]) as never }, membershipSourceVia(sysClient as unknown as SqlExecutor))
    await k.adoptDefaultRules(ORG_A)
  }, 180_000)

  afterAll(async () => {
    for (const table of ['audit_security.audit_logs', 'public.audit_logs']) await admin?.query(`DROP TRIGGER IF EXISTS ue_fin_audit_fault_trg ON ${table}`).catch(() => undefined)
    await rtClient?.end().catch(() => undefined)
    await sysClient?.end().catch(() => undefined)
    await pool?.end()
    await admin?.end()
  })
  afterEach(async () => {
    // A failed assertion must never leave a fault armed for the next financial journey.
    // Clearing this disposable-database fixture does not alter production audit behavior.
    delete process.env.UE_CANONICAL_BOOTSTRAP_V2
    await clearFaults()
    m.audit.mockClear()
  })

  it('applies the manifest privileges: the ledgers are append-only for the runtime role, row security is forced, and the system role has no finance authority', async () => {
    const has = async (role: Role, table: string, privilege: string) =>
      (await admin.query(`SELECT has_table_privilege($1, $2::regclass, $3) AS ok`, [role, table, privilege])).rows[0].ok as boolean
    for (const privilege of ['SELECT', 'INSERT']) {
      expect(await has('union_eyes_runtime', 'ue_authority_financial_steps', privilege), `steps ${privilege}`).toBe(true)
      expect(await has('union_eyes_runtime', 'member_dues_ledger', privilege), `ledger ${privilege}`).toBe(true)
    }
    for (const privilege of ['UPDATE', 'DELETE', 'TRUNCATE']) {
      expect(await has('union_eyes_runtime', 'ue_authority_financial_steps', privilege), `steps ${privilege}`).toBe(false)
      expect(await has('union_eyes_runtime', 'member_dues_ledger', privilege), `ledger ${privilege}`).toBe(false)
    }
    // The arrears balance is the one mutable row the posting changes, so the code's FOR UPDATE on it is permitted.
    for (const privilege of ['SELECT', 'INSERT', 'UPDATE']) expect(await has('union_eyes_runtime', 'member_arrears', privilege), `arrears ${privilege}`).toBe(true)
    expect(await has('union_eyes_runtime', 'payments', 'SELECT')).toBe(true)
    for (const table of ['ue_authority_financial_steps', 'ue_authority_mandates', 'ue_authority_events']) {
      expect(await has('union_eyes_system', table, 'SELECT'), `system ${table}`).toBe(false)
    }
    const forced = (await admin.query(`SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN ('ue_authority_financial_steps','member_arrears','member_dues_ledger','payments') AND relkind = 'r' ORDER BY 1`)).rows
    expect(forced.map((r) => r.relname)).toEqual(['member_arrears', 'member_dues_ledger', 'payments', 'ue_authority_financial_steps'])
    expect(forced.every((r) => r.relrowsecurity && r.relforcerowsecurity)).toBe(true)
  })

  describe('before the institution issues any financial mandate', () => {
    const PAY = randomUUID()
    beforeAll(async () => { await addPayment(PAY, '60.00', P.member) })

    it('every finance duty is refused with an explicit, non-oracle answer', async () => {
      await refused(register(P.treasurer, PAY), 'FINANCIAL_MANDATES_NOT_ISSUED', 403)
      await refused(view(P.treasurer, PAY), 'FINANCIAL_MANDATES_NOT_ISSUED', 403)
      await refused(step(P.president, PAY, 'approved'), 'FINANCIAL_MANDATES_NOT_ISSUED', 403)
      // The same answer for a transaction that does not exist: it says nothing about any transaction id.
      await refused(duty(P.treasurer, randomUUID(), 'finance:view'), 'FINANCIAL_MANDATES_NOT_ISSUED', 403)
      // A member with no financial capacity is told nothing about the state of the institution either.
      await refused(duty(P.member, PAY, 'finance:view'), 'NOT_FOUND', 404)
    })

    it('posting to arrears is refused and changes nothing', async () => {
      await addArrears(P.member, '100.00')
      await refused(post(P.president, P.member, PAY, 60), 'FINANCIAL_MANDATES_NOT_ISSUED', 403)
      expect(await ledgerRows(P.member)).toBe(0)
      expect(await owed(P.member)).toBe('100.00')
    })
  })

  describe('a mandate for a different account confers nothing on this one', () => {
    const PAY = randomUUID()
    beforeAll(async () => {
      await addPayment(PAY, '60.00', P.member)
      await k.grantMandate('financial', P.otherAccount, ['view', 'prepare'], money(OTHER_ACCT, { approver: U.vp }), ORG_A)
    })

    it('registering on an account the caller holds no duty for is a recorded 403, and the transaction stays invisible', async () => {
      await refused(register(P.otherAccount, PAY, ACCT), 'DUTY_NOT_HELD', 403)
      expect(m.audit).toHaveBeenCalledTimes(1)
      expect(await steps(PAY, 'registered')).toBe(0)
      await refused(view(P.otherAccount, PAY), 'NOT_FOUND', 404)
    })
  })

  describe('prepare, approve, execute and reconcile by different principals', () => {
    const PAY = randomUUID()
    const BAD_PAYER = randomUUID()

    beforeAll(async () => {
      await addPayment(PAY, '60.00', P.member)
      await addPayment(BAD_PAYER, '10.00', P.member2)
      await k.grantMandate('financial', U.treasurer, ['view', 'prepare'], money(ACCT, { approver: U.vp }), ORG_A)
      await k.grantMandate('financial', U.vp, ['view', 'approve'], money(ACCT, { issuer: U.president, approver: U.treasurer }), ORG_A)
      await k.grantMandate('financial', U.president, ['view', 'execute'], money(ACCT, { issuer: U.vp, approver: U.treasurer }), ORG_A)
      await k.grantMandate('financial', P.reconciler, ['view', 'reconcile'], money(ACCT, { approver: U.vp }), ORG_A)
    })

    it('a caller without a financial capacity cannot register or see anything', async () => {
      await refused(register(P.member, PAY), 'DUTY_NOT_HELD', 403)
      await refused(duty(P.member, PAY, 'finance:view'), 'NOT_FOUND', 404)
    })

    it('registers and prepares; the preparer cannot approve their own transaction', async () => {
      await register(P.treasurer, PAY)
      await refused(register(P.treasurer, PAY), 'STEP_REFUSED', 409)
      await step(P.treasurer, PAY, 'prepared')
      const attempt = step(P.treasurer, PAY, 'approved')
      await refused(attempt, 'DUTY_NOT_HELD', 403)
      await expect(attempt).rejects.toMatchObject({ reasons: expect.arrayContaining(['SELF_APPROVAL']) })
      expect(await steps(PAY, 'approved')).toBe(0)
      expect(await audits('finance.payment.registered')).toBe(1)
    })

    it('a principal on another account cannot see the transaction at all', async () => {
      await refused(view(P.otherAccount, PAY), 'NOT_FOUND', 404)
      await refused(step(P.otherAccount, PAY, 'approved'), 'NOT_FOUND', 404)
    })

    it('the database refuses a raw out-of-order or duplicate ledger write from the runtime role, even with a valid session actor', async () => {
      const raw = (actor: string, kind: string, pay = PAY) =>
        inRole('union_eyes_runtime', ORG_A, actor, (tx) => (tx as unknown as Tx).execute(sql`INSERT INTO ue_authority_financial_steps (organization_id, subject_id, step, actor) VALUES (${ORG_A}, ${pay}, ${kind}, ${actor})`))
      // Not yet approved: executing, reconciling or approving out of order is a state refusal.
      await dbRefused(raw(P.president, 'executed'), /STATE_NOT_ELIGIBLE: required approvals not met/)
      await dbRefused(raw(P.reconciler, 'reconciled'), /STATE_NOT_ELIGIBLE: not executed/)
      await dbRefused(raw(P.treasurer, 'approved'), /SEGREGATION_OF_DUTIES: the preparer cannot approve/)
      // An unregistered transaction accepts no step at all.
      await dbRefused(raw(P.treasurer, 'prepared', BAD_PAYER), /STATE_NOT_ELIGIBLE: transaction is not registered/)
      // A second registration or preparation is refused by the unique ledger index.
      await dbRefused(inRole('union_eyes_runtime', ORG_A, P.treasurer, (tx) => (tx as unknown as Tx).execute(sql`INSERT INTO ue_authority_financial_steps (organization_id, subject_id, step, actor, account_id, required_approvals, amount_minor, currency) VALUES (${ORG_A}, ${PAY}, 'registered', ${P.treasurer}, ${ACCT}, 1, 6000, 'CAD')`)), /ue_authority_fin_step_uq/)
      // A step recorded under someone else's identity is refused by the actor guard.
      await dbRefused(inRole('union_eyes_runtime', ORG_A, P.treasurer, (tx) => (tx as unknown as Tx).execute(sql`INSERT INTO ue_authority_financial_steps (organization_id, subject_id, step, actor) VALUES (${ORG_A}, ${PAY}, 'approved', ${U.vp})`)), /ACTOR_NOT_SESSION/)
      expect(await steps(PAY, 'executed')).toBe(0)
      expect(await steps(PAY, 'approved')).toBe(0)
    })

    it('the approver, and only an approver, can approve; approving twice is refused', async () => {
      await refused(step(P.president, PAY, 'approved'), 'DUTY_NOT_HELD', 403)
      await step(P.vp, PAY, 'approved')
      await refused(step(P.vp, PAY, 'approved'), 'DUTY_NOT_HELD', 403)
      await dbRefused(inRole('union_eyes_runtime', ORG_A, P.vp, (tx) => (tx as unknown as Tx).execute(sql`INSERT INTO ue_authority_financial_steps (organization_id, subject_id, step, actor) VALUES (${ORG_A}, ${PAY}, 'approved', ${P.vp})`)), /ue_authority_fin_approver_uq/)
      const seen = await view(P.treasurer, PAY)
      expect(seen).toMatchObject({ state: 'approved', amountMinor: 6000, currency: 'CAD', accountId: ACCT, approvalsRecorded: 1 })
    })

    it('neither the preparer nor the approver can execute', async () => {
      await refused(post(P.treasurer, P.member, PAY, 60), 'DUTY_NOT_HELD', 403)
      const viaApprover = post(P.vp, P.member, PAY, 60)
      await refused(viaApprover, 'DUTY_NOT_HELD', 403)
      await expect(viaApprover).rejects.toMatchObject({ reasons: expect.arrayContaining(['SEGREGATION_OF_DUTIES']) })
    })

    it('an amount that differs from the record is refused, and so is a payer who is not the arrears member', async () => {
      await refused(post(P.president, P.member, PAY, 59.99), 'FACT_MISMATCH', 409)
      await expect(post(P.president, P.member, PAY, 60.001)).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
      await addArrears(P.member2, '30.00')
      await refused(post(P.president, P.member2, PAY, 60), 'FACT_MISMATCH', 409)
      expect(await steps(PAY, 'executed')).toBe(0)
      expect(await ledgerRows(P.member)).toBe(0)
      expect(await ledgerRows(P.member2)).toBe(0)
      expect(await owed(P.member)).toBe('100.00')
    })

    it('an audit fault on either audit sink rolls back the ledger entry, the arrears update and the financial step together', async () => {
      // dues.arrears.payment_record goes to audit_security.audit_logs (outside Canonical V2); authority.finance.executed to public.audit_logs.
      for (const action of ['dues.arrears.payment_record', 'authority.finance.executed']) {
        await failAudit(action)
        await faultRaised(post(P.president, P.member, PAY, 60))
        expect(await steps(PAY, 'executed'), action).toBe(0)
        expect(await ledgerRows(P.member), action).toBe(0)
        expect(await owed(P.member), action).toBe('100.00')
        await clearFaults()
      }
    })

    it('an independent executor posts it once: ledger, arrears, step and both audit records commit together', async () => {
      const out = await post(P.president, P.member, PAY, 60)
      expect(out.balanceAfter).toBe(40)
      expect(await steps(PAY, 'executed')).toBe(1)
      expect(await ledgerRows(P.member)).toBe(1)
      expect(await owed(P.member)).toBe('40.00')
      const ledger = (await admin.query(`SELECT amount::text AS amount, reference_id::text AS reference_id, created_by FROM member_dues_ledger WHERE user_id = $1`, [P.member])).rows[0]
      expect(ledger).toMatchObject({ amount: '60.00', reference_id: PAY, created_by: P.president })
      expect(await audits('dues.arrears.payment_record')).toBe(1)
      expect(await scalar(`SELECT count(*) AS n FROM public.audit_logs WHERE action = 'authority.finance.executed' AND organization_id = $1`, [ORG_A])).toBe(1)
    })

    it('cannot be posted twice, and the executor cannot reconcile their own execution', async () => {
      await refused(post(P.president, P.member, PAY, 60), 'DUTY_NOT_HELD', 403)
      expect(await ledgerRows(P.member)).toBe(1)
      await refused(step(P.president, PAY, 'reconciled'), 'DUTY_NOT_HELD', 403)
      await refused(step(P.treasurer, PAY, 'reconciled'), 'DUTY_NOT_HELD', 403)
    })

    it('an independent reconciler closes it', async () => {
      await step(P.reconciler, PAY, 'reconciled')
      expect((await view(P.treasurer, PAY)).state).toBe('reconciled')
    })

    it('keeps the ledgers append-only for the runtime role: UPDATE, DELETE, TRUNCATE and row locks are permission-denied', async () => {
      const runtime = (work: (tx: Tx) => Promise<unknown>) => inRole('union_eyes_runtime', ORG_A, P.president, (tx) => work(tx as unknown as Tx))
      await dbRefused(runtime((t) => t.execute(sql`UPDATE ue_authority_financial_steps SET amount_minor = 1 WHERE subject_id = ${PAY}`)), /permission denied/)
      await dbRefused(runtime((t) => t.execute(sql`DELETE FROM ue_authority_financial_steps WHERE subject_id = ${PAY}`)), /permission denied/)
      await dbRefused(runtime((t) => t.execute(sql`UPDATE member_dues_ledger SET amount = 1 WHERE user_id = ${P.member}`)), /permission denied/)
      await dbRefused(runtime((t) => t.execute(sql`DELETE FROM member_dues_ledger WHERE user_id = ${P.member}`)), /permission denied/)
      await dbRefused(runtime((t) => t.execute(sql`TRUNCATE member_dues_ledger`)), /permission denied/)
      // Locking rows of a table without UPDATE privilege is itself refused: no code path may SELECT ... FOR UPDATE on these tables.
      await dbRefused(runtime((t) => t.execute(sql`SELECT id FROM member_dues_ledger WHERE user_id = ${P.member} FOR UPDATE`)), /permission denied/)
      await dbRefused(runtime((t) => t.execute(sql`SELECT id FROM ue_authority_financial_steps WHERE subject_id = ${PAY} FOR UPDATE`)), /permission denied/)
      // The arrears row the posting does lock is lockable, and its lock needs no more than the UPDATE privilege it holds.
      await runtime((t) => t.execute(sql`SELECT id FROM member_arrears WHERE user_id = ${P.member} FOR UPDATE`))
      expect(await steps(PAY, 'executed')).toBe(1)
      expect(await ledgerRows(P.member)).toBe(1)
    })

    it('an audit fault on a plain step, on either sink, rolls the step back', async () => {
      const PAY2 = randomUUID()
      await addPayment(PAY2, '12.00', P.member)
      await register(P.treasurer, PAY2)
      await failAudit('finance.payment.prepared')
      await faultRaised(step(P.treasurer, PAY2, 'prepared'))
      expect(await steps(PAY2, 'prepared')).toBe(0)
      await clearFaults()
      await step(P.treasurer, PAY2, 'prepared')
      expect(await steps(PAY2, 'prepared')).toBe(1)

      // This suite exercises the legacy-lineage runtime role and its real audit sink.
      // Canonical V2 requires a live auth session and the auth-owned membership reader;
      // flipping an environment flag does not install that topology or prove V2 atomicity.
      // Its missing-reader refusal is covered separately below.
    })

    it('fails closed when Canonical V2 is requested without its auth-owned membership reader', async () => {
      // This combined legacy fixture has no live V2 session/reader. If that changes,
      // the suite must be upgraded to a real session-bound V2 acceptance rather than
      // silently treating this test as proof of the canonical audit chain.
      const reader = await admin.query(`SELECT to_regprocedure('user_management.ue_authority_membership_rows(uuid,text[])') AS fn`)
      expect(reader.rows[0].fn, 'legacy fixture unexpectedly contains the V2 reader; run session-bound V2 qualification').toBeNull()
      const pay = randomUUID()
      await addPayment(pay, '13.00', P.member)
      process.env.UE_CANONICAL_BOOTSTRAP_V2 = '1'
      try {
        const error = await register(P.treasurer, pay).then(() => null, (e: { message?: string; cause?: { message?: string } }) => e)
        expect(error, 'V2 must not succeed without its live identity authority').not.toBeNull()
        expect(`${error?.message} ${error?.cause?.message}`).toMatch(/ue_authority_membership_rows/)
        expect(await steps(pay, 'registered')).toBe(0)
        expect(await scalar(`SELECT count(*) AS n FROM public.audit_logs WHERE action = 'finance.payment.registered' AND organization_id = $1 AND resource_id = $2`, [ORG_A, pay])).toBe(0)
      } finally {
        delete process.env.UE_CANONICAL_BOOTSTRAP_V2
      }
    })

    it('lets exactly one of two truly concurrent executions win, on separate connections', async () => {
      const member = `fin-race-${sfx}`
      await addArrears(member, '100.00')
      const pay = await approvedPayment('25.00', member)
      const outcomes = await Promise.allSettled([post(P.president, member, pay, 25), post(P.president, member, pay, 25)])
      expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1)
      expect(outcomes.filter((o) => o.status === 'rejected')).toHaveLength(1)
      expect(await steps(pay, 'executed')).toBe(1)
      expect(await ledgerRows(member)).toBe(1)
      expect(await owed(member)).toBe('75.00')
    })

    it('a membership that is revoked, then restored, ends and returns the duty at once (read live, never cached)', async () => {
      const pay = randomUUID()
      await addPayment(pay, '20.00', P.member)
      await register(P.treasurer, pay)
      await step(P.treasurer, pay, 'prepared')
      await admin.query(`UPDATE user_management.organization_users SET is_active = false WHERE user_id = $1 AND organization_id = $2`, [U.vp, ORG_A])
      await expect(step(P.vp, pay, 'approved')).rejects.toMatchObject({ status: expect.any(Number) })
      expect(await steps(pay, 'approved')).toBe(0)
      const denied = await step(P.vp, pay, 'approved').then(() => null, (e: { code: string }) => e.code)
      expect(['NOT_FOUND', 'DUTY_NOT_HELD']).toContain(denied)
      await admin.query(`UPDATE user_management.organization_users SET is_active = true WHERE user_id = $1 AND organization_id = $2`, [U.vp, ORG_A])
      await step(P.vp, pay, 'approved')
      expect(await steps(pay, 'approved')).toBe(1)
    })

    it('turns each real refusal into its documented HTTP answer', async () => {
      const failure = (await step(P.president, PAY, 'approved').then(() => null, (e: unknown) => e)) as Error
      const response = responseModule!.financialDutyErrorResponse(failure)
      expect(response?.status).toBe(403)
      expect(await response?.json()).toMatchObject({ success: false, error: { code: 'DUTY_NOT_HELD' } })
      const hidden = responseModule!.financialDutyErrorResponse(await view(P.otherAccount, PAY).then(() => null, (e: unknown) => e))
      expect(hidden?.status).toBe(404)
    })
  })

  describe('another organization is invisible', () => {
    const PAY_B = randomUUID()
    beforeAll(async () => { await addPayment(PAY_B, '60.00', P.member, ORG_B) })

    it('a foreign transaction is 404 for every duty, cannot be registered, and the foreign session cannot read or write this tenant', async () => {
      await refused(view(P.treasurer, PAY_B), 'NOT_FOUND', 404)
      await refused(step(P.vp, PAY_B, 'approved'), 'NOT_FOUND', 404)
      await refused(register(P.treasurer, PAY_B), 'NOT_FOUND', 404)
      await refused(post(P.president, P.member, PAY_B, 60), 'NOT_FOUND', 404)
      // A session bound to the other organization claiming this organization in the request is not a way in.
      const own = randomUUID()
      await addPayment(own, '9.00', P.member)
      await refused(inRole('union_eyes_runtime', ORG_B, P.foreign, (tx) => adapter().readFinancialTransaction(tx, { userId: P.foreign, organizationId: ORG_A, transactionId: own })), 'NOT_FOUND', 404)
      const countRows = (org: string, table: string) =>
        inRole('union_eyes_runtime', org, P.foreign, async (tx) => Number(((await (tx as unknown as Tx).execute(sql.raw(`SELECT count(*)::int AS n FROM ${table}`))) as { rows: Array<{ n: number }> }).rows[0].n))
      for (const table of ['ue_authority_financial_steps', 'ue_authority_mandates', 'member_arrears', 'member_dues_ledger']) {
        expect(await countRows(ORG_B, table), table).toBe(0)
        expect(await scalar(`SELECT count(*) AS n FROM ${table} WHERE organization_id = $1`, [ORG_A]), `${table} in the owning tenant`).toBeGreaterThan(0)
      }
      await dbRefused(
        inRole('union_eyes_runtime', ORG_B, P.foreign, (tx) => (tx as unknown as Tx).execute(sql`INSERT INTO member_dues_ledger (user_id, organization_id, transaction_type, effective_date, balance_before, balance_after, description) VALUES (${P.member}, ${ORG_A}, 'payment', now(), 1, 0, 'forged')`)),
        /row-level security/,
      )
      await dbRefused(
        inRole('union_eyes_runtime', ORG_B, P.foreign, (tx) => (tx as unknown as Tx).execute(sql`INSERT INTO ue_authority_financial_steps (organization_id, subject_id, step, actor, account_id, required_approvals, amount_minor, currency) VALUES (${ORG_A}, ${own}, 'registered', ${P.foreign}, ${ACCT}, 1, 900, 'CAD')`)),
        /row-level security/,
      )
      expect(await scalar(`SELECT count(*) AS n FROM member_dues_ledger WHERE description = 'forged'`)).toBe(0)
    })
  })
})
