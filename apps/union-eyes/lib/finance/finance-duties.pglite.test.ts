/**
 * Governed financial duties (UE-CONV-D-001 / D-002 / D-003) end to end on PGlite: the real kernel storage and loaders,
 * the real finance route adapter, the real arrears posting, the real atomic audit chain. `withRLSContext` is replaced by
 * a transaction that binds the acting principal and organization as the application does. Only the session, the
 * best-effort refusal logger and the Canonical-V2 switch are doubles. Not a staging pass.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { drizzle } from 'drizzle-orm/pglite'
import type { PGlite } from '@electric-sql/pglite'
import { newUuid, ORG, ORG_B, seedMembership, U } from '../../db/__tests__/authority-kernel-harness'
import { freshDb, kit } from '../../db/__tests__/authority-kernel-testkit'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { ddl } from '@/lib/documents/test-support/pglite-document-database'
import { memberArrears, memberDuesLedger } from '@/db/schema/dues-finance-schema'

const m = vi.hoisted(() => ({ audit: vi.fn() }))
vi.mock('@/lib/audit-logger', () => ({ auditLog: m.audit, AuditEventType: { AUTH_FAILED: 'AUTH_FAILED' }, AuditSeverity: { HIGH: 'HIGH' } }))
vi.mock('@/lib/auth/canonical-bootstrap', () => ({ currentStateContextEnabled: () => true }))
// These suites run the canonical session context against a legacy-shaped in-process database, so membership is read from the tables
// directly. The topology-aware source (definer function under V2) has its own tests and a native proof.
vi.mock('@/lib/authority/store/active-membership-source', async () => ({ activeMembershipSource: (await import('@/lib/authority/store/identity')).canonicalMembershipSource }))

import { performFinancialDuty, readFinancialTransaction, requireFinancialDuty, type FinancialDutyInput } from '@/lib/authority/store/finance-route-adapter'
import { recordArrearsPayment } from '@/lib/dues/arrears-payment'

let pg: PGlite
let k: ReturnType<typeof kit>

const ACCT = newUuid()
const OTHER_ACCT = newUuid()
const T2 = 'user_treasurer_two'
const T3 = 'user_treasurer_three'
const T4 = 'user_treasurer_four'
const money = (account: string, over: Record<string, unknown> = {}) => ({ scope: { accountIds: [account] }, monetaryLimitMinor: 500_000, currency: 'CAD', ...over })

/** One transaction as `userId`, the way withRLSContext binds it. */
async function as<T>(userId: string, fn: (tx: RLSTx) => Promise<T>, org = ORG): Promise<T> {
  await pg.exec('BEGIN')
  try {
    await pg.query(`SELECT set_config('app.current_org_id', $1, true), set_config('app.current_user_id', $2, true)`, [org, userId])
    const out = await fn(drizzle(pg) as unknown as RLSTx)
    await pg.exec('COMMIT')
    return out
  } catch (error) {
    await pg.exec('ROLLBACK')
    throw error
  }
}

const admin = async <T>(fn: () => Promise<T>): Promise<T> => k.asAdmin(fn)
const addPayment = (id: string, amount: string, member: string | null, org = ORG, currency = 'CAD') =>
  admin(() => pg.query(`INSERT INTO public.payments (id, organization_id, member_id, amount, currency) VALUES ($1,$2,$3,$4,$5)`, [id, org, member, amount, currency]))
const addArrears = (member: string, owed: string) =>
  admin(() => pg.query(`INSERT INTO member_arrears (id, user_id, organization_id, total_owed, arrears_status) VALUES (gen_random_uuid(), $1, $2, $3, 'warning')`, [member, ORG, owed]))
const fault = (action: string | null) =>
  admin(async () => {
    await pg.query('DELETE FROM audit_fault_actions')
    if (action) await pg.query('INSERT INTO audit_fault_actions (action) VALUES ($1)', [action])
  })
const scalar = async (text: string, params: unknown[] = []) => Number((await admin(() => pg.query<{ n: string }>(text, params))).rows[0].n)
const steps = (pay: string, step: string) => scalar(`SELECT count(*) n FROM ue_authority_financial_steps WHERE subject_id = $1 AND step = $2`, [pay, step])
const ledgerRows = (member: string) => scalar(`SELECT count(*) n FROM member_dues_ledger WHERE user_id = $1`, [member])
const owed = async (member: string) => (await admin(() => pg.query<{ t: string }>(`SELECT total_owed::text t FROM member_arrears WHERE user_id = $1`, [member]))).rows[0].t

const step = (who: string, transactionId: string, kind: FinancialDutyInput['step'], extra: Partial<FinancialDutyInput> = {}, org = ORG) =>
  as(who, (tx) => performFinancialDuty(tx, { userId: who, organizationId: org, transactionId, step: kind, ...extra }, undefined, { action: `finance.payment.${kind}`, resourceType: 'payments', resourceId: transactionId }), org)
const register = (who: string, pay: string, account = ACCT, org = ORG) => step(who, pay, 'registered', { accountId: account, requiredApprovals: 1 }, org)
const post = (who: string, member: string, pay: string, amount: number) => as(who, (tx) => recordArrearsPayment(tx, { userId: who, organizationId: ORG, memberId: member, paymentId: pay, amount }))
/** Drizzle may wrap the database error, so the injected fault is looked for in the message and its cause. */
const faultRaised = async (promise: Promise<unknown>) => {
  const error = (await promise.then(() => null, (e: unknown) => e)) as { message?: string; cause?: { message?: string } } | null
  expect(error).not.toBeNull()
  expect(`${error?.message} ${error?.cause?.message}`).toMatch(/injected audit fault/)
}
const refused = (promise: Promise<unknown>, code: string, status: number) => expect(promise).rejects.toMatchObject({ code, status })

beforeAll(async () => {
  pg = await freshDb()
  k = kit(pg)
  await k.asAdmin(async () => {
    for (const who of [T2, T3, T4]) await seedMembership(pg, who, ORG, 'secretary_treasurer')
    await seedMembership(pg, U.member, ORG_B, 'member')
    await pg.exec(`${ddl(memberArrears)}; ${ddl(memberDuesLedger)};
      GRANT SELECT, INSERT, UPDATE ON member_arrears, member_dues_ledger TO union_eyes_runtime;
      CREATE TABLE audit_fault_actions (action text PRIMARY KEY);
      GRANT SELECT ON audit_fault_actions TO union_eyes_runtime;
      CREATE FUNCTION refuse_faulted_audit() RETURNS trigger AS $$
      BEGIN IF EXISTS (SELECT 1 FROM audit_fault_actions WHERE action = NEW.action) THEN RAISE EXCEPTION 'injected audit fault'; END IF; RETURN NEW; END $$ LANGUAGE plpgsql;
      CREATE TRIGGER inject_fault BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION refuse_faulted_audit();`)
  })
  await k.adoptDefaultRules()
}, 180_000)
afterAll(async () => { await pg?.close() })
beforeEach(() => m.audit.mockClear())

describe('before the institution issues any financial mandate', () => {
  const PAY = newUuid()
  beforeAll(async () => { await addPayment(PAY, '60.00', U.member) })

  it('every finance duty is refused with an explicit, non-oracle answer', async () => {
    await refused(register(U.treasurer, PAY), 'FINANCIAL_MANDATES_NOT_ISSUED', 403)
    await refused(as(U.treasurer, (tx) => readFinancialTransaction(tx, { userId: U.treasurer, organizationId: ORG, transactionId: PAY })), 'FINANCIAL_MANDATES_NOT_ISSUED', 403)
    await refused(step(U.president, PAY, 'approved'), 'FINANCIAL_MANDATES_NOT_ISSUED', 403)
    // The same answer for a transaction that does not exist: it says nothing about any transaction id.
    await refused(as(U.treasurer, (tx) => requireFinancialDuty(tx, { userId: U.treasurer, organizationId: ORG, transactionId: newUuid(), action: 'finance:view' })), 'FINANCIAL_MANDATES_NOT_ISSUED', 403)
    // A member with no financial capacity is told nothing about the state of the institution either.
    await refused(as(U.member, (tx) => requireFinancialDuty(tx, { userId: U.member, organizationId: ORG, transactionId: PAY, action: 'finance:view' })), 'NOT_FOUND', 404)
  })

  it('posting to arrears is refused and changes nothing', async () => {
    await addArrears(U.member, '100.00')
    await refused(post(U.president, U.member, PAY, 60), 'FINANCIAL_MANDATES_NOT_ISSUED', 403)
    expect(await ledgerRows(U.member)).toBe(0)
    expect(await owed(U.member)).toBe('100.00')
  })
})

describe('a mandate for a different account confers nothing on this one', () => {
  const PAY = newUuid()
  beforeAll(async () => {
    await addPayment(PAY, '60.00', U.member)
    await k.grantMandate('financial', T4, ['view', 'prepare'], money(OTHER_ACCT, { approver: U.vp }))
  })

  it('registering on an account the caller holds no duty for is a recorded 403, and the transaction stays invisible', async () => {
    await refused(register(T4, PAY, ACCT), 'DUTY_NOT_HELD', 403)
    expect(m.audit).toHaveBeenCalledTimes(1)
    expect(await steps(PAY, 'registered')).toBe(0)
  })
})

describe('prepare, approve, execute and reconcile by different principals', () => {
  const PAY = newUuid()
  const BAD_PAYER = newUuid()

  beforeAll(async () => {
    await addPayment(PAY, '60.00', U.member)
    await addPayment(BAD_PAYER, '10.00', U.member2)
    await k.grantMandate('financial', U.treasurer, ['view', 'prepare'], money(ACCT, { approver: U.vp }))
    await k.grantMandate('financial', U.vp, ['view', 'approve'], money(ACCT, { issuer: U.president, approver: U.treasurer }))
    await k.grantMandate('financial', U.president, ['view', 'execute'], money(ACCT, { issuer: U.vp, approver: U.treasurer }))
    await k.grantMandate('financial', T2, ['view', 'reconcile'], money(ACCT, { approver: U.vp }))
  })

  it('a caller without a financial capacity cannot register or see anything', async () => {
    await refused(register(U.member, PAY), 'DUTY_NOT_HELD', 403)
    await refused(as(U.member, (tx) => requireFinancialDuty(tx, { userId: U.member, organizationId: ORG, transactionId: PAY, action: 'finance:view' })), 'NOT_FOUND', 404)
  })

  it('registers and prepares; the preparer cannot approve their own transaction', async () => {
    await register(U.treasurer, PAY)
    await refused(register(U.treasurer, PAY), 'STEP_REFUSED', 409)
    await step(U.treasurer, PAY, 'prepared')
    const attempt = step(U.treasurer, PAY, 'approved')
    await refused(attempt, 'DUTY_NOT_HELD', 403)
    await expect(attempt).rejects.toMatchObject({ reasons: expect.arrayContaining(['SELF_APPROVAL']) })
    expect(await steps(PAY, 'approved')).toBe(0)
  })

  it('a principal on another account cannot see the transaction at all', async () => {
    await refused(as(T4, (tx) => readFinancialTransaction(tx, { userId: T4, organizationId: ORG, transactionId: PAY })), 'NOT_FOUND', 404)
    await refused(step(T4, PAY, 'approved'), 'NOT_FOUND', 404)
  })

  it('the approver, and only an approver, can approve; approving twice is refused', async () => {
    await refused(step(U.president, PAY, 'approved'), 'DUTY_NOT_HELD', 403)
    await step(U.vp, PAY, 'approved')
    await refused(step(U.vp, PAY, 'approved'), 'DUTY_NOT_HELD', 403)
    const view = await as(U.treasurer, (tx) => readFinancialTransaction(tx, { userId: U.treasurer, organizationId: ORG, transactionId: PAY }))
    expect(view).toMatchObject({ state: 'approved', amountMinor: 6000, currency: 'CAD', accountId: ACCT, approvalsRecorded: 1 })
  })

  it('neither the preparer nor the approver can execute', async () => {
    await refused(post(U.treasurer, U.member, PAY, 60), 'DUTY_NOT_HELD', 403)
    const viaApprover = post(U.vp, U.member, PAY, 60)
    await refused(viaApprover, 'DUTY_NOT_HELD', 403)
    await expect(viaApprover).rejects.toMatchObject({ reasons: expect.arrayContaining(['SEGREGATION_OF_DUTIES']) })
  })

  it('an amount that differs from the record is refused, and so is a payer who is not the arrears member', async () => {
    await refused(post(U.president, U.member, PAY, 59.99), 'FACT_MISMATCH', 409)
    await expect(post(U.president, U.member, PAY, 60.001)).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
    await addArrears(U.member2, '30.00')
    await refused(post(U.president, U.member2, PAY, 60), 'FACT_MISMATCH', 409)
    expect(await steps(PAY, 'executed')).toBe(0)
    expect(await ledgerRows(U.member)).toBe(0)
    expect(await ledgerRows(U.member2)).toBe(0)
    expect(await owed(U.member)).toBe('100.00')
  })

  it('an audit fault rolls back the ledger entry, the arrears update and the financial step together', async () => {
    for (const action of ['dues.arrears.payment_record', 'authority.finance.executed']) {
      await fault(action)
      await faultRaised(post(U.president, U.member, PAY, 60))
      expect(await steps(PAY, 'executed'), action).toBe(0)
      expect(await ledgerRows(U.member), action).toBe(0)
      expect(await owed(U.member), action).toBe('100.00')
    }
    await fault(null)
  })

  it('an independent executor posts it once: ledger, arrears, step and audit commit together', async () => {
    const out = await post(U.president, U.member, PAY, 60)
    expect(out.balanceAfter).toBe(40)
    expect(await steps(PAY, 'executed')).toBe(1)
    expect(await ledgerRows(U.member)).toBe(1)
    expect(await owed(U.member)).toBe('40.00')
    const ledger = (await admin(() => pg.query<{ amount: string; reference_id: string; created_by: string }>(`SELECT amount::text, reference_id::text, created_by FROM member_dues_ledger WHERE user_id = $1`, [U.member]))).rows[0]
    expect(ledger).toMatchObject({ amount: '60.00', reference_id: PAY, created_by: U.president })
    expect(await scalar(`SELECT count(*) n FROM public.audit_logs WHERE action = 'dues.arrears.payment_record' AND user_id = $1`, [U.president])).toBe(1)
    expect(await scalar(`SELECT count(*) n FROM public.audit_logs WHERE action = 'authority.finance.executed'`)).toBe(1)
  })

  it('cannot be posted twice, and the executor cannot reconcile their own execution', async () => {
    await refused(post(U.president, U.member, PAY, 60), 'DUTY_NOT_HELD', 403)
    expect(await ledgerRows(U.member)).toBe(1)
    await refused(step(U.president, PAY, 'reconciled'), 'DUTY_NOT_HELD', 403)
    await refused(step(U.treasurer, PAY, 'reconciled'), 'DUTY_NOT_HELD', 403)
  })

  it('an independent reconciler closes it', async () => {
    await step(T2, PAY, 'reconciled')
    const view = await as(U.treasurer, (tx) => readFinancialTransaction(tx, { userId: U.treasurer, organizationId: ORG, transactionId: PAY }))
    expect(view.state).toBe('reconciled')
  })

  it('an audit fault on a plain step rolls the step back', async () => {
    const PAY2 = newUuid()
    await addPayment(PAY2, '12.00', U.member)
    await register(U.treasurer, PAY2)
    await fault('finance.payment.prepared')
    await faultRaised(step(U.treasurer, PAY2, 'prepared'))
    expect(await steps(PAY2, 'prepared')).toBe(0)
    await fault(null)
    await step(U.treasurer, PAY2, 'prepared')
    expect(await steps(PAY2, 'prepared')).toBe(1)
  })
})

describe('incompatible duties held by one person are refused even if the mandate store were bypassed', () => {
  const PAY = newUuid()
  const rawMandate = (holder: string, powers: string[]) =>
    admin(async () => {
      await pg.exec('ALTER TABLE ue_authority_mandates DISABLE TRIGGER USER')
      await pg.query(
        `INSERT INTO ue_authority_mandates (organization_id, principal_user_id, kind, powers, scope, monetary_limit_minor, currency, source_instrument, granted_by, effective_at, expires_at)
         VALUES ($1,$2,'financial',$3::text[],$4::jsonb,500000,'CAD','Raw fixture',$5, now() - interval '5 minutes', now() + interval '30 days')`,
        [ORG, holder, powers, JSON.stringify({ accountIds: [ACCT] }), U.president],
      )
      await pg.exec('ALTER TABLE ue_authority_mandates ENABLE TRIGGER USER')
    })

  beforeAll(async () => {
    await addPayment(PAY, '25.00', U.member)
    await k.grantMandate('financial', T3, ['view', 'prepare'], money(ACCT, { approver: U.vp }))
  })

  it('the grant-time check refuses prepare and approve for one person on one account', async () => {
    await expect(k.grantMandate('financial', U.treasurer, ['approve'], money(ACCT, { approver: U.vp }))).rejects.toThrow(/SEGREGATION_OF_DUTIES/)
  })

  it('the kernel refuses self-approval and approver-execution on the transaction itself', async () => {
    await register(T3, PAY)
    await step(T3, PAY, 'prepared')
    await rawMandate(T3, ['approve'])
    const selfApproval = step(T3, PAY, 'approved')
    await refused(selfApproval, 'DUTY_NOT_HELD', 403)
    await expect(selfApproval).rejects.toMatchObject({ reasons: expect.arrayContaining(['SELF_APPROVAL']) })
    await step(U.vp, PAY, 'approved')
    await rawMandate(U.vp, ['execute'])
    const approverExecutes = step(U.vp, PAY, 'executed')
    await refused(approverExecutes, 'DUTY_NOT_HELD', 403)
    await expect(approverExecutes).rejects.toMatchObject({ reasons: expect.arrayContaining(['SEGREGATION_OF_DUTIES']) })
  })
})

describe('another organization is invisible', () => {
  const PAY_B = newUuid()
  beforeAll(async () => { await addPayment(PAY_B, '60.00', U.member, ORG_B) })

  it('a foreign transaction is 404 for every duty and cannot be registered', async () => {
    await refused(as(U.treasurer, (tx) => readFinancialTransaction(tx, { userId: U.treasurer, organizationId: ORG, transactionId: PAY_B })), 'NOT_FOUND', 404)
    await refused(step(U.vp, PAY_B, 'approved'), 'NOT_FOUND', 404)
    await refused(register(U.treasurer, PAY_B), 'NOT_FOUND', 404)
    await refused(post(U.president, U.member, PAY_B, 60), 'NOT_FOUND', 404)
  })
})

describe('when payments cannot be an authoritative source', () => {
  it('answers 501 with the exact missing columns for every duty, and posts nothing', async () => {
    const PAY = newUuid()
    await addPayment(PAY, '5.00', U.member)
    await admin(() => pg.exec('ALTER TABLE public.payments DROP COLUMN amount, DROP COLUMN currency, DROP COLUMN member_id'))
    const unavailable = { code: 'FINANCE_SOURCE_UNAVAILABLE', status: 501, missingColumns: ['amount', 'currency', 'member_id'] }
    await expect(register(U.treasurer, PAY)).rejects.toMatchObject(unavailable)
    await expect(step(U.vp, PAY, 'approved')).rejects.toMatchObject(unavailable)
    await expect(post(U.president, U.member, PAY, 5)).rejects.toMatchObject(unavailable)
    await expect(as(U.treasurer, (tx) => readFinancialTransaction(tx, { userId: U.treasurer, organizationId: ORG, transactionId: PAY }))).rejects.toMatchObject(unavailable)
  })
})
