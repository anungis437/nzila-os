/**
 * Case Intake API — POST /api/cases/intake
 * 
 * Server-side validated case creation with CUPE vocabulary enforcement
 * and audit trail logging.
 *
 * PR-020: Intake Hardening + Validation + Audit Completion
 */

import { NextResponse } from 'next/server';
import { createPlatformNarProofAdapter } from '@/lib/audit/platform-nar-proof';
import { auth } from '@nzila/platform-auth/entra/server';
import { validateIntakeRequest } from '@nzila/cupe-vocabulary';
import { getCaseTypeById } from '@nzila/cupe-vocabulary';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { createClaim, getClaimsByMember } from '@/db/queries/claims-queries';
import { requireCaseFilingCapacity, caseAuthorizationResponse } from '@/lib/cases/case-authorization';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { logger } from '@/lib/logger';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import { buildUnionEvidencePack } from '@/lib/evidence';
import { eventBus, AppEvents } from '@/lib/events';
import '@/lib/events/pilot-event-listeners';
import { createHash } from 'crypto';
import { claims } from '@/db/schema/claims-schema';
import { eq, and } from 'drizzle-orm';
import { getOrganizationIdForUser } from '@/lib/organization-utils';
import { incidentInstant } from '@/lib/cases/incident-instant';
import { enforceDecision, type DecisionProofAdapter } from '@nzila/decision-core';
import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap';
import { canonicalNarProofAdapter, createCanonicalNarProofAdapter } from '@/lib/audit/canonical-nar-proof';
import { getCanonicalOrganizationContext } from '@/lib/auth/canonical-context';
import { ensureOwnDirectoryProfile } from '@/lib/members/own-directory-profile';

export const dynamic = 'force-dynamic';

const narProofAdapter = createPlatformNarProofAdapter();

/**
 * One canonical organization binding for the whole intake. The filing transaction takes the member's per-principal case-mail
 * authority lock; any step inside it that opened a fresh binding (the canonical evidence pack resolves the actor) would insert a
 * session row behind that same lock and wait on its own transaction. Establishing the binding first means every nested step
 * reuses it. When no binding can be established the handler runs exactly as before and returns its own refusal.
 */
export async function POST(request: Request) {
  if (!currentStateContextEnabled()) return handleIntake(request);
  const { withCanonicalApiContext } = await import('@/lib/auth/canonical-context');
  let established = false;
  try {
    return await withCanonicalApiContext(() => {
      established = true;
      return handleIntake(request);
    });
  } catch (error) {
    // handleIntake never throws (it answers every failure itself), so this is the binding refusing to establish.
    if (established) throw error;
    return handleIntake(request);
  }
}

async function handleIntake(request: Request) {
  try {
    // 1. Auth check
    const { userId, identityProvider, providerSubject } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'AUTH_REQUIRED', message: 'Authentication required.' },
        { status: 401 },
      );
    }
    const orgId = await getOrganizationIdForUser(userId);
    await requireEntitlement(orgId, 'grievance_case_suite');

    // 2. Parse body
    let body: any;
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
    const canonical = currentStateContextEnabled();
    {
      // Self-service intake always files for the authenticated member, in every deployment mode. The client may still
      // send its verified Entra object id; a caller-supplied member id can never select another principal.
      const ownEntraObjectId = identityProvider === 'entra'
        ? providerSubject?.split(':')[1] : undefined;
      if (data.memberId !== userId && (!ownEntraObjectId || data.memberId !== ownEntraObjectId)) {
        return NextResponse.json({ error: 'MEMBER_IDENTITY_MISMATCH',
          message: 'Self-service intake must use the authenticated member.' }, { status: 403 });
      }
      data.memberId = userId;
    }
    const proofAdapter = canonical ? canonicalNarProofAdapter : narProofAdapter;
    const decideIntake = (resourceId: string, adapter: DecisionProofAdapter = proofAdapter) => enforceDecision({
      decisionType: 'union.grievance.intake.submitted', organizationId: orgId, resourceId,
      actor: { id: userId, type: 'user', authorityScope: ['grievance:create'] },
      authorityScope: ['grievance:create'],
      input: { memberId: data.memberId, caseType: data.caseType, incidentDate: data.incidentDate,
        title: data.title, priority: data.priority },
      policy: { id: 'labour.grievance.intake', version: '1.0.0', domain: 'labour' },
      actionType: 'claim:intake', proofAdapter: adapter, emitAuditPayload: true,
    });

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
    const directoryContact = canonical
      ? await getCanonicalOrganizationContext({ expectedActorUserId: userId, organizationId: orgId }) : null;

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
      if (found && directoryContact) await ensureOwnDirectoryProfile(tx, directoryContact);
      return found ?? null;
    });

    if (existingCheck) {
      const duplicateDecision = await decideIntake(existingCheck.claimId);

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

    const preflightDecision = await decideIntake('pending');

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
    const { claim, canonicalDecision } = await withRLSContext(async (tx) => {
      // Filing is open to any active member of the organization; it opens a case for themselves and grants nothing else.
      await requireCaseFilingCapacity(tx, { userId, organizationId: orgId }, 'member');
      if (directoryContact) await ensureOwnDirectoryProfile(tx, directoryContact);
      const newClaim = await createClaim(
        {
          organizationId: orgId,
          memberId: data.memberId,
          claimType: mapCaseTypeToClaimType(data.caseType),
          priority: data.priority as 'low' | 'medium' | 'high' | 'critical',
          description: data.description,
          incidentDate: incidentInstant(data.incidentDate),
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
      const canonicalDecision = canonical
        ? await decideIntake(newClaim.claimId, createCanonicalNarProofAdapter(tx)) : null;
      if (canonicalDecision && !canonicalDecision.allowed) throw new Error('UE_INTAKE_DECISION_REJECTED');
      // The claim and this record commit together. A failed audit rolls the intake back.
      await persistAtomicAudit(tx, {
        organizationId: orgId,
        userId,
        // The database requires every new case's creation audit (ue_check_claim_journal_audit): claim.create, in this transaction.
        action: 'claim.create',
        resourceType: 'claims',
        resourceId: newClaim.claimId,
        details: {
          event: 'CASE_INTAKE_SUBMITTED',
          route: '/api/cases/intake',
          caseType: data.caseType,
          priority: data.priority,
          severity,
          title: data.title,
          isAnonymous: data.isAnonymous,
        },
      });
      // Canonical sealing shares the live claim transaction; failures roll back the
      // case, decision proof and audit instead of leaving a successful orphan intake.
      if (canonical) await buildUnionEvidencePack({
        actionType: 'CASE_INTAKE_SUBMITTED', orgId, actorId: userId,
        artifacts: [{ type: 'case_intake', data: { claimId: newClaim.claimId,
          claimNumber: newClaim.claimNumber, caseType: data.caseType, severity } }],
      });
      return { claim: newClaim, canonicalDecision };
    });

    logger.info('Case intake submitted', {
      claimId: claim.claimId,
      claimNumber: claim.claimNumber,
      caseType: data.caseType,
      priority: data.priority,
    });

    // Evidence: tamper-proof case intake trail
    if (!canonical) buildUnionEvidencePack({
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

    const recordedDecision = canonicalDecision ?? await decideIntake(claim.claimId);

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
    const refused = caseAuthorizationResponse(error);
    if (refused) return refused;
    // An organization without the module is refused, not reported as a server fault.
    if ((error as { code?: unknown } | null)?.code === 'ENTITLEMENT_REQUIRED') {
      return NextResponse.json({ error: 'ENTITLEMENT_REQUIRED', message: 'Module access denied' }, { status: 403 });
    }
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
  return (mapping[cupeType] ?? 'other') as any;
}
