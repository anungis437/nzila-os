/**
 * The dashboard layout's reads and writes (lib/dashboard/layout-bootstrap.ts) on real PostgreSQL, as the real roles.
 *
 * The layout used to go through the module-level handle for the profile, the membership and the province, with no user and no organization
 * set. As the runtime role that hid every profile, refused every insert and sent each person to /sign-up; unit tests replace the database and CI
 * connects as a superuser, so nothing noticed. This runs the unmodified functions, with only the context boundary replaced by the harness's
 * (a tenant transaction for withRLSContext, a system transaction for withSystemContext), and proves that
 *   - a first visit creates the person's profile in their own user context, a second visit finds the same one, and nobody else sees it;
 *   - a membership is found by the person's id; a membership seeded under their e-mail is linked to them only when linking is switched on
 *     (never in production), only if it is active, not deleted and nobody has signed in as its user id, whatever the case of the e-mail, once,
 *     in its own organization, in the same transaction as its security audit event (a membership of another real person is never taken);
 *     with none, and auto-provisioning on, they become an active member of the default organization, in that organization's own context;
 *   - with auto-provisioning off nothing is written and the caller is told to send the person to the access-request flow;
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
  }, 120_000)

  afterAll(async () => {
    await admin?.end()
    await harness.stop()
  })

  describe('the profile', () => {
    it('creates the person\'s profile on the first visit and finds the same one on the next', async () => {
      const email = `person-${tag}@example.test`
      const created = await bootstrap!.loadOrCreateProfile({ userId: person, email })
      expect(created).toMatchObject({ userId: person, email })
      const again = await bootstrap!.loadOrCreateProfile({ userId: person, email })
      expect(again?.id).toBe(created?.id)
      expect((await admin.query('SELECT count(*)::int AS n FROM profiles WHERE user_id = $1', [person])).rows[0].n).toBe(1)
    })

    it('keeps a profile with no e-mail as a profile with no e-mail, and never relinks another person\'s profile by e-mail', async () => {
      const shared = `shared-${tag}@example.test`
      await admin.query('INSERT INTO profiles (user_id, email) VALUES ($1, $2)', [`old-oid-${tag}`, shared])
      const fresh = await bootstrap!.loadOrCreateProfile({ userId: other, email: shared })
      expect(fresh?.userId).toBe(other)
      expect((await admin.query('SELECT user_id FROM profiles WHERE user_id = $1', [`old-oid-${tag}`])).rowCount).toBe(1)
      expect((await bootstrap!.loadOrCreateProfile({ userId: `blank-${tag}`, email: '' }))?.email).toBeNull()
    })

    it('control: with no user set the runtime role sees no profile, and cannot create one', async () => {
      const seen = await harness.tenant(RUNTIME_ROLE, null, null, (tx) => tx.select().from(schema!.profiles))
      expect(seen).toEqual([])
      expect(await refusedBy(harness.tenant(RUNTIME_ROLE, null, null, (tx) => tx.insert(schema!.profiles).values({ userId: `nobody-${tag}` })))).toMatch(/row-level security/)
    })
  })

  describe('the membership', () => {
    const base = { defaultOrganizationId: '', name: 'Member Name', allowAutoProvisioning: true }

    it('finds a membership already linked to the person\'s id, without writing anything', async () => {
      const userId = `entra-${tag}-existing`
      await insertMember(admin, OTHER_ORG, { userId, role: 'steward' })
      const outcome = await bootstrap!.ensureOrganizationMembership({ ...base, defaultOrganizationId: DEFAULT_ORG, userId, email: `${userId}@example.test` })
      expect(outcome).toBe('existing')
      expect(await membersOf(userId)).toEqual([{ org: OTHER_ORG, role: 'steward', status: 'active', is_primary: false }])
    })

    describe('a membership seeded under the e-mail', () => {
      const linking = { ...base, defaultOrganizationId: '', linkSeededMemberships: true }
      const auditsOf = async (userId: string) =>
        (
          await admin.query(
            `SELECT action, user_id, organization_id::text AS org, resource_id::text AS resource, resource_type, metadata FROM audit_security.audit_logs WHERE user_id = $1 AND action = 'membership.link_by_email' ORDER BY created_at`,
            [userId],
          )
        ).rows
      const ownerOf = async (memberId: string) => (await admin.query('SELECT user_id FROM organization_members WHERE id = $1', [memberId])).rows[0].user_id as string

      it('is linked to the person when linking is switched on, and only theirs, once, with a security audit event written as the runtime role', async () => {
        const userId = `entra-${tag}-pilot`
        const email = `pilot-${tag}@example.test`
        const seeded = await insertMember(admin, OTHER_ORG, { userId: `placeholder-${tag}`, email, role: 'officer' })
        const unrelated = await insertMember(admin, OTHER_ORG, { userId: `placeholder-2-${tag}`, email: `someone-${tag}@example.test` })

        const outcome = await bootstrap!.ensureOrganizationMembership({ ...linking, defaultOrganizationId: DEFAULT_ORG, userId, email })

        expect(outcome).toBe('linked')
        expect(await membersOf(userId)).toEqual([{ org: OTHER_ORG, role: 'officer', status: 'active', is_primary: false }])
        expect(await ownerOf(seeded)).toBe(userId)
        expect(await ownerOf(unrelated)).toBe(`placeholder-2-${tag}`)
        expect(await auditsOf(userId)).toEqual([
          {
            action: 'membership.link_by_email',
            user_id: userId,
            org: OTHER_ORG,
            resource: seeded,
            resource_type: 'organization_members',
            metadata: { previousUserId: `placeholder-${tag}`, matchedOn: 'email', trigger: 'dashboard_layout_sign_in' },
          },
        ])
        // The second sign-in finds the membership by the person's id: no second link, no second audit event.
        expect(await bootstrap!.ensureOrganizationMembership({ ...linking, defaultOrganizationId: DEFAULT_ORG, userId, email })).toBe('existing')
        expect((await auditsOf(userId)).length).toBe(1)
      })

      it('matches the e-mail whatever its case on either side', async () => {
        const mixedSeed = await insertMember(admin, OTHER_ORG, { userId: `placeholder-mixed-${tag}`, email: `Mixed.Case-${tag}@Example.TEST` })
        const upperSeed = await insertMember(admin, QC_ORG, { userId: `placeholder-upper-${tag}`, email: `upper-${tag}@example.test` })

        const lowerSession = `entra-${tag}-lower`
        expect(await bootstrap!.ensureOrganizationMembership({ ...linking, defaultOrganizationId: DEFAULT_ORG, userId: lowerSession, email: `mixed.case-${tag}@example.test` })).toBe('linked')
        expect(await ownerOf(mixedSeed)).toBe(lowerSession)

        const upperSession = `entra-${tag}-upper`
        expect(await bootstrap!.ensureOrganizationMembership({ ...linking, defaultOrganizationId: DEFAULT_ORG, userId: upperSession, email: `  UPPER-${tag}@EXAMPLE.test ` })).toBe('linked')
        expect(await ownerOf(upperSeed)).toBe(upperSession)
      })

      it('is not linked unless linking is switched on: the person is provisioned and the seeded membership stays where it is', async () => {
        const userId = `entra-${tag}-off`
        const email = `off-${tag}@example.test`
        const seeded = await insertMember(admin, OTHER_ORG, { userId: `placeholder-off-${tag}`, email })

        expect(await bootstrap!.ensureOrganizationMembership({ ...base, defaultOrganizationId: DEFAULT_ORG, userId, email })).toBe('provisioned')

        expect(await ownerOf(seeded)).toBe(`placeholder-off-${tag}`)
        expect(await auditsOf(userId)).toEqual([])
      })

      it('is never linked in production, even when the caller asks for it', async () => {
        vi.stubEnv('NODE_ENV', 'production')
        const userId = `entra-${tag}-prod`
        const email = `prod-${tag}@example.test`
        const seeded = await insertMember(admin, OTHER_ORG, { userId: `placeholder-prod-${tag}`, email })

        const outcome = await bootstrap!.ensureOrganizationMembership({ ...linking, defaultOrganizationId: DEFAULT_ORG, userId, email, allowAutoProvisioning: false })

        vi.unstubAllEnvs()
        expect(outcome).toBe('none')
        expect(await ownerOf(seeded)).toBe(`placeholder-prod-${tag}`)
        expect(await auditsOf(userId)).toEqual([])
      })

      it('never takes the membership of another real person who has the same e-mail on another account', async () => {
        const owner = `entra-${tag}-owner`
        const intruder = `entra-${tag}-intruder`
        const email = `shared-account-${tag}@example.test`
        const membership = await insertMember(admin, OTHER_ORG, { userId: owner, email, role: 'admin' })
        // The owner has signed in as that user id: the layout created their profile.
        await bootstrap!.loadOrCreateProfile({ userId: owner, email })

        const outcome = await bootstrap!.ensureOrganizationMembership({ ...linking, defaultOrganizationId: DEFAULT_ORG, userId: intruder, email, allowAutoProvisioning: false })

        expect(outcome).toBe('none')
        expect(await ownerOf(membership)).toBe(owner)
        expect(await membersOf(intruder)).toEqual([])
        expect(await auditsOf(intruder)).toEqual([])
      })

      it('never revives a membership that is inactive or deleted', async () => {
        const email = `gone-${tag}@example.test`
        const inactive = await insertMember(admin, OTHER_ORG, { userId: `placeholder-inactive-${tag}`, email, status: 'inactive' })
        const deleted = await insertMember(admin, QC_ORG, { userId: `placeholder-deleted-${tag}`, email })
        await admin.query('UPDATE organization_members SET deleted_at = now() WHERE id = $1', [deleted])
        const userId = `entra-${tag}-gone`

        expect(await bootstrap!.ensureOrganizationMembership({ ...linking, defaultOrganizationId: DEFAULT_ORG, userId, email, allowAutoProvisioning: false })).toBe('none')

        expect(await ownerOf(inactive)).toBe(`placeholder-inactive-${tag}`)
        expect(await ownerOf(deleted)).toBe(`placeholder-deleted-${tag}`)
      })

      it('links the oldest of two seeds with one e-mail in an organization, and one in each organization, without colliding on the unique index', async () => {
        const email = `dup-${tag}@example.test`
        const userId = `entra-${tag}-dup`
        const oldest = await insertMember(admin, OTHER_ORG, { userId: `placeholder-dup-1-${tag}`, email })
        const newer = await insertMember(admin, OTHER_ORG, { userId: `placeholder-dup-2-${tag}`, email })
        const elsewhere = await insertMember(admin, QC_ORG, { userId: `placeholder-dup-3-${tag}`, email })
        await admin.query(`UPDATE organization_members SET created_at = now() - interval '2 days' WHERE id = $1`, [oldest])

        expect(await bootstrap!.ensureOrganizationMembership({ ...linking, defaultOrganizationId: DEFAULT_ORG, userId, email })).toBe('linked')

        expect(await ownerOf(oldest)).toBe(userId)
        expect(await ownerOf(newer)).toBe(`placeholder-dup-2-${tag}`)
        expect(await ownerOf(elsewhere)).toBe(userId)
        expect((await auditsOf(userId)).map((audit) => audit.org).sort()).toEqual([OTHER_ORG, QC_ORG].sort())
      })

      it('is not linked when its security audit event cannot be written: the link rolls back with it and the failure is raised', async () => {
        const userId = `entra-${tag}-noaudit`
        const email = `noaudit-${tag}@example.test`
        const seeded = await insertMember(admin, OTHER_ORG, { userId: `placeholder-noaudit-${tag}`, email })
        await admin.query(`REVOKE INSERT ON audit_security.audit_logs FROM ${RUNTIME_ROLE}`)
        try {
          const failure = await refusedBy(bootstrap!.ensureOrganizationMembership({ ...linking, defaultOrganizationId: DEFAULT_ORG, userId, email }))
          expect(failure).toMatch(/permission denied|Failed query/)
        } finally {
          await admin.query(`GRANT INSERT ON audit_security.audit_logs TO ${RUNTIME_ROLE}`)
        }

        expect(await ownerOf(seeded)).toBe(`placeholder-noaudit-${tag}`)
        expect(await membersOf(userId)).toEqual([])
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

    it('makes a person with none an active, primary member of the default organization, in that organization\'s context, once', async () => {
      const userId = `entra-${tag}-new`
      const email = `new-${tag}@example.test`
      const input = { ...base, defaultOrganizationId: DEFAULT_ORG, userId, email }
      expect(await bootstrap!.ensureOrganizationMembership(input)).toBe('provisioned')
      expect(await membersOf(userId)).toEqual([{ org: DEFAULT_ORG, role: 'member', status: 'active', is_primary: true }])
      expect(await bootstrap!.ensureOrganizationMembership(input)).toBe('existing')
      expect((await membersOf(userId)).length).toBe(1)
    })

    it('tolerates a concurrent request that made the same membership first', async () => {
      const userId = `entra-${tag}-race`
      const input = { ...base, defaultOrganizationId: DEFAULT_ORG, userId, email: `race-${tag}@example.test` }
      const outcomes = await Promise.all([bootstrap!.ensureOrganizationMembership(input), bootstrap!.ensureOrganizationMembership(input)])
      expect(outcomes.every((outcome) => outcome === 'provisioned' || outcome === 'existing')).toBe(true)
      expect((await membersOf(userId)).length).toBe(1)
    })

    it('writes nothing and says so when auto-provisioning is not permitted', async () => {
      const userId = `entra-${tag}-denied`
      const outcome = await bootstrap!.ensureOrganizationMembership({ ...base, defaultOrganizationId: DEFAULT_ORG, userId, email: `denied-${tag}@example.test`, allowAutoProvisioning: false })
      expect(outcome).toBe('none')
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
      const asOther = await harness.tenant(RUNTIME_ROLE, OTHER_ORG, null, (tx) => tx.select({ id: schema!.organizations.id }).from(schema!.organizations))
      expect(asOther.map((row) => row.id)).toEqual([OTHER_ORG])
      expect(await harness.tenant(RUNTIME_ROLE, null, null, (tx) => tx.select({ id: schema!.organizations.id }).from(schema!.organizations))).toEqual([])
    })
  })
})
