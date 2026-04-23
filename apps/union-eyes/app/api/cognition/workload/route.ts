/**
 * GET /api/cognition/workload
 *
 * Per-steward workload snapshots + org-level fairness for the org.
 * Org-scoped, audited, steward-or-higher.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withOrganizationAuth } from '@/lib/organization-middleware';
import { hasMinRole } from '@/lib/api-auth-guard';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';
import { computeWorkloadFairness } from '@nzila/ue-cognition';
import { scoreStewardWorkloads, stewardSubject } from '@/lib/cognition/ue-adapter';

export const GET = withOrganizationAuth(async (
  _request: NextRequest,
  context,
) => {
  const allowed = await hasMinRole('steward');
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const stewards = await scoreStewardWorkloads(context.organizationId);
  const subject = stewardSubject(context.organizationId, 'org');
  const fairness = stewards.length > 0
    ? computeWorkloadFairness(subject, stewards)
    : null;

  await auditLog({
    eventType: AuditEventType.DATA_ACCESS,
    severity: AuditSeverity.LOW,
    userId: context.userId,
    organizationId: context.organizationId,
    resource: 'cognition_workload',
    action: 'compute',
    details: { stewardCount: stewards.length, fairnessScore: fairness?.fairnessScore ?? null },
    outcome: 'success',
  });

  return NextResponse.json({
    stewards,
    fairness,
    governance: {
      autoApplied: false,
      humanOverrideRequired: true,
      note: 'Reassignments are recommendations only. Operator must confirm.',
    },
  });
});
