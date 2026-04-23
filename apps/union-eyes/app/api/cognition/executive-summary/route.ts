/**
 * GET /api/cognition/executive-summary
 *
 * Aggregated org-wide executive view. Admin-only.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withOrganizationAuth } from '@/lib/organization-middleware';
import { hasMinRole } from '@/lib/api-auth-guard';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';
import { buildExecutiveSummary } from '@nzila/ue-cognition';

export const GET = withOrganizationAuth(async (
  _request: NextRequest,
  context,
) => {
  const allowed = await hasMinRole('admin');
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const summary = buildExecutiveSummary({ tenantId: 'union-eyes', orgId: context.organizationId });

  await auditLog({
    eventType: AuditEventType.DATA_ACCESS,
    severity: AuditSeverity.LOW,
    userId: context.userId,
    organizationId: context.organizationId,
    resource: 'cognition_executive',
    action: 'view',
    details: {
      backlog: summary.backlog.total,
      interventions: summary.recommendedInterventions.length,
    },
    outcome: 'success',
  });

  return NextResponse.json({
    summary,
    governance: {
      autoApplied: false,
      humanOverrideRequired: true,
      note: 'Interventions are advisory. No actions are dispatched automatically.',
    },
  });
});
