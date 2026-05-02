import type { DecisionRecord } from '@nzila/decision-core'

export type NarStorageRef = {
  type: 'azure_blob'
  uri: string
  immutable: true
  retentionUntil: string
}

export type NarSeal = {
  algorithm: 'sha256'
  keyId: string
  hash: string
  signature: string
  previousHash?: string
  signedAt: string
}

export type NarRecord = {
  id: string
  decisionRecordId: string
  organizationId: string
  decisionType: string
  actionType: string
  actorId: string
  actorType: 'user' | 'system' | 'api'
  resourceType: string
  resourceId: string
  policyId: string
  policyVersion: string
  inputHash: string
  outcomeHash: string
  createdAt: string
  payload: DecisionRecord
  storage?: NarStorageRef
  seal: NarSeal
}

export type NarExportChainProof = {
  rootHash: string
  totalRecords: number
  verified: boolean
}

export type NarExportMetadata = {
  systemVersion: string
  exportVersion: string
  generatedBy: string
}

export type NarExportVerification = {
  instructions: string
  checksum: string
  signature: string
}

export type NarExportPack = {
  version: '2.0'
  generatedAt: string
  organizationId: string
  records: NarRecord[]
  chainProof: NarExportChainProof
  metadata: NarExportMetadata
  verification: NarExportVerification
}

export type NarExportFormat = 'json' | 'zip'

export type NarVerificationResult = {
  valid: boolean
  errors: string[]
  expectedHash?: string
  computedHash?: string
  signatureValid?: boolean
  chainValid?: boolean
}

export type NarRecordInput = {
  recordId?: string
  decision: DecisionRecord
  decisionType: string
  actionType: string
  previousHash?: string
  isGenesis?: boolean
  storage?: NarStorageRef
  keyId?: string
  createdAt?: string
  secret?: string
}

export type NarProof = {
  auditRecordId: string
  hash: string
  signature: string
  previousHash?: string
  verified: true
}

export type NarProofAdapterOptions = {
  keyId?: string
  retentionYears?: number
  getPreviousHash: (organizationId: string) => Promise<string | undefined>
  persistImmutableStorage?: (record: NarRecord) => Promise<NarStorageRef>
  persistRecord: (record: NarRecord) => Promise<{ auditRecordId: string }>
  getSigningSecret?: () => Promise<string>
}

export type NarChainVerificationIssue = {
  index: number
  recordId: string
  reason: string
}

export type NarChainVerificationResult = {
  organizationId: string
  totalRecords: number
  valid: boolean
  corruptionIndex?: number
  anomalies: NarChainVerificationIssue[]
  rootHash?: string
}

export type NarExportPackBuildOptions = {
  generatedAt?: string
  systemVersion?: string
  exportVersion?: string
  generatedBy?: string
  signingSecret?: string
}
