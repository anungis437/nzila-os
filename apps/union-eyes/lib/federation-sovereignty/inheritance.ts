/**
 * Sovereignty-aware policy inheritance engine.
 *
 * Rules (non-negotiable):
 *   - locals inherit federation baseline policies
 *   - federation can override local defaults
 *   - local can tighten but not weaken
 *   - publication rights can be delegated
 *   - AI/publication rules can cascade
 *
 * Read-only. Never mutates production state.
 *
 * @module lib/federation-sovereignty/inheritance
 */

import type {
  SovereignGovernanceContract,
  SovereigntyTier,
} from './types';

// ── Tier ordering ─────────────────────────────────────────────────────────────

const TIER_ORDER: SovereigntyTier[] = [
  'national',
  'regional',
  'local',
  'affiliate',
  'coalition',
];

function tierIndex(tier: SovereigntyTier): number {
  const idx = TIER_ORDER.indexOf(tier);
  return idx === -1 ? TIER_ORDER.length : idx;
}

/** Returns true if `child` is subordinate to `parent` in the hierarchy. */
export function isSubordinateTier(
  child: SovereigntyTier,
  parent: SovereigntyTier,
): boolean {
  return tierIndex(child) > tierIndex(parent);
}

// ── Policy inheritance resolution ────────────────────────────────────────────

export interface PolicyInheritanceResult {
  federationId: string;
  tier: SovereigntyTier;
  inheritedPolicies: string[];
  locallyTightened: string[];
  hardLocked: string[];
  customisable: string[];
  weakeningAttempted: boolean;
  weakeningViolations: string[];
}

/**
 * Resolve the full policy inheritance profile for a unit.
 *
 * `parentPolicies` — the set of policy IDs the parent tier enforces.
 * `locallyRequestedOverrides` — overrides the unit is attempting to apply.
 */
export function resolvePolicyInheritance(
  contract: SovereignGovernanceContract,
  parentPolicies: string[],
  locallyRequestedOverrides: string[] = [],
): PolicyInheritanceResult {
  const inheritedPolicies = parentPolicies.filter(
    (p) => !contract.overrideRestrictions.includes(p),
  );

  const hardLocked = contract.overrideRestrictions.filter((r) =>
    parentPolicies.includes(r),
  );

  const locallyTightened = contract.inheritedPolicies.filter(
    (p) => !parentPolicies.includes(p),
  );

  const customisable = inheritedPolicies.filter(
    (p) => !hardLocked.includes(p),
  );

  const weakeningViolations = locallyRequestedOverrides.filter(
    (override) =>
      parentPolicies.includes(override) &&
      !contract.delegatedAuthorities.includes('policy-enforcement'),
  );

  return {
    federationId: contract.federationId,
    tier: contract.sovereigntyTier,
    inheritedPolicies,
    locallyTightened,
    hardLocked,
    customisable,
    weakeningAttempted: weakeningViolations.length > 0,
    weakeningViolations,
  };
}

// ── Publication authority inheritance ────────────────────────────────────────

export interface PublicationAuthorityResult {
  federationId: string;
  publicationAllowed: boolean;
  requiresFederationApproval: boolean;
  delegatedFromTier: SovereigntyTier | null;
  cascadeRestrictions: string[];
  aiPublicationAllowed: boolean;
}

/**
 * Determine whether a unit holds valid publication authority,
 * accounting for delegation cascade and federation approval requirements.
 */
export function resolvePublicationAuthority(
  contract: SovereignGovernanceContract,
  grantingTier: SovereigntyTier | null = null,
): PublicationAuthorityResult {
  const hasDelegatedPublication =
    contract.delegatedAuthorities.includes('publication');
  const publicationRestricted =
    contract.overrideRestrictions.includes('publication');

  const publicationAllowed = hasDelegatedPublication && !publicationRestricted;

  const requiresFederationApproval =
    !hasDelegatedPublication ||
    publicationRestricted ||
    contract.escalationRequirements.includes('publication');

  const cascadeRestrictions: string[] = [];
  if (publicationRestricted) {
    cascadeRestrictions.push('publication.blocked-by-restriction');
  }
  if (contract.sovereigntyMode === 'oversight-required') {
    cascadeRestrictions.push('publication.oversight-required');
  }
  if (contract.sovereigntyMode === 'restricted') {
    cascadeRestrictions.push('publication.restricted-mode');
  }

  const aiPublicationAllowed =
    publicationAllowed &&
    contract.delegatedAuthorities.includes('ai-operations') &&
    !contract.overrideRestrictions.includes('ai-operations');

  return {
    federationId: contract.federationId,
    publicationAllowed,
    requiresFederationApproval,
    delegatedFromTier: publicationAllowed ? (grantingTier ?? contract.sovereigntyTier) : null,
    cascadeRestrictions,
    aiPublicationAllowed,
  };
}

// ── AI governance cascade ─────────────────────────────────────────────────────

export interface AIGovernanceCascadeResult {
  federationId: string;
  tier: SovereigntyTier;
  cascadedRestrictions: string[];
  localRelaxationAllowed: boolean;
  humanReviewInheritedFrom: SovereigntyTier | null;
}

/**
 * Resolve AI governance cascade for a unit.
 * AI/publication rules cascade downward — more authoritative tiers can impose
 * restrictions that subordinate tiers cannot unilaterally remove.
 */
export function resolveAIGovernanceCascade(
  contract: SovereignGovernanceContract,
  parentAIRestrictions: string[] = [],
): AIGovernanceCascadeResult {
  const hasAIAuthority = contract.delegatedAuthorities.includes('ai-operations');
  const aiRestricted = contract.overrideRestrictions.includes('ai-operations');

  const cascadedRestrictions = [
    ...parentAIRestrictions,
    ...(aiRestricted ? ['ai.operations.restricted'] : []),
  ];

  const localRelaxationAllowed =
    hasAIAuthority &&
    !aiRestricted &&
    contract.sovereigntyMode === 'fully-autonomous';

  const humanReviewInheritedFrom: SovereigntyTier | null =
    contract.sovereigntyTier === 'local' ||
    contract.sovereigntyTier === 'affiliate'
      ? 'regional'
      : contract.sovereigntyTier === 'regional'
        ? 'national'
        : null;

  return {
    federationId: contract.federationId,
    tier: contract.sovereigntyTier,
    cascadedRestrictions: [...new Set(cascadedRestrictions)],
    localRelaxationAllowed,
    humanReviewInheritedFrom,
  };
}
