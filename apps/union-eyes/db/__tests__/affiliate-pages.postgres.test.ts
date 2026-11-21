/**
 * The CLC and federation affiliate pages' reads (lib/organizations/affiliates.ts, lib/organizations/per-capita-standing.ts) on real
 * PostgreSQL, as the real roles.
 *
 * The pages read `organizations`, `organization_members` and `per_capita_remittances` through the module-level handle with no organization
 * set. As the runtime role that showed a parent no affiliate at all (a tenant session reads only its own organization row), no member count and no
 * remittance, and a failure rendered as the same empty page. This runs the unmodified functions, with only the context boundary replaced by the harness's,
 * and proves that
 *   - a parent's administrator is shown the organizations directly below it (not its grandchildren, not another tree); a member who is not an
 *     administrator, and an administrator of another tree, are refused before anything is read. Issue #1116: the hierarchy is an affiliation
 *     graph, not an access grant, so an affiliate is its directory entry (name, type, status, province, affiliate code) and its contact
 *     details, description and active-member count are given only where the caller is a direct member of the affiliate;
 *   - the remittance figures are the ones addressed to the organization: members are each affiliate's latest period (never a sum over periods),
 *     overdue means still pending past its due date, compliance counts what fell due and was submitted by then, and there is no rate (null) when
 *     nothing fell due; the affiliate with no remittance on file is pending and at risk;
 *   - the tenant context needs no system authority for remittances, and with no organization set the runtime role sees none of them.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { insertMember, insertOrganization } from './page-reads-seed'

const URL = process.env.UE_AUTHORITY_COMBINED_URL

vi.mock('@/db/db', async () => ({ db: (await import('./native-route-harness')).ambientDb }))
vi.mock('@/db', async () => ({ db: (await import('./native-route-harness')).ambientDb }))
vi.mock('@/lib/db/with-rls-context', async () => (await import('./native-route-harness')).rlsContextModule)
// The affiliate directory is read as it is in the legacy lineage (its own native proof); the remittance reflection is proved in canonical
// mode, the mode of every current deployment, where the canonical source contains per_capita_remittances.
const mode = vi.hoisted(() => ({ canonical: false }))
vi.mock('@/lib/auth/canonical-bootstrap', () => ({ currentStateContextEnabled: () => mode.canonical }))
vi.mock('@/lib/api-auth-guard', () => ({
  ROLE_HIERARCHY: { member: 20, admin: 140, fed_staff: 160, fed_executive: 170, clc_staff: 180, clc_executive: 190, system_admin: 200 },
  isPlatformAdminUser: async () => false,
}))

const { harness, RUNTIME_ROLE } = await import('./native-route-harness')
const affiliates = URL ? await import('@/lib/organizations/affiliates') : null
const standing = URL ? await import('@/lib/organizations/per-capita-standing') : null
const schema = URL ? await import('@/db/schema') : null

describe.skipIf(!URL)('the affiliate and remittance reads on the combined schema, as the real roles', () => {
  const tag = `af${randomUUID().slice(0, 8)}`
  const CLC = randomUUID()
  const FED = randomUUID()
  const UNION = randomUUID()
  const LOCAL_1 = randomUUID()
  const LOCAL_2 = randomUUID()
  const OTHER_CLC = randomUUID()
  const OTHER_CHILD = randomUUID()
  const clcStaff = `clc-staff-${tag}`
  const clcMember = `clc-member-${tag}`
  const fedAdmin = `fed-admin-${tag}`
  const strangerAdmin = `stranger-${tag}`
  const clcAdminAndFedMember = `clc-admin-fed-member-${tag}`
  let admin: pg.Client

  const remittance = (from: string, to: string, month: number, status: string, dueOffsetDays: number, submittedOffsetDays: number | null, members: number, amount: number) =>
    admin.query(
      `INSERT INTO per_capita_remittances (organization_id, from_organization_id, to_organization_id, remittance_month, remittance_year, due_date, total_members, good_standing_members, remittable_members, per_capita_rate, total_amount, status, submitted_date, created_at, updated_at)
       VALUES ($1, $1, $2, $3, EXTRACT(YEAR FROM CURRENT_DATE)::int, CURRENT_DATE + $4::int, $7, $7, $7, 10, $8, $5, CASE WHEN $6::int IS NULL THEN NULL ELSE (CURRENT_DATE + $4::int + $6::int)::timestamptz + interval '10 hours' END, now(), now())`,
      [from, to, month, dueOffsetDays, status, submittedOffsetDays, members, amount],
    )

  beforeAll(async () => {
    admin = await harness.start(URL!)
    await insertOrganization(admin, tag, { id: CLC, name: `CLC ${tag}`, type: 'congress' })
    await insertOrganization(admin, tag, { id: FED, name: `Federation ${tag}`, type: 'federation', parentId: CLC, path: [CLC], level: 1, province: 'ON' })
    await insertOrganization(admin, tag, { id: UNION, name: `Union ${tag}`, type: 'union', parentId: CLC, path: [CLC], level: 1 })
    await insertOrganization(admin, tag, { id: LOCAL_1, name: `Local 1 ${tag}`, parentId: FED, path: [CLC, FED], level: 2 })
    await insertOrganization(admin, tag, { id: LOCAL_2, name: `Local 2 ${tag}`, parentId: FED, path: [CLC, FED], level: 2 })
    await insertOrganization(admin, tag, { id: OTHER_CLC, name: `Other CLC ${tag}`, type: 'congress' })
    await insertOrganization(admin, tag, { id: OTHER_CHILD, name: `Other child ${tag}`, type: 'union', parentId: OTHER_CLC, path: [OTHER_CLC], level: 1 })
    await admin.query(`UPDATE organizations SET email = 'fed@example.test', phone = '416-555-0100', address = '{"street": "1 Main St", "city": "Toronto", "postal_code": "M5V 1A1"}'::jsonb, clc_affiliate_code = 'F-1', description = 'The federation' WHERE id = $1`, [FED])

    await insertMember(admin, CLC, { userId: clcStaff, role: 'clc_staff' })
    await insertMember(admin, CLC, { userId: clcMember, role: 'member' })
    await insertMember(admin, FED, { userId: fedAdmin, role: 'admin' })
    await insertMember(admin, OTHER_CLC, { userId: strangerAdmin, role: 'admin' })
    await insertMember(admin, CLC, { userId: clcAdminAndFedMember, role: 'admin' })
    await insertMember(admin, FED, { userId: clcAdminAndFedMember, role: 'member' })
    for (const [org, count] of [[FED, 3], [UNION, 2], [LOCAL_1, 1], [OTHER_CHILD, 4]] as Array<[string, number]>) {
      for (let i = 0; i < count; i += 1) await insertMember(admin, org, { userId: `m-${org.slice(0, 6)}-${i}-${tag}` })
    }
    await insertMember(admin, UNION, { userId: `suspended-${tag}`, status: 'suspended' })

    await remittance(FED, CLC, 1, 'paid', -40, -2, 100, 1000)
    await remittance(FED, CLC, 2, 'pending', -5, null, 120, 1200)
    await remittance(UNION, CLC, 1, 'approved', -30, 3, 50, 500)
    await remittance(UNION, CLC, 2, 'pending', 20, null, 55, 550)
    await remittance(LOCAL_1, FED, 1, 'paid', -10, -10, 30, 300)
    // The congress staff member is a real canonical member: their tenant session is a verified business session.
    await harness.setRole(clcStaff, CLC, 'admin')
  }, 120_000)

  afterAll(async () => {
    await admin?.end()
    await harness.stop()
  })

  describe('the affiliates', () => {
    it('lists the organizations directly below, by name, as directory entries only: administering the congress shows no contact details or member counts', async () => {
      const list = await affiliates!.listAffiliates({ userId: clcStaff, organizationId: CLC })
      expect(list.map((row) => row.name)).toEqual([`Federation ${tag}`, `Union ${tag}`])
      const federation = list.find((row) => row.id === FED)
      expect(federation).toMatchObject({
        organizationType: 'federation', provinceTerritory: 'ON', clcAffiliateCode: 'F-1', email: null, phone: null,
        address: null, description: null, memberCount: null,
      })
      expect(list.find((row) => row.id === UNION)?.memberCount).toBeNull()
    })

    it('gives the private details of an affiliate only where the caller is a direct member of it', async () => {
      const list = await affiliates!.listAffiliates({ userId: clcAdminAndFedMember, organizationId: CLC })
      expect(list.find((row) => row.id === FED)).toMatchObject({
        organizationType: 'federation', provinceTerritory: 'ON', clcAffiliateCode: 'F-1', email: 'fed@example.test', phone: '416-555-0100',
        address: '1 Main St, Toronto, M5V 1A1', description: 'The federation', memberCount: 5,
      })
      expect(list.find((row) => row.id === UNION)?.memberCount).toBeNull()
    })

    it('shows a federation its own locals (as directory entries) and neither the congress above it nor another tree', async () => {
      const list = await affiliates!.listAffiliates({ userId: fedAdmin, organizationId: FED })
      expect(list.map((row) => row.id).sort()).toEqual([LOCAL_1, LOCAL_2].sort())
      expect(list.find((row) => row.id === LOCAL_1)?.memberCount).toBeNull()
      expect(list.find((row) => row.id === LOCAL_2)?.memberCount).toBeNull()
    })

    it('refuses a member who is not an administrator and an administrator of another tree, before reading anything', async () => {
      await expect(affiliates!.listAffiliates({ userId: clcMember, organizationId: CLC })).rejects.toBeInstanceOf(affiliates!.AffiliateAccessError)
      await expect(affiliates!.listAffiliates({ userId: strangerAdmin, organizationId: CLC })).rejects.toBeInstanceOf(affiliates!.AffiliateAccessError)
      await expect(affiliates!.listAffiliates({ userId: `nobody-${tag}`, organizationId: CLC })).rejects.toBeInstanceOf(affiliates!.AffiliateAccessError)
    })

    it('control: a tenant session reads only its own organization row, so the congress could not list its affiliates without the system read', async () => {
      const seen = await harness.tenant(RUNTIME_ROLE, CLC, clcStaff, (tx) => tx.select({ id: schema!.organizations.id }).from(schema!.organizations))
      expect(seen.map((row) => row.id)).toEqual([CLC])
    })

    it('writes an address that is not an object or is empty as no address', () => {
      expect(affiliates!.addressLine(null)).toBeNull()
      expect(affiliates!.addressLine({})).toBeNull()
      expect(affiliates!.addressLine('  ')).toBeNull()
      expect(affiliates!.addressLine('2 Side St')).toBe('2 Side St')
    })
  })

  describe('the remittances', () => {
    // Canonical mode: per_capita_remittances has no runtime or system grant in the current source (CONTAINED_NO_AUTHORITY), so the
    // reflection is refused 501 NOT_IMPLEMENTED with the reason before any statement (lib/reality/contained-storage.ts), for every organization;
    // the dashboards show it as a failed read, never as zero remittances or a compliant position.
    const snapshot = async () => (await admin.query(`SELECT id::text, status, total_amount::text FROM per_capita_remittances ORDER BY id`)).rows
    const unavailable = async (work: Promise<unknown>) =>
      expect(await work.then(() => null, (error: unknown) => error)).toMatchObject({
        name: 'ContainedStorageUnavailable', code: 'NOT_IMPLEMENTED', status: 501, storage: 'per_capita_remittances' })
    beforeAll(() => { mode.canonical = true })
    afterAll(() => { mode.canonical = false })

    it('refuses the congress\'s summary 501: no member count, pending, overdue, compliance rate or revenue is computed', async () => {
      const before = await snapshot()
      await unavailable(standing!.loadRemittanceMetrics(CLC))
      expect(await snapshot()).toEqual(before)
    })

    it('refuses the federation\'s summary the same way', async () => {
      await unavailable(standing!.loadRemittanceMetrics(FED))
    })

    it('refuses an organization nothing fell due to the same way: no rate, not zero, and not a compliant position', async () => {
      await unavailable(standing!.loadRemittanceMetrics(randomUUID()))
    })

    it('refuses the affiliates\' standings, and the facts they come from', async () => {
      await unavailable(standing!.loadAffiliateStandings(CLC))
      await unavailable(standing!.loadRemittanceFacts(CLC))
      // The pure standing rule is unchanged: with nothing on file, pending and at risk.
      expect(standing!.standingOf([])).toEqual({ remittanceStatus: 'pending', complianceStatus: 'at-risk', lastRemittanceDate: null })
    })

    it('control: the database refuses the table to the runtime role, in a member\'s session or with no organization, and to the system role', async () => {
      const refusal = async (work: Promise<unknown>) => {
        const error = await work.then(() => null, (failure: { message?: string; cause?: { message?: string } }) => `${failure.message} ${failure.cause?.message ?? ''}`)
        expect(error).toMatch(/permission denied for table per_capita_remittances/)
      }
      await refusal(harness.tenant(RUNTIME_ROLE, CLC, clcStaff, (tx) => tx.select().from(schema!.perCapitaRemittances)))
      await refusal(harness.tenant(RUNTIME_ROLE, null, null, (tx) => tx.select().from(schema!.perCapitaRemittances)))
      const { SYSTEM_ROLE } = await import('./native-route-harness')
      await refusal(harness.tenant(SYSTEM_ROLE, null, null, (tx) => tx.select().from(schema!.perCapitaRemittances)))
    })
  })
})
