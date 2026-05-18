/**
 * Sovereignty conflict resolver.
 *
 * Classifies, simulates resolution paths, and generates evidence for:
 *   - policy divergence
 *   - authority override attempts
 *   - publication disputes
 *   - AI autonomy conflicts
 *   - audit visibility disagreements
 *   - continuity jurisdiction disputes
 *   - escalation deadlocks
 *
 * Never auto-resolves. Only: classify, simulate, ledger, escalate.
 *
 * Read-only. Never mutates production state.
 *
 * @module lib/federation-sovereignty/conflicts
 */

import type {
  SovereignGovernanceContract,
  SovereigntyConflictType,
  SovereigntyConflictResult,
  ConflictResolutionPath,
  SovereigntyTier,
} from './types';

let _conflictCounter = 0;

function nextConflictId(): string {
  return `conflict_${Date.now()}_${++_conflictCounter}`;
}

// ── Resolution path selection ─────────────────────────────────────────────────

function selectResolutionPath(
  conflictType: SovereigntyConflictType,
  involvedTiers: SovereigntyTier[],
  autoResolvable: boolean,
): ConflictResolutionPath {
  if (autoResolvable) return 'none';
  if (conflictType === 'escalation-deadlock') return 'arbitration-required';
  if (conflictType === 'policy-divergence' || conflictType === 'continuity-jurisdiction') {
    return involvedTiers.includes('national') ? 'national-override' : 'federation-mediation';
  }
  if (conflictType === 'publication-dispute') return 'federation-mediation';
  if (conflictType === 'authority-override') {
    return involvedTiers.includes('national') ? 'national-override' : 'executive-escalation';
  }
  if (conflictType === 'ai-autonomy-conflict') return 'executive-escalation';
  if (conflictType === 'audit-visibility-disagreement') return 'local-withdrawal';
  return 'federation-mediation';
}

// ── Conflict detectors ────────────────────────────────────────────────────────

/**
 * Detect policy divergence between two sovereignty contracts.
 */
export function detectPolicyDivergence(
  parent: SovereignGovernanceContract,
  child: SovereignGovernanceContract,
): SovereigntyConflictResult {
  const divergentPolicies = child.overrideRestrictions.filter((r) =>
    parent.inheritedPolicies.includes(r),
  );

  const conflictDetected = divergentPolicies.length > 0;
  const autoResolvable =
    !conflictDetected || child.sovereigntyMode === 'federation-aligned';

  const involvedTiers: SovereigntyTier[] = [
    parent.sovereigntyTier,
    child.sovereigntyTier,
  ];

  return {
    conflictId: nextConflictId(),
    conflictType: 'policy-divergence',
    involvedTiers,
    conflictDetected,
    resolutionPath: selectResolutionPath('policy-divergence', involvedTiers, autoResolvable),
    escalationRequired: conflictDetected && !autoResolvable,
    autoResolvable,
    evidenceRequired: conflictDetected,
    diagnostics: {
      divergentPolicies,
      parentTier: parent.sovereigntyTier,
      childTier: child.sovereigntyTier,
      governanceMode: 'shadow',
    },
  };
}

/**
 * Detect an authority override attempt.
 */
export function detectAuthorityOverride(
  contract: SovereignGovernanceContract,
  attemptedAuthority: string,
): SovereigntyConflictResult {
  const conflictDetected = contract.overrideRestrictions.includes(attemptedAuthority);
  const involvedTiers: SovereigntyTier[] = [contract.sovereigntyTier];

  return {
    conflictId: nextConflictId(),
    conflictType: 'authority-override',
    involvedTiers,
    conflictDetected,
    resolutionPath: selectResolutionPath('authority-override', involvedTiers, !conflictDetected),
    escalationRequired: conflictDetected,
    autoResolvable: !conflictDetected,
    evidenceRequired: conflictDetected,
    diagnostics: {
      attemptedAuthority,
      tier: contract.sovereigntyTier,
      mode: contract.sovereigntyMode,
      governanceMode: 'shadow',
    },
  };
}

/**
 * Detect a publication dispute between two units attempting to co-publish
 * without aligned publication authority.
 */
export function detectPublicationDispute(
  unitA: SovereignGovernanceContract,
  unitB: SovereignGovernanceContract,
): SovereigntyConflictResult {
  const aHasPublication = unitA.delegatedAuthorities.includes('publication');
  const bHasPublication = unitB.delegatedAuthorities.includes('publication');
  const aRestricted = unitA.overrideRestrictions.includes('publication');
  const bRestricted = unitB.overrideRestrictions.includes('publication');

  const conflictDetected =
    (aHasPublication && bRestricted) ||
    (bHasPublication && aRestricted) ||
    (!aHasPublication && !bHasPublication);

  const involvedTiers: SovereigntyTier[] = [
    unitA.sovereigntyTier,
    unitB.sovereigntyTier,
  ];

  return {
    conflictId: nextConflictId(),
    conflictType: 'publication-dispute',
    involvedTiers,
    conflictDetected,
    resolutionPath: selectResolutionPath('publication-dispute', involvedTiers, !conflictDetected),
    escalationRequired: conflictDetected,
    autoResolvable: !conflictDetected,
    evidenceRequired: conflictDetected,
    diagnostics: {
      aHasPublication,
      bHasPublication,
      aRestricted,
      bRestricted,
      governanceMode: 'shadow',
    },
  };
}

/**
 * Detect an AI autonomy conflict.
 */
export function detectAIAutonomyConflict(
  contract: SovereignGovernanceContract,
  attemptedAIOperation: string,
): SovereigntyConflictResult {
  const hasAIAuthority = contract.delegatedAuthorities.includes('ai-operations');
  const aiRestricted = contract.overrideRestrictions.includes('ai-operations');
  const modeRestricts =
    contract.sovereigntyMode === 'restricted' ||
    contract.sovereigntyMode === 'oversight-required';

  const conflictDetected = !hasAIAuthority || aiRestricted || modeRestricts;
  const involvedTiers: SovereigntyTier[] = [contract.sovereigntyTier];

  return {
    conflictId: nextConflictId(),
    conflictType: 'ai-autonomy-conflict',
    involvedTiers,
    conflictDetected,
    resolutionPath: selectResolutionPath('ai-autonomy-conflict', involvedTiers, !conflictDetected),
    escalationRequired: conflictDetected,
    autoResolvable: !conflictDetected,
    evidenceRequired: conflictDetected,
    diagnostics: {
      attemptedAIOperation,
      hasAIAuthority,
      aiRestricted,
      modeRestricts,
      governanceMode: 'shadow',
    },
  };
}

/**
 * Detect an audit visibility disagreement.
 */
export function detectAuditVisibilityDisagreement(
  contract: SovereignGovernanceContract,
  requestedScope: 'local' | 'regional' | 'national' | 'federated',
): SovereigntyConflictResult {
  const scopeOrder = ['local', 'regional', 'national', 'federated'];
  const permittedIdx = scopeOrder.indexOf(contract.auditVisibility);
  const requestedIdx = scopeOrder.indexOf(requestedScope);

  const conflictDetected = requestedIdx > permittedIdx;
  const involvedTiers: SovereigntyTier[] = [contract.sovereigntyTier];

  return {
    conflictId: nextConflictId(),
    conflictType: 'audit-visibility-disagreement',
    involvedTiers,
    conflictDetected,
    resolutionPath: selectResolutionPath('audit-visibility-disagreement', involvedTiers, !conflictDetected),
    escalationRequired: false,
    autoResolvable: !conflictDetected,
    evidenceRequired: conflictDetected,
    diagnostics: {
      permittedScope: contract.auditVisibility,
      requestedScope,
      governanceMode: 'shadow',
    },
  };
}

/**
 * Detect an escalation deadlock between two tiers.
 */
export function detectEscalationDeadlock(
  tierA: SovereigntyTier,
  tierB: SovereigntyTier,
  conflictType: SovereigntyConflictType,
): SovereigntyConflictResult {
  const bothHighTier = tierA === 'national' && tierB === 'national';
  const conflictDetected =
    bothHighTier || (tierA === tierB && conflictType !== 'policy-divergence');

  return {
    conflictId: nextConflictId(),
    conflictType: 'escalation-deadlock',
    involvedTiers: [tierA, tierB],
    conflictDetected,
    resolutionPath: conflictDetected ? 'arbitration-required' : 'none',
    escalationRequired: conflictDetected,
    autoResolvable: false,
    evidenceRequired: conflictDetected,
    diagnostics: {
      tierA,
      tierB,
      underlyingConflict: conflictType,
      governanceMode: 'shadow',
    },
  };
}
