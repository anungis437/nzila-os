/**
 * Governed financial duties (UE-CONV-D-001 / D-002 / D-003) end to end on PGlite: the real kernel storage and loaders,
 * the real finance route adapter, the real arrears posting, the real atomic audit chain. `withRLSContext` is replaced by
 * a transaction that binds the acting principal and organization as the application does. Only the session, the
 * best-effort refusal logger and the Canonical-V2 switch are doubles. Not a staging pass.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { newUuid, ORG, ORG_B, seedMembership, U } from '../../db/__tests__/authority-kernel-harness'
import { appDrizzle, freshDb, kit } from '../../db/__tests__/authority-kernel-testkit'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { ddl } from '@/lib/documents/test-support/pglite-document-database'
import { ErrorCode } from '@/lib/api/errors'
import { BaseFinancialCapabilityUnavailable } from '@/lib/finance/base-release-boundary'
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
    const out = await fn(appDrizzle(pg) as unknown as RLSTx)
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
const scalar = async (text: string, params: unknown[] = []) => Number((await admin(() => pg.query<{ n: string }>(text, params))).rows[0].n)
const steps = (pay: string, step: string) => scalar(`SELECT count(*) n FROM ue_authority_financial_steps WHERE subject_id = $1 AND step = $2`, [pay, step])
const ledgerRows = (member: string) => scalar(`SELECT count(*) n FROM member_dues_ledger WHERE user_id = $1`, [member])
const owed = async (member: string) => (await admin(() => pg.query<{ t: string }>(`SELECT total_owed::text t FROM member_arrears WHERE user_id = $1`, [member]))).rows[0].t

const step = (who: string, transactionId: string, kind: FinancialDutyInput['step'], extra: Partial<FinancialDutyInput> = {}, org = ORG) =>
  as(who, (tx) => performFinancialDuty(tx, { userId: who, organizationId: org, transactionId, step: kind, ...extra }, undefined, { action: `finance.payment.${kind}`, resourceType: 'payments', resourceId: transactionId }), org)
const register = (who: string, pay: string, account = ACCT, org = ORG) => step(who, pay, 'registered', { accountId: account, requiredApprovals: 1 }, org)
const post = (who: string, member: string, pay: string, amount: number) => as(who, (tx) => recordArrearsPayment(tx, { userId: who, organizationId: ORG, memberId: member, paymentId: pay, amount }))
const unavailable = { status: 501, code: ErrorCode.NOT_IMPLEMENTED, message: 'Finance and dues persistence are not available in this release.' }
/** The base release refuses the duty itself, before any read, decision, ledger write or audit. */
const refused = async (promise: Promise<unknown>) => {
  const error = await promise.then(() => null, (e: unknown) => e)
  expect(error).toBeInstanceOf(BaseFinancialCapabilityUnavailable)
  expect(error).toMatchObject(unavailable)
}

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

describe('finance and dues persistence are excluded from the base release', () => {
  const PAY = newUuid()
  const view = (who: string) => as(who, (tx) => readFinancialTransaction(tx, { userId: who, organizationId: ORG, transactionId: PAY }))
  const require = (who: string) => as(who, (tx) => requireFinancialDuty(tx, { userId: who, organizationId: ORG, transactionId: PAY, action: 'finance:view' }))

  beforeAll(async () => {
    await addPayment(PAY, '60.00', U.member)
    await addArrears(U.member, '100.00')
  })

  /** Nothing the refused duties could have written or read leaves a trace. */
  const untouched = async () => {
    for (const kind of ['registered', 'prepared', 'approved', 'executed', 'reconciled'] as const) expect(await steps(PAY, kind), kind).toBe(0)
    expect(await ledgerRows(U.member)).toBe(0)
    expect(await owed(U.member)).toBe('100.00')
    expect(await scalar(`SELECT count(*) n FROM public.audit_logs WHERE action LIKE 'finance.payment.%' OR action LIKE 'authority.finance.%' OR action = 'dues.arrears.payment_record'`)).toBe(0)
    expect(m.audit).not.toHaveBeenCalled()
  }

  it('refuses every duty before any mandate exists, and writes nothing', async () => {
    await refused(register(U.treasurer, PAY))
    for (const kind of ['prepared', 'approved', 'executed', 'reconciled'] as const) await refused(step(U.president, PAY, kind))
    await refused(view(U.treasurer))
    await refused(require(U.treasurer))
    await refused(require(U.member))
    await refused(post(U.president, U.member, PAY, 60))
    await untouched()
  })

  it('refuses a caller who holds a live mandate for the exact duty, because no mandate grants it', async () => {
    await k.grantMandate('financial', U.treasurer, ['view', 'prepare'], money(ACCT, { approver: U.vp }))
    await k.grantMandate('financial', U.vp, ['view', 'approve'], money(ACCT, { issuer: U.president, approver: U.treasurer }))
    await k.grantMandate('financial', U.president, ['view', 'execute'], money(ACCT, { issuer: U.vp, approver: U.treasurer }))
    await k.grantMandate('financial', T2, ['view', 'reconcile'], money(ACCT, { approver: U.vp }))

    await refused(register(U.treasurer, PAY))
    await refused(step(U.treasurer, PAY, 'prepared'))
    await refused(step(U.vp, PAY, 'approved'))
    await refused(step(U.president, PAY, 'executed'))
    await refused(step(T2, PAY, 'reconciled'))
    await refused(view(U.treasurer))
    await refused(require(U.vp))
    await refused(post(U.president, U.member, PAY, 60))
    await untouched()
  })

  it('refuses the same way for another account, another organization and an unknown transaction', async () => {
    const PAY_B = newUuid()
    await addPayment(PAY_B, '60.00', U.member, ORG_B)
    await refused(register(U.treasurer, PAY, OTHER_ACCT))
    await refused(register(U.treasurer, PAY_B))
    await refused(step(U.vp, PAY_B, 'approved'))
    await refused(post(U.president, U.member, PAY_B, 60))
    await refused(as(U.treasurer, (tx) => requireFinancialDuty(tx, { userId: U.treasurer, organizationId: ORG, transactionId: newUuid(), action: 'finance:view' })))
    await untouched()
  })

  it('refuses whether or not the payments table could be an authoritative source', async () => {
    await admin(() => pg.exec('ALTER TABLE public.payments DROP COLUMN amount, DROP COLUMN currency, DROP COLUMN member_id'))
    await refused(register(U.treasurer, PAY))
    await refused(step(U.vp, PAY, 'approved'))
    await refused(post(U.president, U.member, PAY, 5))
    await refused(view(U.treasurer))
    await untouched()
  })
})

describe('the mandate store keeps its grant-time segregation rule', () => {
  it('the grant-time check refuses prepare and approve for one person on one account', async () => {
    await expect(k.grantMandate('financial', U.treasurer, ['approve'], money(ACCT, { approver: U.vp }))).rejects.toThrow(/SEGREGATION_OF_DUTIES/)
  })
})
