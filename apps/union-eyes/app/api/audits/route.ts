/**
 * GET /api/audits
 * Organization audit logs from PostgreSQL.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { auditLogs } from '@/db/schema/audit-security-schema';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'officer' } },
  async ({ organizationId }) => {
    const rows = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.organizationId, organizationId!))
      .orderBy(desc(auditLogs.createdAt))
      .limit(100);
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
        severity: row.severity,
        outcome: row.outcome,
        createdAt: row.createdAt?.toISOString(),
      })),
      total: rows.length,
    };
  },
);

