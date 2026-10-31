/**
 * Evidence behind pilot onboarding events.
 *
 * An onboarding event says a milestone happened in the organization: it was created, a user was invited, a role was assigned. The
 * route records the event and an audit row, so both must rest on what the organization's own membership data shows, not on what the
 * caller wrote in the body. A milestone the data does not show is refused.
 */
import { and, eq } from 'drizzle-orm'
import { organizationMembers, organizations } from '@/db/schema'
import type { RLSTx } from '@/lib/db/with-rls-context'

export type OnboardingMilestone = 'org_created' | 'user_invited' | 'role_assigned'

export type MilestoneEvidence =
  | { ok: true; evidence: Record<string, string | number | boolean> }
  | { ok: false; reason: string }

export async function verifyOnboardingMilestone(
  tx: RLSTx,
  organizationId: string,
  milestone: OnboardingMilestone,
  targetUserId: string | undefined,
  role: string | undefined,
): Promise<MilestoneEvidence> {
  if (milestone === 'org_created') {
    const [org] = await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, organizationId)).limit(1)
    return org ? { ok: true, evidence: { organizationExists: true } } : { ok: false, reason: 'the organization does not exist' }
  }

  if (!targetUserId) return { ok: false, reason: `${milestone} names no target user` }

  const [member] = await tx
    .select({ role: organizationMembers.role, status: organizationMembers.status })
    .from(organizationMembers)
    .where(and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, targetUserId)))
    .limit(1)
  if (!member) return { ok: false, reason: 'the target user is not a member of this organization' }

  if (milestone === 'user_invited') return { ok: true, evidence: { memberStatus: member.status } }

  if (!role) return { ok: false, reason: 'role_assigned names no role' }
  if (member.status !== 'active') return { ok: false, reason: 'the target member is not active' }
  if (member.role.trim().toLowerCase() !== role.trim().toLowerCase()) {
    return { ok: false, reason: 'the target member does not hold that role' }
  }
  return { ok: true, evidence: { memberRole: member.role, memberStatus: member.status } }
}
