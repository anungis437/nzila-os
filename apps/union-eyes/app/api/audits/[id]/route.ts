/**
 * Officer audit detail: tenant-scoped, redacted and access-audited.
 * Raw old/new values, IPs, session identifiers and metadata may contain
 * confidential member information and must not be returned by this endpoint.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { readAuditEntry } from '@/lib/audit/audit-reader';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET = withApi(
  { auth: { required: true, minRole: 'officer' }, requireOrg: true },
  async ({ params, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Organization officer context required');
    const { id } = params as { id: string };
    if (!UUID.test(id)) throw ApiError.badRequest('Invalid audit identifier');

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
