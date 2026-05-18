/**
 * Sovereignty autonomy engine.
 *
 * Evaluates the operational sovereignty mode for a federation unit,
 * resolves local policy enforcement boundaries, and determines AI
 * autonomy limits.
 *
 * Read-only. Never mutates production state.
 *
 * @module lib/federation-sovereignty/autonomy
 */

import type {
  SovereignGovernanceContract,
  SovereigntyMode,
  DelegatedAuthority,
  AIAutonomyBoundary,
  AuditVisibilityPolicy,
} from './types';

// ── Sovereignty mode resolution ───────────────────────────────────────────────

/**
 * Derive the effective sovereignty mode for a unit given its contract
 * and any parent-imposed constraints.
 *
 * Rules:
 * - If parent requires oversight → oversight-required regardless of local preference
 * - If override restrictions exceed half of authorities → restricted
 * - If all delegated authorities granted → fully-autonomous
 * - Otherwise → federation-aligned
 */
export function resolveEffectiveSovereigntyMode(
  contract: SovereignGovernanceContract,
  parentRequiresOversight = false,
): SovereigntyMode {
  if (parentRequiresOversight || contract.sovereigntyMode === 'oversight-required') {
    return 'oversight-required';
  }

  const allAuthorities: DelegatedAuthority[] = [
    'publication',
    'policy-enforcement',
    'member-governance',
    'ai-operations',
    'audit-visibility',
    'continuity-management',
  ];

  const restrictionRatio =
    contract.overrideRestrictions.length / allAuthorities.length;

  if (restrictionRatio > 0.5) return 'restricted';

  const hasAllAuthorities = allAuthorities.every((a) =>
    contract.delegatedAuthorities.includes(a),
  );

  if (hasAllAuthorities && contract.escalationRequirements.length === 0) {
    return 'fully-autonomous';
  }

  return 'federation-aligned';
}

// ── Local policy enforcement boundary ────────────────────────────────────────

/**
 * Determine which authorities a unit may enforce locally without federation
 * review, given its contract and current mode.
 */
export function resolveLocalEnforcementBoundary(
  contract: SovereignGovernanceContract,
): {
  enforcableAuthorities: DelegatedAuthority[];
  federationReviewRequired: DelegatedAuthority[];
  blockedAuthorities: DelegatedAuthority[];
} {
  const mode = resolveEffectiveSovereigntyMode(contract);

  const allAuthorities: DelegatedAuthority[] = [
    'publication',
    'policy-enforcement',
    'member-governance',
    'ai-operations',
    'audit-visibility',
    'continuity-management',
  ];

  const enforcableAuthorities: DelegatedAuthority[] = [];
  const federationReviewRequired: DelegatedAuthority[] = [];
  const blockedAuthorities: DelegatedAuthority[] = [];

  for (const authority of allAuthorities) {
    const delegated = contract.delegatedAuthorities.includes(authority);
    const restricted = contract.overrideRestrictions.includes(authority);
    const escalationNeeded = contract.escalationRequirements.includes(authority);

    if (restricted) {
      blockedAuthorities.push(authority);
    } else if (!delegated || escalationNeeded || mode === 'oversight-required') {
      federationReviewRequired.push(authority);
    } else if (mode === 'restricted' && authority !== 'member-governance') {
      federationReviewRequired.push(authority);
    } else {
      enforcableAuthorities.push(authority);
    }
  }

  return { enforcableAuthorities, federationReviewRequired, blockedAuthorities };
}

// ── AI autonomy boundary ──────────────────────────────────────────────────────

/**
 * Derive the AI autonomy boundary applicable within a sovereignty unit.
 *
 * Conservative defaults apply: more restricted tiers get tighter AI boundaries.
 */
export function resolveAIAutonomyBoundary(
  contract: SovereignGovernanceContract,
): AIAutonomyBoundary {
  const mode = resolveEffectiveSovereigntyMode(contract);
  const hasAIAuthority = contract.delegatedAuthorities.includes('ai-operations');

  const maxPermittedRisk: AIAutonomyBoundary['maxPermittedRisk'] =
    mode === 'fully-autonomous' && hasAIAuthority
      ? 'sensitive'
      : mode === 'federation-aligned' && hasAIAuthority
        ? 'advisory'
        : 'assistive';

  const federatedRestrictions: string[] = [];
  if (mode === 'oversight-required') {
    federatedRestrictions.push('ai.publication', 'ai.export', 'ai.member-data');
  }
  if (mode === 'restricted') {
    federatedRestrictions.push('ai.publication');
  }
  if (!hasAIAuthority) {
    federatedRestrictions.push('ai.autonomous-action');
  }

  const humanReviewJurisdiction: AIAutonomyBoundary['humanReviewJurisdiction'] =
    contract.sovereigntyTier === 'national'
      ? 'national'
      : contract.sovereigntyTier === 'regional'
        ? 'regional'
        : 'local';

  return {
    federationId: contract.federationId,
    sovereigntyTier: contract.sovereigntyTier,
    maxPermittedRisk,
    federatedRestrictions,
    humanReviewJurisdiction,
    localOverrideAllowed: mode === 'fully-autonomous',
  };
}

// ── Audit visibility ──────────────────────────────────────────────────────────

/**
 * Derive the audit visibility policy applicable within a sovereignty unit.
 */
export function resolveAuditVisibilityPolicy(
  contract: SovereignGovernanceContract,
): AuditVisibilityPolicy {
  const visibilityScope = contract.auditVisibility;

  return {
    federationId: contract.federationId,
    sovereigntyTier: contract.sovereigntyTier,
    localDetailVisible: true,
    regionalSummaryVisible:
      visibilityScope === 'regional' ||
      visibilityScope === 'national' ||
      visibilityScope === 'federated',
    nationalEscalationsOnly:
      visibilityScope === 'national' || visibilityScope === 'federated',
    federatedScopeAllowed: visibilityScope === 'federated',
  };
}
