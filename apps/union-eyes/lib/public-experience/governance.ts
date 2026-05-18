/**
 * Public-experience governance enforcement.
 *
 * Provides primitives for checking whether a surface or content item
 * is allowed to transition to a new status under the current actor's
 * governance level. These are enforced at the API layer before any
 * publish or promote operation.
 *
 * Governance contracts from `lib/governance-policy` are bound here so that
 * public-surface governance evaluation flows through the centralized policy
 * evaluation engine and is captured in the governance decision ledger.
 */

import type { ExperienceSurface } from './registry';
import type { GovernanceLevel, PublicContentStatus, ExperienceVisibility } from './types';
import { resolveContract } from '../governance-policy/registry';
import { evaluatePolicy } from '../governance-policy/evaluation';
import type { PolicyEvaluationContext, PolicyEvaluationResult } from '../governance-policy/evaluation';
import { recordPublicationEvent } from '../governance-observability/telemetry';

export interface GovernanceActor {
  userId: string;
  role: string;
  /** Governance clearance the actor holds — derived from their role. */
  clearance: GovernanceLevel;
}

export interface GovernanceTransitionResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Determine the minimum governance clearance required to publish a surface
 * at the target visibility level.
 */
export function requiredClearanceForVisibility(
  visibility: ExperienceVisibility,
): GovernanceLevel {
  if (visibility === 'public') return 'executive-approved';
  if (visibility === 'authenticated') return 'review-required';
  return 'standard';
}

const GOVERNANCE_RANK: Record<GovernanceLevel, number> = {
  standard: 0,
  'review-required': 1,
  'executive-approved': 2,
};

/** Return true if the actor's clearance meets or exceeds the required level. */
export function hasSufficientClearance(
  actor: GovernanceActor,
  required: GovernanceLevel,
): boolean {
  return GOVERNANCE_RANK[actor.clearance] >= GOVERNANCE_RANK[required];
}

/**
 * Evaluate whether an actor may promote a surface to a new status.
 *
 * Rules:
 * - Any status → 'draft'     always allowed (demotion/reset).
 * - 'draft' → 'review'       requires standard or above.
 * - 'review' → 'approved'    requires review-required or above.
 * - 'approved' → 'published' requires the surface's own governance level.
 * - 'published' → 'archived' requires review-required or above.
 */
export function evaluateStatusTransition(
  surface: ExperienceSurface,
  actor: GovernanceActor,
  targetStatus: PublicContentStatus,
): GovernanceTransitionResult {
  // Always allow demoting to draft
  if (targetStatus === 'draft') return { allowed: true };

  const requiredByTarget: Record<PublicContentStatus, GovernanceLevel> = {
    draft: 'standard',
    review: 'standard',
    approved: 'review-required',
    published: surface.governance,
    archived: 'review-required',
  };

  const required = requiredByTarget[targetStatus];

  if (!hasSufficientClearance(actor, required)) {
    return {
      allowed: false,
      reason: `Transition to '${targetStatus}' requires '${required}' clearance; actor has '${actor.clearance}'.`,
    };
  }

  // Additional check: public surfaces require executive-approved clearance
  if (
    targetStatus === 'published' &&
    surface.visibility === 'public' &&
    !hasSufficientClearance(actor, 'executive-approved')
  ) {
    return {
      allowed: false,
      reason: `Publishing to public visibility requires 'executive-approved' clearance.`,
    };
  }

  return { allowed: true };
}

// ── Governance contract binding ───────────────────────────────────────────────

/**
 * Resolve and evaluate the governance policy contract for a public-experience
 * surface. Returns the policy evaluation result for ledger capture.
 *
 * - Non-federation surfaces use `CONTRACT_PUBLIC_SURFACE` (`public-experience.surface`).
 * - Federation surfaces use `CONTRACT_FEDERATION_SURFACE` (`public-experience.federation`).
 *
 * If the registry has not been bootstrapped yet (e.g. in test isolation),
 * this function returns `null` gracefully — never throws.
 */
export function evaluateSurfaceContract(
  surface: ExperienceSurface,
  actor: GovernanceActor,
  opts: {
    isFederation?: boolean;
    executiveApproved?: boolean;
    federationApproved?: boolean;
  } = {},
): PolicyEvaluationResult | null {
  const contractId = opts.isFederation
    ? 'public-experience.federation'
    : 'public-experience.surface';

  const contract = resolveContract(contractId);
  if (!contract) return null;

  const context: PolicyEvaluationContext = {
    operationId: `public-experience.${surface.id}`,
    actor: {
      userId: actor.userId,
      role: actor.role,
      orgId: '',
    },
    isPublic: surface.visibility === 'public',
    isFederation: opts.isFederation ?? false,
    executiveApproved: opts.executiveApproved ?? actor.clearance === 'executive-approved',
    federationApproved: opts.federationApproved ?? false,
  };

  const result = evaluatePolicy(contract, context);

  // Fire-and-forget governed telemetry for publication events (Wave 8)
  void recordPublicationEvent({
    surfaceId: surface.id,
    isPublic: surface.visibility === 'public',
    isFederation: opts.isFederation ?? false,
    targetStatus: 'evaluation',
    actorId: actor.userId,
    allowed: result.allowed,
  });

  return result;
}
