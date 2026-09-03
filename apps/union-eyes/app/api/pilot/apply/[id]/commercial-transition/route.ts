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
import { authorizePilotAccess, getPilotEffectiveOrganizationId, getPilotVerifiedOrganizationId } from '@/lib/pilot/pilot-ownership';
import {
  buildPilotArtifactVersionRecord,
  buildPilotContractNumber,
  buildCommercialTermsSnapshot,
  COMMERCIAL_STATE_ORDER,
  buildProposalPackage,
  inferPilotStatusFromCommercialState,
  isCommercialTransitionAllowed,
  normalizeCommercialState,
  parsePriceBandLowerBound,
  type CommercialState,
} from '@/lib/pilot/commercialization-wave1';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// PR #752 round 25: these 3 states each create a REAL financial artifact
// (commercial contract, platform invoice, or org subscription) below — all
// require platform-approved commercial terms first (see the gate after the
// transition-allowed check).
const FINANCIAL_TARGET_STATES: CommercialState[] = ['contract_sent', 'invoice_issued', 'subscription_active'];

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

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function buildInvoiceNumber(applicationId: string): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `PILOT-INV-${stamp}-${applicationId.slice(0, 6).toUpperCase()}`;
}

/**
 * Signals a structured, expected rejection discovered AFTER the pilot row
 * is locked (PR #752 round 23) — thrown from inside the transaction to roll
 * it back, then translated back into the exact HTTP response by the outer
 * catch. Distinguishes an expected business rejection (404/409/400) from a
 * genuine failure (500).
 */
class CommercialTransitionRejected extends Error {
  constructor(
    public readonly status: number,
    public readonly body: Record<string, unknown>,
  ) {
    super('commercial transition rejected');
  }
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

    // PR #752 round 23: this is a CHEAP existence + role-tier pre-check
    // only — never the authoritative snapshot. Every value that feeds a
    // financial or FSM decision below (verifiedOrganizationId, responses,
    // fromState, the proposal) is re-derived from a FRESH read taken AFTER
    // the row lock, inside the transaction. Reusing this snapshot for those
    // decisions was round 22's gap: a concurrent rebind could change
    // verifiedOrganizationId (or a concurrent transition change
    // responses.commercialState) between this read and the lock being
    // acquired, and the old code kept using the stale values captured here.
    const [existsRow] = await withSystemContext((_tx) =>
      db
        .select({
          id: pilotApplications.id,
          responses: pilotApplications.responses,
          verifiedOrganizationId: pilotApplications.verifiedOrganizationId,
        })
        .from(pilotApplications)
        .where(and(eq(pilotApplications.id, id))),
    );

    if (!existsRow) {
      return NextResponse.json({ error: 'Pilot application not found' }, { status: 404 });
    }

    // PR #752 round 19: `responses.organizationId` (the claim) is an
    // unauthenticated client assertion, not server-verified ownership — see
    // getPilotClaimedOrganizationId's doc comment in lib/pilot/pilot-
    // ownership.ts. This route creates REAL financial records
    // (commercialContracts / billingAccounts / orgSubscriptions /
    // platformInvoices), so ordinary same-org self-service is not
    // sufficient authority here: only an independent platform-tier decision
    // (system_admin+, per authorizePilotAccess's 'platform' branch) counts.
    // The org VALUE used here doesn't affect the outcome for platform
    // actors (who pass regardless) or non-platform actors (who are
    // rejected regardless of same-org/cross-org) — only the actor's ROLE
    // does — so this snapshot is safe to use for authorization even though
    // it is not used for any financial decision below.
    const decision = await authorizePilotAccess(getPilotEffectiveOrganizationId(existsRow));
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

    if (body.applyReferenceTemplate) {
      // Operational package MUST NOT ship customer-specific reference-template
      // fixtures. The demo package (@nzila/union-eyes-demo) owns those.
      return NextResponse.json(
        { error: 'applyReferenceTemplate is not accepted by the operational application' },
        { status: 400 },
      );
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const monetization: {
      notes: string[];
      contractId?: string;
      invoiceId?: string;
      subscriptionId?: string;
    } = { notes: [] };

    let fromState!: CommercialState;
    let qualificationScores!: ReturnType<typeof buildProposalPackage>['qualificationScores'];

    try {
      await withSystemContext(async () =>
        db.transaction(async (tx) => {
      // PR #752 round 22: lock the pilot row for the duration of this
      // transaction, same as bindPilotOrganization/rebindPilotOrganization's
      // own `FOR UPDATE` lock on this row — serializes this monetization
      // transaction against a concurrent verify/rebind so neither can
      // observe stale state. PR #752 round 23: the row is now re-SELECTed
      // (not just locked by id) — verifiedOrganizationId, responses,
      // fromState, and the proposal are all derived from THIS locked read,
      // never the pre-lock snapshot above.
      const [application] = await tx
        .select()
        .from(pilotApplications)
        .where(eq(pilotApplications.id, id))
        .limit(1)
        .for('update');

      if (!application) {
        throw new CommercialTransitionRejected(404, { error: 'Pilot application not found' });
      }

      // PR #752 round 20: `responses.organizationId` (the CLAIM) must never
      // be used for billing — only the server-controlled
      // `verifiedOrganizationId` column, set exclusively by POST
      // .../verify-organization or .../rebind-organization. Re-checked here
      // (not just at the pre-check above) because a concurrent rebind could
      // have changed or cleared it between the pre-check read and this lock.
      const verifiedOrganizationId = getPilotVerifiedOrganizationId(application);
      if (!verifiedOrganizationId) {
        throw new CommercialTransitionRejected(409, {
          error: 'This pilot application\'s organization has not been verified. Call POST /api/pilot/apply/[id]/verify-organization before commercial transition.',
        });
      }

      const responses = { ...((application.responses ?? {}) as Record<string, unknown>) };
      fromState = normalizeCommercialState(responses.commercialState);

      if (!body.allowSkip && !isCommercialTransitionAllowed(fromState, targetState)) {
        throw new CommercialTransitionRejected(400, {
          error: `Invalid transition: ${fromState} -> ${targetState}. Only adjacent transitions are allowed.`,
          data: {
            fromState,
            targetState,
            allowedNext: COMMERCIAL_STATE_ORDER[COMMERCIAL_STATE_ORDER.indexOf(fromState) + 1] ?? fromState,
            allowedPrevious: COMMERCIAL_STATE_ORDER[COMMERCIAL_STATE_ORDER.indexOf(fromState) - 1] ?? fromState,
          },
        });
      }

      // PR #752 round 25: `memberCount` is applicant-supplied at public
      // intake and steward-editable via ordinary PATCH; `responses.
      // subscriptionPlanId` has no governed writer at all (round 24's own
      // inventory). Neither may drive a real financial amount or billing
      // plan selection. Every financial-artifact-creating transition
      // requires an explicit platform approval first (see
      // lib/pilot/commercial-terms-authority.ts's approveCommercialTerms) —
      // re-checked here, under the SAME row lock, against the FRESH read
      // above, never an earlier snapshot.
      if (FINANCIAL_TARGET_STATES.includes(targetState)) {
        if (application.verifiedMemberCount == null || application.verifiedPilotAmount == null) {
          throw new CommercialTransitionRejected(409, {
            error:
              'Commercial terms have not been approved for this pilot. Call POST /api/pilot/apply/[id]/approve-commercial-terms ' +
              'with a verified memberCount before contract, invoice, or subscription creation.',
          });
        }
        if (targetState === 'subscription_active' && !application.verifiedSubscriptionPlanId) {
          throw new CommercialTransitionRejected(409, {
            error:
              'No approved subscription plan for this pilot. Call POST /api/pilot/apply/[id]/approve-commercial-terms ' +
              'with an explicit subscriptionPlanId before activating a subscription.',
          });
        }
      }

      // PR #752 round 27: an immutable record of the approval that produced
      // whatever artifact this transition creates, stamped into that
      // artifact's own metadata — so a LATER organization correction that
      // clears the pilot row's terms (round 26) can never erase proof of
      // which approval a given contract/invoice/subscription came from.
      // Only meaningful (and only ever read) for financial target states;
      // the gate above guarantees the required fields are non-null there.
      const commercialTermsSnapshot = FINANCIAL_TARGET_STATES.includes(targetState)
        ? buildCommercialTermsSnapshot({
            verifiedOrganizationId,
            verifiedMemberCount: application.verifiedMemberCount as number,
            verifiedPilotAmount: application.verifiedPilotAmount as string,
            verifiedSubscriptionPlanId: application.verifiedSubscriptionPlanId,
            commercialTermsApprovedBy: application.commercialTermsApprovedBy as string,
            commercialTermsApprovedAt: application.commercialTermsApprovedAt as Date,
          })
        : null;

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
      qualificationScores = proposal.qualificationScores;

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

      const contractNumber = buildPilotContractNumber(application.id);
      // Guaranteed non-null for the 3 financial target states by the gate
      // above; the ladder-derived fallback only applies to the non-financial
      // states that compute `pilotAmount` unconditionally but never use it.
      const pilotAmount = application.verifiedPilotAmount ?? parsePriceBandLowerBound(proposal.economicsTier.targetPriceRange);

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
                commercialTermsSnapshot: commercialTermsSnapshot?.snapshot,
                commercialTermsFingerprint: commercialTermsSnapshot?.fingerprint,
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
              commercialTermsSnapshot: commercialTermsSnapshot?.snapshot,
              commercialTermsFingerprint: commercialTermsSnapshot?.fingerprint,
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
              commercialTermsSnapshot: commercialTermsSnapshot?.snapshot,
              commercialTermsFingerprint: commercialTermsSnapshot?.fingerprint,
            },
          });

          monetization.invoiceId = invoice.id;
        }
      }

      if (targetState === 'subscription_active' && organizationId && billingAccountId) {
        // Round 25: the ONLY source of truth is the platform-approved
        // verifiedSubscriptionPlanId column — never responses.subscriptionPlanId
        // (no governed writer ever set it) and never an ambiguous "any
        // active plan" fallback (subscription_plans has no uniqueness
        // constraint on isActive). The gate above makes this branch
        // unreachable without it set; the null-check below is defensive.
        const selectedPlanId = application.verifiedSubscriptionPlanId;

        if (!selectedPlanId) {
          monetization.notes.push('No approved subscription plan; subscription activation staged only.');
        } else {
          // Round 26: approval validated the plan was active AT APPROVAL
          // TIME, but activation can happen much later — isActive=false
          // means "must not accept new subscriptions", so revalidate under
          // the SAME lock rather than trusting the stored id alone.
          const [plan] = await tx
            .select({ id: subscriptionPlans.id, isActive: subscriptionPlans.isActive })
            .from(subscriptionPlans)
            .where(eq(subscriptionPlans.id, selectedPlanId));

          if (!plan || !plan.isActive) {
            monetization.notes.push('Approved subscription plan is no longer active; subscription activation staged only.');
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
                    commercialTermsSnapshot: commercialTermsSnapshot?.snapshot,
                    commercialTermsFingerprint: commercialTermsSnapshot?.fingerprint,
                  },
                })
                .returning({ id: orgSubscriptions.id });

              monetization.subscriptionId = subscription?.id;
            }
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
    } catch (err) {
      if (err instanceof CommercialTransitionRejected) {
        return NextResponse.json(err.body, { status: err.status });
      }
      throw err;
    }

    return NextResponse.json({
      data: {
        id,
        fromState,
        targetState,
        status: inferPilotStatusFromCommercialState(targetState),
        monetization,
        qualificationScores,
      },
    });
  } catch (error) {
    logger.error('pilot_commercial_transition:failed', {
      error: (error as Error).message,
    });
    return NextResponse.json({ error: 'Failed to process commercial transition' }, { status: 500 });
  }
});
