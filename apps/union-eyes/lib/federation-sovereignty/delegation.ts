/**
 * Delegation chain engine.
 *
 * Evaluates whether a federation unit holds a valid delegation grant
 * for a given authority, resolves the grant path, and detects conflicts
 * or sub-delegation violations.
 *
 * Read-only. Never mutates production state.
 *
 * @module lib/federation-sovereignty/delegation
 */

import type {
  SovereignGovernanceContract,
  DelegatedAuthority,
  DelegationGrant,
  DelegationChainResult,
  SovereigntyTier,
} from './types';

// ── Grant registry (in-process) ───────────────────────────────────────────────

// ga-check:exempt — in-process runtime registry, not primary persistence
const _grants = new Map<string, DelegationGrant[]>();

/** Register one or more delegation grants into the in-process registry. */
export function registerDelegationGrants(grants: DelegationGrant[]): void {
  for (const grant of grants) {
    const key = grant.receivingFederationId;
    const existing = _grants.get(key) ?? [];
    existing.push(grant);
    _grants.set(key, existing);
  }
}

/** Clear the delegation grant registry (for testing). */
export function _resetDelegationRegistry(): void {
  _grants.clear();
}

/** Return all grants registered for a given federation unit. */
export function getGrantsForFederation(federationId: string): DelegationGrant[] {
  return _grants.get(federationId) ?? [];
}

// ── Chain evaluation ──────────────────────────────────────────────────────────

/**
 * Evaluate whether `federationId` holds a valid grant for `authority`,
 * traversing the contract's inherited policies and the grant registry.
 */
export function evaluateDelegationChain(
  contract: SovereignGovernanceContract,
  authority: DelegatedAuthority,
): DelegationChainResult {
  const directGrants = getGrantsForFederation(contract.federationId).filter(
    (g) => g.authority === authority,
  );

  const contractDelegated = contract.delegatedAuthorities.includes(authority);
  const contractRestricted = contract.overrideRestrictions.includes(authority);

  const conflicts: string[] = [];

  if (contractRestricted) {
    conflicts.push(`authority.${authority}.restricted-by-contract`);
  }

  const nonSubDelegatable = directGrants.filter(
    (g) => !g.subDelegationAllowed && g.authority === authority,
  );
  if (nonSubDelegatable.length > 0) {
    conflicts.push(`sub-delegation.${authority}.not-permitted`);
  }

  const grantPath: SovereigntyTier[] = directGrants.length > 0
    ? [...new Set(directGrants.map((g) => g.grantingTier))]
    : [];

  const granted = (contractDelegated || directGrants.length > 0) && !contractRestricted;

  const conditions = directGrants.flatMap((g) => g.conditions);

  return {
    federationId: contract.federationId,
    authority,
    granted,
    grantPath,
    conditions: [...new Set(conditions)],
    subDelegationAllowed:
      directGrants.some((g) => g.subDelegationAllowed) || false,
    conflicts,
    diagnostics: {
      contractDelegated,
      contractRestricted,
      directGrantCount: directGrants.length,
      governanceMode: 'shadow',
    },
  };
}

/**
 * Evaluate all delegated authorities in a contract, returning a map of results.
 */
export function evaluateAllDelegations(
  contract: SovereignGovernanceContract,
): Map<DelegatedAuthority, DelegationChainResult> {
  const allAuthorities: DelegatedAuthority[] = [
    'publication',
    'policy-enforcement',
    'member-governance',
    'ai-operations',
    'audit-visibility',
    'continuity-management',
  ];

  const results = new Map<DelegatedAuthority, DelegationChainResult>();
  for (const authority of allAuthorities) {
    results.set(authority, evaluateDelegationChain(contract, authority));
  }
  return results;
}

/**
 * Detect any revocable grants in the chain — useful for continuity stress
 * simulation (a grant revocation can instantly strip an authority).
 */
export function detectRevocableGrants(
  federationId: string,
  authority: DelegatedAuthority,
): DelegationGrant[] {
  return getGrantsForFederation(federationId).filter(
    (g) => g.authority === authority && g.revocable,
  );
}
