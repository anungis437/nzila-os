/**
 * @nzila/governance-runtime — Types
 *
 * Release identity, environment identity, deployment legitimacy, and
 * governance assertion types.
 *
 * @module @nzila/governance-runtime/types
 */

// ── Release identity ────────────────────────────────────────────────────────

export interface ReleaseIdentity {
  /** Stable release id, e.g., "UE-2026-05-09-001". */
  readonly releaseId: string
  /** Commit SHA the release was built from. */
  readonly commitSha: string
  /** Hash of the deployment manifest. */
  readonly manifestHash: string
  /** ISO timestamp of build. */
  readonly builtAt: string
}

// ── Environment identity ────────────────────────────────────────────────────

export type EnvironmentClass =
  | 'production'
  | 'pilot'
  | 'staging'
  | 'demo'
  | 'development'

export interface EnvironmentIdentity {
  /** Stable environment label, e.g., "ue-pilot-2026q2". */
  readonly environment: string
  /** Environment class — drives isolation invariants. */
  readonly environmentClass: EnvironmentClass
  /** Provenance source the identity was read from. */
  readonly provenance: string
  /** Optional hash of the environment manifest. */
  readonly manifestHash?: string
}

// ── Deployment legitimacy result ────────────────────────────────────────────

export type DeploymentLegitimacyVerdict =
  | 'verified'
  | 'partial'
  | 'unverified'
  | 'rejected'

export interface DeploymentLegitimacyCheck {
  readonly name:
    | 'release-identity-bound'
    | 'manifest-hash-matches'
    | 'environment-identity-verified'
    | 'migration-parity'
    | 'isolation-invariants'
    | 'rollback-target-attested'
  readonly status: 'pass' | 'fail' | 'skipped'
  readonly reason?: string
}

export interface DeploymentLegitimacyReport {
  readonly verdict: DeploymentLegitimacyVerdict
  readonly checks: readonly DeploymentLegitimacyCheck[]
  readonly release: ReleaseIdentity
  readonly environment: EnvironmentIdentity
  readonly evaluatedAt: string
}
