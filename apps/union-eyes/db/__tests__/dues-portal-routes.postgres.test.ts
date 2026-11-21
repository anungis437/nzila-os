/**
 * The member dues portal routes on real PostgreSQL, as the real roles: GET /api/dues/deductions and POST /api/dues/issues.
 *
 * Platform 0061 and cache 0052 gave payroll_deductions and member_dues_issues a physical relation and a row-security floor (organization). Until then both
 * routes answered with an undefined-relation fault whatever the caller sent. This runs the unmodified routes against the combined Django + Drizzle schema,
 * with only the request boundary replaced (see native-route-harness.ts).
 *
 * Finance and dues persistence is now excluded from the base release (lib/finance/base-release-boundary.ts requireBaseFinancialAuthority: an
 * unconditional 501, no database, provider or audit side effect; consistent with the closed owner decision that dues are handled in an external
 * system). So this proves the decided refusal, at the strength the positive proofs had:
 *   - every member, in either organization, is answered NOT_IMPLEMENTED (501) for their deductions, and the refusal carries no row;
 *   - the routes no longer ask for a tenant transaction, and a handle with no organization still sees no deduction row;
 *   - a report is refused 501 whatever the body claims, whichever deduction it names (another member's, another organization's or a made-up one
 *     answer identically, so the refusal is no existence oracle), and nothing is stored or audited;
 *   - what a client can get wrong is still a client error, never a server fault, and writes nothing;
 *   - below the route an organization still cannot read another's reports, and a caller with no organization is refused before any statement.
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
    // The organizations the members belong to: a canonical membership references its organization.
    for (const id of [ORG_A, ORG_B]) await admin.query(
      `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
       VALUES ($1,$2,$2,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`, [id, `dues-portal-${id.slice(0, 8)}-${tag}`])
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

  const refusedAsUnavailable = (error: unknown) => {
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: ErrorCode.NOT_IMPLEMENTED, status: 501, message: 'Finance and dues persistence are not available in this release.' })
  }

  describe('GET /api/dues/deductions', () => {
    it('answers every member NOT_IMPLEMENTED for their deductions, in either organization, with no row in the refusal', async () => {
      for (const who of [asM, asMInB, asN]) {
        const error = await rejection(listDeductions({ ...who, request: new Request('http://localhost/api/dues/deductions') }))
        refusedAsUnavailable(error)
        expect(JSON.stringify(error)).not.toMatch(/45\.50|47\.25|60\.00|30\.00|staff-|internal reconciliation/)
      }
    })

    it('no longer asks the wrapper for a tenant transaction, and a handle with no organization still sees no deduction row', async () => {
      const config = harness.configs.find((entry) => entry.openapi?.summary === 'List payroll deductions for the authenticated member')
      expect(config?.rlsOrgContext).toBe(false)
      const schema = await import('@/db/schema')
      const withoutOrganization = await harness.tenant(RUNTIME_ROLE, null, memberM, (tx) => tx.select().from(schema.payrollDeductions))
      expect(withoutOrganization).toEqual([])
    })

    it('refuses a signed-in caller who has no organization before any statement: there is no canonical membership to bind', async () => {
      const error = await rejection(listDeductions({ organizationId: null, userId: memberM, role: 'member', request: new Request('http://localhost/api/dues/deductions') }))
      expect((error as InstanceType<typeof ApiError>).code).toBe(ErrorCode.FORBIDDEN)
    })
  })

  describe('POST /api/dues/issues', () => {
    it('refuses a report NOT_IMPLEMENTED, whatever the body claims about identity, status, priority, assignment and resolution, and stores and audits nothing', async () => {
      const before = harness.audits.length
      for (const payload of [{ ...valid, expectedAmount: 45.5 }, {
        ...valid, userId: memberN, organizationId: ORG_B, status: 'resolved', priority: 1, assignedTo: 'staff', resolvedBy: 'staff', resolutionType: 'corrected', actualAmount: 1,
      }]) refusedAsUnavailable(await rejection(fileIssue(request(asM, payload))))
      expect(await issueRows('subject = $1', [valid.subject])).toHaveLength(0)
      expect(harness.audits).toHaveLength(before)
    })

    it('refuses a report naming the caller\'s own, another member\'s, another organization\'s or a made-up deduction identically, and writes nothing', async () => {
      const subject = `Named deduction ${tag}`
      for (const payrollDeductionId of [ids.mar, ids.n, ids.b, randomUUID()]) {
        refusedAsUnavailable(await rejection(fileIssue(request(asM, { ...valid, subject, payrollDeductionId }))))
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
      const { rows } = await admin.query(`INSERT INTO public.member_dues_issues (organization_id, user_id, issue_type, subject, description)
        VALUES ($1, $2, 'incorrect_amount', $3, 'Seeded by the operator: the route files nothing in this release') RETURNING id::text AS id`, [ORG_A, memberM, subject])
      const schema = await import('@/db/schema')
      const seenByA = await harness.tenant(RUNTIME_ROLE, ORG_A, memberM, (tx) => tx.select().from(schema.memberDuesIssues))
      expect(seenByA.map((row) => row.id)).toContain(rows[0].id)
      const seenByB = await harness.tenant(RUNTIME_ROLE, ORG_B, memberM, (tx) => tx.select().from(schema.memberDuesIssues))
      expect(seenByB.map((row) => row.id)).not.toContain(rows[0].id)
    })

    it('refuses before any audit is attempted, so nothing is stored whether or not the audit sink would work', async () => {
      const subject = `Unaudited ${tag}`
      const before = harness.audits.length
      refusedAsUnavailable(await rejection(fileIssue(request(asM, { ...valid, subject }))))
      expect(await issueRows('subject = $1', [subject])).toHaveLength(0)
      expect(harness.audits).toHaveLength(before)
    })

    it('refuses a caller below the role floor: no identity, no organization', async () => {
      const error = await rejection(fileIssue(request({ organizationId: null as never, userId: null as never }, valid)))
      expect((error as InstanceType<typeof ApiError>).code).toBe(ErrorCode.FORBIDDEN)
    })
  })
})
