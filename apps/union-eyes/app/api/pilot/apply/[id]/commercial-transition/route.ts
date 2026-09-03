import { NextResponse, type NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  billingAccounts,
  commercialContracts,
  orgSubscriptions,
  pilotApplications,
  platformInvoiceLineItems,
  platformInvoices,
  subscriptionPlans,
} from '@/db/schema';
import { withApiAuth, hasMinRole } from '@/lib/api-auth-guard';
import { authorizePilotAccess, getPilotClaimedOrganizationId, getPilotVerifiedOrganizationId } from '@/lib/pilot/pilot-ownership';
import {
  buildPilotArtifactVersionRecord,
  COMMERCIAL_STATE_ORDER,
  buildProposalPackage,
  inferPilotStatusFromCommercialState,
  isCommercialTransitionAllowed,
  normalizeCommercialState,
  type CommercialState,
} from '@/lib/pilot/commercialization-wave1';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type TransitionPayload = {
  targetState?: string;
  reason?: string;
  source?: string;
  allowSkip?: boolean;
  /**
   * Generic reference-template key. The operational package intentionally
   * carries no customer-specific reference templates; any value provided here
   * is rejected below to keep the operational surface free of demo fixtures.
   */
  applyReferenceTemplate?: string | null;
};

function parseTargetState(value: any): CommercialState | null {
  if (typeof value !== 'string') return null;
  if (!COMMERCIAL_STATE_ORDER.includes(value as CommercialState)) return null;
  return value as CommercialState;
}

function parsePriceBandLowerBound(amountBand: string): string {
  const firstSegment = amountBand.split('-')[0]?.trim() ?? '0';
  const raw = firstSegment.replace(/[$,]/g, '').toUpperCase();
  const multiplier = raw.endsWith('K') ? 1000 : 1;
  const numeric = Number(raw.replace('K', ''));
  if (!Number.isFinite(numeric) || numeric <= 0) return '5000.00';
  return (numeric * multiplier).toFixed(2);
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function buildContractNumber(applicationId: string): string {
  return `PILOT-${applicationId.slice(0, 8).toUpperCase()}`;
}

function buildInvoiceNumber(applicationId: string): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `PILOT-INV-${stamp}-${applicationId.slice(0, 6).toUpperCase()}`;
}

export const POST = withApiAuth(async (request: NextRequest, context?: { params?: Promise<{ id: string }> | { id: string } }) => {
  try {
    // Round 19: this route requires platform-tier authority (see the
    // authorizePilotAccess check below) — check the same tier here, before
    // touching the database at all, so an under-authorized caller gets a
    // uniform 403 regardless of whether the pilot id exists.
    const canAccess = await hasMinRole('system_admin');
    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rawParams = context?.params ? await context.params : undefined;
    const id = rawParams?.id;

    if (!id) {
      return NextResponse.json({ error: 'Pilot application id is required' }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as TransitionPayload;
    const targetState = parseTargetState(body.targetState);

    if (!targetState) {
      return NextResponse.json({ error: 'A valid targetState is required' }, { status: 400 });
    }

    const [application] = await withSystemContext((_tx) =>
      db
        .select()
        .from(pilotApplications)
        .where(and(eq(pilotApplications.id, id))),
    );

    if (!application) {
      return NextResponse.json({ error: 'Pilot application not found' }, { status: 404 });
    }

    // PR #752 round 19: `responses.organizationId` (read below via
    // getPilotClaimedOrganizationId) is an unauthenticated client claim, not
    // server-verified ownership — see that function's doc comment in
    // lib/pilot/pilot-ownership.ts. This route creates REAL financial
    // records (commercialContracts / billingAccounts / orgSubscriptions /
    // platformInvoices) keyed by that claimed org id, so ordinary same-org
    // self-service is not sufficient authority here: only an independent
    // platform-tier decision (system_admin+, per authorizePilotAccess's
    // 'platform' branch) counts as verification for a billing-mutating
    // operation. Same-org actors are correctly authorized to VIEW/manage
    // their own pilot elsewhere (e.g. the [id] CRUD route), just not to
    // drive commercial-transition.
    const decision = await authorizePilotAccess(getPilotClaimedOrganizationId(application));
    if (!decision.ok) {
      return NextResponse.json(
        { error: decision.status === 401 ? 'Unauthorized' : 'Forbidden' },
        { status: decision.status },
      );
    }
    if (decision.reason !== 'platform') {
      return NextResponse.json(
        { error: 'Commercial transitions require platform-tier review; the claimed organization on a pilot application is not sufficient authority for billing operations.' },
        { status: 403 },
      );
    }

    // PR #752 round 20: `responses.organizationId` (the CLAIM) must never be
    // used for billing — only the server-controlled `verifiedOrganizationId`
    // column, set exclusively by POST .../verify-organization after an
    // independent platform-tier confirmation (see bindPilotOrganization's
    // doc comment in lib/pilot/pilot-ownership.ts). A platform reviewer
    // approving this transition does NOT, by itself, confirm that the
    // claimed organization is the real organization behind this
    // application — that confirmation must happen explicitly and be
    // persisted (who verified it, and when) before any financial record can
    // be created from it.
    const verifiedOrganizationId = getPilotVerifiedOrganizationId(application);
    if (!verifiedOrganizationId) {
      return NextResponse.json(
        {
          error: 'This pilot application\'s organization has not been verified. Call POST /api/pilot/apply/[id]/verify-organization before commercial transition.',
        },
        { status: 409 },
      );
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const responses = { ...((application.responses ?? {}) as Record<string, unknown>) };
    const fromState = normalizeCommercialState(responses.commercialState);

    if (!body.allowSkip && !isCommercialTransitionAllowed(fromState, targetState)) {
      return NextResponse.json(
        {
          error: `Invalid transition: ${fromState} -> ${targetState}. Only adjacent transitions are allowed.`,
          data: {
            fromState,
            targetState,
            allowedNext: COMMERCIAL_STATE_ORDER[COMMERCIAL_STATE_ORDER.indexOf(fromState) + 1] ?? fromState,
            allowedPrevious: COMMERCIAL_STATE_ORDER[COMMERCIAL_STATE_ORDER.indexOf(fromState) - 1] ?? fromState,
          },
        },
        { status: 400 },
      );
    }

    if (body.applyReferenceTemplate) {
      // Operational package MUST NOT ship customer-specific reference-template
      // fixtures. The demo package (@nzila/union-eyes-demo) owns those.
      return NextResponse.json(
        { error: 'applyReferenceTemplate is not accepted by the operational application' },
        { status: 400 },
      );
    }

    const proposal = buildProposalPackage(
      {
        id: application.id,
        organizationName: application.organizationName,
        organizationType: application.organizationType as 'local' | 'regional' | 'national',
        contactName: application.contactName,
        contactEmail: application.contactEmail,
        memberCount: application.memberCount,
        jurisdictions: application.jurisdictions ?? [],
        sectors: application.sectors ?? [],
        currentSystem: application.currentSystem,
        challenges: application.challenges ?? [],
        goals: application.goals ?? [],
        readinessScore: application.readinessScore,
      },
      {
        commercialState: targetState,
        championScore: typeof responses.championScore === 'number' ? responses.championScore : undefined,
        activityScore: typeof responses.activityScore === 'number' ? responses.activityScore : undefined,
      },
    );

    const monetization: {
      notes: string[];
      contractId?: string;
      invoiceId?: string;
      subscriptionId?: string;
    } = { notes: [] };

    await withSystemContext(async () =>
      db.transaction(async (tx) => {
      // Verified above — never `responses.organizationId` (the claim).
      const organizationId = verifiedOrganizationId;

      let billingAccountId: string | null = null;

      if (organizationId) {
        const [billingAccount] = await tx
          .select({ id: billingAccounts.id })
          .from(billingAccounts)
          .where(eq(billingAccounts.organizationId, organizationId));

        billingAccountId = billingAccount?.id ?? null;

        if (!billingAccountId) {
          monetization.notes.push('No billing account found; monetization side effects were staged only.');
        }
      } else {
        monetization.notes.push('No organizationId provided in pilot responses; monetization side effects were staged only.');
      }

      const contractNumber = buildContractNumber(application.id);
      const pilotAmount = parsePriceBandLowerBound(proposal.economicsTier.targetPriceRange);

      if (targetState === 'contract_sent' && organizationId && billingAccountId) {
        const [existingContract] = await tx
          .select({ id: commercialContracts.id })
          .from(commercialContracts)
          .where(eq(commercialContracts.contractNumber, contractNumber));

        if (existingContract) {
          monetization.contractId = existingContract.id;
        } else {
          const [newContract] = await tx
            .insert(commercialContracts)
            .values({
              organizationId,
              billingAccountId,
              contractNumber,
              name: `${application.organizationName} 90-day pilot`,
              description: 'Commercialization Wave 1 pilot contract',
              status: 'pending_approval',
              effectiveDate: now,
              expirationDate: addDays(now, 90),
              totalContractValue: pilotAmount,
              currency: 'CAD',
              metadata: {
                source: 'pilot-commercial-transition',
                pilotApplicationId: application.id,
              },
            })
            .returning({ id: commercialContracts.id });

          monetization.contractId = newContract?.id;
        }
      }

      if (targetState === 'contract_signed' && organizationId && billingAccountId) {
        const [existingContract] = await tx
          .select({ id: commercialContracts.id })
          .from(commercialContracts)
          .where(eq(commercialContracts.contractNumber, contractNumber));

        if (existingContract) {
          await tx
            .update(commercialContracts)
            .set({
              status: 'active',
              signedAt: now,
              updatedAt: now,
            })
            .where(eq(commercialContracts.id, existingContract.id));

          monetization.contractId = existingContract.id;
        } else {
          monetization.notes.push('No draft contract found to sign; staged only.');
        }
      }

      if (targetState === 'invoice_issued' && organizationId && billingAccountId) {
        const invoiceNumber = buildInvoiceNumber(application.id);

        const [invoice] = await tx
          .insert(platformInvoices)
          .values({
            billingAccountId,
            organizationId,
            invoiceNumber,
            issueDate: now,
            dueDate: addDays(now, 30),
            subtotal: pilotAmount,
            taxAmount: '0.00',
            totalAmount: pilotAmount,
            amountPaid: '0.00',
            currency: 'CAD',
            status: 'issued',
            notes: 'Pilot commercialization invoice',
            metadata: {
              source: 'pilot-commercial-transition',
              pilotApplicationId: application.id,
            },
          })
          .returning({ id: platformInvoices.id });

        if (invoice?.id) {
          await tx.insert(platformInvoiceLineItems).values({
            invoiceId: invoice.id,
            description: '90-day pilot program',
            costType: 'pilot_fee',
            quantity: '1',
            unitPrice: pilotAmount,
            amount: pilotAmount,
            currency: 'CAD',
            metadata: {
              source: 'pilot-commercial-transition',
              pilotApplicationId: application.id,
            },
          });

          monetization.invoiceId = invoice.id;
        }
      }

      if (targetState === 'subscription_active' && organizationId && billingAccountId) {
        const explicitPlanId = typeof responses.subscriptionPlanId === 'string' ? responses.subscriptionPlanId : null;

        let selectedPlanId = explicitPlanId;
        if (!selectedPlanId) {
          const [fallbackPlan] = await tx
            .select({ id: subscriptionPlans.id })
            .from(subscriptionPlans)
            .where(eq(subscriptionPlans.isActive, true));
          selectedPlanId = fallbackPlan?.id ?? null;
        }

        if (!selectedPlanId) {
          monetization.notes.push('No active subscription plan found; subscription activation staged only.');
        } else {
          const [existingSubscription] = await tx
            .select({ id: orgSubscriptions.id })
            .from(orgSubscriptions)
            .where(and(eq(orgSubscriptions.organizationId, organizationId), eq(orgSubscriptions.planId, selectedPlanId)));

          if (existingSubscription) {
            await tx
              .update(orgSubscriptions)
              .set({ status: 'active', updatedAt: now })
              .where(eq(orgSubscriptions.id, existingSubscription.id));
            monetization.subscriptionId = existingSubscription.id;
          } else {
            const [subscription] = await tx
              .insert(orgSubscriptions)
              .values({
                billingAccountId,
                planId: selectedPlanId,
                organizationId,
                status: 'active',
                startDate: now,
                metadata: {
                  source: 'pilot-commercial-transition',
                  pilotApplicationId: application.id,
                },
              })
              .returning({ id: orgSubscriptions.id });

            monetization.subscriptionId = subscription?.id;
          }
        }
      }

      const transitionHistory = Array.isArray(responses.commercialTransitionHistory)
        ? [...(responses.commercialTransitionHistory as any[])]
        : [];

      transitionHistory.push({
        at: nowIso,
        from: fromState,
        to: targetState,
        reason: body.reason ?? null,
        source: body.source ?? 'admin-ui',
      });

      responses.commercialTransitionHistory = transitionHistory;
      responses.commercialState = targetState;
      responses.commercialStateUpdatedAt = nowIso;
      const pilotIntelligence =
        typeof responses.pilotIntelligence === 'object' && responses.pilotIntelligence
          ? ({ ...(responses.pilotIntelligence as Record<string, unknown>) } as Record<string, unknown>)
          : {};
      const interactionTimeline = Array.isArray(pilotIntelligence.interactionTimeline)
        ? [...pilotIntelligence.interactionTimeline]
        : [];
      interactionTimeline.push({
        at: nowIso,
        type: 'commercial_transition',
        value: {
          from: fromState,
          to: targetState,
          reason: body.reason ?? null,
        },
        source: body.source ?? 'admin-ui',
      });
      pilotIntelligence.interactionTimeline = interactionTimeline;
      pilotIntelligence.updatedAt = nowIso;
      responses.pilotIntelligence = pilotIntelligence;
      responses.pilotFitScore = proposal.qualificationScores.pilotFitScore;
      responses.pilotRiskScore = proposal.qualificationScores.pilotRiskScore;
      responses.pilotRevenueScore = proposal.qualificationScores.pilotRevenueScore;
      responses.pilotReadinessScore = proposal.qualificationScores.pilotReadinessScore;
      responses.pilotStrategicValueScore = proposal.qualificationScores.pilotStrategicValueScore;
      responses.overallOpportunityScore = proposal.qualificationScores.overallOpportunityScore;
      responses.opportunityTier = proposal.qualificationScores.opportunityTier;
      responses.pilotQualificationScores = proposal.qualificationScores;
      const artifactSnapshot = buildPilotArtifactVersionRecord({
        generatedAt: proposal.generatedAt,
        source: body.source ?? 'admin-ui',
        milestone: targetState,
        notes: body.reason,
        commercialState: targetState,
        qualificationScores: proposal.qualificationScores,
        artifacts: proposal.artifacts,
      });
      const existingVersions = Array.isArray(responses.pilotArtifactVersions)
        ? [...responses.pilotArtifactVersions]
        : [];
      const existingSnapshot = existingVersions.find(
        (version) =>
          version &&
          typeof version === 'object' &&
          'checksum' in version &&
          (version as { checksum?: string }).checksum === artifactSnapshot.checksum,
      );
      if (!existingSnapshot) {
        existingVersions.push(artifactSnapshot);
      }
      responses.pilotArtifactVersions = existingVersions;
      responses.latestPilotArtifactVersionId = artifactSnapshot.versionId;
      responses.latestPilotArtifactChecksum = artifactSnapshot.checksum;
      responses.latestPilotArtifactUpdatedAt = proposal.generatedAt;
      responses.commercialMonetization = {
        ...(typeof responses.commercialMonetization === 'object' && responses.commercialMonetization
          ? (responses.commercialMonetization as Record<string, unknown>)
          : {}),
        lastTransitionAt: nowIso,
        lastState: targetState,
        ...monetization,
      };

      const nextStatus = inferPilotStatusFromCommercialState(targetState);
      const updatePayload: {
        status: 'submitted' | 'review' | 'approved' | 'active' | 'completed' | 'declined';
        responses: Record<string, unknown>;
        reviewedAt?: Date;
        approvedAt?: Date;
      } = {
        status: nextStatus,
        responses,
      };

      if (nextStatus === 'review' && !application.reviewedAt) {
        updatePayload.reviewedAt = now;
      }
      if (nextStatus === 'approved' && !application.approvedAt) {
        updatePayload.approvedAt = now;
      }

      await tx
        .update(pilotApplications)
        .set(updatePayload)
        .where(eq(pilotApplications.id, application.id));
      }),
    );

    return NextResponse.json({
      data: {
        id: application.id,
        fromState,
        targetState,
        status: inferPilotStatusFromCommercialState(targetState),
        monetization,
        qualificationScores: proposal.qualificationScores,
      },
    });
  } catch (error) {
    logger.error('pilot_commercial_transition:failed', {
      error: (error as Error).message,
    });
    return NextResponse.json({ error: 'Failed to process commercial transition' }, { status: 500 });
  }
});
