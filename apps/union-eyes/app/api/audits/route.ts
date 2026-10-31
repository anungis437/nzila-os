/**
 * GET /api/audits
 * Organization audit log entries, from both audit stores (see lib/audit/audit-reader.ts).
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { listAuditEntries } from '@/lib/audit/audit-reader';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'officer' } },
  async ({ organizationId, userId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const rows = await withRLSContext({ organizationId, userId: userId ?? undefined }, (tx) => listAuditEntries(tx, organizationId));
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

