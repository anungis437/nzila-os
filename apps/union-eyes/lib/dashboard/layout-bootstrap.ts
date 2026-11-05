/**
 * What the dashboard layout reads and writes before any page renders, each in the database context that matches what it is.
 *
 * The layout used to go through the module-level handle for all of it. Outside a transaction that handle is the pooled connection with
 * no user and no organization set, and row-level security then hides every profile and every membership from the runtime role: the profile
 * was never found, creating it was refused, and the layout sent every person to /sign-up. Unit tests replace the database and CI connects as
 * a superuser, so neither noticed.
 *
 *   - the person's own profile (USER_RLS) is read and created in their own user context, before an organization is known;
 *   - a membership is looked up by the person's id before any organization context can exist, which is what the system role is for; the
 *     system role is granted SELECT and UPDATE on memberships, never INSERT;
 *   - a membership seeded under the person's e-mail can be linked to them (see linkSeededMemberships): the lookup by e-mail crosses
 *     organizations, so it is made as the system role, and the link and its audit event are one transaction in the membership's own
 *     organization and the person's own user context, the only place the audit table accepts the row;
 *   - the default-organization membership is an INSERT, so it is made as the runtime role in that organization's own context;
 *   - the organization's province is read in the organization's own context.
 *
 * A profile is never relinked to another person by e-mail: the system role holds no UPDATE on profiles, dozens of tables reference
 * profiles.user_id, and an e-mail is not the identity. The same holds for a membership, except for the one pilot and demo convenience
 * described at linkSeededMemberships, which is off unless explicitly switched on and can never be on in production.
 */
import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm';
import { profiles } from '@/db/schema';
import { organizationMembers, organizations } from '@/db/schema-organizations';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { withRLSContext, withSystemContext } from '@/lib/db/with-rls-context';
import { escapeHatchActive } from '@/lib/runtime/production-guard';

export type DashboardProfile = typeof profiles.$inferSelect;

/** The profile of the signed-in person, created on their first visit; null only when it can neither be found nor created. */
export function loadOrCreateProfile(input: { userId: string; email: string }): Promise<DashboardProfile | null> {
  const { userId, email } = input;
  // 'system' keeps the authenticated user context and clears the organization: a profile belongs to a person, not to an organization.
  return withRLSContext({ organizationId: 'system', userId }, async (tx) => {
    const read = async () => (await tx.select().from(profiles).where(eq(profiles.userId, userId)).limit(1))[0] ?? null;
    const existing = await read();
    if (existing) return existing;
    await tx.insert(profiles).values({ userId, email: email || null }).onConflictDoNothing({ target: profiles.userId });
    return read();
  });
}

export type MembershipOutcome = 'existing' | 'linked' | 'provisioned' | 'none';

/**
 * Whether a membership seeded under an e-mail may be linked to the person who signs in with that e-mail.
 *
 * NEVER true in a deployment (lib/runtime/production-guard.ts), and false everywhere unless UE_ALLOW_SEED_MEMBERSHIP_LINKING=true is set on purpose
 * (a local or CI run). The reason is the evidence, not a policy: the e-mail of the session is the Entra `email` claim or, when that is absent,
 * `preferred_username` (packages/platform-auth/src/entra/config.ts), neither of which is verified, and the session carries no flag that says
 * otherwise. Whoever can make a provider assert an address would take the membership, its role included. Memberships are claimed in
 * production through an invitation (packages/platform-auth/src/invites).
 */
export function isSeedMembershipLinkingAllowed(): boolean {
  return escapeHatchActive('UE_ALLOW_SEED_MEMBERSHIP_LINKING');
}

/** The e-mail to compare: trimmed; the case is folded by the database on both sides, so one function decides what "the same" means. */
function emailToCompare(email: string): string {
  return email.trim();
}

async function hasOwnMembership(userId: string): Promise<boolean> {
  const [own] = await withSystemContext((tx) =>
    tx.select({ id: organizationMembers.id }).from(organizationMembers).where(eq(organizationMembers.userId, userId)).limit(1),
  );
  return Boolean(own);
}

/**
 * Links the memberships that were seeded under the person's e-mail and that no one has taken up.
 *
 * Seeded pilot and demo memberships cannot be told apart from real ones by how they are stored: organization_members.user_id is NOT NULL, so
 * an unclaimed seed has no NULL, and the seeds name a made-up user id with no common prefix (demo-*, marathon-*, the fixture ids, the random
 * uuid of an import). What a made-up user id has in common is that no one ever signed in as it, so a membership is unclaimed only if
 *   - its e-mail is the person's, compared with lower() on both sides;
 *   - it is active and not deleted (a removed or suspended membership is never revived by a sign-in);
 *   - nobody has a profile under its user id (the layout creates a profile at a person's first visit), so a membership that belongs to a
 *     real person, whose user id has signed in, is never taken, even when the e-mail is the same on two accounts;
 *   - it is the oldest such membership of its organization (two seeds with one e-mail in an organization would otherwise collide on the
 *     unique (organization_id, user_id) index).
 * The link only changes the row from the user id it was found with, so a concurrent request that took it first leaves it alone, and it is
 * written in the membership's own organization with the person's user id, in the same transaction as its security audit event: no audit,
 * no link.
 *
 * Returns how many memberships were linked.
 */
async function linkSeededMemberships(input: { userId: string; email: string }): Promise<number> {
  const { userId, email } = input;

  const candidates = await withSystemContext((tx) =>
    tx
      .select({ id: organizationMembers.id, organizationId: organizationMembers.organizationId, userId: organizationMembers.userId })
      .from(organizationMembers)
      .where(
        and(
          sql`lower(${organizationMembers.email}) = lower(${email})`,
          eq(organizationMembers.status, 'active'),
          isNull(organizationMembers.deletedAt),
          ne(organizationMembers.userId, userId),
          sql`not exists (select 1 from ${profiles} where ${profiles.userId} = ${organizationMembers.userId})`,
        ),
      )
      .orderBy(asc(organizationMembers.createdAt), asc(organizationMembers.id)),
  );

  const oldestOfEachOrganization = new Map<string, (typeof candidates)[number]>();
  for (const candidate of candidates) {
    if (!oldestOfEachOrganization.has(candidate.organizationId)) oldestOfEachOrganization.set(candidate.organizationId, candidate);
  }

  let linked = 0;
  for (const candidate of oldestOfEachOrganization.values()) {
    linked += await withRLSContext({ organizationId: candidate.organizationId, userId }, async (tx) => {
      const taken = await tx
        .update(organizationMembers)
        .set({ userId, updatedAt: new Date() })
        .where(
          and(
            eq(organizationMembers.id, candidate.id),
            eq(organizationMembers.organizationId, candidate.organizationId),
            eq(organizationMembers.userId, candidate.userId),
            eq(organizationMembers.status, 'active'),
            isNull(organizationMembers.deletedAt),
          ),
        )
        .returning({ id: organizationMembers.id });
      if (taken.length === 0) return 0;
      await persistAtomicAudit(tx, {
        organizationId: candidate.organizationId,
        userId,
        action: 'membership.link_by_email',
        resourceType: 'organization_members',
        resourceId: candidate.id,
        details: { previousUserId: candidate.userId, matchedOn: 'email', trigger: 'dashboard_layout_sign_in' },
      });
      return 1;
    });
  }
  return linked;
}

/**
 * Makes sure the person has an organization membership.
 *  - one already linked to their id: 'existing';
 *  - memberships seeded under their e-mail (pilot and demo users) that no one has taken up, and only when linking is switched on
 *    (`linkSeededMemberships`, which is never honoured in production): linked to their id, 'linked' (see linkSeededMemberships above);
 *  - none, and auto-provisioning is permitted: an active member of the default organization, 'provisioned' (a concurrent request that made
 *    the same row is not an error);
 *  - none, and it is not permitted: 'none', and the caller sends the person to the access-request flow.
 */
export async function ensureOrganizationMembership(input: {
  userId: string;
  email: string;
  name: string;
  defaultOrganizationId: string;
  allowAutoProvisioning: boolean;
  /** Pass isSeedMembershipLinkingAllowed(). Ignored in production, whatever it says. */
  linkSeededMemberships?: boolean;
}): Promise<MembershipOutcome> {
  const { userId, email } = input;

  if (await hasOwnMembership(userId)) return 'existing';

  const claim = emailToCompare(email);
  if (input.linkSeededMemberships === true && process.env.NODE_ENV !== 'production' && claim) {
    if ((await linkSeededMemberships({ userId, email: claim })) > 0) return 'linked';
    // A concurrent request of the same person may have linked it between the two lookups.
    if (await hasOwnMembership(userId)) return 'existing';
  }
  if (!input.allowAutoProvisioning) return 'none';

  await withRLSContext({ organizationId: input.defaultOrganizationId, userId }, (tx) =>
    tx
      .insert(organizationMembers)
      .values({
        userId,
        organizationId: input.defaultOrganizationId,
        name: input.name,
        email,
        role: 'member',
        status: 'active',
        isPrimary: true,
      })
      .onConflictDoNothing({ target: [organizationMembers.organizationId, organizationMembers.userId] }),
  );
  return 'provisioned';
}

/** The organization's province or territory (the Quebec bilingual banner depends on it), read in the organization's own context. */
export function readOrganizationProvince(organizationId: string): Promise<string | null> {
  return withRLSContext({ organizationId }, async (tx) => {
    const [organization] = await tx
      .select({ provinceTerritory: organizations.provinceTerritory })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    return organization?.provinceTerritory ?? null;
  });
}
