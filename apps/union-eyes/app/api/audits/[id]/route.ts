/**
 * Administrator audit detail: tenant-scoped, redacted and access-audited.
 * Readable only by a live, direct administrator of the organization in context (#1116): a platform title, a role carried in
 * provider metadata, or an administrator's role in a parent organization is not enough.
 * Raw old/new values, IPs, session identifiers and metadata may contain
 * confidential member information and must not be returned by this endpoint.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { readAuditEntry } from '@/lib/audit/audit-reader';
import { directRoleIn, isAdministrativeRole, resolveOrganizationAccess } from '@/lib/organizations/read-authority';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET = withApi(
  { auth: { required: true, minRole: 'admin' }, requireOrg: true },
  async ({ params, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Organization administrator context required');
    const { id } = params as { id: string };
    if (!UUID.test(id)) throw ApiError.badRequest('Invalid audit identifier');
    if (!isAdministrativeRole(directRoleIn(await resolveOrganizationAccess(userId), organizationId))) {
      throw ApiError.forbidden('Reading the audit log requires direct administration of this organization');
    }

    return withRLSContext({ organizationId, userId }, async (tx) => {
      const row = await readAuditEntry(tx, organizationId, id);
      if (!row) throw ApiError.notFound('Audit log');

      await persistAtomicAudit(tx, {
        organizationId, userId,
        action: 'audit.entry.read',
        resourceType: 'audit_logs',
        resourceId: row.auditId,
        details: { viewedAuditId: row.auditId },
      });
      return {
        auditId: row.auditId,
        action: row.action,
        resourceType: row.resourceType,
        resourceId: row.resourceId,
        severity: row.severity,
        outcome: row.outcome,
        source: row.source,
        createdAt: row.createdAt,
      };
    });
  },
);
