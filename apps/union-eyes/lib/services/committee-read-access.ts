import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { committeeMemberships } from '@/db/schema'
import { ApiError } from '@/lib/api/errors'
import { isBelowStaff } from '@/lib/api/crud-low-role-guard'
import { requireCommitteeScope } from '@/lib/services/committee-workspace-service'
import { directRoleIn, isAdministrativeRole, resolveOrganizationAccess } from '@/lib/organizations/read-authority'

/**
 * A committee's meetings, attendance, action items and documents are its working record. The committee must be the
 * caller's organization's, and the reader must be staff or an active member of that committee; any other member
 * gets the same answer as for a committee that does not exist.
 */
async function isActiveCommitteeMember(committeeId: string, userId: string): Promise<boolean> {
  const [membership] = await db
    .select({ id: committeeMemberships.id })
    .from(committeeMemberships)
    .where(and(
      eq(committeeMemberships.committeeId, committeeId),
      eq(committeeMemberships.memberId, userId),
      eq(committeeMemberships.status, 'active'),
    ))
    .limit(1)
  return Boolean(membership)
}

export async function requireCommitteeReader(
  organizationId: string,
  committeeId: string,
  userId: string | null | undefined,
  children: { meetingId?: string; actionItemId?: string; documentId?: string } = {},
): Promise<void> {
  await requireCommitteeScope(organizationId, committeeId, children)
  if (!userId) throw ApiError.notFound('Committee')
  if (!(await isBelowStaff(userId, organizationId))) return
  if (!(await isActiveCommitteeMember(committeeId, userId))) throw ApiError.notFound('Committee')
}

/**
 * The minutes are the committee's own deliberation. A steward-level role in the organization is not, by itself, a seat on the
 * committee: the minutes are read by an active member of the committee, or by an administrator of the organization itself (a direct
 * role there, never a platform title or a role in an organization above it). Anyone else who may read the meeting gets it without
 * the minutes.
 */
export async function canReadCommitteeMinutes(
  organizationId: string,
  committeeId: string,
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) return false
  if (await isActiveCommitteeMember(committeeId, userId)) return true
  const access = await resolveOrganizationAccess(userId)
  return isAdministrativeRole(directRoleIn(access, organizationId))
}

/** A meeting as read by someone who may not read its minutes: the minutes are withheld and the response says so. */
export function withholdMinutes<T extends { minutes?: string | null }>(meeting: T): T & { minutesWithheld: true } {
  return { ...meeting, minutes: null, minutesWithheld: true }
}
