/**
 * Governance policy registry.
 *
 * The registry is the single source of truth for all active governance policy
 * contracts. It is populated at application startup (or module load in tests)
 * by calling `registerContract()`.
 *
 * The registry is intentionally in-memory. Persistence of evaluation decisions
 * is handled by the decision ledger (see `evaluation.ts`), not the registry.
 *
 * @module lib/governance-policy/registry
 */

import { PLATFORM_CONTRACTS } from './contracts';
import type { GovernancePolicyContract } from './contracts';
import type { GovernancePolicyScope } from './types';

// ── Internal store ─────────────────────────────────────────────────────────────

// ga-check:exempt — in-process bootstrap registry, not primary persistence
const _contracts = new Map<string, GovernancePolicyContract>();

let _bootstrapped = false;

// ── Bootstrap ──────────────────────────────────────────────────────────────────

/**
 * Register all platform built-in contracts.
 * Idempotent — safe to call multiple times (test teardown, HMR, etc.).
 */
export function bootstrapPlatformContracts(): void {
  for (const contract of PLATFORM_CONTRACTS) {
    _contracts.set(contract.id, contract);
  }
  _bootstrapped = true;
}

// Auto-bootstrap on module load in non-test environments.
if (typeof process !== 'undefined' && process.env['NODE_ENV'] !== 'test') {
  bootstrapPlatformContracts();
}

// ── Registration ───────────────────────────────────────────────────────────────

/**
 * Register a governance policy contract.
 * If a contract with the same id is already registered, it is replaced.
 *
 * Org-specific or federation overrides should use `mergeContracts()` from
 * `contracts.ts` before registering to preserve baseline requirements.
 */
export function registerContract(contract: GovernancePolicyContract): void {
  _contracts.set(contract.id, contract);
}

/**
 * Register multiple contracts at once.
 */
export function registerContracts(
  contracts: GovernancePolicyContract[],
): void {
  for (const c of contracts) {
    registerContract(c);
  }
}

// ── Resolution ─────────────────────────────────────────────────────────────────

/**
 * Resolve a contract by its id.
 * Returns `undefined` if no contract is registered for the given id.
 */
export function resolveContract(
  id: string,
): GovernancePolicyContract | undefined {
  return _contracts.get(id);
}

/**
 * Return all contracts registered for a given scope.
 */
export function getContractsByScope(
  scope: GovernancePolicyScope,
): GovernancePolicyContract[] {
  return Array.from(_contracts.values()).filter((c) => c.scope === scope);
}

/**
 * Return all registered contracts (snapshot — not a live reference).
 */
export function getAllContracts(): GovernancePolicyContract[] {
  return Array.from(_contracts.values());
}

/**
 * Return true if the registry has been bootstrapped with platform contracts.
 */
export function isBootstrapped(): boolean {
  return _bootstrapped;
}

/**
 * Reset registry to empty state.
 * For test use only.
 */
export function _resetRegistry(): void {
  _contracts.clear();
  _bootstrapped = false;
}
