import { sql, type SQL } from 'drizzle-orm';
const dsql = sql;
import { grievances } from '@/db/schema/domains/claims/grievances';
import { kernelCaseRelationshipScope } from '@/lib/authority/store/route-adapter';

/**
 * Pre-filter for list queries: matters a user authored or holds a LIVE, non-recused authority-kernel relationship to.
 * Organization role seniority is deliberately not an input, and neither is the legacy primary-representative column.
 * This only narrows what a list may enumerate; reading or changing any one matter still needs a full kernel decision.
 * Callers must add the organization predicate themselves.
 */
export function grievanceRelationshipScope(userId: string): SQL {
  return sql`(
    ${grievances.createdBy}::text = ${userId}
    OR ${kernelCaseRelationshipScope(userId, dsql`${grievances.id}`, dsql`${grievances.organizationId}`)}
  )`;
}

/** Unassigned, non-confidential intakes: eligible for triage-metadata projection only. */
export function unassignedIntakeTriageScope(): SQL {
  return sql`(
    ${grievances.status} = 'draft'
    AND ${sql.raw(`NOT EXISTS (
      SELECT 1 FROM ue_authority_resource_relationships r
       WHERE r.resource_type = 'case' AND r.resource_id = grievances.id AND r.organization_id = grievances.organization_id
         AND r.relation IN ('owner', 'assignee') AND r.status = 'active' AND r.revoked_at IS NULL
         AND (r.expires_at IS NULL OR r.expires_at > now()))`)}
    AND ${grievances.isConfidential} IS NOT TRUE
  )`;
}
