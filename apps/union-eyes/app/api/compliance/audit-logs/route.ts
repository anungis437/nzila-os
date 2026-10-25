/**
 * GET POST /api/compliance/audit-logs
 * Compliance audit logs backed by PostgreSQL.
 */
import { withApi, ApiError, z } from '@/lib/api/framework';
import { db } from '@/db/db';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
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
    return rows;
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
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    // A manual entry is recorded as exactly that: attributed to the administrator who wrote it, with the declared
    // fields kept as details, so it cannot pass for a system-generated record of another action.
    return withRLSContext({ organizationId }, async (tx) => {
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'compliance.manual_entry',
        resourceType: body.resourceType,
        resourceId: body.resourceId,
        details: {
          ...(body.metadata ?? {}),
          declaredAction: body.action,
          declaredSeverity: body.severity,
          declaredOutcome: body.outcome,
        },
      });
      return { recorded: true };
    });
  },
);

