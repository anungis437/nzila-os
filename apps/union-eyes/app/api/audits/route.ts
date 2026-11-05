/**
 * GET /api/audits
 * Organization audit log entries, from both audit stores (see lib/audit/audit-reader.ts).
 * Readable only by a live, direct administrator of the organization in context (#1116): a platform title, a role carried in
 * provider metadata, or an administrator's role in a parent organization is not enough.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { listAuditEntries } from '@/lib/audit/audit-reader';
import { directRoleIn, isAdministrativeRole, resolveOrganizationAccess } from '@/lib/organizations/read-authority';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'admin' } },
  async ({ organizationId, userId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    if (!userId || !isAdministrativeRole(directRoleIn(await resolveOrganizationAccess(userId), organizationId))) {
      throw ApiError.forbidden('Reading the audit log requires direct administration of this organization');
    }
    const rows = await withRLSContext({ organizationId, userId }, (tx) => listAuditEntries(tx, organizationId));
    return {
      // These are recorded audit-log entries, not audit engagements: no engagement table exists, so no findings count or report flag is
      // reported (the earlier 0 and false were invented), and an entry that did not succeed is `unknown`, not an engagement `in-progress`.
      kind: 'audit_log_entries' as const,
      audits: rows.map(row => ({
        id: row.auditId,
        title: row.action,
        type: row.resourceType,
        status: row.outcome === 'success' ? 'completed' : 'unknown',
        dateCompleted: row.outcome === 'success' ? row.createdAt?.toISOString() : undefined,
        auditor: row.userId ?? 'system',
        // The canonical store records no severity or outcome: null here means not recorded, not 'info' or 'success'.
        severity: row.severity,
        outcome: row.outcome,
        source: row.source,
        createdAt: row.createdAt?.toISOString(),
      })),
      total: rows.length,
    };
  },
);

