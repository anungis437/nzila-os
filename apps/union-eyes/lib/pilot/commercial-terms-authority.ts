/**
 * Platform-approved pilot commercial terms (PR #752 round 25).
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
 */
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { pilotApplications, subscriptionPlans } from '@/db/schema';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { getRecommendedEconomicsTier, parsePriceBandLowerBound } from './commercialization-wave1';

export type ApproveCommercialTermsResult =
  | {
      ok: true;
      verifiedMemberCount: number;
      verifiedPilotAmount: string;
      verifiedSubscriptionPlanId: string | null;
    }
  | { ok: false; status: 404 | 409; error: string };

/**
 * Platform-only approval of a pilot application's commercial terms.
 *
 * Fails closed:
 *   - `memberCount` must be a positive integer.
 *   - `subscriptionPlanId`, when provided, must reference an existing,
 *     currently-active `subscription_plans` row — never trusted from the
 *     caller's word alone, and never guessed via an "any active plan"
 *     fallback (the ambiguity this module exists to remove). Omitting it
 *     is valid for pilots that will never reach `subscription_active`.
 *   - `pilotAmount`, when provided, overrides the deterministic amount
 *     derived from the economics ladder (for a negotiated custom price);
 *     it must be a positive finite number. When omitted, the amount is
 *     computed deterministically from `memberCount` via the SAME
 *     `getRecommendedEconomicsTier`/`parsePriceBandLowerBound` logic
 *     `commercial-transition` already uses for its informational proposal
 *     — so the approved number matches what an approver would have seen.
 *
 * The pilot row is locked with `FOR UPDATE` for the same reason
 * `bindPilotOrganization` locks it: serializes this approval against a
 * concurrent rebind or commercial-transition attempt on the same row.
 * Re-approving with the SAME values is idempotent; approving again with
 * DIFFERENT values is treated as a deliberate correction (allowed —
 * unlike organization binding, commercial terms are expected to be
 * revised before a pilot reaches its first financial-artifact-creating
 * transition) and simply overwrites the prior approval, re-stamping the
 * approver and timestamp.
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
      .select({ id: pilotApplications.id })
      .from(pilotApplications)
      .where(eq(pilotApplications.id, pilotId))
      .limit(1)
      .for('update');

    if (!pilot) {
      return { ok: false, status: 404, error: 'Pilot application not found' };
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
