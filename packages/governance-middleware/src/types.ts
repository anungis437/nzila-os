/**
 * @nzila/governance-middleware — Types
 *
 * Local shapes for the emitter and gates. These are structurally
 * compatible with the canonical envelope from
 * `@nzila/governance-telemetry` but kept local to avoid workspace
 * coupling at type level.
 *
 * @module @nzila/governance-middleware/types
 */

export type GovernanceSeverity = 'info' | 'warning' | 'critical'

export interface GovernanceSubject {
  readonly kind: string
  readonly id: string
  readonly attributes?: Readonly<Record<string, unknown>>
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

export interface GovernanceEventEnvelope {
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

export interface GovernanceSink {
  readonly name: string
  emit(envelope: GovernanceEventEnvelope): void | Promise<void>
}
