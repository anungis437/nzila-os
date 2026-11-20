/**
 * The dashboard layout's reads and writes (lib/dashboard/layout-bootstrap.ts) on real PostgreSQL, as the real roles.
 *
 * The layout used to go through the module-level handle for the profile, the membership and the province, with no user and no organization
 * set. As the runtime role that hid every profile, refused every insert and sent each person to /sign-up; unit tests replace the database and CI
 * connects as a superuser, so nothing noticed. This runs the unmodified functions, with only the context boundary replaced by the harness's
 * (a tenant transaction for withRLSContext, a system transaction for withSystemContext), and proves that
 *   - in canonical mode (every native clone) the canonical membership is live authority: the legacy profile and membership bootstrap is
 *     refused before any statement for every legacy scenario (first visit, relink by e-mail, seeded memberships with linking on or off, in
 *     production, another person's membership, inactive or deleted seeds, duplicates, a failed audit, auto-provisioning, concurrent requests),
 *     and nothing is written: no profile, no membership, no relinked seed, no audit event;
 *   - the province is read for the organization and for no other;
 *   - the old statements (a membership read with no organization, an insert with no organization) are refused or empty.
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

const { harness, RUNTIME_ROLE, SYSTEM_ROLE } = await import('./native-route-harness')
const bootstrap = URL ? await import('@/lib/dashboard/layout-bootstrap') : null
const schema = URL ? await import('@/db/schema') : null

describe.skipIf(!URL)('the dashboard layout bootstrap on the combined schema, as the real roles', () => {
  const tag = `lb${randomUUID().slice(0, 8)}`
  const DEFAULT_ORG = randomUUID()
  const QC_ORG = randomUUID()
  const OTHER_ORG = randomUUID()
  const person = `entra-${tag}-person`
  const other = `entra-${tag}-other`
  let admin: pg.Client

  /** drizzle wraps the driver's error in a "Failed query" error; the driver's message is its cause. */
  const refusedBy = async (work: Promise<unknown>) => {
    const error = await work.then(() => null, (failure: unknown) => failure as { message?: string; cause?: { message?: string } })
    return `${error?.message ?? ''} ${error?.cause?.message ?? ''}`
  }
  const membersOf = async (userId: string) =>
    (await admin.query(`SELECT organization_id::text AS org, role, status, is_primary FROM organization_members WHERE user_id = $1`, [userId])).rows

  beforeAll(async () => {
    admin = await harness.start(URL!)
    await insertOrganization(admin, tag, { id: DEFAULT_ORG })
    await insertOrganization(admin, tag, { id: QC_ORG, province: 'QC' })
    await insertOrganization(admin, tag, { id: OTHER_ORG })
    // The member who opens the dashboard of each organization whose province is read: a real canonical member with a real session.
    await harness.declareCaller(`province-reader-qc-${tag}`, QC_ORG, 'member')
    await harness.declareCaller(`province-reader-other-${tag}`, OTHER_ORG, 'member')
  }, 120_000)

  afterAll(async () => {
    await admin?.end()
    await harness.stop()
  })

  // Canonical mode (every native clone): the canonical membership is live authority, the dashboard layout never calls the legacy profile and
  // membership bootstrap, and lib/dashboard/layout-bootstrap.ts refuses it before any statement. Each legacy scenario below is the proof that
  // the canonical path refuses it and writes nothing: no profile, no membership, no relinked seed, no audit event.
  const refusedLegacy = async (work: Promise<unknown>) =>
    expect(await work.then(() => null, (error: { code?: string }) => error?.code)).toBe('LEGACY_DASHBOARD_BOOTSTRAP_REFUSED')
  const profilesOf = async (userId: string) => Number((await admin.query('SELECT count(*)::int AS n FROM profiles WHERE user_id = $1', [userId])).rows[0].n)
  const linkAudits = async (userId: string) => Number((await admin.query(
    `SELECT count(*)::int AS n FROM public.audit_logs WHERE user_id = $1 AND action = 'membership.link_by_email'`, [userId])).rows[0].n)

  describe('the profile', () => {
    it('refuses to create the person\'s profile on a first visit, and on the next: nothing is written', async () => {
      const email = `person-${tag}@example.test`
      await refusedLegacy(bootstrap!.loadOrCreateProfile({ userId: person, email }))
      await refusedLegacy(bootstrap!.loadOrCreateProfile({ userId: person, email }))
      expect(await profilesOf(person)).toBe(0)
    })

    it('never relinks another person\'s profile by e-mail, and creates no profile with or without an e-mail', async () => {
      const shared = `shared-${tag}@example.test`
      await admin.query('INSERT INTO profiles (user_id, email) VALUES ($1, $2)', [`old-oid-${tag}`, shared])
      await refusedLegacy(bootstrap!.loadOrCreateProfile({ userId: other, email: shared }))
      expect((await admin.query('SELECT user_id FROM profiles WHERE email = $1', [shared])).rows).toEqual([{ user_id: `old-oid-${tag}` }])
      await refusedLegacy(bootstrap!.loadOrCreateProfile({ userId: `blank-${tag}`, email: '' }))
      expect(await profilesOf(other)).toBe(0)
      expect(await profilesOf(`blank-${tag}`)).toBe(0)
    })

    it('control: with no user set the runtime role sees no profile, and cannot create one', async () => {
      const seen = await harness.tenant(RUNTIME_ROLE, null, null, (tx) => tx.select().from(schema!.profiles))
      expect(seen).toEqual([])
      expect(await refusedBy(harness.tenant(RUNTIME_ROLE, null, null, (tx) => tx.insert(schema!.profiles).values({ userId: `nobody-${tag}` })))).toMatch(/row-level security/)
    })
  })

  describe('the membership', () => {
    const base = { defaultOrganizationId: '', name: 'Member Name', allowAutoProvisioning: true }

    it('refuses even for a membership already linked to the person\'s id, and writes nothing', async () => {
      const userId = `entra-${tag}-existing`
      await insertMember(admin, OTHER_ORG, { userId, role: 'steward' })
      await refusedLegacy(bootstrap!.ensureOrganizationMembership({ ...base, defaultOrganizationId: DEFAULT_ORG, userId, email: `${userId}@example.test` }))
      expect(await membersOf(userId)).toEqual([{ org: OTHER_ORG, role: 'steward', status: 'active', is_primary: false }])
    })

    describe('a membership seeded under the e-mail', () => {
      const linking = { ...base, defaultOrganizationId: '', linkSeededMemberships: true }
      const ownerOf = async (memberId: string) => (await admin.query('SELECT user_id FROM organization_members WHERE id = $1', [memberId])).rows[0].user_id as string

      it('is never linked to the person, even with linking switched on: refused, the seed keeps its owner, no audit event', async () => {
        const userId = `entra-${tag}-pilot`
        const email = `pilot-${tag}@example.test`
        const seeded = await insertMember(admin, OTHER_ORG, { userId: `placeholder-${tag}`, email, role: 'officer' })
        await refusedLegacy(bootstrap!.ensureOrganizationMembership({ ...linking, defaultOrganizationId: DEFAULT_ORG, userId, email }))
        expect(await ownerOf(seeded)).toBe(`placeholder-${tag}`)
        expect(await membersOf(userId)).toEqual([])
        expect(await linkAudits(userId)).toBe(0)
      })

      it('is never linked whatever the case of the e-mail on either side', async () => {
        const mixedSeed = await insertMember(admin, OTHER_ORG, { userId: `placeholder-mixed-${tag}`, email: `Mixed.Case-${tag}@Example.TEST` })
        const upperSeed = await insertMember(admin, QC_ORG, { userId: `placeholder-upper-${tag}`, email: `upper-${tag}@example.test` })
        await refusedLegacy(bootstrap!.ensureOrganizationMembership({ ...linking, defaultOrganizationId: DEFAULT_ORG, userId: `entra-${tag}-lower`, email: `mixed.case-${tag}@example.test` }))
        await refusedLegacy(bootstrap!.ensureOrganizationMembership({ ...linking, defaultOrganizationId: DEFAULT_ORG, userId: `entra-${tag}-upper`, email: `  UPPER-${tag}@EXAMPLE.test ` }))
        expect(await ownerOf(mixedSeed)).toBe(`placeholder-mixed-${tag}`)
        expect(await ownerOf(upperSeed)).toBe(`placeholder-upper-${tag}`)
      })

      it('is not linked and nobody is provisioned when linking is off: refused, nothing written', async () => {
        const userId = `entra-${tag}-off`
        const email = `off-${tag}@example.test`
        const seeded = await insertMember(admin, OTHER_ORG, { userId: `placeholder-off-${tag}`, email })
        await refusedLegacy(bootstrap!.ensureOrganizationMembership({ ...base, defaultOrganizationId: DEFAULT_ORG, userId, email }))
        expect(await ownerOf(seeded)).toBe(`placeholder-off-${tag}`)
        expect(await membersOf(userId)).toEqual([])
        expect(await linkAudits(userId)).toBe(0)
      })

      it('is never linked in production, even when the caller asks for it', async () => {
        vi.stubEnv('NODE_ENV', 'production')
        const userId = `entra-${tag}-prod`
        const email = `prod-${tag}@example.test`
        const seeded = await insertMember(admin, OTHER_ORG, { userId: `placeholder-prod-${tag}`, email })
        try {
          await refusedLegacy(bootstrap!.ensureOrganizationMembership({ ...linking, defaultOrganizationId: DEFAULT_ORG, userId, email, allowAutoProvisioning: false }))
        } finally {
          vi.unstubAllEnvs()
        }
        expect(await ownerOf(seeded)).toBe(`placeholder-prod-${tag}`)
        expect(await linkAudits(userId)).toBe(0)
      })

      it('never takes the membership of another real person who has the same e-mail on another account', async () => {
        const owner = `entra-${tag}-owner`
        const intruder = `entra-${tag}-intruder`
        const email = `shared-account-${tag}@example.test`
        const membership = await insertMember(admin, OTHER_ORG, { userId: owner, email, role: 'admin' })
        await refusedLegacy(bootstrap!.ensureOrganizationMembership({ ...linking, defaultOrganizationId: DEFAULT_ORG, userId: intruder, email, allowAutoProvisioning: false }))
        expect(await ownerOf(membership)).toBe(owner)
        expect(await membersOf(intruder)).toEqual([])
        expect(await linkAudits(intruder)).toBe(0)
      })

      it('never revives a membership that is inactive or deleted', async () => {
        const email = `gone-${tag}@example.test`
        const inactive = await insertMember(admin, OTHER_ORG, { userId: `placeholder-inactive-${tag}`, email, status: 'inactive' })
        const deleted = await insertMember(admin, QC_ORG, { userId: `placeholder-deleted-${tag}`, email })
        await admin.query('UPDATE organization_members SET deleted_at = now() WHERE id = $1', [deleted])
        await refusedLegacy(bootstrap!.ensureOrganizationMembership({ ...linking, defaultOrganizationId: DEFAULT_ORG, userId: `entra-${tag}-gone`, email, allowAutoProvisioning: false }))
        expect(await ownerOf(inactive)).toBe(`placeholder-inactive-${tag}`)
        expect(await ownerOf(deleted)).toBe(`placeholder-deleted-${tag}`)
      })

      it('links none of two seeds with one e-mail in an organization, nor one in another organization', async () => {
        const email = `dup-${tag}@example.test`
        const userId = `entra-${tag}-dup`
        const oldest = await insertMember(admin, OTHER_ORG, { userId: `placeholder-dup-1-${tag}`, email })
        const newer = await insertMember(admin, OTHER_ORG, { userId: `placeholder-dup-2-${tag}`, email })
        const elsewhere = await insertMember(admin, QC_ORG, { userId: `placeholder-dup-3-${tag}`, email })
        await refusedLegacy(bootstrap!.ensureOrganizationMembership({ ...linking, defaultOrganizationId: DEFAULT_ORG, userId, email }))
        expect([await ownerOf(oldest), await ownerOf(newer), await ownerOf(elsewhere)]).toEqual([`placeholder-dup-1-${tag}`, `placeholder-dup-2-${tag}`, `placeholder-dup-3-${tag}`])
        expect(await linkAudits(userId)).toBe(0)
      })

      it('is not linked when no audit event could be written either: the refusal comes before any write', async () => {
        const userId = `entra-${tag}-noaudit`
        const email = `noaudit-${tag}@example.test`
        const seeded = await insertMember(admin, OTHER_ORG, { userId: `placeholder-noaudit-${tag}`, email })
        await refusedLegacy(bootstrap!.ensureOrganizationMembership({ ...linking, defaultOrganizationId: DEFAULT_ORG, userId, email }))
        expect(await ownerOf(seeded)).toBe(`placeholder-noaudit-${tag}`)
        expect(await membersOf(userId)).toEqual([])
        expect(await linkAudits(userId)).toBe(0)
      })

      it('is found as the system role across organizations, while the runtime role with no organization set sees none of them', async () => {
        const email = `lookup-${tag}@example.test`
        await insertMember(admin, OTHER_ORG, { userId: `placeholder-lookup-${tag}`, email })

        const asRuntime = await harness.tenant(RUNTIME_ROLE, null, null, (tx) => tx.select().from(schema!.organizationMembers))
        const asSystem = await harness.tenant(SYSTEM_ROLE, null, null, (tx) => tx.select().from(schema!.organizationMembers))

        expect(asRuntime).toEqual([])
        expect(asSystem.some((row) => row.email === email)).toBe(true)
      })
    })

    it('never makes a person with none a member of the default organization from a sign-in: refused, nothing written', async () => {
      const userId = `entra-${tag}-new`
      const input = { ...base, defaultOrganizationId: DEFAULT_ORG, userId, email: `new-${tag}@example.test` }
      await refusedLegacy(bootstrap!.ensureOrganizationMembership(input))
      await refusedLegacy(bootstrap!.ensureOrganizationMembership(input))
      expect(await membersOf(userId)).toEqual([])
    })

    it('refuses concurrent requests alike, and writes nothing', async () => {
      const userId = `entra-${tag}-race`
      const input = { ...base, defaultOrganizationId: DEFAULT_ORG, userId, email: `race-${tag}@example.test` }
      const outcomes = await Promise.all([bootstrap!.ensureOrganizationMembership(input), bootstrap!.ensureOrganizationMembership(input)]
        .map((work) => work.then(() => null, (error: { code?: string }) => error?.code)))
      expect(outcomes).toEqual(['LEGACY_DASHBOARD_BOOTSTRAP_REFUSED', 'LEGACY_DASHBOARD_BOOTSTRAP_REFUSED'])
      expect(await membersOf(userId)).toEqual([])
    })

    it('writes nothing when auto-provisioning is not permitted either', async () => {
      const userId = `entra-${tag}-denied`
      await refusedLegacy(bootstrap!.ensureOrganizationMembership({ ...base, defaultOrganizationId: DEFAULT_ORG, userId, email: `denied-${tag}@example.test`, allowAutoProvisioning: false }))
      expect(await membersOf(userId)).toEqual([])
    })

    it('control: with no organization set the runtime role sees no membership and cannot insert one, which is why the lookup is a system read and the insert has its context', async () => {
      const seen = await harness.tenant(RUNTIME_ROLE, null, null, (tx) => tx.select().from(schema!.organizationMembers))
      expect(seen).toEqual([])
      expect(
        await refusedBy(
          harness.tenant(RUNTIME_ROLE, null, `entra-${tag}-control`, (tx) =>
            tx.insert(schema!.organizationMembers).values({ userId: `entra-${tag}-control`, organizationId: DEFAULT_ORG, name: 'n', email: 'e@example.test' }),
          ),
        ),
      ).toMatch(/row-level security/)
    })
  })

  describe('the province', () => {
    it('reads the organization\'s province, and nothing for an organization that has none or does not exist', async () => {
      expect(await bootstrap!.readOrganizationProvince(QC_ORG)).toBe('QC')
      expect(await bootstrap!.readOrganizationProvince(OTHER_ORG)).toBeNull()
      expect(await bootstrap!.readOrganizationProvince(randomUUID())).toBeNull()
    })

    it('control: another organization\'s context cannot read it, and no organization at all reads nothing', async () => {
      const asOther = await harness.tenant(RUNTIME_ROLE, OTHER_ORG, `province-reader-other-${tag}`, (tx) => tx.select({ id: schema!.organizations.id }).from(schema!.organizations))
      expect(asOther.map((row) => row.id)).toEqual([OTHER_ORG])
      expect(await harness.tenant(RUNTIME_ROLE, null, null, (tx) => tx.select({ id: schema!.organizations.id }).from(schema!.organizations))).toEqual([])
    })
  })
})
