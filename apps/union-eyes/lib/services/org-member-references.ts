import { and, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '@/db/db'
import { organizationMembers } from '@/db/schema-organizations'
import { ApiError } from '@/lib/api/errors'

/**
 * An id taken from a request body that names a person must name a current member of the caller organization. Anything else is
 * a 400 that names no one, so a body cannot attach another organization's user, or a removed member, to a committee record.
 */
export async function assertOrganizationMembers(userIds: ReadonlyArray<string | null | undefined>, organizationId: string): Promise<void> {
  const wanted = [...new Set(userIds.filter((id): id is string => typeof id === 'string' && id.length > 0))]
  if (wanted.length === 0) return
  if (wanted.length > 500) throw ApiError.badRequest('Too many members named in one request')
  const found = await db
    .select({ userId: organizationMembers.userId })
    .from(organizationMembers)
    .where(and(eq(organizationMembers.organizationId, organizationId), inArray(organizationMembers.userId, wanted), isNull(organizationMembers.deletedAt)))
  if (new Set(found.map((row) => row.userId)).size !== wanted.length) {
    throw ApiError.badRequest('Every member named must be a current member of this organization')
  }
}
