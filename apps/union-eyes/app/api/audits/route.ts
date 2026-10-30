/**
 * GET /api/audits
 * Organization audit logs from PostgreSQL.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { requireOrganizationAuditReader, ORGANIZATION_AUDIT_PROJECTION } from '@/lib/audit/org-audit-reader';
import { auditLogs } from '@/db/schema/audit-security-schema';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'admin' }, requireOrg: true, rlsOrgContext: true },
  async ({ organizationId, userId }) => {
    const scope = await requireOrganizationAuditReader(userId, organizationId);
    const rows = await db
      .select(ORGANIZATION_AUDIT_PROJECTION)
      .from(auditLogs)
      .where(eq(auditLogs.organizationId, scope))
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

