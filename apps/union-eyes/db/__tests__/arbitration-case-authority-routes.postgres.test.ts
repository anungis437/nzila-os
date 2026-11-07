/**
 * Arbitration case authority on the combined schema, as the real roles (DEF-0B3-ARBITRATION-RECORD-NO-CASE-AUTHORITY).
 *
 * B98 (lib/arbitration/arbitration-case-authority.ts) made every arbitration write and the per-row read hook ask the authority
 * kernel's case-access verdict, and the item route declared `retainOnDelete` so no arbitration is ever removed through the generic
 * route. What had no end-to-end proof is the wiring itself: that the generic CRUD factory actually calls that hook for the
 * collection list (not only a single item), that DELETE refuses every caller unconditionally, and that an update re-checks edit
 * authority rather than the read authority a GET accepts.
 *
 * Every call goes straight through the unmodified route handlers (see native-route-harness.ts) against real `grievances` and
 * `arbitrations` rows, as the real union_eyes_runtime role; nothing in the data path is mocked except the one external decision
 * this module never computes itself -- the authority kernel's case-access verdict (@/lib/services/case-access-service), which is
 * proven on its own in lib/services/case-access-service.pglite.test.ts and stubbed here exactly as grievances-routes.postgres.test.ts
 * already stubs it, keyed by `${userId}|${grievanceId}`, defaulting to no access.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const URL = process.env.UE_AUTHORITY_COMBINED_URL

const state = vi.hoisted(() => ({
  // `${userId}|${grievanceId}` -> the case-relationship decision the authority kernel would give; absent means no relationship.
  caseAccess: new Map<string, Record<string, unknown>>(),
}))

vi.mock('@/db/db', async () => ({ db: (await import('./native-route-harness')).ambientDb }))
vi.mock('@/db', async () => ({ db: (await import('./native-route-harness')).ambientDb }))
vi.mock('@/lib/db/with-rls-context', async () => (await import('./native-route-harness')).rlsContextModule)
vi.mock('@/lib/audit/atomic-audit', async () => ({ persistAtomicAudit: (await import('./native-route-harness')).recordAudit }))
vi.mock('@/lib/api/with-api', async () => ({ withApi: (await import('./native-route-harness')).emulatedWithApi }))
vi.mock('@/lib/services/case-access-service', () => {
  const none = { isPrimaryOwner: false, isSecondaryCollaborator: false, accessRole: null, canViewCase: false, canEditCaseNotes: false, canUploadDocuments: false, canDraftActions: false, canViewPrivateDocuments: false, canManageAssignments: false }
  return {
    getEffectiveCaseAccess: async ({ userId, grievanceId }: { userId: string; grievanceId: string }) => ({ ...none, ...(state.caseAccess.get(`${userId}|${grievanceId}`) ?? {}) }),
  }
})

const { harness } = await import('./native-route-harness')
const { ApiError, ErrorCode } = await import('@/lib/api/errors')

type Row = Record<string, unknown>
type One = (ctx: unknown) => Promise<{ data: Row }>
type Many = (ctx: unknown) => Promise<{ data: Row[] }>
type Collection = { GET: Many; POST: One }
type Item = { GET: One; PATCH: One; DELETE: One }

const routes = URL
  ? {
      collection: await import('@/app/api/arbitrations/route'),
      item: await import('@/app/api/arbitrations/[id]/route'),
    }
  : null

describe.skipIf(!URL)('arbitration case authority on the combined schema, as the real roles', () => {
  const tag = `arb${randomUUID().slice(0, 8)}`
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  let admin: pg.Client

  const steward = { id: randomUUID(), organizationId: ORG_A, role: 'steward' }
  const otherSteward = { id: randomUUID(), organizationId: ORG_A, role: 'steward' }
  const stewardOrgB = { id: randomUUID(), organizationId: ORG_B, role: 'steward' }
  // DELETE's own role floor is admin (crud-factory defaults deleteRole to 'admin' when writeRole is below it), so
  // only an admin caller actually reaches retainOnDelete; a steward is refused by the role floor first.
  const orgAdmin = { id: randomUUID(), organizationId: ORG_A, role: 'admin' }

  let caseOwned = ''
  let caseReadOnly = ''
  let caseNoStanding = ''
  let caseOrgB = ''
  let arbitrationOwned = ''
  let arbitrationReadOnly = ''
  let arbitrationNoStanding = ''
  let arbitrationOrgB = ''

  const call = <T,>(handler: (ctx: unknown) => Promise<T>, who: { id: string; organizationId: string }, options: { body?: unknown; id?: string } = {}) =>
    handler({
      request: new Request('http://localhost/api/test'),
      organizationId: who.organizationId,
      userId: who.id,
      body: options.body,
      params: options.id ? { id: options.id } : {},
    })
  const rejection = async (promise: Promise<unknown>) => promise.then(() => null, (error: unknown) => error)

  const newOrganization = (id: string, name: string) =>
    admin.query(
      `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
       VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
      [id, name, `${name.toLowerCase().replace(/\W+/g, '-')}-${tag}-${id.slice(0, 6)}`],
    )
  const newOrgMember = (who: { id: string; organizationId: string; role: string }) =>
    admin.query(
      `INSERT INTO organization_members (id, user_id, organization_id, name, email, role, status) VALUES ($1,$2,$3,$4,$5,$6,'active')`,
      [who.id, who.id, who.organizationId, `Actor ${tag}`, `actor-${who.id}@${tag}.test`, who.role],
    )
  const newGrievance = async (organizationId: string, createdBy: string) => {
    const id = randomUUID()
    // The physical table is Django-managed and carries no database-level defaults (see grievances.ts's own
    // comment), so a raw-SQL insert must supply every NOT NULL column explicitly, not only the ones this test cares about.
    await admin.query(
      `INSERT INTO grievances (id, organization_id, grievance_number, type, title, description, created_by) VALUES ($1,$2,$3,'individual',$4,$5,$6)`,
      [id, organizationId, `GR-${tag}-${id.slice(0, 8)}`, `Grievance ${tag}`, 'd', createdBy],
    )
    return id
  }
  const newArbitration = async (organizationId: string, grievanceId: string, number: string) => {
    const id = randomUUID()
    // The real arbitrations table carries a NOT NULL organization_id (Django-managed, like grievances; see
    // grievances.ts's own comment on raw-SQL inserts needing every NOT NULL column supplied explicitly).
    await admin.query(
      `INSERT INTO arbitrations (id, organization_id, grievance_id, arbitration_number, board_name, board_type, status) VALUES ($1,$2,$3,$4,'Board','grievance','pending')`,
      [id, organizationId, grievanceId, number],
    )
    return id
  }

  const collection = () => routes!.collection as unknown as Collection
  const item = () => routes!.item as unknown as Item

  beforeAll(async () => {
    admin = await harness.start(URL!)
    for (const who of [steward, otherSteward, stewardOrgB, orgAdmin]) harness.setRole(who.id, who.organizationId, who.role)
    await newOrganization(ORG_A, `Org A ${tag}`)
    await newOrganization(ORG_B, `Org B ${tag}`)
    for (const who of [steward, otherSteward, stewardOrgB, orgAdmin]) await newOrgMember(who)

    caseOwned = await newGrievance(ORG_A, steward.id)
    caseReadOnly = await newGrievance(ORG_A, steward.id)
    caseNoStanding = await newGrievance(ORG_A, steward.id)
    caseOrgB = await newGrievance(ORG_B, stewardOrgB.id)

    arbitrationOwned = await newArbitration(ORG_A, caseOwned, `OWN-${tag}`)
    arbitrationReadOnly = await newArbitration(ORG_A, caseReadOnly, `RO-${tag}`)
    arbitrationNoStanding = await newArbitration(ORG_A, caseNoStanding, `NONE-${tag}`)
    arbitrationOrgB = await newArbitration(ORG_B, caseOrgB, `ORGB-${tag}`)

    // steward: primary owner of caseOwned, read-only collaborator of caseReadOnly, no standing at all on caseNoStanding.
    state.caseAccess.set(`${steward.id}|${caseOwned}`, { canViewCase: true, isPrimaryOwner: true, canEditCaseNotes: true })
    state.caseAccess.set(`${steward.id}|${caseReadOnly}`, { canViewCase: true, isPrimaryOwner: false, canEditCaseNotes: false })
    // otherSteward holds no relationship to any case; stewardOrgB owns caseOrgB in its own organization.
    state.caseAccess.set(`${stewardOrgB.id}|${caseOrgB}`, { canViewCase: true, isPrimaryOwner: true, canEditCaseNotes: true })
  }, 60_000)

  afterAll(() => harness.stop())

  it('the collection lists only arbitrations whose case the caller may read, counting only those', async () => {
    const result = await call(collection().GET, steward)
    const ids = result.data.map((row) => row.id)
    expect(ids).toContain(arbitrationOwned)
    expect(ids).toContain(arbitrationReadOnly)
    expect(ids).not.toContain(arbitrationNoStanding)
    expect(ids).not.toContain(arbitrationOrgB)
  })

  it('the item route answers not-found for a case the caller may not read, not forbidden', async () => {
    const error = await rejection(call(item().GET, steward, { id: arbitrationNoStanding }))
    expect((error as InstanceType<typeof ApiError>)?.code).toBe(ErrorCode.NOT_FOUND)
  })

  it('an organization never sees another organization\'s arbitration even with a matching case-access stub', async () => {
    const error = await rejection(call(item().GET, steward, { id: arbitrationOrgB }))
    expect((error as InstanceType<typeof ApiError>)?.code).toBe(ErrorCode.NOT_FOUND)
  })

  it('a read-only collaborator reads the arbitration but may not update it', async () => {
    const read = await call(item().GET, steward, { id: arbitrationReadOnly })
    expect(read.data.id).toBe(arbitrationReadOnly)
    const error = await rejection(call(item().PATCH, steward, { id: arbitrationReadOnly, body: { boardName: 'Renamed' } }))
    expect((error as InstanceType<typeof ApiError>)?.code).toBe(ErrorCode.FORBIDDEN)
  })

  it('the case owner may update their own arbitration', async () => {
    const updated = await call(item().PATCH, steward, { id: arbitrationOwned, body: { boardName: 'Renamed Board' } })
    expect(updated.data.boardName).toBe('Renamed Board')
  })

  it('DELETE refuses every caller unconditionally, including the case owner, before any row is read', async () => {
    const error = await rejection(call(item().DELETE, orgAdmin, { id: arbitrationOwned }))
    expect((error as InstanceType<typeof ApiError>)?.code).toBe(ErrorCode.CONFLICT)
    const error2 = await rejection(call(item().DELETE, orgAdmin, { id: 'does-not-exist' }))
    expect((error2 as InstanceType<typeof ApiError>)?.code).toBe(ErrorCode.CONFLICT)
  })

  it('DELETE refuses a caller below its own role floor before retainOnDelete is ever reached', async () => {
    const error = await rejection(call(item().DELETE, steward, { id: arbitrationOwned }))
    expect((error as InstanceType<typeof ApiError>)?.code).toBe(ErrorCode.FORBIDDEN)
  })

  it('creating an arbitration requires edit authority on the named grievance, not only membership in its organization', async () => {
    const body = { grievanceId: caseReadOnly, arbitrationNumber: `NEW-${tag}`, boardName: 'Board', boardType: 'grievance' }
    const error = await rejection(call(collection().POST, steward, { body }))
    expect((error as InstanceType<typeof ApiError>)?.code).toBe(ErrorCode.FORBIDDEN)
    const created = await call(collection().POST, steward, { body: { ...body, grievanceId: caseOwned, arbitrationNumber: `NEW2-${tag}` } })
    expect(created.data.grievanceId).toBe(caseOwned)
  })

  it('creating an arbitration against another organization\'s grievance is refused before any case-access check', async () => {
    const body = { grievanceId: caseOrgB, arbitrationNumber: `CROSS-${tag}`, boardName: 'Board', boardType: 'grievance' }
    const error = await rejection(call(collection().POST, steward, { body }))
    expect((error as InstanceType<typeof ApiError>)?.code).toBe(ErrorCode.NOT_FOUND)
  })
})
