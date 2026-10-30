/**
 * GET POST /api/compliance/audit-logs
 * Compliance audit logs backed by PostgreSQL.
 */
import { withApi, ApiError, z } from '@/lib/api/framework';
import { db } from '@/db/db';
import { requireOrganizationAuditReader, ORGANIZATION_AUDIT_PROJECTION } from '@/lib/audit/org-audit-reader';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
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
    return rows;
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    requireOrg: true,
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
    const auditScope = await requireOrganizationAuditReader(userId, organizationId);
    // A manual entry is recorded as exactly that: attributed to the administrator who wrote it, with the declared
    // fields kept as details, so it cannot pass for a system-generated record of another action.
    return withRLSContext({ organizationId: auditScope }, async (tx) => {
      await persistAtomicAudit(tx, {
        organizationId: auditScope,
        userId: userId!,
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

