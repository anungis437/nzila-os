/**
 * GET /api/audits/[id]
 * Single audit log entry from PostgreSQL.
 */
import { withApi } from '@/lib/api/framework';
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
      return Response.json({ error: 'Not found' }, { status: 404 });
    }
    return { data: row };
  },
);

