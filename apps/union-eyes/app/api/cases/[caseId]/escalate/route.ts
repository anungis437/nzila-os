/**
 * POST /api/cases/[caseId]/escalate
 *
 * Escalate a claim to a formal grievance — creates a linked grievance record
 * and marks the claim as resolved/escalated.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApi } from '@/lib/api/framework';
import { claims } from '@/db/schema';
import { grievances } from '@/db/schema/domains/claims/grievances';
import { grievanceEvents } from '@/db/schema/domains/claims/grievance-lifecycle';
import { eq, and } from 'drizzle-orm';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { updateClaimStatusById } from '@/lib/workflow-engine';
import { enforceDecision } from '@nzila/decision-core';
import { createNarProofAdapter, getNarSigningSecret } from '@nzila/nar';
import { platformDb } from '@nzila/db/platform';
import { auditRecords } from '@nzila/db/schema';
import { desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const narProofAdapter = createNarProofAdapter({
  keyId: process.env.NAR_SIGNING_KEY_ID,
  getPreviousHash: async (organizationId) => {
    const rows = await platformDb
      .select({ hash: auditRecords.narHash })
      .from(auditRecords)
      .where(eq(auditRecords.organizationId, organizationId))
      .orderBy(desc(auditRecords.createdAt))
      .limit(1);
    return rows[0]?.hash;
  },
  persistRecord: async (record) => {
    await platformDb.insert(auditRecords).values({
      id: record.id,
      decisionRecordId: record.decisionRecordId,
      organizationId: record.organizationId,
      decisionType: record.decisionType,
      actionType: record.actionType,
      actorId: record.actorId,
      actorType: record.actorType,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      policyId: record.policyId,
      policyVersion: record.policyVersion,
      inputHash: record.inputHash,
      outcomeHash: record.outcomeHash,
      payload: record.payload,
      narHash: record.seal.hash,
      narSignature: record.seal.signature,
      previousHash: record.seal.previousHash,
      keyId: record.seal.keyId,
      storageType: record.storage?.type,
      storageUri: record.storage?.uri,
      immutable: record.storage?.immutable,
      retentionUntil: record.storage?.retentionUntil ? new Date(record.storage.retentionUntil) : null,
      createdAt: new Date(record.createdAt),
    });
    return { auditRecordId: record.id };
  },
  getSigningSecret: getNarSigningSecret,
});

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

    if (!ctx.organizationId) {
      return NextResponse.json(
        { success: false, error: 'Organization context required' },
        { status: 403 },
      );
    }

    // Fetch the claim (org-scoped + RLS)
    const [claim] = await withRLSContext(async (tx) =>
      tx
        .select()
        .from(claims)
        .where(and(eq(claims.claimId, caseId), eq(claims.organizationId, ctx.organizationId!)))
        .limit(1)
    );

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

    const preflightDecision = await enforceDecision({
      decisionType: 'union.case.escalated',
      organizationId: orgId,
      resourceId: caseId,
      actor: {
        id: ctx.userId ?? 'system',
        type: 'user',
        role: 'steward',
        authorityScope: ['case:escalate'],
      },
      authorityScope: ['case:escalate'],
      input: {
        caseId,
        reason: notes ?? 'escalated_to_grievance',
      },
      policy: {
        id: 'labour.case.escalation',
        version: '1.0.0',
        domain: 'labour',
      },
      actionType: 'case:escalate',
      proofAdapter: narProofAdapter,
      emitAuditPayload: true,
    });

    if (!preflightDecision.allowed) {
      return NextResponse.json(
        { success: false, error: 'Decision validation failed', decision: preflightDecision.decision },
        { status: 422 },
      );
    }

    // Create the grievance
    const escalationResult = await withRLSContext(async (tx) => {
      const [g] = await tx
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
      await tx.insert(grievanceEvents).values({
        grievanceId: g.id,
        eventType: 'created',
        actorUserId: ctx.userId ?? '',
        notes: `Escalated from case ${claim.claimNumber ?? caseId}. ${notes ?? ''}`.trim(),
      });

      const transitionResult = await updateClaimStatusById(
        caseId,
        'resolved',
        ctx.userId ?? 'system',
        notes ?? 'Escalated to formal grievance',
        tx,
      );

      if (!transitionResult.success) {
        return {
          success: false as const,
          error: transitionResult.error ?? 'Escalation requires a valid FSM transition to resolved',
        };
      }

      // Store the link in the claim's metadata
      const existingMeta = (claim.metadata as Record<string, unknown>) ?? {};
      await tx
        .update(claims)
        .set({
          resolutionOutcome: 'escalated_to_grievance',
          updatedAt: new Date(),
          metadata: {
            ...existingMeta,
            escalatedGrievanceId: g.id,
            escalatedGrievanceNumber: g.grievanceNumber,
          },
        })
        .where(eq(claims.claimId, caseId));

      return { success: true as const, grievance: g };
    });

    if (!escalationResult.success) {
      return NextResponse.json(
        { success: false, error: escalationResult.error },
        { status: 422 },
      );
    }

    const grievance = escalationResult.grievance;

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

    const recordedDecision = await enforceDecision({
      decisionType: 'union.case.escalated',
      organizationId: orgId,
      resourceId: caseId,
      actor: {
        id: ctx.userId ?? 'system',
        type: 'user',
        role: 'steward',
        authorityScope: ['case:escalate'],
      },
      authorityScope: ['case:escalate'],
      input: {
        caseId,
        reason: notes ?? 'escalated_to_grievance',
      },
      policy: {
        id: 'labour.case.escalation',
        version: '1.0.0',
        domain: 'labour',
      },
      actionType: 'case:escalate',
      proofAdapter: narProofAdapter,
      emitAuditPayload: true,
    });

    return {
      claim: { claimId: caseId, status: 'resolved', resolutionOutcome: 'escalated_to_grievance' },
      grievance: {
        id: grievance.id,
        grievanceNumber: grievance.grievanceNumber,
        status: grievance.status,
        type: grievance.type,
      },
      decision: recordedDecision.decision,
    };
  },
);
