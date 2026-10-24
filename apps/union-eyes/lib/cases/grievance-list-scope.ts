import { and, eq, isNull, or, sql, type SQL } from 'drizzle-orm'
import { grievances } from '@/db/schema/domains/claims/grievances'

/** Fields a representative may see for a matter they have no case-resource authority over. */
export const GRIEVANCE_TRIAGE_COLUMNS = {
  id: grievances.id,
  grievanceNumber: grievances.grievanceNumber,
  type: grievances.type,
  status: grievances.status,
  priority: grievances.priority,
  createdAt: grievances.createdAt,
  updatedAt: grievances.updatedAt,
} as const

/**
 * Case-resource authority for a non-supervisory representative: matters they own as primary
 * representative, are actively assigned to as a collaborator, or created while still unassigned or
 * assigned to themselves. Creating a matter ends as authority once it is reassigned. Role alone grants none.
 */
export function grievanceCaseAuthorityScope(organizationId: string, userId: string): SQL {
  return and(
    eq(grievances.organizationId, organizationId),
    or(
      and(
        eq(grievances.createdBy, userId),
        or(isNull(grievances.unionRepId), sql`${grievances.unionRepId}::text = ${userId}`),
      ),
      sql`${grievances.unionRepId}::text = ${userId}`,
      sql`EXISTS (
        SELECT 1 FROM grievance_case_access_assignments a
        WHERE a.grievance_id = ${grievances.id}
          AND a.organization_id = ${grievances.organizationId}
          AND a.user_id = ${userId}
          AND a.status = 'active'
          AND (a.expires_at IS NULL OR a.expires_at > NOW())
      )`,
    ),
  )!
}

/** Unassigned intakes awaiting triage: visible as minimum metadata only, never as case content. */
export function grievanceTriageScope(organizationId: string): SQL {
  return and(
    eq(grievances.organizationId, organizationId),
    eq(grievances.status, 'draft'),
    isNull(grievances.unionRepId),
  )!
}
