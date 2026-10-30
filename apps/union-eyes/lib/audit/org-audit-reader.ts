/**
 * Full organization audit history is privileged institutional evidence.
 * A platform title, federation parent role or generic officer role does not
 * convey standing access to the audit security schema.
 *
 * UE-INST-AUDIT-HISTORY-READERS: direct organization administrators may
 * view a field-minimized audit projection. The separately designated privacy
 * officer flow is intentionally unavailable until a verified mandate exists.
 */
import { ApiError } from '@/lib/api/errors';
import { isAdministrativeRole, resolveOrganizationAccess } from '@/lib/organizations/read-authority';
import { auditLogs } from '@/db/schema/audit-security-schema';

export async function requireOrganizationAuditReader(userId: string | null, organizationId: string | null): Promise<string> {
  if (!userId || !organizationId) throw ApiError.forbidden('Active organization context required');
  const access = await resolveOrganizationAccess(userId);
  if (!isAdministrativeRole(access.direct.get(organizationId))) {
    throw ApiError.forbidden('Direct organization administrator or verified privacy mandate required');
  }
  return organizationId;
}

/** SQL projection: never read IP, session/device identifiers, arbitrary metadata,
 * payload old/new values, or confidential error descriptions through this view.
 * Do not select all columns then redact in JavaScript.
 */
export const ORGANIZATION_AUDIT_PROJECTION = {
  auditId: auditLogs.auditId,
  organizationId: auditLogs.organizationId,
  userId: auditLogs.userId,
  action: auditLogs.action,
  resourceType: auditLogs.resourceType,
  resourceId: auditLogs.resourceId,
  severity: auditLogs.severity,
  outcome: auditLogs.outcome,
  createdAt: auditLogs.createdAt,
} as const;
