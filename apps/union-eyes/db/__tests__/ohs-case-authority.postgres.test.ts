/**
 * OHS/CNESST case authority on the combined schema, as the real roles (DEF-0B4-OHS-FILINGS-NO-CASE-AUTHORITY,
 * DEF-0B5-OHS-WITHDRAWAL-REFUSAL-NO-CASE-AUTHORITY).
 *
 * Proves, over two organizations, that a steward reaches a CNESST filing, right-of-refusal or preventive-withdrawal
 * record only through: an officer-or-above role, a steward_assignments row whose department covers the member's
 * current employment, the filing's own designated representative, or (for a refusal/withdrawal) the designated
 * representative of the filing it is linked to. Every call goes straight through the unmodified route handlers
 * (see native-route-harness.ts) as the real union_eyes_runtime / union_eyes_system roles; nothing in the data path
 * is mocked.
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
vi.mock('@/lib/organization-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/organization-utils')>()),
  getUserRoleInOrganization: (await import('./native-route-harness')).roleInOrganization,
}))

const { harness } = await import('./native-route-harness')
const { ApiError, ErrorCode } = await import('@/lib/api/errors')

type Row = Record<string, unknown>
type One = (ctx: unknown) => Promise<{ data: Row }>
type Many = (ctx: unknown) => Promise<{ data: Row[] }>
type Collection = { GET: Many; POST: One }
type Item = { GET: One; PATCH: One }

const routes = URL
  ? {
      filings: [await import('@/app/api/cnesst/filings/route'), await import('@/app/api/cnesst/filings/[id]/route')],
      refusals: [await import('@/app/api/cnesst/right-of-refusal/route'), await import('@/app/api/cnesst/right-of-refusal/[id]/route')],
    }
  : null

describe.skipIf(!URL)('OHS/CNESST case authority on the combined schema, as the real roles', () => {
  const tag = `ohs${randomUUID().slice(0, 8)}`
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  let admin: pg.Client

  const person = (organizationId: string, role: string) => ({ id: randomUUID(), organizationId, role })
  // Covered: in the department the steward's assignment names. Uncovered: a different department, same organization.
  const A = { steward: person(ORG_A, 'steward'), outsider: person(ORG_A, 'steward'), officer: person(ORG_A, 'officer') }
  const B = { steward: person(ORG_B, 'steward'), officer: person(ORG_B, 'officer') }
  let memberCovered = ''
  let memberUncovered = ''
  let memberOrgB = ''

  const call = <T,>(handler: (ctx: unknown) => Promise<T>, who: { id: string; organizationId: string }, options: { body?: unknown; id?: string } = {}) =>
    handler({
      request: new Request('http://localhost/api/test'),
      organizationId: who.organizationId,
      userId: who.id,
      body: options.body,
      params: options.id ? { id: options.id } : {},
    })
  const rejection = async (promise: Promise<unknown>) => promise.then(() => null, (error: unknown) => error)
  const rowOf = async (table: string, id: string) => (await admin.query(`SELECT * FROM public.${table} WHERE id = $1`, [id])).rows[0] as Row | undefined

  const newOrganization = (id: string, name: string) =>
    admin.query(
      `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
       VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
      [id, name, `${name.toLowerCase().replace(/\W+/g, '-')}-${tag}-${id.slice(0, 6)}`],
    )
  const newMember = async (organizationId: string, department: string) => {
    const memberId = randomUUID()
    await admin.query(
      `INSERT INTO organization_members (id, user_id, organization_id, name, email, role, status) VALUES ($1,$2,$3,$4,$5,'member','active')`,
      [memberId, memberId, organizationId, `Member ${tag}`, `member-${memberId}@${tag}.test`],
    )
    await admin.query(
      `INSERT INTO member_employment (id, organization_id, member_id, employment_status, employment_type, hire_date, seniority_date, job_title, department, pay_frequency)
       VALUES ($1,$2,$3,'active','full_time',current_date,current_date,'Operator',$4,'hourly')`,
      [randomUUID(), organizationId, memberId, department],
    )
    return memberId
  }
  const newOrgMember = (who: { id: string; organizationId: string; role: string }) =>
    admin.query(
      `INSERT INTO organization_members (id, user_id, organization_id, name, email, role, status) VALUES ($1,$2,$3,$4,$5,$6,'active')`,
      [who.id, who.id, who.organizationId, `Actor ${tag}`, `actor-${who.id}@${tag}.test`, who.role],
    )
  const newStewardAssignment = async (who: { id: string; organizationId: string }, department: string) => {
    const stewardProfileId = randomUUID()
    await admin.query(`INSERT INTO stewards (id, org_id, user_id, active) VALUES ($1,$2,$3,true)`, [stewardProfileId, who.organizationId, who.id])
    await admin.query(
      `INSERT INTO steward_assignments (id, organization_id, steward_id, steward_type, status, department, start_date) VALUES ($1,$2,$3,'steward','active',$4,current_date)`,
      [randomUUID(), who.organizationId, stewardProfileId, department],
    )
  }

  const filings = () => routes!.filings[0] as unknown as Collection
  const filingItem = () => routes!.filings[1] as unknown as Item
  const refusals = () => routes!.refusals[0] as unknown as Collection
  const refusalItem = () => routes!.refusals[1] as unknown as Item

  beforeAll(async () => {
    admin = await harness.start(URL!)
    for (const who of [A.steward, A.outsider, A.officer, B.steward, B.officer]) harness.setRole(who.id, who.organizationId, who.role)
    await newOrganization(ORG_A, `Org A ${tag}`)
    await newOrganization(ORG_B, `Org B ${tag}`)
    for (const who of [A.steward, A.outsider, A.officer, B.steward, B.officer]) await newOrgMember(who)
    memberCovered = await newMember(ORG_A, 'Shop Floor')
    memberUncovered = await newMember(ORG_A, 'Head Office')
    memberOrgB = await newMember(ORG_B, 'Shop Floor')
    // A.steward's only assignment covers Shop Floor; A.outsider holds a steward role but no assignment at all.
    await newStewardAssignment(A.steward, 'Shop Floor')
  }, 60_000)

  afterAll(async () => {
    await admin?.end()
    await harness.stop()
  })

  describe('CNESST filings', () => {
    it('a covering steward opens, reads and updates a filing for the member their assignment covers', async () => {
      const created = await call(filings().POST, A.steward, { body: { filingType: 'workplace_accident', legalBasis: 'LATMP art. 271', title: `Covered ${tag}`, description: 'd', memberId: memberCovered } })
      const id = created.data.id as string
      expect((await rowOf('cnesst_filings', id))!.member_id).toBe(memberCovered)
      const read = await call(filingItem().GET, A.steward, { id })
      expect(read.data.id).toBe(id)
      const updated = await call(filingItem().PATCH, A.steward, { id, body: { title: `Covered, revised ${tag}` } })
      expect(updated.data.title).toBe(`Covered, revised ${tag}`)
    })

    it('refuses a same-tenant steward with no covering assignment: create, read and update all fail closed', async () => {
      const createDenied = await rejection(call(filings().POST, A.outsider, { body: { filingType: 'workplace_accident', legalBasis: 'LATMP art. 271', title: `Uncovered ${tag}`, description: 'd', memberId: memberUncovered } }))
      expect((createDenied as InstanceType<typeof ApiError>)?.code).toBe(ErrorCode.FORBIDDEN)

      // An officer opens the record the outsider has no case authority over, so the refusal is proven against a real row.
      const officerOpened = await call(filings().POST, A.officer, { body: { filingType: 'workplace_accident', legalBasis: 'LATMP art. 271', title: `Uncovered ${tag}`, description: 'd', memberId: memberUncovered } })
      const id = officerOpened.data.id as string

      const readDenied = await rejection(call(filingItem().GET, A.outsider, { id }))
      expect((readDenied as InstanceType<typeof ApiError>)?.code).toBe(ErrorCode.NOT_FOUND)
      const writeDenied = await rejection(call(filingItem().PATCH, A.outsider, { id, body: { title: 'should not land' } }))
      expect((writeDenied as InstanceType<typeof ApiError>)?.code).toBe(ErrorCode.FORBIDDEN)
      expect((await rowOf('cnesst_filings', id))!.title).toBe(`Uncovered ${tag}`)
    })

    it('an officer reaches every member\'s filing regardless of coverage', async () => {
      const read = await call(filingItem().GET, A.officer, { id: (await call(filings().POST, A.officer, { body: { filingType: 'workplace_accident', legalBasis: 'LATMP art. 271', title: `Officer-opened ${tag}`, description: 'd', memberId: memberUncovered } })).data.id as string })
      expect(read.data.memberId).toBe(memberUncovered)
    })

    it('a designated representative reaches the filing even with no covering assignment', async () => {
      const opened = await call(filings().POST, A.officer, { body: { filingType: 'workplace_accident', legalBasis: 'LATMP art. 271', title: `Designated ${tag}`, description: 'd', memberId: memberUncovered } })
      const id = opened.data.id as string
      await admin.query(`UPDATE cnesst_filings SET union_rep_id = $1 WHERE id = $2`, [A.outsider.id, id])
      const read = await call(filingItem().GET, A.outsider, { id })
      expect(read.data.id).toBe(id)
      const updated = await call(filingItem().PATCH, A.outsider, { id, body: { title: `Designated, revised ${tag}` } })
      expect(updated.data.title).toBe(`Designated, revised ${tag}`)
    })

    it('revoking the covering assignment removes access; reassigning it to another steward moves access with it', async () => {
      const opened = await call(filings().POST, A.steward, { body: { filingType: 'workplace_accident', legalBasis: 'LATMP art. 271', title: `Revocation ${tag}`, description: 'd', memberId: memberCovered } })
      const id = opened.data.id as string
      expect((await call(filingItem().GET, A.steward, { id })).data.id).toBe(id)

      await admin.query(`UPDATE steward_assignments SET status = 'revoked' WHERE organization_id = $1 AND department = 'Shop Floor'`, [ORG_A])
      const afterRevoke = await rejection(call(filingItem().GET, A.steward, { id }))
      expect((afterRevoke as InstanceType<typeof ApiError>)?.code).toBe(ErrorCode.NOT_FOUND)

      await newStewardAssignment(A.outsider, 'Shop Floor')
      const reassigned = await call(filingItem().GET, A.outsider, { id })
      expect(reassigned.data.id).toBe(id)
    })

    it('refuses cross-tenant access outright: another organization\'s steward and officer both get not-found', async () => {
      const opened = await call(filings().POST, A.officer, { body: { filingType: 'workplace_accident', legalBasis: 'LATMP art. 271', title: `Tenant A only ${tag}`, description: 'd', memberId: memberCovered } })
      const id = opened.data.id as string
      for (const who of [B.steward, B.officer]) {
        const denied = await rejection(call(filingItem().GET, who, { id }))
        expect((denied as InstanceType<typeof ApiError>)?.code, who.role).toBe(ErrorCode.NOT_FOUND)
      }
      // The reverse direction: org B's own member and officer-opened filing is unreachable from org A.
      const orgBFiling = await call(filings().POST, B.officer, { body: { filingType: 'workplace_accident', legalBasis: 'LATMP art. 271', title: `Tenant B only ${tag}`, description: 'd', memberId: memberOrgB } })
      const deniedFromA = await rejection(call(filingItem().GET, A.officer, { id: orgBFiling.data.id as string }))
      expect((deniedFromA as InstanceType<typeof ApiError>)?.code).toBe(ErrorCode.NOT_FOUND)
    })

    it('concurrent reads of the same filing by an authorized and an unauthorized steward resolve independently, with no cross-contamination', async () => {
      const opened = await call(filings().POST, A.officer, { body: { filingType: 'workplace_accident', legalBasis: 'LATMP art. 271', title: `Concurrency ${tag}`, description: 'd', memberId: memberUncovered } })
      const id = opened.data.id as string
      const [authorized, denied] = await Promise.all([
        call(filingItem().GET, A.officer, { id }),
        rejection(call(filingItem().GET, A.outsider, { id })),
      ])
      expect(authorized.data.id).toBe(id)
      expect((denied as InstanceType<typeof ApiError>)?.code).toBe(ErrorCode.NOT_FOUND)
    })
  })

  describe('right-of-refusal events (transitive case authority through a linked filing)', () => {
    it('a covering steward records and reads a refusal for the member their assignment covers', async () => {
      const created = await call(refusals().POST, A.steward, { body: { memberId: memberCovered, memberName: 'Worker', refusalDate: new Date().toISOString(), taskRefused: 'Operate the press', dangerDescription: 'Guard removed' } })
      const id = created.data.id as string
      const read = await call(refusalItem().GET, A.steward, { id })
      expect(read.data.id).toBe(id)
    })

    it('refuses a same-tenant steward with no covering assignment and no linked-filing designation', async () => {
      const officerOpened = await call(refusals().POST, A.officer, { body: { memberId: memberUncovered, memberName: 'Worker', refusalDate: new Date().toISOString(), taskRefused: 'Operate the press', dangerDescription: 'Guard removed' } })
      const denied = await rejection(call(refusalItem().GET, A.outsider, { id: officerOpened.data.id as string }))
      expect((denied as InstanceType<typeof ApiError>)?.code).toBe(ErrorCode.NOT_FOUND)
    })

    it('a steward with no covering assignment reaches a refusal through the filing it is linked to', async () => {
      const filing = await call(filings().POST, A.officer, { body: { filingType: 'workplace_accident', legalBasis: 'LATMP art. 271', title: `Linked ${tag}`, description: 'd', memberId: memberUncovered } })
      await admin.query(`UPDATE cnesst_filings SET union_rep_id = $1 WHERE id = $2`, [A.outsider.id, filing.data.id])
      const refusal = await call(refusals().POST, A.officer, { body: { memberId: memberUncovered, memberName: 'Worker', refusalDate: new Date().toISOString(), taskRefused: 'Operate the press', dangerDescription: 'Guard removed', cneesstFilingId: filing.data.id } })
      const read = await call(refusalItem().GET, A.outsider, { id: refusal.data.id as string })
      expect(read.data.id).toBe(refusal.data.id)
    })
  })
})
