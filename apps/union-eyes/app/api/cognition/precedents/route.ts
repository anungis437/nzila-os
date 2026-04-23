/**
 * POST /api/cognition/precedents
 *
 * Body: { forCaseId: string, type: string, tags: string[], candidateCaseIds?: string[] }
 *
 * Phase-1: candidates must be supplied by the caller (UI lookup against
 * grievances table). Engine returns ranked precedents with org-scope guard.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withOrganizationAuth } from '@/lib/organization-middleware';
import { hasMinRole } from '@/lib/api-auth-guard';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';
import { findPrecedents, CrossOrgPrecedentLeakError } from '@nzila/ue-cognition';
import { caseSubject } from '@/lib/cognition/ue-adapter';
import { db } from '@/db/db';
import { grievances } from '@/db/schema/domains/claims/grievances';
import { and, eq, inArray } from 'drizzle-orm';

export const POST = withOrganizationAuth(async (
  request: NextRequest,
  context,
) => {
  const allowed = await hasMinRole('steward');
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { forCaseId?: string; type?: string; tags?: string[]; candidateCaseIds?: string[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.forCaseId || !body.type) {
    return NextResponse.json({ error: 'forCaseId and type are required' }, { status: 400 });
  }

  const candidateIds = body.candidateCaseIds ?? [];
  let candidateRows: Array<typeof grievances.$inferSelect> = [];
  if (candidateIds.length > 0) {
    candidateRows = await db
      .select()
      .from(grievances)
      .where(and(
        eq(grievances.organizationId, context.organizationId),
        inArray(grievances.id, candidateIds),
      ));
  } else {
    candidateRows = await db
      .select()
      .from(grievances)
      .where(and(
        eq(grievances.organizationId, context.organizationId),
        eq(grievances.type, body.type as typeof grievances.$inferSelect['type']),
      ))
      .limit(50);
  }

  const subject = caseSubject(context.organizationId, body.forCaseId);
  let result;
  try {
    result = findPrecedents({
      forCaseId: body.forCaseId,
      forSubject: subject,
      forType: body.type,
      forTags: body.tags ?? [],
      candidates: candidateRows.map((g) => ({
        subject: caseSubject(context.organizationId, g.id),
        descriptor: {
          caseId: g.id,
          caseKind: 'grievance' as const,
          type: g.type as string,
          tags: [g.type as string, g.priority as string].filter(Boolean) as string[],
          summary: g.title ?? '',
          resolutionOutcome: ['settled', 'closed', 'withdrawn', 'denied'].includes(g.status as string)
            ? (g.status as string)
            : undefined,
          daysToResolve: g.resolvedAt && g.filedDate
            ? Math.round((g.resolvedAt.getTime() - g.filedDate.getTime()) / 86_400_000)
            : undefined,
        },
      })),
    });
  } catch (e) {
    if (e instanceof CrossOrgPrecedentLeakError) {
      return NextResponse.json({ error: 'Cross-org precedent leak prevented' }, { status: 500 });
    }
    throw e;
  }

  await auditLog({
    eventType: AuditEventType.DATA_ACCESS,
    severity: AuditSeverity.LOW,
    userId: context.userId,
    organizationId: context.organizationId,
    resource: 'cognition_precedent',
    resourceId: body.forCaseId,
    action: 'search',
    details: { matchCount: result.matches.length, candidateCount: candidateRows.length },
    outcome: 'success',
  });

  return NextResponse.json({
    result,
    governance: {
      autoApplied: false,
      humanOverrideRequired: true,
      orgScopeEnforced: true,
    },
  });
});
