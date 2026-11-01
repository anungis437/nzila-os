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
export const ACTIVITY_MAX_LIMIT = 50
export const MIN_SEARCH_LENGTH = 3

/** `j***@example.org`: enough to tell two people apart, not enough to write to them. */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null
  const at = email.lastIndexOf('@')
  if (at <= 0) return '***'
  return `${email[0]}***${email.slice(at)}`
}

/** `Pat M.` from `Pat Morgan`; a single word stays as its first letter and a dot. */
export function abbreviateName(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'Member'
  if (parts.length === 1) return `${parts[0][0]}.`
  return `${parts[0]} ${parts[parts.length - 1][0]}.`
}

export const escapeLike = (term: string): string => term.replace(/[\\%_]/g, '\\$&')

export function normalizeSearch(raw: string | null | undefined): { term: string; tooShort: boolean } {
  const term = (raw ?? '').trim().slice(0, 100)
  return { term, tooShort: term.length > 0 && term.length < MIN_SEARCH_LENGTH }
}

export async function listPlatformUsers(tx: RLSTx, input: { search?: string | null; organizationId?: string | null }) {
  const { term } = normalizeSearch(input.search)
  // A removed member's tombstone is not part of a cross-organization directory.
  const conditions: SQL[] = [isNull(organizationMembers.deletedAt)]
  const matching = term ? or(ilike(organizationMembers.name, `%${escapeLike(term)}%`), ilike(organizationMembers.email, `%${escapeLike(term)}%`)) : undefined
  if (matching) conditions.push(matching)
  if (input.organizationId) conditions.push(sql`${organizationMembers.organizationId}::text = ${input.organizationId}`)

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

export async function recentMemberActivity(tx: RLSTx, limit: number) {
  const bounded = Math.min(Math.max(Math.trunc(Number.isFinite(limit) ? limit : 10), 1), ACTIVITY_MAX_LIMIT)
  const rows = await tx
    .select({
      id: organizationMembers.id,
      name: organizationMembers.name,
      role: organizationMembers.role,
      organizationId: organizationMembers.organizationId,
      orgName: organizations.name,
      createdAt: organizationMembers.createdAt,
    })
    .from(organizationMembers)
    .leftJoin(organizations, sql`${organizations.id}::text = ${organizationMembers.organizationId}::text`)
    .where(isNull(organizationMembers.deletedAt))
    .orderBy(desc(organizationMembers.createdAt))
    .limit(bounded)

  return rows.map((row) => {
    const who = abbreviateName(row.name)
    return {
      id: row.id,
      type: 'member_added',
      description: `${who} joined ${row.orgName ?? 'organization'} as ${row.role}`,
      user: who,
      organizationName: row.orgName,
      timestamp: row.createdAt,
    }
  })
}
