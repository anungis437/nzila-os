import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { committeeMemberships } from '@/db/schema'
import { ApiError } from '@/lib/api/errors'
import { isBelowStaff } from '@/lib/api/crud-low-role-guard'
import { requireCommitteeScope } from '@/lib/services/committee-workspace-service'

/**
 * A committee's meetings, attendance, action items and documents are its working record. The committee must be the
 * caller's organization's, and the reader must be staff or an active member of that committee; any other member
 * gets the same answer as for a committee that does not exist.
 */
export async function requireCommitteeReader(
  organizationId: string,
  committeeId: string,
  userId: string | null | undefined,
  children: { meetingId?: string; actionItemId?: string; documentId?: string } = {},
): Promise<void> {
  await requireCommitteeScope(organizationId, committeeId, children)
  if (!userId) throw ApiError.notFound('Committee')
  if (!(await isBelowStaff(userId, organizationId))) return
  const [membership] = await db
    .select({ id: committeeMemberships.id })
    .from(committeeMemberships)
    .where(and(
      eq(committeeMemberships.committeeId, committeeId),
      eq(committeeMemberships.memberId, userId),
      eq(committeeMemberships.status, 'active'),
    ))
    .limit(1)
  if (!membership) throw ApiError.notFound('Committee')
}
