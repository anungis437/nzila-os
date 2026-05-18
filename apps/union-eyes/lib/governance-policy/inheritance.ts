/**
 * Federation governance inheritance engine.
 *
 * Implements the hierarchy resolution rules for governance policy contracts
 * in federated union structures:
 *
 *   National → Regional → Local
 *
 * Rules:
 * 1. Child orgs inherit all federation baseline contracts from their parent.
 * 2. A child org may register stricter contracts (more requirements).
 * 3. A child org may NOT weaken a parent contract (fewer requirements,
 *    lower sensitivity, or less restrictive mode is rejected).
 * 4. `sensitivity` uses a most-restrictive-wins resolution.
 * 5. `mode` uses a most-restrictive-wins resolution (enforce > shadow).
 * 6. `requirements` are always the union of parent + child.
 *
 * This module is deliberately pure (no I/O, no side effects) so it can
 * be used safely in CI scripts and tests.
 *
 * @module lib/governance-policy/inheritance
 */

import type { GovernancePolicyContract } from './contracts';
import { mergeContracts } from './contracts';
import type { GovernanceSensitivity, EvaluationMode, FederationTier } from './types';

// ── Ranking tables ─────────────────────────────────────────────────────────────

const SENSITIVITY_RANK: Record<GovernanceSensitivity, number> = {
  low: 0,
  moderate: 1,
  high: 2,
  critical: 3,
};

const MODE_RANK: Record<EvaluationMode, number> = {
  shadow: 0,
  enforce: 1,
};

const TIER_RANK: Record<FederationTier, number> = {
  standalone: -1,
  national: 3,
  regional: 2,
  local: 1,
};

// ── Org node ───────────────────────────────────────────────────────────────────

/**
 * A node in the federation hierarchy.
 * Carries the org's own governance contracts plus a reference to its parent.
 */
export interface FederationOrgNode {
  orgId: string;
  tier: FederationTier;
  /**
   * Contracts registered by this org (NOT including inherited ones).
   * Use `resolveInheritedContracts()` to get the full effective set.
   */
  ownContracts: GovernancePolicyContract[];
  /** Parent org node. `null` for national / standalone orgs. */
  parent: FederationOrgNode | null;
}

// ── Inheritance resolution ─────────────────────────────────────────────────────

/**
 * Resolve the effective (inherited + own) contracts for a given org node.
 *
 * For each contract id in the ancestor chain, the most-restrictive version wins:
 * - highest sensitivity,
 * - most restrictive mode (enforce > shadow),
 * - union of all requirements.
 *
 * Contracts unique to the local org (not present in ancestors) are included
 * as-is.
 */
export function resolveInheritedContracts(
  node: FederationOrgNode,
): GovernancePolicyContract[] {
  // Collect contracts from root → leaf (breadth-first, ancestor-first)
  const chain: GovernancePolicyContract[][] = [];
  let current: FederationOrgNode | null = node;
  while (current !== null) {
    chain.unshift(current.ownContracts);
    current = current.parent;
  }

  // Build a map: contractId → most-restrictive resolved contract
  const resolved = new Map<string, GovernancePolicyContract>();

  for (const levelContracts of chain) {
    for (const contract of levelContracts) {
      const existing = resolved.get(contract.id);
      if (!existing) {
        resolved.set(contract.id, contract);
      } else {
        resolved.set(contract.id, _mostRestrictive(existing, contract));
      }
    }
  }

  return Array.from(resolved.values());
}

/**
 * Validate that a child org's contract does not weaken a parent contract.
 *
 * Returns a list of violation descriptions. Empty array means the child
 * contract is valid.
 */
export function validateInheritanceStrength(
  parentContract: GovernancePolicyContract,
  childContract: GovernancePolicyContract,
): string[] {
  const violations: string[] = [];

  if (
    SENSITIVITY_RANK[childContract.sensitivity] <
    SENSITIVITY_RANK[parentContract.sensitivity]
  ) {
    violations.push(
      `sensitivity weakened: parent='${parentContract.sensitivity}', child='${childContract.sensitivity}'`,
    );
  }

  if (MODE_RANK[childContract.mode] < MODE_RANK[parentContract.mode]) {
    violations.push(
      `mode weakened: parent='${parentContract.mode}', child='${childContract.mode}'`,
    );
  }

  for (const req of parentContract.requirements) {
    if (!childContract.requirements.includes(req)) {
      violations.push(`requirement removed: '${req}' present in parent but missing in child`);
    }
  }

  if (parentContract.orgScoping === 'strict' && childContract.orgScoping !== 'strict') {
    violations.push(`orgScoping weakened: parent='strict', child='${childContract.orgScoping ?? 'undefined'}'`);
  }

  return violations;
}

/**
 * Compare two contracts and return the more restrictive one.
 * Requirements are always unioned; sensitivity and mode use most-restrictive-wins.
 */
function _mostRestrictive(
  a: GovernancePolicyContract,
  b: GovernancePolicyContract,
): GovernancePolicyContract {
  const sensitivity: GovernanceSensitivity =
    SENSITIVITY_RANK[a.sensitivity] >= SENSITIVITY_RANK[b.sensitivity]
      ? a.sensitivity
      : b.sensitivity;

  const mode: EvaluationMode =
    MODE_RANK[a.mode] >= MODE_RANK[b.mode] ? a.mode : b.mode;

  const orgScoping: 'strict' | 'standard' | undefined =
    a.orgScoping === 'strict' || b.orgScoping === 'strict' ? 'strict' : a.orgScoping ?? b.orgScoping;

  return mergeContracts(a, {
    sensitivity,
    mode,
    orgScoping,
    evidenceRequired: a.evidenceRequired || b.evidenceRequired,
    auditRequired: a.auditRequired || b.auditRequired,
    federationInheritance: a.federationInheritance ?? b.federationInheritance,
    publicVisibility: a.publicVisibility ?? b.publicVisibility,
    requirements: [...a.requirements, ...b.requirements],
  });
}

/**
 * Return true if `childTier` is a valid subordinate of `parentTier`.
 * Standalone orgs have no parent.
 */
export function isValidChildTier(
  childTier: FederationTier,
  parentTier: FederationTier,
): boolean {
  if (childTier === 'standalone' || parentTier === 'standalone') return false;
  return TIER_RANK[childTier] < TIER_RANK[parentTier];
}
