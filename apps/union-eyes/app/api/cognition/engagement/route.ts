/**
 * GET /api/cognition/engagement
 *
 * Returns the latest member-engagement snapshots for the org, sorted by
 * disengagement risk descending. Phase-1: pulls already-computed snapshots
 * from the file-backed store. Phase-2 will invoke a scheduled scorer.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withOrganizationAuth } from '@/lib/organization-middleware';
import { hasMinRole } from '@/lib/api-auth-guard';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';
import { listEngagementSnapshots } from '@nzila/ue-cognition';

export const GET = withOrganizationAuth(async (
  _request: NextRequest,
  context,
) => {
  const allowed = await hasMinRole('steward');
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const all = listEngagementSnapshots().filter((s) => s.subject.orgId === context.organizationId);
  const byMember = new Map<string, typeof all[number]>();
  for (const s of all) {
    const cur = byMember.get(s.memberId);
    if (!cur || s.snapshotAt > cur.snapshotAt) byMember.set(s.memberId, s);
  }
  const latest = [...byMember.values()].sort(
    (a, b) => b.disengagementProbability - a.disengagementProbability,
  );

  await auditLog({
    eventType: AuditEventType.DATA_ACCESS,
    severity: AuditSeverity.LOW,
    userId: context.userId,
    organizationId: context.organizationId,
    resource: 'cognition_engagement',
    action: 'list',
    details: { memberCount: latest.length },
    outcome: 'success',
  });

  return NextResponse.json({
    members: latest,
    governance: {
      autoApplied: false,
      humanOverrideRequired: true,
      note: 'Outreach recommendations are advisory; member preference + steward judgement override.',
    },
  });
});
