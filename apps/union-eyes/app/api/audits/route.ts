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
      audits: rows.map(row => ({
        id: row.auditId,
        title: row.action,
        type: row.resourceType,
        status: row.outcome === 'success' ? 'completed' : 'in-progress',
        dateCompleted: row.outcome === 'success' ? row.createdAt?.toISOString() : undefined,
        auditor: row.userId ?? 'system',
        severity: row.severity,
        findings: 0,
        hasReport: false,
        createdAt: row.createdAt?.toISOString(),
      })),
      total: rows.length,
    };
  },
);

