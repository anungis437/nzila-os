/**
 * The identity and role lookups of lib/api-auth-guard.ts and lib/organization-utils.ts on real PostgreSQL, as the real roles (UE-CONV-H-019).
 *
 * Every native clone runs in canonical mode, where who a caller is, which organization they act in and what role they hold are the canonical
 * membership read through a live session: the binder establishes one canonical request (lib/auth/canonical-context.ts
 * withCanonicalApiContext) and every lookup answers from it. The legacy chain (an Entra claim, the picker cookie, organization_members read
 * as the system role) is not the canonical path, so this proves the canonical one with only the session boundary replaced:
 *   - a member's request answers their role, their access and their organization; a role in another organization is refused, not guessed;
 *   - a stranger, a suspended member and a removed member get no request at all (MEMBERSHIP_REQUIRED), so no role, and a lookup outside a
 *     request is refused rather than answered from a claim or a cookie;
 *   - a claimed organization or a picker cookie never changes the organization the canonical session is bound to;
 *   - a platform system administrator is recognized from the canonical user record, a member is not;
 *   - the organization facts (type, name, existence) are read as the system role, and a handle with no organization sees none of them.
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
      `INSERT INTO organization_members (exempt_from_per_capita, user_id, organization_id, role, status, is_primary, name, email, joined_at, deleted_at, created_at, updated_at)
       VALUES (false, $1,$2,$3,$4,false,$1,$1 || '@example.test',now(), ${deleted ? 'now()' : 'NULL'}, now(), now())`,
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
    // The canonical memberships: the steward's, a suspended person's and a removed membership; the administrator's, and a membership that
    // exists only in the platform's own organization-user records. The stranger has a user and no membership.
    await harness.setRole(steward, ORG, 'steward')
    await harness.setRole(suspended, ORG, 'steward')
    await harness.setRole(removed, ORG, 'steward')
    await harness.setRole(sysadmin, ORG, 'member')
    await harness.setRole(authOnly, ORG, 'officer')
    await admin.query(`UPDATE user_management.users SET lifecycle_state = 'suspended' WHERE user_id = $1`, [suspended])
    await admin.query(`UPDATE user_management.organization_users SET is_active = false WHERE user_id = $1 AND organization_id = $2`, [removed, ORG])
  }, 60_000)

  /** A request of a live member, as production establishes it; anyone else is refused before any scope exists. */
  const asRequest = <T,>(userId: string, work: () => Promise<T>, organizationId = ORG) => harness.asCanonicalRequest(userId, organizationId, work)
  const refusedCode = async (work: Promise<unknown>) => work.then(() => 'answered', (error: { code?: string }) => error?.code ?? 'refused')

  afterAll(async () => {
    signedInAs(null)
    await admin?.end()
    await harness.stop()
  })

  describe('the role and the access a person holds in an organization', () => {
    it('reads a member\'s role in their own request, and gives a stranger, a suspended member or a removed one no request and so no role', async () => {
      expect(await asRequest(steward, () => guard!.getUserRole(steward, ORG))).toBe('steward')
      // A role in another organization is refused inside the steward\'s request: the binding names one organization only.
      expect(await asRequest(steward, () => refusedCode(guard!.getUserRole(steward, OTHER_ORG)))).toBe('MEMBERSHIP_REQUIRED')
      for (const person of [stranger, suspended, removed])
        expect(await refusedCode(asRequest(person, () => guard!.getUserRole(person, ORG))), person).toBe('MEMBERSHIP_REQUIRED')
      // Outside a request there is no canonical actor to answer for: the lookup is refused, never answered from a claim.
      signedInAs(steward, ORG)
      expect(await refusedCode(guard!.getUserRole(steward, ORG))).not.toBe('answered')
    })

    it('answers whether a person holds at least a role in an organization', async () => {
      await asRequest(steward, async () => {
        expect(await guard!.hasRoleInOrganization(ORG, 'member', steward)).toBe(true)
        expect(await guard!.hasRoleInOrganization(ORG, 'steward', steward)).toBe(true)
        expect(await guard!.hasRoleInOrganization(ORG, 'admin', steward)).toBe(false)
        // Another person named inside the steward\'s request is never answered with the steward\'s role.
        expect(await guard!.hasRoleInOrganization(ORG, 'member', stranger)).toBe(false)
        expect(await guard!.hasRoleInOrganization(ORG, 'member', suspended)).toBe(false)
      })
    })

    it('knows the organization\'s type, name and whether a person may enter it', async () => {
      expect(await guard!.getOrgType(ORG)).toBe('local')
      expect(await guard!.getOrgType(OTHER_ORG)).toBe('federation')
      expect(await guard!.getOrgType(randomUUID())).toBeNull()
      expect(await orgUtils!.getOrganizationInfo(ORG)).toMatchObject({ id: ORG, type: 'local', name: `Identity Local ${tag}` })
      expect(await orgUtils!.validateOrganizationExists(ORG)).toBe(true)
      expect(await orgUtils!.validateOrganizationExists(randomUUID())).toBe(false)
      await asRequest(steward, async () => {
        expect(await orgUtils!.userHasOrganizationAccess(steward, ORG)).toBe(true)
        expect(await orgUtils!.userHasOrganizationAccess(stranger, ORG)).toBe(false)
        expect(await orgUtils!.userHasOrganizationAccess(removed, ORG)).toBe(false)
        expect(await orgUtils!.getUserRoleInOrganization(steward, ORG)).toBe('steward')
        expect(await orgUtils!.getUserRoleInOrganization(stranger, ORG)).toBeNull()
      })
    })

    it('recognizes a platform system administrator from the canonical user record, and nobody else', async () => {
      expect(await asRequest(sysadmin, () => guard!.isSystemAdmin(sysadmin))).toBe(true)
      expect(await asRequest(steward, () => guard!.isSystemAdmin(steward))).toBe(false)
      expect(await refusedCode(asRequest(stranger, () => guard!.isSystemAdmin(stranger)))).toBe('MEMBERSHIP_REQUIRED')
      expect(await refusedCode(asRequest(`nobody-${tag}`, () => guard!.isSystemAdmin(`nobody-${tag}`)))).toBe('MEMBERSHIP_REQUIRED')
    })

    it('is why the organization facts are read as the system role: a handle with no organization sees none of it', async () => {
      const { organizationMembers, organizations } = await import('@/db/schema')
      const members = await harness.tenant(RUNTIME_ROLE, null, steward, (tx) => tx.select().from(organizationMembers))
      const orgs = await harness.tenant(RUNTIME_ROLE, null, steward, (tx) => tx.select().from(organizations))
      expect(members).toEqual([])
      expect(orgs).toEqual([])
    })
  })

  describe('who the session says the caller is', () => {
    it('resolves the signed-in person, the organization their session is bound to and the role their membership gives them', async () => {
      signedInAs(steward, ORG)
      expect(await asRequest(steward, () => guard!.getCurrentUser())).toMatchObject({ id: steward, organizationId: ORG, role: 'steward' })
    })

    it('ignores an organization a claim names, valid or not: the canonical session decides it', async () => {
      for (const claimed of ['org_not_a_uuid', randomUUID(), OTHER_ORG]) {
        signedInAs(steward, claimed)
        const user = await asRequest(steward, () => guard!.getCurrentUser())
        expect(user?.organizationId).toBe(ORG)
        expect(user?.role).toBe('steward')
      }
    })

    it('ignores the organization picker cookie: a member stays in their session\'s organization, and a stranger gets no request with it', async () => {
      signedInAs(steward, null, { selected_organization_id: OTHER_ORG })
      expect((await asRequest(steward, () => guard!.getCurrentUser()))?.organizationId).toBe(ORG)
      signedInAs(stranger, null, { selected_organization_id: ORG })
      expect(await refusedCode(asRequest(stranger, () => guard!.getCurrentUser()))).toBe('MEMBERSHIP_REQUIRED')
      signedInAs(steward, null, { selected_org_id: 'org_stale_value' })
      expect(await asRequest(steward, () => orgUtils!.getOrganizationIdForUser(steward))).toBe(ORG)
    })

    it('gives a suspended person or a removed membership no request, and so not the organization\'s role', async () => {
      for (const person of [suspended, removed]) {
        signedInAs(person, ORG)
        expect(await refusedCode(asRequest(person, () => guard!.getCurrentUser())), person).toBe('MEMBERSHIP_REQUIRED')
      }
    })

    it('finds the person\'s membership, and their organization, for the unified user context, and none without a request', async () => {
      signedInAs(steward)
      expect(await asRequest(steward, () => guard!.getUserContext())).toMatchObject({ userId: steward, organizationId: ORG, roles: ['steward'] })
      signedInAs(null)
      expect(await refusedCode(guard!.getUserContext())).not.toBe('answered')
    })

    it('reads a role granted through the platform\'s own organization-user records', async () => {
      expect(await asRequest(authOnly, () => guard!.getUserContextForOrganization(ORG, authOnly))).toMatchObject({ userId: authOnly, organizationId: ORG, roles: ['officer'] })
    })
  })
})
