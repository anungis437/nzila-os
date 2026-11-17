import { and, eq, sql } from 'drizzle-orm'
import { TENANT_LOCAL_ROLES, type UserRole } from '@/lib/auth/roles'
import { canonicalMembershipRole } from '@/lib/auth/canonical-membership-role'
import { organizationMembers } from '@/db/schema-organizations'
import { profiles } from '@/db/schema/profiles-schema'
import { getActiveTenantDb } from '@/db/tenant-context-storage'
import { canonicalTenantPrincipal } from '@/lib/db/canonical-transaction-scope'
import type { CanonicalRequestProfile } from '@/lib/auth/canonical-request-scope'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import { ApiError } from '@/lib/api/errors'

export const hasDirectoryMembership = (role: string) => TENANT_LOCAL_ROLES.includes(role as UserRole)

/** Materialize contact data, never membership authority. Both identity and role
 * come from the live canonical transaction, not an email match or request body.
 * Existing profiles (including tombstones) are never reassigned or reactivated.
 * No SYSTEM context, new database grant, or default organization is involved. */
export async function ensureOwnDirectoryProfile(tx: RLSTx, contact: CanonicalRequestProfile) {
  const principal = canonicalTenantPrincipal()
  const localRole = principal ? canonicalMembershipRole(principal.role,principal.isSystemAdmin === true) : null
  if (!principal || !localRole || tx !== getActiveTenantDb()
    || principal.userId !== contact.userId || principal.organizationId !== contact.organizationId
    || !hasDirectoryMembership(localRole)) throw ApiError.forbidden('A live local membership is required.')
  const email = contact.email.trim()
  if (!email || email.length > 320) throw ApiError.conflict('Your account needs a valid contact email before membership setup can finish.')
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`member-directory:${principal.organizationId}:${principal.userId}`},0))`)
  const [existing] = await tx.select({ id: organizationMembers.id, status: organizationMembers.status,
    deletedAt: organizationMembers.deletedAt }).from(organizationMembers).where(and(
    eq(organizationMembers.organizationId, principal.organizationId), eq(organizationMembers.userId, principal.userId),
  )).limit(1).for('update')
  if (existing && (existing.deletedAt || existing.status !== 'active')) throw ApiError.conflict('Your member profile requires administrator review.')
  // Several business tables reference profiles.user_id. This contact anchor
  // grants no identity, subscription or billing authority and is never relinked.
  const [anchor] = await tx.insert(profiles).values({ userId: principal.userId, email })
    .onConflictDoNothing({ target: profiles.userId }).returning({ id: profiles.id })
  if (anchor) await persistAtomicAudit(tx, { organizationId: principal.organizationId, userId: principal.userId,
    action: 'member.profile_anchored', resourceType: 'profiles', resourceId: anchor.id,
    details: { source: 'canonical_auth_principal' } })
  if (existing) return { memberId: existing.id, created: false }
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim() || email
  const [member] = await tx.insert(organizationMembers).values({
    organizationId: principal.organizationId, userId: principal.userId,
    name: name.slice(0,400), email, role: localRole, status: 'active',
    // Profile creation time is not the person's historical union join date.
    joinedAt: null, metadata: { source: 'canonical_membership_contact_projection' },
  }).returning({ id: organizationMembers.id })
  if (!member) throw new Error('Member profile could not be persisted')
  await persistAtomicAudit(tx, { organizationId: principal.organizationId, userId: principal.userId,
    action: 'member.directory_projected', resourceType: 'organization_members', resourceId: member.id,
    details: { source: 'canonical_auth_membership', membershipRole: principal.role } })
  return { memberId: member.id, created: true }
}
