/** Deferred finance HTTP handlers with real canonical source authentication.
 * Actual withApi, role/input floors, live bearer binding and restricted LOGIN
 * SQL ports are retained. No role-claim wrapper or transactional audit double.
 * Native execution requires a disposable per-clone current-source environment.
 */
import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import { NextRequest } from 'next/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { canonicalMembershipRole } from '@/lib/auth/canonical-membership-role'
import {
  currentCanonicalRequest,
  withCanonicalRequestScope,
} from '@/lib/auth/canonical-request-scope'
import {
  createNativeCanonicalSession,
  withNativeCanonicalActor,
} from '@/scripts/runtime/native-canonical-fixture'
import { insertMember, insertOrganization } from './page-reads-seed'
import { savepointHarness } from './native-savepoint-harness'

vi.mock('@/db', async () => ({ db: (await import('./native-savepoint-harness')).ambientDb }))
vi.mock('@/db/db', async () => ({ db: (await import('./native-savepoint-harness')).ambientDb }))
vi.mock('@/lib/db/with-rls-context', async () => {
  const { currentCanonicalRequest } = await import('@/lib/auth/canonical-request-scope')
  const { savepointHarness, RUNTIME_ROLE, SYSTEM_ROLE } = await import('./native-savepoint-harness')
  return {
    withRLSContext: <T>(scope: { organizationId: string }, work: (tx: unknown) => Promise<T>) => {
      const current = currentCanonicalRequest({ organizationId: scope.organizationId })
      if (!current) throw new Error('Actual canonical native request required')
      return savepointHarness.context(
        RUNTIME_ROLE,
        scope.organizationId,
        current.binding.userId,
        work,
      )
    },
    withSystemContext: <T>(work: (tx: unknown) => Promise<T>) =>
      savepointHarness.context(SYSTEM_ROLE, null, null, work),
  }
})
const URL = process.env.UE_AUTHORITY_COMBINED_URL
const modules = URL
  ? {
      dues0: await import('@/app/api/dues/issues/route'),
      dues1: await import('@/app/api/dues/arrears/[id]/reminder/route'),
      dues2: await import('@/app/api/dues/arrears/route'),
      dues3: await import('@/app/api/dues/arrears/calculate/route'),
      dues4: await import('@/app/api/dues/payment-plans/route'),
      dues5: await import('@/app/api/dues/receipt/[id]/route'),
      dues6: await import('@/app/api/dues/late-fees/route'),
      dues7: await import('@/app/api/dues/dashboard/route'),
      dues8: await import('@/app/api/dues/exceptions/route'),
      dues9: await import('@/app/api/dues/deductions/route'),
      dues10: await import('@/app/api/dues/payment-history/route'),
      dues11: await import('@/app/api/dues/ledger/route'),
      dues12: await import('@/app/api/dues/setup-intent/route'),
      dues13: await import('@/app/api/dues/reconcile/route'),
      dues14: await import('@/app/api/dues/create-payment-intent/route'),
      dues15: await import('@/app/api/dues/reconciliation/queue/route'),
      dues16: await import('@/app/api/dues/calculate/route'),
      dues17: await import('@/app/api/dues/billing-cycle/route'),
      dues18: await import('@/app/api/dues/balance/route'),
      dues19: await import('@/app/api/dues/reconciliation/auto-match/route'),
      dues20: await import('@/app/api/dues/remittances/route'),
      dues21: await import('@/app/api/dues/reconciliation/match/route'),
      dues22: await import('@/app/api/dues/reconciliation/reject/route'),
      dues23: await import('@/app/api/dues/remittances/upload/route'),
      dues24: await import('@/app/api/dues/remittances/[id]/route'),
      retired0: await import('@/app/api/financial/budgets/route'),
      retired1: await import('@/app/api/financial/budgets/[id]/route'),
      retired2: await import('@/app/api/financial/expenses/route'),
      retired3: await import('@/app/api/financial/expenses/[id]/route'),
      retired4: await import('@/app/api/financial/vendors/route'),
      retired5: await import('@/app/api/financial/vendors/[id]/route'),
      contracts: await import('@/app/api/contracts/route'),
      clauses: await import('@/app/api/contracts/[id]/clauses/route'),
      billing: await import('@/app/api/finance/billing/route'),
      invoices: await import('@/app/api/finance/invoices/route'),
      invoice: await import('@/app/api/finance/invoices/[id]/route'),
      payments: await import('@/app/api/finance/invoices/[id]/payments/route'),
      allocation: await import('@/app/api/finance/allocation/route'),
      allocationRun: await import('@/app/api/finance/allocation/run/route'),
      simulation: await import('@/app/api/finance/simulation/route'),
      chargebacks: await import('@/app/api/finance/chargebacks/route'),
      dashboard: await import('@/app/api/finance/dashboard/route'),
      exports: await import('@/app/api/finance/exports/route'),
      quote: await import('@/app/api/finance/pricing/quote/route'),
      compare: await import('@/app/api/finance/pricing/compare/route'),
      summary: await import('@/app/api/finance/summary/route'),
      inbound: await import('@/app/api/finance/per-capita/inbound/route'),
      duties: await import('@/app/api/payments/[id]/duties/route'),
      arrears: await import('@/app/api/dues/arrears/[id]/payment/route'),
    }
  : null

type Handler = (
  request: NextRequest,
  context?: { params: Promise<Record<string, string>> },
) => Promise<Response>
interface Case {
  module: keyof NonNullable<typeof modules>
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  body?: unknown
  params?: Record<string, string>
  multipart?: boolean
  selfMember?: boolean
  memberAllowed?: boolean
}
const memberIds: Record<string, string> = {}
const id = randomUUID()
const cases: Case[] = [
  { module: 'contracts', method: 'GET', path: '/api/contracts' },
  {
    module: 'contracts',
    method: 'POST',
    path: '/api/contracts',
    body: {
      billingAccountId: id,
      name: 'Synthetic excluded priced draft',
      effectiveDate: '2026-01-01',
      expirationDate: '2027-01-01',
    },
  },
  { module: 'clauses', method: 'GET', path: `/api/contracts/${id}/clauses`, params: { id } },
  {
    module: 'dues0',
    method: 'POST',
    path: `/api/dues/issues`,
    body: {
      issueType: 'other',
      subject: 'Synthetic unavailable dues issue',
      description: 'No financial persistence authorized',
    },
    memberAllowed: true,
  },
  { module: 'dues1', method: 'POST', path: `/api/dues/arrears/${id}/reminder`, params: { id } },
  { module: 'dues2', method: 'GET', path: `/api/dues/arrears` },
  { module: 'dues3', method: 'GET', path: `/api/dues/arrears/calculate` },
  { module: 'dues3', method: 'POST', path: `/api/dues/arrears/calculate` },
  { module: 'dues4', method: 'GET', path: `/api/dues/payment-plans` },
  {
    module: 'dues4',
    method: 'POST',
    path: `/api/dues/payment-plans`,
    body: {
      userId: 'synthetic',
      planName: 'Synthetic unavailable plan',
      totalOwed: '10',
      installmentAmount: '10',
      installmentCount: 1,
      startDate: '2026-01-01',
      nextPaymentDue: '2026-02-01',
    },
  },
  {
    module: 'dues5',
    method: 'GET',
    path: `/api/dues/receipt/${id}`,
    params: { id },
    memberAllowed: true,
  },
  { module: 'dues6', method: 'GET', path: `/api/dues/late-fees` },
  { module: 'dues7', method: 'GET', path: `/api/dues/dashboard` },
  { module: 'dues8', method: 'GET', path: `/api/dues/exceptions` },
  { module: 'dues9', method: 'GET', path: `/api/dues/deductions`, memberAllowed: true },
  { module: 'dues10', method: 'GET', path: `/api/dues/payment-history`, memberAllowed: true },
  { module: 'dues11', method: 'GET', path: `/api/dues/ledger` },
  { module: 'dues12', method: 'POST', path: `/api/dues/setup-intent`, body: {} },
  {
    module: 'dues13',
    method: 'POST',
    path: `/api/dues/reconcile`,
    body: { periodStart: '2026-01-01', periodEnd: '2026-01-31' },
  },
  {
    module: 'dues14',
    method: 'POST',
    path: `/api/dues/create-payment-intent`,
    memberAllowed: true,
  },
  { module: 'dues15', method: 'GET', path: `/api/dues/reconciliation/queue` },
  {
    module: 'dues16',
    method: 'POST',
    path: `/api/dues/calculate`,
    body: { memberId: id, periodStart: '2026-01-01', periodEnd: '2026-01-31' },
    memberAllowed: true,
    selfMember: true,
  },
  { module: 'dues17', method: 'GET', path: `/api/dues/billing-cycle` },
  { module: 'dues18', method: 'GET', path: `/api/dues/balance`, memberAllowed: true },
  { module: 'dues19', method: 'POST', path: `/api/dues/reconciliation/auto-match` },
  { module: 'dues20', method: 'GET', path: `/api/dues/remittances` },
  {
    module: 'dues20',
    method: 'POST',
    path: `/api/dues/remittances`,
    body: {
      employerId: id,
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      fiscalYear: 2026,
      fiscalMonth: 1,
      remittanceDate: '2026-02-01',
      totalAmount: '10',
      memberCount: 1,
    },
  },
  {
    module: 'dues21',
    method: 'POST',
    path: `/api/dues/reconciliation/match`,
    body: { remittanceId: id, memberId: id },
  },
  {
    module: 'dues22',
    method: 'POST',
    path: `/api/dues/reconciliation/reject`,
    body: { remittanceId: id, reason: 'Synthetic refusal' },
  },
  { module: 'dues23', method: 'POST', path: `/api/dues/remittances/upload`, multipart: true },
  { module: 'dues24', method: 'GET', path: `/api/dues/remittances/${id}`, params: { id } },
  {
    module: 'dues24',
    method: 'PATCH',
    path: `/api/dues/remittances/${id}`,
    params: { id },
    body: { notes: 'Synthetic unavailable update' },
  },
  { module: 'retired0', method: 'GET', path: `/api/financial/budgets`, memberAllowed: true },
  { module: 'retired0', method: 'POST', path: `/api/financial/budgets`, memberAllowed: true },
  {
    module: 'retired1',
    method: 'GET',
    path: `/api/financial/budgets/${id}`,
    memberAllowed: true,
    params: { id },
  },
  {
    module: 'retired1',
    method: 'PATCH',
    path: `/api/financial/budgets/${id}`,
    memberAllowed: true,
    params: { id },
  },
  {
    module: 'retired1',
    method: 'DELETE',
    path: `/api/financial/budgets/${id}`,
    memberAllowed: true,
    params: { id },
  },
  { module: 'retired2', method: 'GET', path: `/api/financial/expenses`, memberAllowed: true },
  { module: 'retired2', method: 'POST', path: `/api/financial/expenses`, memberAllowed: true },
  {
    module: 'retired3',
    method: 'GET',
    path: `/api/financial/expenses/${id}`,
    memberAllowed: true,
    params: { id },
  },
  {
    module: 'retired3',
    method: 'PATCH',
    path: `/api/financial/expenses/${id}`,
    memberAllowed: true,
    params: { id },
  },
  {
    module: 'retired3',
    method: 'DELETE',
    path: `/api/financial/expenses/${id}`,
    memberAllowed: true,
    params: { id },
  },
  { module: 'retired4', method: 'GET', path: `/api/financial/vendors`, memberAllowed: true },
  { module: 'retired4', method: 'POST', path: `/api/financial/vendors`, memberAllowed: true },
  {
    module: 'retired5',
    method: 'GET',
    path: `/api/financial/vendors/${id}`,
    memberAllowed: true,
    params: { id },
  },
  {
    module: 'retired5',
    method: 'PATCH',
    path: `/api/financial/vendors/${id}`,
    memberAllowed: true,
    params: { id },
  },
  {
    module: 'retired5',
    method: 'DELETE',
    path: `/api/financial/vendors/${id}`,
    memberAllowed: true,
    params: { id },
  },
  { module: 'billing', method: 'GET', path: '/api/finance/billing' },
  {
    module: 'billing',
    method: 'POST',
    path: '/api/finance/billing',
    body: {
      displayName: 'Synthetic unavailable billing',
      billingEmail: 'synthetic@example.invalid',
    },
  },
  {
    module: 'billing',
    method: 'PATCH',
    path: '/api/finance/billing',
    body: { displayName: 'Must not persist' },
  },
  { module: 'invoices', method: 'GET', path: '/api/finance/invoices' },
  {
    module: 'invoices',
    method: 'POST',
    path: '/api/finance/invoices',
    body: { billingPeriodId: id },
  },
  { module: 'invoice', method: 'GET', path: `/api/finance/invoices/${id}`, params: { id } },
  {
    module: 'payments',
    method: 'GET',
    path: `/api/finance/invoices/${id}/payments`,
    params: { id },
  },
  {
    module: 'payments',
    method: 'POST',
    path: `/api/finance/invoices/${id}/payments`,
    params: { id },
    body: { amount: '10.00', method: 'eft' },
  },
  { module: 'allocation', method: 'GET', path: '/api/finance/allocation' },
  {
    module: 'allocation',
    method: 'POST',
    path: '/api/finance/allocation',
    body: { name: 'Synthetic unavailable rule', costType: 'usage_fee', method: 'per_member_count' },
  },
  {
    module: 'allocationRun',
    method: 'POST',
    path: '/api/finance/allocation/run',
    body: { billingPeriodId: id, ruleId: id, localBasisData: [] },
  },
  {
    module: 'simulation',
    method: 'POST',
    path: '/api/finance/simulation',
    body: { billingPeriodId: id, ruleId: id, localBasisData: [] },
  },
  { module: 'chargebacks', method: 'GET', path: '/api/finance/chargebacks' },
  { module: 'dashboard', method: 'GET', path: '/api/finance/dashboard' },
  {
    module: 'exports',
    method: 'GET',
    path: `/api/finance/exports?type=master_invoice&invoiceId=${id}`,
  },
  {
    module: 'quote',
    method: 'POST',
    path: '/api/finance/pricing/quote',
    body: { memberCount: 10 },
  },
  {
    module: 'compare',
    method: 'POST',
    path: '/api/finance/pricing/compare',
    body: { memberCount: 10 },
  },
  { module: 'summary', method: 'GET', path: '/api/finance/summary' },
  { module: 'inbound', method: 'GET', path: '/api/finance/per-capita/inbound' },
  {
    module: 'duties',
    method: 'GET',
    path: `/api/payments/${id}/duties`,
    params: { id },
    memberAllowed: true,
  },
  {
    module: 'duties',
    method: 'POST',
    path: `/api/payments/${id}/duties`,
    params: { id },
    body: { step: 'registered', accountId: id, requiredApprovals: 1 },
    memberAllowed: true,
  },
  {
    module: 'arrears',
    method: 'POST',
    path: `/api/dues/arrears/${id}/payment`,
    params: { id },
    body: { paymentId: id, amount: 10 },
    memberAllowed: true,
  },
]
const run = (entry: Case, callerUserId?: string) => {
  let payload = entry.body
  if (entry.selfMember && callerUserId)
    payload = { ...(entry.body as Record<string, unknown>), memberId: memberIds[callerUserId] }
  let multipart: FormData | undefined
  if (entry.multipart) {
    multipart = new FormData()
    multipart.set('file', new File(['a,b\n1,2\n'], 'synthetic.csv', { type: 'text/csv' }))
    multipart.set(
      'metadata',
      JSON.stringify({ employerId: id, periodStart: '2026-01-01', periodEnd: '2026-01-31' }),
    )
  }
  const handler = modules![entry.module][
    entry.method as keyof NonNullable<typeof modules>[typeof entry.module]
  ] as unknown as Handler
  return handler(
    new NextRequest(`http://localhost${entry.path}`, {
      method: entry.method,
      ...(multipart
        ? { body: multipart }
        : payload === undefined
          ? {}
          : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }),
    }),
    { params: Promise.resolve(entry.params ?? {}) },
  )
}

describe.skipIf(!URL)('deferred finance HTTP source on actual native canonical sessions', () => {
  let operator: pg.Client
  const org = randomUUID(),
    foreignOrg = randomUUID()
  const foreignInvoice = randomUUID()
  const users = {
    member: `finance-member-${randomUUID()}`,
    secretary_treasurer: `finance-officer-${randomUUID()}`,
    admin: `finance-admin-${randomUUID()}`,
  }
  // Each independent route gets a real fresh canonical actor/session. The
  // production shared Redis bucket is never reset or weakened for the test.
  const scenarios = {
    member: cases.map(() => `finance-scenario-member-${randomUUID()}`),
    secretary_treasurer: cases.map(() => `finance-scenario-officer-${randomUUID()}`),
    admin: cases.map(() => `finance-scenario-admin-${randomUUID()}`),
  }
  const asUser = <T>(userId: string, work: () => Promise<T>) =>
    withNativeCanonicalActor(userId, org, (binding) =>
      withCanonicalRequestScope(
        binding,
        {
          userId: binding.userId,
          organizationId: binding.organizationId,
          role: canonicalMembershipRole(binding.role, false),
          email: `${userId}@example.invalid`,
          firstName: null,
          lastName: null,
          isSystemAdmin: false,
        },
        work,
      ),
    )
  const asActor = <T>(role: keyof typeof users, work: () => Promise<T>) => asUser(users[role], work)
  const history = async () => {
    const result: Record<string, unknown> = {}
    for (const table of [
      'billing_accounts',
      'platform_invoices',
      'platform_payments',
      'allocation_rules',
      'allocation_runs',
      'platform_cost_ledger_entries',
      'payments',
      'member_arrears',
      'member_dues_ledger',
      'ue_authority_financial_steps',
      'org_entitlements',
      'commercial_contracts',
      'contract_line_items',
      'contract_covered_orgs',
      'audit_logs',
    ])
      result[table] = (
        await operator.query(
          `SELECT count(*)::text AS count,md5(COALESCE(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) AS digest FROM public."${table}" t`,
        )
      ).rows[0]
    return result
  }
  beforeAll(async () => {
    expect(
      process.env.UE_CANONICAL_BOOTSTRAP_V2,
      'Opted-in source cohort requires actual canonical mode',
    ).toBe('1')
    operator = await savepointHarness.start(URL!)
    for (const organization of [org, foreignOrg])
      await insertOrganization(operator, randomUUID().slice(0, 8), { id: organization })
    for (const [role, user] of Object.entries(users)) {
      await operator.query(
        "INSERT INTO user_management.users(user_id,email,is_active,lifecycle_state,is_system_admin) VALUES($1,$2,true,'active',false)",
        [user, `${user}@example.invalid`],
      )
      await operator.query(
        'INSERT INTO user_management.organization_users(user_id,organization_id,role,is_active) VALUES($1,$2,$3,true)',
        [user, org, role],
      )
      memberIds[role] = await insertMember(operator, org, {
        userId: user,
        role,
        name: 'Synthetic canonical finance caller',
      })
    }
    for (const [role, actors] of Object.entries(scenarios))
      for (const [index, user] of actors.entries()) {
        await operator.query(
          "INSERT INTO user_management.users(user_id,email,is_active,lifecycle_state,is_system_admin) VALUES($1,$2,true,'active',false)",
          [user, `${user}@example.invalid`],
        )
        await operator.query(
          'INSERT INTO user_management.organization_users(user_id,organization_id,role,is_active) VALUES($1,$2,$3,true)',
          [user, org, role],
        )
        if (cases[index].selfMember)
          memberIds[user] = await insertMember(operator, org, {
            userId: user,
            role,
            name: 'Synthetic own-member calculation caller',
          })
      }
    // Adversarial retained admission metadata cannot activate an excluded
    // financial feature. This is disposable operator data, not adoption.
    for (const feature of ['financial_intelligence_suite', 'allocation_engine'])
      await operator.query(
        `INSERT INTO public.org_entitlements
        (id,organization_id,feature_key,status,granted_at,current_usage,created_at,updated_at)
        VALUES($1,$2,$3,'active',now(),0,now(),now())`,
        [randomUUID(), org, feature],
      )
    // Explicit disposable operator preparation provides a real foreign row.
    // No institution, mandate, financial approval or runtime grant is issued.
    const foreignAccount = randomUUID(),
      foreignPeriod = randomUUID()
    await operator.query(
      `INSERT INTO public.billing_accounts(id,organization_id,display_name,billing_email)
      VALUES($1,$2,'Synthetic retained foreign billing','synthetic@example.invalid')`,
      [foreignAccount, foreignOrg],
    )
    await operator.query(
      `INSERT INTO public.billing_periods(id,organization_id,period_start,period_end,label)
      VALUES($1,$2,'2026-01-01','2026-01-31','Synthetic retained period')`,
      [foreignPeriod, foreignOrg],
    )
    await operator.query(
      `INSERT INTO public.platform_invoices
      (id,billing_account_id,organization_id,billing_period_id,invoice_number,issue_date,due_date,subtotal,tax_amount,total_amount,amount_paid,currency,status)
      VALUES($1,$2,$3,$4,$5,now(),now()+interval '30 days',42,0,42,0,'CAD','issued')`,
      [foreignInvoice, foreignAccount, foreignOrg, foreignPeriod, `SYNTHETIC-${foreignInvoice}`],
    )
  }, 120000)
  afterAll(async () => {
    await savepointHarness.stop()
    await operator?.end()
  })

  it.each(['member', 'secretary_treasurer', 'admin'] as const)(
    'returns explicit501/403 for every current finance operation as canonical %s with no persisted effect',
    async (role) => {
      const before = await history()
      for (const [index, entry] of cases.entries()) {
        const user = scenarios[role][index]
        const response = await asUser(user, async () => {
          expect(currentCanonicalRequest()?.binding.userId).toBe(user)
          return run(entry, user)
        })
        expect([501, 403], `${role}:${entry.method}:${entry.path}`).toContain(response.status)
        const body = (await response.json()) as Record<string, unknown>
        if (entry.module.startsWith('retired')) {
          // The six existing retiredFinancialRoute producers retain their
          // explicit capability envelope, independently of standardErrorResponse.
          expect(response.status).toBe(501)
          expect(body).toMatchObject({
            success: false,
            error: { code: 'NOT_IMPLEMENTED' },
            capabilityState: 'NOT_IMPLEMENTED',
          })
        } else {
          const code = response.status === 501 ? 'NOT_IMPLEMENTED' : 'INSUFFICIENT_PERMISSIONS'
          expect(body).toMatchObject({
            code,
            message: expect.any(String),
            timestamp: expect.any(String),
            traceId: expect.any(String),
          })
          expect(response.headers.get('X-Error-Code')).toBe(code)
          expect(body).not.toHaveProperty('success')
        }
        expect(body).not.toHaveProperty('data')
        if (role === 'member' && !entry.memberAllowed) expect(response.status).toBe(403)
      }
      expect(await history()).toEqual(before)
    },
    120000,
  )

  it('preserves malformed body/id/query floors without starting an excluded operation', async () => {
    const before = await history()
    for (const entry of [
      {
        module: 'billing',
        method: 'POST',
        path: '/api/finance/billing',
        body: { displayName: '' },
      },
      {
        module: 'invoice',
        method: 'GET',
        path: '/api/finance/invoices/not-a-uuid',
        params: { id: 'not-a-uuid' },
      },
      { module: 'invoices', method: 'GET', path: '/api/finance/invoices?limit=-1' },
      {
        module: 'duties',
        method: 'POST',
        path: `/api/payments/${id}/duties`,
        params: { id },
        body: { step: 'registered' },
      },
      {
        module: 'duties',
        method: 'POST',
        path: `/api/payments/${id}/duties`,
        params: { id },
        body: { step: 'prepared', accountId: id },
      },
      {
        module: 'simulation',
        method: 'POST',
        path: '/api/finance/simulation',
        body: { billingPeriodId: 'invalid' },
      },
    ] satisfies Case[]) {
      expect((await asActor('admin', () => run(entry))).status).toBe(400)
    }
    expect(await history()).toEqual(before)
  })

  it('preserves the explicit execution-step refusal without recording a payment or audit', async () => {
    const before = await history()
    const response = await asActor('member', () =>
      run({
        module: 'duties',
        method: 'POST',
        path: `/api/payments/${id}/duties`,
        params: { id },
        body: { step: 'executed' },
      }),
    )
    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({
      success: false,
      error: { code: 'STEP_NOT_AVAILABLE' },
    })
    expect(await history()).toEqual(before)
  })

  it('does not reveal foreign/nonexistent invoice data through a disabled export', async () => {
    expect(
      (
        await operator.query(
          'SELECT organization_id::text AS org FROM public.platform_invoices WHERE id=$1',
          [foreignInvoice],
        )
      ).rows,
    ).toEqual([{ org: foreignOrg }])
    const before = await history()
    for (const invoiceId of [randomUUID(), foreignInvoice]) {
      const response = await asActor('secretary_treasurer', () =>
        run({
          module: 'exports',
          method: 'GET',
          path: `/api/finance/exports?type=master_invoice&invoiceId=${invoiceId}`,
        }),
      )
      expect(response.status).toBe(501)
      expect(await response.json()).toMatchObject({
        code: 'NOT_IMPLEMENTED',
        message: expect.any(String),
        traceId: expect.any(String),
      })
    }
    expect(await history()).toEqual(before)
  })

  it('refuses a genuinely revoked bearer before any route callback can execute', async () => {
    const session = await createNativeCanonicalSession(users.member, org)
    let liveBindings = 0
    await session.withBinding(async (binding) => {
      expect(binding.userId).toBe(users.member)
      expect(binding.organizationId).toBe(org)
      liveBindings++
    })
    expect(liveBindings).toBe(1)
    await session.revoke()
    let called = 0
    await expect(
      session.withBinding(async () => {
        called++
        return run(cases[0])
      }),
    ).rejects.toMatchObject({ name: 'AuthOrgBindingError', code: 'SESSION_AUTHORITY_REQUIRED' })
    expect(called).toBe(0)
  })
})
