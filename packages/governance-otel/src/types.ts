/**
 * @nzila/governance-otel — Types
 *
 * Local mirror of the canonical event envelope shape so this package
 * does not depend on `@nzila/governance-telemetry` at type level (avoiding
 * workspace coupling for now). Structurally compatible.
 *
 * @module @nzila/governance-otel/types
 */

export type GovernanceSeverity = 'info' | 'warning' | 'critical'

export interface GovernanceSubject {
  readonly kind: string
  readonly id: string
}

export interface GovernanceScope {
  readonly product: string
  readonly environment: string
  readonly environmentClass: string
}

export interface GovernanceDoctrineCitation {
  readonly document: string
  readonly section?: string
  readonly policyId?: string
}

export interface GovernanceEventEnvelopeLike {
  readonly id: string
  readonly schemaVersion: string
  readonly type: string
  readonly severity: GovernanceSeverity
  readonly scope: GovernanceScope
  readonly subject: GovernanceSubject
  readonly doctrineCitations?: readonly GovernanceDoctrineCitation[]
  readonly decision?: string
  readonly releaseId: string
  readonly emittedAt: string
  readonly payload: Readonly<Record<string, unknown>>
  readonly correlationKey?: string
}
