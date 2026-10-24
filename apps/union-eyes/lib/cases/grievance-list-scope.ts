import { and, eq, or, sql, type SQL } from 'drizzle-orm'
import { grievances } from '@/db/schema/domains/claims/grievances'
import { kernelCaseRelationshipScope } from '@/lib/authority/store/route-adapter'

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
 * Pre-filter for a representative's own matters: those they authored while still unassigned, and those they hold a
 * LIVE, non-recused authority-kernel relationship to. Role alone grants none, and the legacy primary-representative
 * column is not read. Reading or changing one matter still needs a full kernel decision.
 */
export function grievanceCaseAuthorityScope(organizationId: string, userId: string): SQL {
  return and(
    eq(grievances.organizationId, organizationId),
    or(
      and(eq(grievances.createdBy, userId), sql`NOT EXISTS (
        SELECT 1 FROM ue_authority_resource_relationships r
         WHERE r.resource_type = 'case' AND r.resource_id = ${grievances.id} AND r.organization_id = ${grievances.organizationId}
           AND r.relation IN ('owner', 'assignee') AND r.status = 'active' AND r.revoked_at IS NULL
           AND (r.expires_at IS NULL OR r.expires_at > now()))`),
      kernelCaseRelationshipScope(userId, sql`${grievances.id}`, sql`${grievances.organizationId}`),
    ),
  )!
}

/** Unassigned intakes awaiting triage: visible as minimum metadata only, never as case content. */
export function grievanceTriageScope(organizationId: string): SQL {
  return and(
    eq(grievances.organizationId, organizationId),
    eq(grievances.status, 'draft'),
    sql.raw(`NOT EXISTS (
      SELECT 1 FROM ue_authority_resource_relationships r
       WHERE r.resource_type = 'case' AND r.resource_id = grievances.id AND r.organization_id = grievances.organization_id
         AND r.relation IN ('owner', 'assignee') AND r.status = 'active' AND r.revoked_at IS NULL
         AND (r.expires_at IS NULL OR r.expires_at > now()))`),
  )!
}
