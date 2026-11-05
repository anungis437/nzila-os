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
vi.mock('@/lib/auth/canonical-bootstrap', () => ({ currentStateContextEnabled: () => false }))
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
    it('summarizes what is addressed to the congress: latest-period members, pending and overdue, a compliance rate, this year\'s revenue', async () => {
      expect(await standing!.loadRemittanceMetrics(CLC)).toEqual({
        totalMembers: 120 + 55,
        pendingRemittances: 2,
        overdueRemittances: 1,
        complianceRate: 33,
        totalRevenue: 1500,
      })
    })

    it('summarizes what is addressed to the federation, and none of the congress\'s', async () => {
      expect(await standing!.loadRemittanceMetrics(FED)).toEqual({ totalMembers: 30, pendingRemittances: 0, overdueRemittances: 0, complianceRate: 100, totalRevenue: 300 })
    })

    it('reports no compliance rate, not zero, for an organization nothing fell due to', async () => {
      expect(await standing!.loadRemittanceMetrics(randomUUID())).toEqual({ totalMembers: 0, pendingRemittances: 0, overdueRemittances: 0, complianceRate: null, totalRevenue: 0 })
    })

    it('gives each affiliate its own standing; one with nothing on file is pending and at risk', async () => {
      const standings = await standing!.loadAffiliateStandings(CLC)
      const submittedOn = (offset: number) => (v: string | null) => expect(String(v).slice(0, 10)).toBe(new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10))
      expect(standings.get(FED)).toMatchObject({ remittanceStatus: 'overdue', complianceStatus: 'non-compliant' })
      submittedOn(-42)(standings.get(FED)!.lastRemittanceDate)
      expect(standings.get(UNION)).toMatchObject({ remittanceStatus: 'pending', complianceStatus: 'at-risk' })
      expect(standings.has(LOCAL_1)).toBe(false)
      expect(standing!.standingOf([])).toEqual({ remittanceStatus: 'pending', complianceStatus: 'at-risk', lastRemittanceDate: null })
    })

    it('control: with no organization set the runtime role sees no remittance at all', async () => {
      expect(await harness.tenant(RUNTIME_ROLE, null, null, (tx) => tx.select().from(schema!.perCapitaRemittances))).toEqual([])
    })
  })
})
