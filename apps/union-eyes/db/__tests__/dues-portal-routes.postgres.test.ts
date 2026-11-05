/**
 * The member dues portal routes on real PostgreSQL, as the real roles: GET /api/dues/deductions and POST /api/dues/issues.
 *
 * Platform 0061 and cache 0052 gave payroll_deductions and member_dues_issues a physical relation and a row-security floor (organization). Until then both
 * routes answered with an undefined-relation fault whatever the caller sent. This runs the unmodified routes against the combined Django + Drizzle schema,
 * with only the request boundary replaced (see native-route-harness.ts). It proves that
 *   - a member reads their own deductions, newest pay period first, and not another member's, and not their own in another organization;
 *   - the read carries nothing internal (the staff member who verified it, the remittance line, the employer, free-form metadata, other deductions);
 *   - the route asks the wrapper for a tenant transaction, and a handle with no organization sees no deduction row (why it must);
 *   - a member files a report as themselves, as open, whatever the body claims about identity, status, priority or assignment, and it is audited;
 *   - a report may name a deduction only if it is the caller's own: another member's, another organization's and a made-up one are all "not found";
 *   - what a client can get wrong (a body that is not an object, text that is too long, an amount that cannot be stored, an id that is not a uuid)
 *     is a client error, never a server fault, and writes nothing;
 *   - an organization cannot read another's reports, and a report whose audit fails is not stored.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const URL = process.env.UE_AUTHORITY_COMBINED_URL

vi.mock('@/db/db', async () => ({ db: (await import('./native-route-harness')).ambientDb }))
vi.mock('@/db', async () => ({ db: (await import('./native-route-harness')).ambientDb }))
vi.mock('@/lib/db/with-rls-context', async () => (await import('./native-route-harness')).rlsContextModule)
vi.mock('@/lib/audit/atomic-audit', async () => ({ persistAtomicAudit: (await import('./native-route-harness')).recordAudit }))
vi.mock('@/lib/api/with-api', async () => ({ withApi: (await import('./native-route-harness')).emulatedWithApi }))

const { harness, RUNTIME_ROLE } = await import('./native-route-harness')
const { ApiError, ErrorCode } = await import('@/lib/api/errors')
const deductions = URL ? await import('@/app/api/dues/deductions/route') : null
const issues = URL ? await import('@/app/api/dues/issues/route') : null

type Row = Record<string, unknown>
const listDeductions = (ctx: unknown) => (deductions!.GET as unknown as (ctx: unknown) => Promise<{ data: Row[] }>)(ctx)
const fileIssue = (ctx: unknown) => (issues!.POST as unknown as (ctx: unknown) => Promise<Response>)(ctx)

describe.skipIf(!URL)('the dues portal routes on the combined schema, as the real roles', () => {
  const tag = `dp${randomUUID().slice(0, 8)}`
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  const employer = randomUUID()
  const memberM = `member-m-${tag}`
  const memberN = `member-n-${tag}`
  const asM = { organizationId: ORG_A, userId: memberM }
  const asN = { organizationId: ORG_A, userId: memberN }
  const asMInB = { organizationId: ORG_B, userId: memberM }
  let admin: pg.Client
  const ids = { jan: '', feb: '', mar: '', n: '', b: '' }

  const seedDeduction = async (organizationId: string, userId: string, month: number, amount: string) => {
    const { rows } = await admin.query(
      `INSERT INTO public.payroll_deductions
         (organization_id, user_id, employer_id, pay_period_start, pay_period_end, gross_pay, net_pay, union_dues_amount, other_deductions, source,
          remittance_line_item_id, verified, verified_at, verified_by, metadata)
       VALUES ($1, $2, $3, $4, $5, 2400.00, 1910.55, $6, '{"health": 12.5}', 'remittance', $7, true, now(), $8, '{"note": "internal reconciliation"}')
       RETURNING id::text AS id`,
      [organizationId, userId, employer, `2026-${String(month).padStart(2, '0')}-01`, `2026-${String(month).padStart(2, '0')}-14`, amount, randomUUID(), `staff-${tag}`],
    )
    return rows[0].id as string
  }

  const issueRows = async (where: string, params: unknown[]) => (await admin.query(`SELECT * FROM public.member_dues_issues WHERE ${where}`, params)).rows as Row[]
  const rejection = async (promise: Promise<unknown>) => promise.then(() => null, (error: unknown) => error)
  const body = (response: Response) => response.json() as Promise<{ success: boolean; issue: Row }>
  const valid = { issueType: 'incorrect_amount', subject: `Wrong amount ${tag}`, description: 'The March deduction is higher than my rate.' }
  const request = (who: { organizationId: string; userId: string }, payload: unknown) => ({ ...who, body: payload, request: new Request('http://localhost/api/dues/issues', { method: 'POST' }) })

  beforeAll(async () => {
    admin = await harness.start(URL!)
    for (const who of [asM, asN, asMInB]) harness.setRole(who.userId, who.organizationId, 'member')
    ids.jan = await seedDeduction(ORG_A, memberM, 1, '45.50')
    ids.feb = await seedDeduction(ORG_A, memberM, 2, '45.50')
    ids.mar = await seedDeduction(ORG_A, memberM, 3, '47.25')
    ids.n = await seedDeduction(ORG_A, memberN, 3, '60.00')
    ids.b = await seedDeduction(ORG_B, memberM, 3, '30.00')
  }, 60_000)

  afterAll(async () => {
    await admin?.end()
    await harness.stop()
  })

  describe('GET /api/dues/deductions', () => {
    it('lists the member\'s own deductions, newest pay period first, and nobody else\'s', async () => {
      const { data } = await listDeductions({ ...asM, request: new Request('http://localhost/api/dues/deductions') })
      expect(data.map((row) => row.id)).toEqual([ids.mar, ids.feb, ids.jan])
      expect(data.map((row) => row.unionDuesAmount)).toEqual(['47.25', '45.50', '45.50'])
    })

    it('shows the same member only what they were deducted in the organization they are acting in', async () => {
      const inB = await listDeductions({ ...asMInB, request: new Request('http://localhost/api/dues/deductions') })
      expect(inB.data.map((row) => row.id)).toEqual([ids.b])
      const other = await listDeductions({ ...asN, request: new Request('http://localhost/api/dues/deductions') })
      expect(other.data.map((row) => row.id)).toEqual([ids.n])
    })

    it('carries nothing internal: not the verifier, the remittance line, the employer, the metadata or the other deductions', async () => {
      const { data } = await listDeductions({ ...asM, request: new Request('http://localhost/api/dues/deductions') })
      expect(Object.keys(data[0]).sort()).toEqual(
        ['createdAt', 'grossPay', 'id', 'netPay', 'payPeriodEnd', 'payPeriodStart', 'source', 'unionDuesAmount', 'verified', 'verifiedAt'].sort(),
      )
      expect(JSON.stringify(data)).not.toMatch(/staff-|internal reconciliation|health|remittance_line|employer/)
      expect(data[0]).toMatchObject({ grossPay: '2400.00', netPay: '1910.55', source: 'remittance', verified: true })
    })

    it('asks the wrapper for a tenant transaction, because a handle with no organization sees no deduction row', async () => {
      const config = harness.configs.find((entry) => entry.openapi?.summary === 'List payroll deductions for the authenticated member')
      expect(config?.rlsOrgContext).toBe(true)
      const schema = await import('@/db/schema')
      const withoutOrganization = await harness.tenant(RUNTIME_ROLE, null, memberM, (tx) => tx.select().from(schema.payrollDeductions))
      expect(withoutOrganization).toEqual([])
    })

    it('answers a signed-in caller who has no organization with an empty list', async () => {
      expect(await listDeductions({ organizationId: null, userId: memberM, role: 'member', request: new Request('http://localhost/api/dues/deductions') })).toEqual({ data: [] })
    })
  })

  describe('POST /api/dues/issues', () => {
    it('files a report as the caller, as open, and audits it by issue type', async () => {
      const before = harness.audits.length
      const { success, issue } = await body(await fileIssue(request(asM, { ...valid, expectedAmount: 45.5 })))
      expect(success).toBe(true)
      const [stored] = await issueRows('id = $1', [issue.id])
      expect(stored).toMatchObject({ organization_id: ORG_A, user_id: memberM, issue_type: 'incorrect_amount', subject: valid.subject, status: 'open', priority: 3, assigned_to: null, expected_amount: '45.50', payroll_deduction_id: null })
      const entries = harness.audits.slice(before).filter((entry) => entry.resourceId === issue.id)
      expect(entries).toEqual([expect.objectContaining({ action: 'dues.issue.report', resourceType: 'member_dues_issues', organizationId: ORG_A, userId: memberM, details: { issueType: 'incorrect_amount' } })])
    })

    it('ignores what a body claims about identity, status, priority, assignment and resolution', async () => {
      const { issue } = await body(await fileIssue(request(asM, {
        ...valid, userId: memberN, organizationId: ORG_B, status: 'resolved', priority: 1, assignedTo: 'staff', resolvedBy: 'staff', resolutionType: 'corrected', actualAmount: 1,
      })))
      const [stored] = await issueRows('id = $1', [issue.id])
      expect(stored).toMatchObject({ organization_id: ORG_A, user_id: memberM, status: 'open', priority: 3, assigned_to: null, resolved_by: null, resolution_type: null, actual_amount: null })
    })

    it('lets a report name one of the caller\'s own deductions', async () => {
      const { issue } = await body(await fileIssue(request(asM, { ...valid, payrollDeductionId: ids.mar })))
      expect((await issueRows('id = $1', [issue.id]))[0].payroll_deduction_id).toBe(ids.mar)
    })

    it('reports another member\'s deduction, another organization\'s and a made-up one identically as not found, and writes nothing', async () => {
      const subject = `Foreign deduction ${tag}`
      for (const payrollDeductionId of [ids.n, ids.b, randomUUID()]) {
        const error = await rejection(fileIssue(request(asM, { ...valid, subject, payrollDeductionId })))
        expect(error).toBeInstanceOf(ApiError)
        expect((error as InstanceType<typeof ApiError>).code).toBe(ErrorCode.NOT_FOUND)
        expect((error as Error).message).toBe('Payroll deduction not found')
      }
      expect(await issueRows('subject = $1', [subject])).toHaveLength(0)
    })

    it('answers a malformed body as a client error, never a server fault, and writes nothing', async () => {
      const subject = `Malformed ${tag}`
      const cases: unknown[] = [
        null, undefined, 'text', ['issueType'],
        { ...valid, subject: 7 }, { ...valid, description: '   ' }, { ...valid, issueType: 'not_a_type' },
        { ...valid, subject: `${subject} ${'x'.repeat(201)}` }, { ...valid, subject, description: 'x'.repeat(5001) },
        { ...valid, subject, expectedAmount: '12.50' }, { ...valid, subject, expectedAmount: -1 }, { ...valid, subject, expectedAmount: 1e12 },
        { ...valid, subject, payrollDeductionId: 'not-a-uuid' }, { ...valid, subject, payrollDeductionId: 42 },
      ]
      for (const payload of cases) {
        const error = await rejection(fileIssue(request(asM, payload)))
        expect(error, JSON.stringify(payload)?.slice(0, 80)).toBeInstanceOf(ApiError)
        expect((error as InstanceType<typeof ApiError>).code, JSON.stringify(payload)?.slice(0, 80)).toBe(ErrorCode.VALIDATION_ERROR)
      }
      expect(await issueRows('subject LIKE $1', [`%${subject}%`])).toHaveLength(0)
    })

    it('keeps one organization\'s reports from another, below the route', async () => {
      const subject = `Isolated ${tag}`
      const { issue } = await body(await fileIssue(request(asM, { ...valid, subject })))
      const schema = await import('@/db/schema')
      const seenByA = await harness.tenant(RUNTIME_ROLE, ORG_A, memberM, (tx) => tx.select().from(schema.memberDuesIssues))
      expect(seenByA.map((row) => row.id)).toContain(issue.id)
      const seenByB = await harness.tenant(RUNTIME_ROLE, ORG_B, memberM, (tx) => tx.select().from(schema.memberDuesIssues))
      expect(seenByB.map((row) => row.id)).not.toContain(issue.id)
    })

    it('stores nothing when its audit fails', async () => {
      const subject = `Unaudited ${tag}`
      harness.failNextAudit()
      const error = await rejection(fileIssue(request(asM, { ...valid, subject })))
      expect((error as Error).message).toBe('audit sink unavailable')
      expect(await issueRows('subject = $1', [subject])).toHaveLength(0)
    })

    it('refuses a caller below the role floor: no identity, no organization', async () => {
      const error = await rejection(fileIssue(request({ organizationId: null as never, userId: null as never }, valid)))
      expect((error as InstanceType<typeof ApiError>).code).toBe(ErrorCode.FORBIDDEN)
    })
  })
})
