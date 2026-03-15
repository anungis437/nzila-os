/**
 * GET POST /api/v2/compliance/audit-logs
 * Compliance audit logs backed by PostgreSQL.
 */
import { withApi, z } from '@/lib/api/framework';
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
    return { data: rows, total: rows.length };
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    body: z.object({
      action: z.string().min(1).max(100),
      resourceType: z.string().min(1).max(50),
      resourceId: z.string().uuid().optional(),
      severity: z.enum(['debug', 'info', 'warning', 'error', 'critical']).default('info'),
      outcome: z.enum(['success', 'failure', 'error']).default('success'),
      metadata: z.record(z.unknown()).optional(),
    }),
  },
  async ({ body, organizationId, userId }) => {
    const [row] = await db
      .insert(auditLogs)
      .values({
        ...body,
        organizationId: organizationId!,
        userId,
      })
      .returning();
    return { data: row };
  },
);
