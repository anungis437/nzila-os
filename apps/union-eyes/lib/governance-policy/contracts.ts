/**
 * Governance policy contracts.
 *
 * A `GovernancePolicyContract` is an executable governance metadata object that
 * declaratively specifies the operational governance requirements for a scope.
 *
 * Contracts are evaluated by `evaluation.ts` at request-time (or shadow-time)
 * and used by the route-policy engine, the public-experience governance layer,
 * AI governance, and export controls.
 *
 * This module also exports the built-in platform-wide contracts that are
 * auto-registered at startup.
 *
 * @module lib/governance-policy/contracts
 */

import type {
  GovernancePolicyScope,
  GovernanceSensitivity,
  GovernanceRequirement,
  EvaluationMode,
} from './types';

// ── Contract shape ─────────────────────────────────────────────────────────────

/**
 * Executable governance metadata for a governed scope.
 *
 * Contracts are immutable once registered. Override them by registering a
 * higher-priority contract for the same scope+id, or by composing contracts
 * with `mergeContracts()`.
 */
export interface GovernancePolicyContract {
  /** Unique identifier — stable across deployments (no UUIDs). */
  id: string;

  /** Human-readable label for evidence and procurement reports. */
  label: string;

  /** Domain this contract governs. */
  scope: GovernancePolicyScope;

  /** Sensitivity tier — drives default audit/approval requirements. */
  sensitivity: GovernanceSensitivity;

  /** Discrete governance requirements imposed by this contract. */
  requirements: GovernanceRequirement[];

  /** Whether the outcome of this operation must produce evidence. */
  evidenceRequired: boolean;

  /** Whether an audit log entry is mandatory on every execution. */
  auditRequired: boolean;

  /**
   * Data-retention policy identifier.
   * References an external retention schedule (e.g. `"standard-7y"`, `"member-3y"`).
   */
  retentionPolicy?: string;

  /**
   * Org-scoping strictness.
   * - `strict`  — cross-org access is always denied.
   * - `standard` — cross-org access follows role checks.
   */
  orgScoping?: 'strict' | 'standard';

  /**
   * Whether this contract participates in federation inheritance.
   * If true, child orgs inherit it unless they provide a stricter override.
   */
  federationInheritance?: boolean;

  /**
   * Whether operations governed by this contract may have public visibility.
   * Requires `executive-approval` in `requirements` when true.
   */
  publicVisibility?: boolean;

  /**
   * Evaluation mode. Defaults to `'shadow'` during rollout; switch to
   * `'enforce'` once coverage is confirmed.
   */
  mode: EvaluationMode;
}

// ── Contract helpers ───────────────────────────────────────────────────────────

/**
 * Merge two contracts — the `override` contract wins for every defined field.
 * `requirements` are unioned (no duplicates). `mode` from override wins.
 *
 * Used to compose local org overrides on top of federation baseline contracts.
 */
export function mergeContracts(
  base: GovernancePolicyContract,
  override: Partial<GovernancePolicyContract>,
): GovernancePolicyContract {
  return {
    ...base,
    ...override,
    id: override.id ?? base.id,
    requirements: Array.from(
      new Set([...base.requirements, ...(override.requirements ?? [])]),
    ),
  };
}

// ── Platform built-in contracts ────────────────────────────────────────────────

/**
 * Default contract applied to all governed API routes.
 * Shadow-mode: evaluation is logged but never blocks.
 */
export const CONTRACT_ROUTE_DEFAULT: GovernancePolicyContract = {
  id: 'route.default',
  label: 'Default Route Governance',
  scope: 'route',
  sensitivity: 'moderate',
  requirements: ['audit'],
  evidenceRequired: false,
  auditRequired: true,
  orgScoping: 'standard',
  federationInheritance: true,
  mode: 'shadow',
};

/**
 * Contract for admin/system-admin routes.
 * Elevates to HIGH severity and locks org-scoping to strict.
 */
export const CONTRACT_ROUTE_ADMIN: GovernancePolicyContract = {
  id: 'route.admin',
  label: 'Admin Route Governance',
  scope: 'route',
  sensitivity: 'high',
  requirements: ['audit', 'retention-lock'],
  evidenceRequired: true,
  auditRequired: true,
  orgScoping: 'strict',
  federationInheritance: true,
  mode: 'shadow',
};

/**
 * Contract for public-experience surfaces.
 * Requires executive approval and federation review for public visibility.
 */
export const CONTRACT_PUBLIC_SURFACE: GovernancePolicyContract = {
  id: 'public-experience.surface',
  label: 'Public Surface Governance',
  scope: 'public-experience',
  sensitivity: 'high',
  requirements: ['audit', 'executive-approval', 'member-visible'],
  evidenceRequired: true,
  auditRequired: true,
  orgScoping: 'standard',
  federationInheritance: true,
  publicVisibility: true,
  mode: 'shadow',
};

/**
 * Contract for federation-level public surfaces.
 * Adds federation-review requirement and elevates to critical.
 */
export const CONTRACT_FEDERATION_SURFACE: GovernancePolicyContract = {
  id: 'public-experience.federation',
  label: 'Federation Surface Governance',
  scope: 'public-experience',
  sensitivity: 'critical',
  requirements: [
    'audit',
    'executive-approval',
    'federation-review',
    'member-visible',
  ],
  evidenceRequired: true,
  auditRequired: true,
  orgScoping: 'strict',
  federationInheritance: true,
  publicVisibility: true,
  mode: 'shadow',
};

/**
 * Contract for AI assistive operations (autocomplete, hints).
 * Minimal governance — no review required.
 */
export const CONTRACT_AI_ASSISTIVE: GovernancePolicyContract = {
  id: 'ai-operation.assistive',
  label: 'AI Assistive Operation',
  scope: 'ai-operation',
  sensitivity: 'low',
  requirements: ['audit'],
  evidenceRequired: false,
  auditRequired: true,
  mode: 'shadow',
};

/**
 * Contract for AI sensitive operations (member data, labour records).
 * Human review recommended; audit mandatory.
 */
export const CONTRACT_AI_SENSITIVE: GovernancePolicyContract = {
  id: 'ai-operation.sensitive',
  label: 'AI Sensitive Operation',
  scope: 'ai-operation',
  sensitivity: 'high',
  requirements: ['audit', 'retention-lock', 'executive-approval'],
  evidenceRequired: true,
  auditRequired: true,
  mode: 'shadow',
};

/**
 * Contract for data exports.
 * Requires retention lock and legal review for external exports.
 */
export const CONTRACT_EXPORT: GovernancePolicyContract = {
  id: 'export.default',
  label: 'Data Export Governance',
  scope: 'export',
  sensitivity: 'high',
  requirements: ['audit', 'retention-lock', 'legal-review'],
  evidenceRequired: true,
  auditRequired: true,
  orgScoping: 'strict',
  federationInheritance: true,
  mode: 'shadow',
};

/**
 * All built-in platform contracts for auto-registration.
 */
export const PLATFORM_CONTRACTS: GovernancePolicyContract[] = [
  CONTRACT_ROUTE_DEFAULT,
  CONTRACT_ROUTE_ADMIN,
  CONTRACT_PUBLIC_SURFACE,
  CONTRACT_FEDERATION_SURFACE,
  CONTRACT_AI_ASSISTIVE,
  CONTRACT_AI_SENSITIVE,
  CONTRACT_EXPORT,
];
