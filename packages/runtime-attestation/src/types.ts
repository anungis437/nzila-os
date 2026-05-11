/**
 * @nzila/runtime-attestation — Types
 * @module @nzila/runtime-attestation/types
 */

export type AttestationClass =
  | 'deployment'
  | 'doctrine-compliance'
  | 'continuity-governance'
  | 'pilot-safety'
  | 'ai-governance'
  | 'environment-legitimacy'

export type AttestationVerdict =
  | 'verified'
  | 'partial'
  | 'unverified'
  | 'rejected'

export interface AttestationSubject {
  readonly kind: string
  readonly id: string
}

export interface EvidenceReference {
  readonly id: string
  readonly contentHash: string
  readonly description: string
}

export interface AttestationSignature {
  readonly signer: string
  readonly algorithm: 'ed25519' | 'ecdsa-p256'
  readonly value: string
  readonly signedAt: string
}

export interface RuntimeAttestation {
  readonly id: string
  readonly schemaVersion: string
  readonly class: AttestationClass
  readonly releaseId: string
  readonly environment: string
  readonly subject: AttestationSubject
  readonly verdict: AttestationVerdict
  readonly rationale: string
  readonly citedEvidence: readonly EvidenceReference[]
  readonly issuedBy: string // governance forum / system actor
  readonly issuedAt: string
  readonly window: { readonly start: string; readonly end: string }
  readonly signature?: AttestationSignature
}

export type RetentionClass =
  | 'short' // <= 90 days
  | 'standard' // 1 year
  | 'extended' // 7 years
  | 'archival' // indefinite

export type AccessClass =
  | 'platform-only'
  | 'governance-forum'
  | 'product-team'
  | 'external-attestation'

export interface LedgerRecord {
  readonly id: string
  readonly contentHash: string
  readonly type: string
  readonly subject: AttestationSubject
  readonly scope: { readonly product?: string; readonly environment?: string }
  readonly releaseId?: string
  readonly payload: Readonly<Record<string, unknown>>
  readonly supersedes?: string
  readonly supersededBy?: string
  readonly retentionClass: RetentionClass
  readonly accessClass: AccessClass
  readonly writtenAt: string
  readonly signature?: AttestationSignature
}

export interface AttestationManifest {
  readonly id: string
  readonly schemaVersion: string
  readonly releaseId: string
  readonly environment: string
  readonly attestations: readonly RuntimeAttestation[]
  readonly issuedAt: string
}
