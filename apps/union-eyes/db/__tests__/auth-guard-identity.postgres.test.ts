/**
 * The identity and role lookups of lib/api-auth-guard.ts and lib/organization-utils.ts on real PostgreSQL, as the real roles (UE-CONV-H-019).
 *
 * Who a caller is, which organization they act in and what role they hold are decided BEFORE any organization context exists, so those lookups read
 * the membership tables on the ambient handle. On the runtime role, outside a tenant transaction, row-level security shows those tables as empty:
 * every role came back as 'member', every organization looked unknown, and the platform administrator check failed. The unit tests replace the database
 * and the HTTP runtime connects as a superuser, so nothing noticed. This runs the unmodified functions against the combined Django + Drizzle schema with only the
 * session boundary (who is signed in, the cookie) replaced, and proves that
 *   - the person's role in an organization, their access to it and the organization's type and name are read, by their own id, as the system role;
 *   - a person who is not a member, or whose membership is suspended or removed, is not given the organization's role;
 *   - the claimed organization of a session is validated (an id that is not a uuid names nothing, an unknown organization is cleared, and the cookie's
 *     organization is honoured only for a member or a platform administrator);
 *   - the same reads on a handle with no organization see nothing, which is why they run as the system role;
 *   - a database failure is a failure, not an anonymous caller.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const URL = process.env.UE_AUTHORITY_COMBINED_URL

const session = vi.hoisted(() => ({
  userId: null as string | null,
  orgId: null as string | null,
  cookies: {} as Record<string, string>,
  email: 'person@example.org',
}))

vi.mock('@/db/db', async () => ({ db: (await import('./native-route-harness')).ambientDb }))
vi.mock('@/db', async () => ({ db: (await import('./native-route-harness')).ambientDb }))
vi.mock('@/lib/db/with-rls-context', async () => (await import('./native-route-harness')).rlsContextModule)
vi.mock('@nzila/platform-auth/entra/server', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  auth: async () => ({ userId: session.userId, orgId: session.orgId, sessionClaims: {} }),
  currentUser: async () =>
    session.userId
      ? { id: session.userId, publicMetadata: {}, privateMetadata: {}, emailAddresses: [{ emailAddress: session.email }], fullName: 'Pat Person', firstName: 'Pat', lastName: 'Person', imageUrl: null }
      : null,
}))
vi.mock('next/headers', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  cookies: async () => ({ get: (name: string) => (session.cookies[name] ? { value: session.cookies[name] } : undefined) }),
}))
vi.mock('@/lib/auth/auth-service', () => ({ getAuthUser: async () => null }))

const { harness, RUNTIME_ROLE } = await import('./native-route-harness')
const guard = URL ? await import('@/lib/api-auth-guard') : null
const orgUtils = URL ? await import('@/lib/organization-utils') : null

describe.skipIf(!URL)('the identity and role lookups on the combined schema, as the real roles', () => {
  const tag = randomUUID().slice(0, 8)
  const ORG = randomUUID()
  const OTHER_ORG = randomUUID()
  const steward = `steward-${tag}`
  const suspended = `suspended-${tag}`
  const removed = `removed-${tag}`
  const stranger = `stranger-${tag}`
  const sysadmin = `sysadmin-${tag}`
  const authOnly = `authonly-${tag}`
  let admin: pg.Client

  const newOrganization = (id: string, name: string, type: string) =>
    admin.query(
      `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
       VALUES ($1,$2,$3,$4,'{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
      [id, name, `${name.toLowerCase().replace(/\W+/g, '-')}-${id}`, type],
    )
  const newMember = (userId: string, organizationId: string, role: string, status = 'active', deleted = false) =>
    admin.query(
      `INSERT INTO organization_members (user_id, organization_id, role, status, is_primary, name, email, joined_at, deleted_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,false,$1,$1 || '@example.test',now(), ${deleted ? 'now()' : 'NULL'}, now(), now())`,
      [userId, organizationId, role, status],
    )
  const signedInAs = (userId: string | null, orgId: string | null = null, cookies: Record<string, string> = {}) => {
    session.userId = userId
    session.orgId = orgId
    session.cookies = cookies
  }

  beforeAll(async () => {
    admin = await harness.start(URL!)
    await newOrganization(ORG, `Identity Local ${tag}`, 'local')
    await newOrganization(OTHER_ORG, `Identity Other ${tag}`, 'federation')
    await newMember(steward, ORG, 'steward')
    await newMember(suspended, ORG, 'steward', 'suspended')
    await newMember(removed, ORG, 'steward', 'active', true)
    await admin.query(
      `INSERT INTO user_management.users (user_id, email, is_system_admin, created_at, updated_at) VALUES ($1, $2, true, now(), now()), ($3, $4, false, now(), now())`,
      [sysadmin, `${sysadmin}@example.org`, stranger, `${stranger}@example.org`],
    )
    await admin.query(`INSERT INTO user_management.organization_users (organization_id, user_id, role, is_active) VALUES ($1, $2, 'officer', true)`, [ORG, authOnly])
  }, 60_000)

  afterAll(async () => {
    signedInAs(null)
    await admin?.end()
    await harness.stop()
  })

  describe('the role and the access a person holds in an organization', () => {
    it('reads a member\'s role, and finds no role for a stranger, a suspended member or a removed one', async () => {
      expect(await guard!.getUserRole(steward, ORG)).toBe('steward')
      expect(await guard!.getUserRole(stranger, ORG)).toBeNull()
      expect(await guard!.getUserRole(suspended, ORG)).toBeNull()
      expect(await guard!.getUserRole(removed, ORG)).toBeNull()
      expect(await guard!.getUserRole(steward, OTHER_ORG)).toBeNull()
    })

    it('answers whether a person holds at least a role in an organization', async () => {
      expect(await guard!.hasRoleInOrganization(ORG, 'member', steward)).toBe(true)
      expect(await guard!.hasRoleInOrganization(ORG, 'steward', steward)).toBe(true)
      expect(await guard!.hasRoleInOrganization(ORG, 'admin', steward)).toBe(false)
      expect(await guard!.hasRoleInOrganization(ORG, 'member', stranger)).toBe(false)
      expect(await guard!.hasRoleInOrganization(ORG, 'member', suspended)).toBe(false)
    })

    it('knows the organization\'s type, name and whether a person may enter it', async () => {
      expect(await guard!.getOrgType(ORG)).toBe('local')
      expect(await guard!.getOrgType(OTHER_ORG)).toBe('federation')
      expect(await guard!.getOrgType(randomUUID())).toBeNull()
      expect(await orgUtils!.getOrganizationInfo(ORG)).toMatchObject({ id: ORG, type: 'local', name: `Identity Local ${tag}` })
      expect(await orgUtils!.validateOrganizationExists(ORG)).toBe(true)
      expect(await orgUtils!.validateOrganizationExists(randomUUID())).toBe(false)
      expect(await orgUtils!.userHasOrganizationAccess(steward, ORG)).toBe(true)
      expect(await orgUtils!.userHasOrganizationAccess(stranger, ORG)).toBe(false)
      expect(await orgUtils!.userHasOrganizationAccess(removed, ORG)).toBe(false)
      expect(await orgUtils!.getUserRoleInOrganization(steward, ORG)).toBe('steward')
      expect(await orgUtils!.getUserRoleInOrganization(stranger, ORG)).toBeNull()
    })

    it('recognizes a platform system administrator and nobody else', async () => {
      expect(await guard!.isSystemAdmin(sysadmin)).toBe(true)
      expect(await guard!.isSystemAdmin(stranger)).toBe(false)
      expect(await guard!.isSystemAdmin(`nobody-${tag}`)).toBe(false)
    })

    it('is why these lookups run as the system role: a handle with no organization sees none of it', async () => {
      const { organizationMembers, organizations } = await import('@/db/schema')
      const members = await harness.tenant(RUNTIME_ROLE, null, steward, (tx) => tx.select().from(organizationMembers))
      const orgs = await harness.tenant(RUNTIME_ROLE, null, steward, (tx) => tx.select().from(organizations))
      expect(members).toEqual([])
      expect(orgs).toEqual([])
    })
  })

  describe('who the session says the caller is', () => {
    it('resolves the signed-in person, the organization their session names and the role their membership gives them', async () => {
      signedInAs(steward, ORG)
      const user = await guard!.getCurrentUser()
      expect(user).toMatchObject({ id: steward, organizationId: ORG, role: 'steward' })
    })

    it('clears an organization that is not a uuid or does not exist, and falls back to the person\'s own membership', async () => {
      for (const claimed of ['org_not_a_uuid', randomUUID()]) {
        signedInAs(steward, claimed)
        const user = await guard!.getCurrentUser()
        expect(user?.organizationId).toBe(ORG)
        expect(user?.role).toBe('steward')
      }
    })

    it('honours the organization picker cookie for a member, and not for someone who does not belong to that organization', async () => {
      signedInAs(steward, null, { selected_organization_id: ORG })
      expect((await guard!.getCurrentUser())?.organizationId).toBe(ORG)

      // A stranger with a cookie naming an organization they are not in does not get it: they keep what their own memberships give them (nothing).
      signedInAs(stranger, null, { selected_organization_id: ORG })
      expect((await guard!.getCurrentUser())?.organizationId).not.toBe(ORG)

      signedInAs(steward, null, { selected_organization_id: 'not-a-uuid' })
      expect((await guard!.getCurrentUser())?.organizationId).toBe(ORG)

      // A stale cookie from another identity provider names no organization; it must not fail the resolution for the person who carries it.
      signedInAs(steward, null, { selected_org_id: 'org_stale_value' })
      expect(await orgUtils!.getOrganizationIdForUser(steward)).toBe(ORG)
    })

    it('does not give a suspended or removed member the organization\'s role', async () => {
      signedInAs(suspended, ORG)
      expect((await guard!.getCurrentUser())?.role).toBe('member')
      signedInAs(removed, ORG)
      expect((await guard!.getCurrentUser())?.role).toBe('member')
    })

    it('finds the person\'s membership, and their organization, for the unified user context', async () => {
      signedInAs(steward)
      expect(await guard!.getUserContext()).toMatchObject({ userId: steward, organizationId: ORG, roles: ['steward'] })
      signedInAs(null)
      expect(await guard!.getUserContext()).toBeNull()
    })

    it('reads a role granted through the platform\'s own organization-user records', async () => {
      expect(await guard!.getUserContextForOrganization(ORG, authOnly)).toMatchObject({ userId: authOnly, organizationId: ORG, roles: ['officer'] })
    })
  })
})
