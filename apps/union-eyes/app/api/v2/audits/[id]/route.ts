/**
 * GET /api/v2/audits/[id]
 * Single audit log entry from PostgreSQL.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { auditLogs } from '@/db/schema/audit-security-schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'officer' } },
  async ({ params, organizationId }) => {
    const { id } = params as { id: string };
    const [row] = await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.auditId, id),
          eq(auditLogs.organizationId, organizationId!),
        ),
      )
      .limit(1);
    if (!row) {
      throw ApiError.notFound('Audit log');
    }
    return { data: row };
  },
);
