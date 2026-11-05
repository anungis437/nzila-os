/**
 * GET /api/cognition/cases/[id]/risk
 *
 * Compute and return the latest cognition-driven risk snapshot for a
 * grievance. Org-scoped via withOrganizationAuth. Audited.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withOrganizationAuth } from '@/lib/organization-middleware';
import { hasMinRole } from '@/lib/api-auth-guard';
import { auditLog } from '@/lib/audit-logger';
import { AuditEventType, AuditSeverity } from '@/lib/audit-logger';
import { scoreGrievanceRisk } from '@/lib/cognition/ue-adapter';
import { visibleCaseIds } from '@/lib/cognition/case-visibility';

export const GET = withOrganizationAuth(async (
  _request: NextRequest,
  context,
  params?: { id: string },
) => {
  if (!params?.id) {
    return NextResponse.json({ error: 'Missing case id' }, { status: 400 });
  }
  const allowed = await hasMinRole('steward');
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // A steward scores the cases the case authority lets them read; any other case is not found.
  if (!(await visibleCaseIds(context.organizationId, context.userId, [params.id])).has(params.id)) {
    return NextResponse.json({ error: 'Grievance not found' }, { status: 404 });
  }

  const snap = await scoreGrievanceRisk(context.organizationId, params.id);
  if (!snap) {
    return NextResponse.json({ error: 'Grievance not found' }, { status: 404 });
  }

  await auditLog({
    eventType: AuditEventType.DATA_ACCESS,
    severity: AuditSeverity.LOW,
    userId: context.userId,
    organizationId: context.organizationId,
    resource: 'cognition_case_risk',
    resourceId: params.id,
    action: 'compute',
    details: {
      tier: snap.riskTier,
      action: snap.recommendedAction,
      modelVersion: snap.modelVersion,
    },
    outcome: 'success',
  });

  return NextResponse.json({
    snapshot: snap,
    governance: {
      modelVersion: snap.modelVersion,
      confidence: snap.confidence,
      explainability: snap.topFactors,
      autoApplied: false,
      humanOverrideRequired: true,
    },
  });
});
