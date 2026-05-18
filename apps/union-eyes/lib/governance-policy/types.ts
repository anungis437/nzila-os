/**
 * Core vocabulary for the governance policy orchestration layer.
 *
 * These types are the shared language across:
 *   - policy contracts      (contracts.ts)
 *   - the policy registry   (registry.ts)
 *   - the evaluation engine (evaluation.ts)
 *   - federation inheritance (inheritance.ts)
 *   - AI governance         (ai-governance.ts)
 *
 * @module lib/governance-policy/types
 */

/**
 * The domain to which a governance policy contract applies.
 */
export type GovernancePolicyScope =
  | 'route'               // API route or server action
  | 'dashboard'           // dashboard surface / sub-layout
  | 'public-experience'   // public-facing union surface
  | 'document'            // managed document (agreement, policy)
  | 'export'              // data export (member list, audit log, etc.)
  | 'ai-operation';       // AI/ML inference, generation, or retrieval action

/**
 * Sensitivity classification of a governed operation or surface.
 * Determines the default audit, retention, and approval requirements.
 */
export type GovernanceSensitivity =
  | 'low'       // non-sensitive operational action
  | 'moderate'  // member-impacting or org-scoped action
  | 'high'      // admin-tier, cross-org, or externally visible
  | 'critical'; // platform-wide, federation-level, or irreversible

/**
 * A discrete governance requirement that a contract can impose.
 * Multiple requirements may coexist on a single contract.
 */
export type GovernanceRequirement =
  | 'audit'               // must emit an audit log entry
  | 'executive-approval'  // requires officer/exec sign-off before execution
  | 'retention-lock'      // output subject to data-retention governance
  | 'legal-review'        // requires legal officer review gate
  | 'member-visible'      // content/result may be surfaced to members
  | 'federation-review';  // parent federation must approve before execution

/**
 * Mode controlling whether policy evaluation blocks or merely observes.
 *
 * - `shadow`  — evaluate and log; never block or reject. Safe for rollout.
 * - `enforce` — evaluate and enforce; block or reject on policy failure.
 */
export type EvaluationMode = 'shadow' | 'enforce';

/**
 * Risk tier of an AI operation.
 * Determines whether human review is required and what audit trail is needed.
 */
export type AIActionRisk =
  | 'assistive'   // surface hints / autocomplete — low risk, no review needed
  | 'advisory'    // recommendations surfaced to user — moderate risk
  | 'sensitive'   // actions involving member data or labour records — review recommended
  | 'restricted'; // irreversible or publicly visible AI actions — review required

/**
 * Governance tier in a federation hierarchy.
 * Used by the inheritance engine to determine resolution direction.
 */
export type FederationTier =
  | 'national'
  | 'regional'
  | 'local'
  | 'standalone'; // no federation parent
