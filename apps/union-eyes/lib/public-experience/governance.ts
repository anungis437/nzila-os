/**
 * Public-experience governance enforcement.
 *
 * Provides primitives for checking whether a surface or content item
 * is allowed to transition to a new status under the current actor's
 * governance level. These are enforced at the API layer before any
 * publish or promote operation.
 */

import type { ExperienceSurface } from './registry';
import type { GovernanceLevel, PublicContentStatus, ExperienceVisibility } from './types';

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
