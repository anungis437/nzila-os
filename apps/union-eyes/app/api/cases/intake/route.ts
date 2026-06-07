/**
 * Case Intake API — POST /api/cases/intake
 * 
 * Server-side validated case creation with CUPE vocabulary enforcement
 * and audit trail logging.
 *
 * PR-020: Intake Hardening + Validation + Audit Completion
 */

import { NextResponse } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';
import { validateIntakeRequest } from '@nzila/cupe-vocabulary';
import { getCaseTypeById } from '@nzila/cupe-vocabulary';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { createClaim, getClaimsByMember } from '@/db/queries/claims-queries';
import { auditDataMutation } from '@/lib/audit-logger';
import { logger } from '@/lib/logger';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import { buildUnionEvidencePack } from '@/lib/evidence';
import { eventBus, AppEvents } from '@/lib/events';
import '@/lib/events/pilot-event-listeners';
import { createHash } from 'crypto';
import { claims } from '@/db/schema/claims-schema';
import { eq, and } from 'drizzle-orm';
import { getOrganizationIdForUser } from '@/lib/organization-utils';
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

export async function POST(request: Request) {
  try {
    // 1. Auth check
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'AUTH_REQUIRED', message: 'Authentication required.' },
        { status: 401 },
      );
    }
    const orgId = await getOrganizationIdForUser(userId);
    await requireEntitlement(orgId, 'grievance_case_suite');

    // 2. Parse body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'INVALID_INPUT', message: 'Request body must be valid JSON.' },
        { status: 400 },
      );
    }

    // 3. Validate via CUPE vocabulary schema
    const validation = validateIntakeRequest(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Intake validation failed.',
          details: validation.errors,
        },
        { status: 400 },
      );
    }

    const data = validation.data!;

    // 4. Auto-set severity from case type defaults if not provided
    let severity = data.severity;
    if (!severity) {
      const caseType = getCaseTypeById(data.caseType);
      severity = caseType?.defaultSeverity ?? 'moderate';
    }

    // 4b. Idempotency: org-scoped content-hash deduplication
    // orgId is included in the hash to prevent cross-org hash collisions
    const idempotencyHash = createHash('sha256')
      .update(`${orgId}|${data.memberId}|${data.caseType}|${data.incidentDate}|${data.title}`)
      .digest('hex');

    // 4c. Org-scoped duplicate check — runs inside withRLSContext to ensure
    //     RLS policies are active and cross-org leakage is impossible.
    const existingCheck = await withRLSContext(async (tx) => {
      const [found] = await tx
        .select({ claimId: claims.claimId, claimNumber: claims.claimNumber })
        .from(claims)
        .where(
          and(
            eq(claims.idempotencyHash, idempotencyHash),
            eq(claims.organizationId, orgId),
          ),
        )
        .limit(1);
      return found ?? null;
    });

    if (existingCheck) {
      const duplicateDecision = await enforceDecision({
        decisionType: 'union.grievance.intake.submitted',
        organizationId: orgId,
        resourceId: existingCheck.claimId,
        actor: {
          id: userId,
          type: 'user',
          authorityScope: ['grievance:create'],
        },
        authorityScope: ['grievance:create'],
        input: {
          memberId: data.memberId,
          caseType: data.caseType,
          incidentDate: data.incidentDate,
          title: data.title,
          priority: data.priority,
        },
        policy: {
          id: 'labour.grievance.intake',
          version: '1.0.0',
          domain: 'labour',
        },
        actionType: 'claim:intake',
        proofAdapter: narProofAdapter,
        emitAuditPayload: true,
      });

      return NextResponse.json(
        {
          success: true,
          claimId: existingCheck.claimId,
          claimNumber: existingCheck.claimNumber,
          status: 'duplicate',
          message: 'A case with identical details already exists.',
          decision: duplicateDecision.decision,
        },
        { status: 200 },
      );
    }

    const preflightDecision = await enforceDecision({
      decisionType: 'union.grievance.intake.submitted',
      organizationId: orgId,
      resourceId: 'pending',
      actor: {
        id: userId,
        type: 'user',
        authorityScope: ['grievance:create'],
      },
      authorityScope: ['grievance:create'],
      input: {
        memberId: data.memberId,
        caseType: data.caseType,
        incidentDate: data.incidentDate,
        title: data.title,
        priority: data.priority,
      },
      policy: {
        id: 'labour.grievance.intake',
        version: '1.0.0',
        domain: 'labour',
      },
      actionType: 'claim:intake',
      proofAdapter: narProofAdapter,
      emitAuditPayload: true,
    });

    if (!preflightDecision.allowed) {
      return NextResponse.json(
        {
          error: 'DECISION_VALIDATION_FAILED',
          message: 'Decision validation failed before case creation.',
          decision: preflightDecision.decision,
        },
        { status: 422 },
      );
    }

    // 5. Create claim with RLS context (audit inside transaction for atomicity)
    const claim = await withRLSContext(async (tx) => {
      const newClaim = await createClaim(
        {
          organizationId: orgId,
          memberId: data.memberId,
          claimType: mapCaseTypeToClaimType(data.caseType),
          priority: data.priority as 'low' | 'medium' | 'high' | 'critical',
          description: data.description,
          incidentDate: new Date(data.incidentDate),
          location: data.location,
          desiredOutcome: data.desiredOutcome ?? '',
          isAnonymous: data.isAnonymous,
          witnessDetails: data.witnesses ?? null,
          witnessesPresent: Boolean(data.witnesses),
          status: 'submitted',
          idempotencyHash,
          metadata: {
            title: data.title,
            severity,
            intake_validated: true,
            intake_version: '2.0',
          },
        },
        tx,
      );
      return newClaim;
    });

    // 6. Audit trail (outside transaction — non-critical path, never throws)
    await auditDataMutation({
      userId,
      organizationId: orgId,
      resource: 'claims',
      resourceId: claim.claimId,
      action: 'create',
      details: {
        event: 'CASE_INTAKE_SUBMITTED',
        caseType: data.caseType,
        priority: data.priority,
        severity,
        title: data.title,
        isAnonymous: data.isAnonymous,
      },
    });

    logger.info('Case intake submitted', {
      claimId: claim.claimId,
      claimNumber: claim.claimNumber,
      caseType: data.caseType,
      priority: data.priority,
    });

    // Evidence: tamper-proof case intake trail
    buildUnionEvidencePack({
      actionType: 'CASE_INTAKE_SUBMITTED',
      orgId: orgId,
      actorId: userId,
      artifacts: [{ type: 'case_intake', data: { claimId: claim.claimId, claimNumber: claim.claimNumber, caseType: data.caseType, severity } }],
    }).catch((err) => logger.warn('Evidence pack failed', { error: String(err), actionType: 'CASE_INTAKE_SUBMITTED' }))

    // 7. Pilot observability: emit case-created event
    const memberClaims = await getClaimsByMember(data.memberId, orgId).catch(() => []);
    eventBus.emit(AppEvents.CLAIM_CREATED, {
      claimId: claim.claimId,
      organizationId: orgId,
      createdBy: userId,
      type: data.caseType,
      isFirst: memberClaims.length <= 1,
    }, { organizationId: orgId, userId });

    const recordedDecision = await enforceDecision({
      decisionType: 'union.grievance.intake.submitted',
      organizationId: orgId,
      resourceId: claim.claimId,
      actor: {
        id: userId,
        type: 'user',
        authorityScope: ['grievance:create'],
      },
      authorityScope: ['grievance:create'],
      input: {
        memberId: data.memberId,
        caseType: data.caseType,
        incidentDate: data.incidentDate,
        title: data.title,
        priority: data.priority,
      },
      policy: {
        id: 'labour.grievance.intake',
        version: '1.0.0',
        domain: 'labour',
      },
      actionType: 'claim:intake',
      proofAdapter: narProofAdapter,
      emitAuditPayload: true,
    });

    return NextResponse.json(
      {
        success: true,
        claimId: claim.claimId,
        claimNumber: claim.claimNumber,
        status: 'submitted',
        decision: recordedDecision.decision,
      },
      { status: 201 },
    );
  } catch (error) {
    logger.error('Case intake failed', error as Error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
      { status: 500 },
    );
  }
}

/**
 * Map CUPE vocabulary case type IDs to the database claim_type enum values.
 * The DB uses a more granular set; we map the CUPE top-level types to the
 * nearest DB enum value.
 */
function mapCaseTypeToClaimType(
  cupeType: string,
): 'grievance_discipline' | 'grievance_schedule' | 'grievance_pay' | 'workplace_safety' |
   'discrimination_age' | 'discrimination_gender' | 'discrimination_race' |
   'discrimination_disability' | 'discrimination_other' |
   'harassment_sexual' | 'harassment_workplace' | 'wage_dispute' |
   'contract_dispute' | 'retaliation' | 'wrongful_termination' | 'other' |
   'harassment_verbal' | 'harassment_physical' {
  const mapping: Record<string, string> = {
    discipline: 'grievance_discipline',
    harassment: 'harassment_workplace',
    discrimination: 'discrimination_other',
    wage_dispute: 'wage_dispute',
    benefits_denial: 'grievance_pay',
    recall_rehire: 'wrongful_termination',
    safety: 'workplace_safety',
    contracting: 'contract_dispute',
    dues: 'grievance_pay',
    other: 'other',
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (mapping[cupeType] ?? 'other') as unknown;
}
