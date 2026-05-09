/**
 * @nzila/governance-runtime — Deployment legitimacy validation
 *
 * Validates that the running release is legitimate: identifiable, manifest-bound,
 * environment-isolated, migration-correct, and rollback-attested.
 *
 * @module @nzila/governance-runtime/deployment-legitimacy
 */
import type {
  DeploymentLegitimacyCheck,
  DeploymentLegitimacyReport,
  DeploymentLegitimacyVerdict,
  EnvironmentIdentity,
  ReleaseIdentity,
} from './types'

export interface DeploymentLegitimacyInput {
  readonly release: ReleaseIdentity
  readonly environment: EnvironmentIdentity
  /** Expected manifest hash from the manifest registry. */
  readonly expectedManifestHash: string
  /** Currently applied schema version. */
  readonly currentSchemaVersion: string
  /** Schema version declared in the manifest. */
  readonly manifestSchemaVersion: string
  /** True if isolation invariants currently hold for this scope. */
  readonly isolationInvariantsHold: boolean
  /** True if the rollback target (if any) is itself attested. Pass true when no rollback is in flight. */
  readonly rollbackTargetAttested: boolean
}

export interface DeploymentLegitimacyOptions {
  readonly evaluatedAt?: string
}

export function validateDeploymentLegitimacy(
  input: DeploymentLegitimacyInput,
  options: DeploymentLegitimacyOptions = {},
): DeploymentLegitimacyReport {
  const checks: DeploymentLegitimacyCheck[] = []

  checks.push({
    name: 'release-identity-bound',
    status: input.release.releaseId.length > 0 ? 'pass' : 'fail',
    reason:
      input.release.releaseId.length > 0
        ? undefined
        : 'release identity not bound at runtime',
  })

  checks.push({
    name: 'manifest-hash-matches',
    status: input.release.manifestHash === input.expectedManifestHash ? 'pass' : 'fail',
    reason:
      input.release.manifestHash === input.expectedManifestHash
        ? undefined
        : 'release manifest hash does not match expected manifest hash',
  })

  checks.push({
    name: 'environment-identity-verified',
    status: input.environment.provenance.length > 0 ? 'pass' : 'fail',
    reason:
      input.environment.provenance.length > 0
        ? undefined
        : 'environment identity provenance missing',
  })

  checks.push({
    name: 'migration-parity',
    status: input.currentSchemaVersion === input.manifestSchemaVersion ? 'pass' : 'fail',
    reason:
      input.currentSchemaVersion === input.manifestSchemaVersion
        ? undefined
        : `migration parity failure: current=${input.currentSchemaVersion} manifest=${input.manifestSchemaVersion}`,
  })

  checks.push({
    name: 'isolation-invariants',
    status: input.isolationInvariantsHold ? 'pass' : 'fail',
    reason: input.isolationInvariantsHold ? undefined : 'isolation invariants broken',
  })

  checks.push({
    name: 'rollback-target-attested',
    status: input.rollbackTargetAttested ? 'pass' : 'fail',
    reason: input.rollbackTargetAttested ? undefined : 'rollback target is not attested',
  })

  const failures = checks.filter((c) => c.status === 'fail')
  const verdict: DeploymentLegitimacyVerdict =
    failures.length === 0
      ? 'verified'
      : failures.length === checks.length
        ? 'rejected'
        : failures.some((f) =>
              [
                'release-identity-bound',
                'manifest-hash-matches',
                'environment-identity-verified',
              ].includes(f.name),
            )
          ? 'rejected'
          : 'partial'

  return {
    verdict,
    checks,
    release: input.release,
    environment: input.environment,
    evaluatedAt: options.evaluatedAt ?? new Date().toISOString(),
  }
}
