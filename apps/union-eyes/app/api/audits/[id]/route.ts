/**
 * GET /api/audits/[id]
 * Single audit log entry from PostgreSQL.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { requireOrganizationAuditReader, ORGANIZATION_AUDIT_PROJECTION } from '@/lib/audit/org-audit-reader';
import { auditLogs } from '@/db/schema/audit-security-schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'admin' }, requireOrg: true, rlsOrgContext: true },
  async ({ params, organizationId, userId }) => {
    const scope = await requireOrganizationAuditReader(userId, organizationId);
    const { id } = params as { id: string };
    const [row] = await db
      .select(ORGANIZATION_AUDIT_PROJECTION)
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.auditId, id),
          eq(auditLogs.organizationId, scope),
        ),
      )
      .limit(1);
    if (!row) {
      throw ApiError.notFound('Audit log');
    }
    return row;
  },
);

