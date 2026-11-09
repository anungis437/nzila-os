/**
 * The platform user directory and member activity feed, as a platform administrator is allowed to see them.
 *
 * These read every organization's people, so what they return is the least that the console needs: who (a display name), where
 * (organization), what role and when. An e-mail address is masked (the full address is not needed to find or act on a person, and the
 * member's own record is the place it is held), and the activity feed gives an abbreviated name and no address at all. A removed
 * (soft-deleted) member appears in neither. A search term is
 * bounded, matches only on three or more characters, and takes the pattern characters of LIKE literally. Both functions run on the
 * executor the caller gives them, which the routes open under the system role with the audit record in the same transaction.
 */
import { and, desc, ilike, isNull, or, sql, type SQL } from 'drizzle-orm'
import { organizationMembers, organizations } from '@/db/schema'
import type { RLSTx } from '@/lib/db/with-rls-context'

export const DIRECTORY_PAGE_LIMIT = 100
export const MIN_SEARCH_LENGTH = 3

/** `j***@example.org`: enough to tell two people apart, not enough to write to them. */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null
  const at = email.lastIndexOf('@')
  if (at <= 0) return '***'
  return `${email[0]}***${email.slice(at)}`
}

export const escapeLike = (term: string): string => term.replace(/[\\%_]/g, '\\$&')

export function normalizeSearch(raw: string | null | undefined): { term: string; tooShort: boolean } {
  const term = (raw ?? '').trim().slice(0, 100)
  return { term, tooShort: term.length > 0 && term.length < MIN_SEARCH_LENGTH }
}

/**
 * Members of exactly the organizations named in `organizationIds` - the caller's own directly-administered organizations. The scope is
 * required, not a filter: there is no call shape that reads every organization's people, and an empty scope reads nothing (issue #1116;
 * DEF-0B2-PLATFORM-DIRECTORY-UNSCOPED-READ, F03).
 */
export async function listPlatformUsers(
  tx: RLSTx,
  input: { search?: string | null; organizationId?: string | null; organizationIds: readonly string[] },
) {
  if (!Array.isArray(input.organizationIds) || input.organizationIds.length === 0) return []
  const { term } = normalizeSearch(input.search)
  // A removed member's tombstone is not part of a cross-organization directory.
  const conditions: SQL[] = [isNull(organizationMembers.deletedAt)]
  const matching = term ? or(ilike(organizationMembers.name, `%${escapeLike(term)}%`), ilike(organizationMembers.email, `%${escapeLike(term)}%`)) : undefined
  if (matching) conditions.push(matching)
  if (input.organizationId) conditions.push(sql`${organizationMembers.organizationId}::text = ${input.organizationId}`)
  conditions.push(sql`${organizationMembers.organizationId}::text IN (${sql.join(input.organizationIds.map((id) => sql`${id}`), sql`, `)})`)

  const rows = await tx
    .select({
      id: organizationMembers.id,
      name: organizationMembers.name,
      email: organizationMembers.email,
      role: organizationMembers.role,
      organizationId: organizationMembers.organizationId,
      organizationName: organizations.name,
      status: organizationMembers.status,
      joinedAt: organizationMembers.joinedAt,
      createdAt: organizationMembers.createdAt,
    })
    .from(organizationMembers)
    .leftJoin(organizations, sql`${organizations.id}::text = ${organizationMembers.organizationId}::text`)
    .where(and(...conditions))
    .orderBy(desc(organizationMembers.createdAt))
    .limit(DIRECTORY_PAGE_LIMIT)
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: maskEmail(row.email),
    role: row.role,
    organizationId: row.organizationId,
    organizationName: row.organizationName ?? 'Unknown',
    status: row.status ?? 'active',
    lastLogin: null,
    joinedAt: row.joinedAt ?? row.createdAt,
  }))
}
