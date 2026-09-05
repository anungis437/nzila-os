/**
 * Platform-approved pilot commercial terms (PR #752 round 25/26).
 *
 * Before this module, commercial-transition sized every real contract and
 * invoice from `pilotApplications.memberCount` — an applicant-supplied
 * value at unauthenticated public intake, and one no `blockedPatchFields`
 * entry protected from an ordinary same-org steward PATCH — and selected a
 * subscription plan from `responses.subscriptionPlanId`, a `responses` key
 * with NO governed writer anywhere in the codebase (see round 24's own
 * full-repo inventory in `lib/pilot/responses-authority.ts`), falling back
 * to "the first `subscription_plans` row with `is_active = true`" when
 * absent — an ambiguous selector, since `subscription_plans` has no
 * uniqueness constraint on `isActive`. Organization identity was
 * independently verified (round 20); the DOLLAR AMOUNT and BILLING PLAN
 * driving real financial records were not.
 *
 * `approveCommercialTerms()` is the ONLY function that may write
 * `verifiedMemberCount`/`verifiedPilotAmount`/`verifiedSubscriptionPlanId`/
 * `commercialTermsApprovedBy`/`commercialTermsApprovedAt` — callers must
 * already have confirmed platform-tier authority (`hasMinRole('system_admin')`)
 * before calling this; it does not itself perform that check (matching the
 * established convention of `bindPilotOrganization`/`rebindPilotOrganization`).
 * `commercial-transition/route.ts` must consume these verified columns
 * exclusively for financial-artifact-creating transitions — never
 * `memberCount` or `responses.subscriptionPlanId` directly.
 *
 * Round 26: once a real financial artifact (commercial contract, platform
 * invoice, or org subscription) exists for this pilot, this function
 * refuses to approve again at all — see the lifecycle guard below. Before
 * round 26, an approval could be freely overwritten with different values
 * even after a contract/invoice had already been produced from the prior
 * approval, leaving no record of which approval produced which artifact
 * (an authoritative-state / ledger-state divergence). `rebindPilotOrganization`
 * (`lib/pilot/pilot-ownership.ts`) separately CLEARS these columns whenever
 * the verified organization actually changes, forcing a fresh approval
 * under the new organization's context before this guard can even become
 * relevant again.
 */
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { pilotApplications, subscriptionPlans } from '@/db/schema';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { getRecommendedEconomicsTier, parsePriceBandLowerBound } from './commercialization-wave1';
import { pilotHasFinancialArtifacts } from './pilot-ownership';

export type ApproveCommercialTermsResult =
  | {
      ok: true;
      verifiedMemberCount: number;
      verifiedPilotAmount: string;
      verifiedSubscriptionPlanId: string | null;
    }
  | { ok: false; status: 404 | 409; error: string };

/** `numeric(12,2)` column bounds — 10 integer digits, 2 decimal places. */
const MIN_PILOT_AMOUNT = 0.01;
const MAX_PILOT_AMOUNT = 9999999999.99;

/**
 * Platform-only approval of a pilot application's commercial terms.
 *
 * Fails closed:
 *   - `memberCount` must be a positive integer.
 *   - The pilot's organization must already be VERIFIED
 *     (`verifiedOrganizationId` non-null — PR #752 round 27) before any
 *     commercial terms may be approved (409 otherwise). Without this, a
 *     pilot could be approved while `verifiedOrganizationId` is still
 *     null, then bound to an organization AFTER the fact
 *     (`bindPilotOrganization`, the first-time NULL -> org bind) — the
 *     approved terms would never have been evaluated in that
 *     organization's context at all. Round 26 only cleared terms on
 *     `rebindPilotOrganization` (an already-verified org changing to a
 *     different one); this closes the same gap for the FIRST bind.
 *   - `subscriptionPlanId`, when provided, must reference an existing,
 *     currently-active `subscription_plans` row — never trusted from the
 *     caller's word alone, and never guessed via an "any active plan"
 *     fallback (the ambiguity this module exists to remove). Omitting it
 *     is valid for pilots that will never reach `subscription_active`.
 *   - `pilotAmount`, when provided, overrides the deterministic amount
 *     derived from the economics ladder (for a negotiated custom price).
 *     Validated on the NORMALIZED (`toFixed(2)`-rounded) value, not the
 *     raw input — a raw value like `0.001` is positive but rounds to
 *     `"0.00"`, which would otherwise silently approve a zero-dollar
 *     contract; the normalized amount must be at least $0.01 and within
 *     `numeric(12,2)` column bounds. When omitted, the amount is computed
 *     deterministically from `memberCount` via the SAME
 *     `getRecommendedEconomicsTier`/`parsePriceBandLowerBound` logic
 *     `commercial-transition` already uses for its informational proposal
 *     — so the approved number matches what an approver would have seen.
 *   - Once this pilot has ANY real financial artifact (see
 *     `pilotHasFinancialArtifacts` — commercial contract, platform
 *     invoice, or org subscription), this function refuses to approve
 *     again at all (409) — an ordinary re-approval must not be able to
 *     change the authoritative amount/plan after a real artifact has
 *     already been produced from a prior approval, with nothing tying the
 *     new approved value to which artifact was actually created under
 *     which approval. A genuine correction after artifacts exist needs an
 *     explicit, versioned correction workflow — not implemented here.
 *
 * The pilot row is locked with `FOR UPDATE` for the same reason
 * `bindPilotOrganization` locks it: serializes this approval against a
 * concurrent rebind or commercial-transition attempt on the same row —
 * this also closes the TOCTOU window between the financial-artifact check
 * below and a concurrent commercial-transition creating one, since both
 * now contend for the same row lock before proceeding. Re-approving with
 * the SAME or DIFFERENT values is permitted ONLY before any financial
 * artifact exists (a deliberate correction is expected during that
 * window); once one exists, every further approval attempt is rejected
 * regardless of whether the values would have been identical.
 */
export async function approveCommercialTerms(params: {
  pilotId: string;
  approvedBy: string;
  memberCount: number;
  subscriptionPlanId?: string | null;
  pilotAmount?: string | null;
}): Promise<ApproveCommercialTermsResult> {
  const { pilotId, approvedBy, memberCount, subscriptionPlanId = null, pilotAmount = null } = params;

  if (!Number.isFinite(memberCount) || memberCount <= 0 || !Number.isInteger(memberCount)) {
    return { ok: false, status: 409, error: 'memberCount must be a positive integer' };
  }

  let resolvedAmount: string;
  if (pilotAmount !== null && pilotAmount !== undefined) {
    const numericAmount = Number(pilotAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return { ok: false, status: 409, error: 'pilotAmount must be a positive number' };
    }
    resolvedAmount = numericAmount.toFixed(2);
  } else {
    resolvedAmount = parsePriceBandLowerBound(getRecommendedEconomicsTier(memberCount).targetPriceRange);
  }

  const normalizedAmount = Number(resolvedAmount);
  if (normalizedAmount < MIN_PILOT_AMOUNT || normalizedAmount > MAX_PILOT_AMOUNT) {
    return {
      ok: false,
      status: 409,
      error: `pilotAmount must normalize to at least $${MIN_PILOT_AMOUNT.toFixed(2)} and at most $${MAX_PILOT_AMOUNT.toFixed(2)}`,
    };
  }

  return withSystemContext(async (_tx) => {
    if (subscriptionPlanId) {
      const [plan] = await db
        .select({ id: subscriptionPlans.id, isActive: subscriptionPlans.isActive })
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, subscriptionPlanId));

      if (!plan) {
        return { ok: false, status: 404, error: 'Subscription plan not found' };
      }
      if (!plan.isActive) {
        return { ok: false, status: 409, error: 'Subscription plan is not active' };
      }
    }

    const [pilot] = await db
      .select({ id: pilotApplications.id, verifiedOrganizationId: pilotApplications.verifiedOrganizationId })
      .from(pilotApplications)
      .where(eq(pilotApplications.id, pilotId))
      .limit(1)
      .for('update');

    if (!pilot) {
      return { ok: false, status: 404, error: 'Pilot application not found' };
    }

    if (!pilot.verifiedOrganizationId) {
      return {
        ok: false,
        status: 409,
        error:
          'This pilot application\'s organization has not been verified. Call POST /api/pilot/apply/[id]/verify-organization ' +
          'before approving commercial terms — commercial terms must be bound to a verified organization, never approved ' +
          'against an unverified pilot.',
      };
    }

    if (await pilotHasFinancialArtifacts(pilotId)) {
      return {
        ok: false,
        status: 409,
        error:
          'This pilot already has a real financial artifact (a commercial contract, platform invoice, or ' +
          'org subscription) created from a prior commercial-terms approval. Ordinary re-approval is not ' +
          'permitted after that point — it would leave no record of which approval produced the existing ' +
          'artifact. A correction requires an explicit, versioned commercial-terms correction workflow, ' +
          'not this endpoint.',
      };
    }

    await db
      .update(pilotApplications)
      .set({
        verifiedMemberCount: memberCount,
        verifiedPilotAmount: resolvedAmount,
        verifiedSubscriptionPlanId: subscriptionPlanId,
        commercialTermsApprovedBy: approvedBy,
        commercialTermsApprovedAt: new Date(),
      })
      .where(eq(pilotApplications.id, pilotId));

    return {
      ok: true,
      verifiedMemberCount: memberCount,
      verifiedPilotAmount: resolvedAmount,
      verifiedSubscriptionPlanId: subscriptionPlanId,
    };
  });
}
