/**
 * GET POST /api/compliance/audit-logs
 * Compliance audit logs backed by PostgreSQL.
 */
import { withApi, ApiError, z } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { auditLogs } from '@/db/schema/audit-security-schema';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'admin' } },
  async ({ organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Organization audit context required');
    return withRLSContext({ organizationId, userId }, async (tx) => {
      // The record of who did what and when. The captured values, network address, user agent, session and correlation ids,
      // free-form metadata and error text stay in the store and are not served by this list.
      const rows = await tx
        .select({
          auditId: auditLogs.auditId,
          action: auditLogs.action,
          resourceType: auditLogs.resourceType,
          resourceId: auditLogs.resourceId,
          userId: auditLogs.userId,
          severity: auditLogs.severity,
          outcome: auditLogs.outcome,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .where(eq(auditLogs.organizationId, organizationId))
        .orderBy(desc(auditLogs.createdAt))
        .limit(100);
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'compliance.audit_log.read',
        resourceType: 'audit_logs',
        resourceId: organizationId,
        details: { count: rows.length },
      });
      return rows;
    });
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    body: z.object({
      action: z.string().min(1).max(100),
      resourceType: z.string().min(1).max(50),
      resourceId: z.guid().optional(),
      severity: z.enum(['debug', 'info', 'warning', 'error', 'critical']).default('info'),
      outcome: z.enum(['success', 'failure', 'error']).default('success'),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }),
  },
  async ({ body, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    // A manual entry is recorded as exactly that: attributed to the administrator who wrote it, with the declared
    // fields kept as details, so it cannot pass for a system-generated record of another action.
    return withRLSContext({ organizationId, userId }, async (tx) => {
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'compliance.manual_entry',
        resourceType: body.resourceType,
        resourceId: body.resourceId,
        details: {
          declaredAction: body.action,
          declaredSeverity: body.severity,
          declaredOutcome: body.outcome,
          untrustedMetadata: body.metadata ?? {},
        },
      });
      return { recorded: true };
    });
  },
);

