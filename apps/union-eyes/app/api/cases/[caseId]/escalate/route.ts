/**
 * POST /api/cases/[caseId]/escalate
 *
 * Escalate a claim to a formal grievance — creates a linked grievance record
 * and marks the claim as resolved/escalated.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { claims } from '@/db/schema';
import { grievances } from '@/db/schema/domains/claims/grievances';
import { grievanceEvents } from '@/db/schema/domains/claims/grievance-lifecycle';
import { eq } from 'drizzle-orm';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';

export const dynamic = 'force-dynamic';

/** Map claim types to grievance types */
const claimTypeToGrievanceType: Record<string, string> = {
  grievance_discipline: 'discipline',
  grievance_pay: 'individual',
  grievance_schedule: 'individual',
  grievance_benefits: 'individual',
  grievance_leave: 'individual',
  workplace_safety: 'safety',
  discrimination_age: 'discrimination',
  discrimination_gender: 'discrimination',
  discrimination_race: 'discrimination',
  discrimination_disability: 'discrimination',
  discrimination_other: 'discrimination',
  harassment_sexual: 'harassment',
  harassment_workplace: 'harassment',
  harassment_verbal: 'harassment',
  harassment_physical: 'harassment',
  wage_dispute: 'contract',
  contract_dispute: 'contract',
  retaliation: 'discipline',
  wrongful_termination: 'termination',
  other: 'other',
};

const escalateSchema = z.object({
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  notes: z.string().max(2000).optional(),
  cbaArticle: z.string().max(100).optional(),
});

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Cases'],
      summary: 'Escalate a claim to a formal grievance',
      description:
        'Creates a linked grievance record from an existing claim and marks the claim as resolved.',
    },
  },
  async (ctx) => {
    const caseId = ctx.params.caseId;
    if (!caseId) {
      return NextResponse.json(
        { success: false, error: 'Missing case ID' },
        { status: 400 },
      );
    }

    const body = await ctx.request.json();
    const parsed = escalateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // Fetch the claim
    const [claim] = await db
      .select()
      .from(claims)
      .where(eq(claims.claimId, caseId))
      .limit(1);

    if (!claim) {
      return NextResponse.json(
        { success: false, error: 'Claim not found' },
        { status: 404 },
      );
    }

    if (claim.status === 'resolved' || claim.status === 'closed') {
      return NextResponse.json(
        { success: false, error: 'Claim is already resolved or closed' },
        { status: 400 },
      );
    }

    const { priority, notes, cbaArticle } = parsed.data;
    const grievanceType = claimTypeToGrievanceType[claim.claimType ?? 'other'] ?? 'other';
    const orgId = claim.organizationId ?? ctx.organizationId ?? '';

    // Create the grievance
    const [grievance] = await db
      .insert(grievances)
      .values({
        grievanceNumber: `GRV-${Date.now()}`,
        type: grievanceType as 'individual',
        title: claim.description?.substring(0, 500) ?? 'Escalated from case queue',
        description: claim.description ?? '',
        priority: (priority ?? claim.priority ?? 'medium') as 'medium',
        status: 'filed',
        grievantId: claim.memberId ? undefined : undefined,
        grievantName: claim.memberId ?? undefined,
        incidentDate: claim.incidentDate,
        filedDate: new Date(),
        cbaArticle: cbaArticle ?? undefined,
        organizationId: orgId,
        createdBy: ctx.userId ?? undefined,
        relatedGrievanceIds: undefined,
      })
      .returning();

    // Insert lifecycle event
    await db.insert(grievanceEvents).values({
      grievanceId: grievance.id,
      eventType: 'created',
      actorUserId: ctx.userId ?? '',
      notes: `Escalated from case ${claim.claimNumber ?? caseId}. ${notes ?? ''}`.trim(),
    });

    // Store the link in the claim's metadata
    const existingMeta = (claim.metadata as Record<string, unknown>) ?? {};
    await db
      .update(claims)
      .set({
        status: 'resolved',
        resolutionOutcome: 'escalated_to_grievance',
        resolvedAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          ...existingMeta,
          escalatedGrievanceId: grievance.id,
          escalatedGrievanceNumber: grievance.grievanceNumber,
        },
      })
      .where(eq(claims.claimId, caseId));

    // Audit
    await auditLog({
      eventType: AuditEventType.DATA_CREATE,
      severity: AuditSeverity.HIGH,
      userId: ctx.userId ?? '',
      organizationId: orgId,
      resource: 'claims',
      action: 'escalate_to_grievance',
      resourceId: caseId,
      details: {
        claimNumber: claim.claimNumber,
        grievanceId: grievance.id,
        grievanceNumber: grievance.grievanceNumber,
      },
      outcome: 'success',
    });

    return {
      claim: { claimId: caseId, status: 'resolved', resolutionOutcome: 'escalated_to_grievance' },
      grievance: {
        id: grievance.id,
        grievanceNumber: grievance.grievanceNumber,
        status: grievance.status,
        type: grievance.type,
      },
    };
  },
);
