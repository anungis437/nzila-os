import { sql, type SQL } from 'drizzle-orm';
import { grievances } from '@/db/schema/domains/claims/grievances';

/**
 * Matters a user may read in full: authored, primary-owned, or covered by an active unexpired
 * case-access grant. Organization role seniority is deliberately not an input. Mirrors
 * `getEffectiveCaseAccess` + creator, for use in set-based queries. Callers must add the
 * organization predicate themselves.
 */
export function grievanceRelationshipScope(userId: string): SQL {
  return sql`(
    ${grievances.createdBy}::text = ${userId}
    OR ${grievances.unionRepId}::text = ${userId}
    OR EXISTS (
      SELECT 1 FROM grievance_case_access_assignments a
      WHERE a.grievance_id = ${grievances.id}
        AND a.organization_id = ${grievances.organizationId}
        AND a.user_id = ${userId}
        AND a.status = 'active'
        AND (a.expires_at IS NULL OR a.expires_at > NOW())
    )
  )`;
}

/** Unassigned, non-confidential intakes: eligible for triage-metadata projection only. */
export function unassignedIntakeTriageScope(): SQL {
  return sql`(
    ${grievances.status} = 'draft'
    AND ${grievances.unionRepId} IS NULL
    AND ${grievances.isConfidential} IS NOT TRUE
  )`;
}
