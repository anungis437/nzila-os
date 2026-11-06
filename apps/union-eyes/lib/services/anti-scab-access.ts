import { eq, sql, type SQL } from 'drizzle-orm'
import { antiScabViolations } from '@/db/schema'

/**
 * Who reaches an anti-scab violation record (DEF-0B4-OHS-ANTI-SCAB-RECORD-NO-AUTHOR-OR-CASE-AUTHORITY).
 *
 * A steward-level role in the organization is eligibility, not authority over every strike or lockout file: until now any steward of the
 * organization read and rewrote every violation. The authority that should reach these records (for example a mandate over the bargaining unit on
 * strike or locked out, or a designated strike committee) is an institutional decision, and the authority kernel (lib/authority/*) has no resource
 * type for them yet. Until that is decided and built, access fails closed to the one relationship the record proves: the principal who filed it
 * (created_by, recorded from the session by platform 0044). Nobody else reads, lists or changes it, and a record filed before 0044 (no author) is
 * reached by no one through these routes.
 */
export function antiScabAuthorCondition(userId: string | null | undefined): SQL {
  return userId ? eq(antiScabViolations.createdBy, userId) : sql`false`
}
