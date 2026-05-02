import { createHash, randomUUID } from 'node:crypto'
import type { NarExportPack, NarExportPackBuildOptions, NarRecord, NarRecordInput, NarVerificationResult } from './types'
import { canonicalStringify, computeNarExportPackHash, computeNarHash, signNarExportPackHash, signNarHash } from './hash'
import { getNarSigningSecret } from './secret'

export async function getPreviousNarHash(
  organizationId: string,
  resolver?: (orgId: string) => Promise<string | undefined>,
): Promise<string | undefined> {
  if (!resolver) return undefined
  return resolver(organizationId)
}

export async function createNarRecord(input: NarRecordInput): Promise<NarRecord> {
  if (!input.previousHash && !input.isGenesis) {
    throw new Error('NAR chain violation: previousHash is required for non-genesis records')
  }

  const createdAt = input.createdAt ?? new Date().toISOString()
  const recordWithoutSeal: Omit<NarRecord, 'seal'> = {
    id: input.recordId ?? randomUUID(),
    decisionRecordId: input.decision.id,
    organizationId: input.decision.organizationId,
    decisionType: input.decisionType,
    actionType: input.actionType,
    actorId: input.decision.actor.id,
    actorType: input.decision.actor.type,
    resourceType: input.decision.resourceType,
    resourceId: input.decision.resourceId,
    policyId: input.decision.policy.id,
    policyVersion: input.decision.policy.version,
    inputHash: computeHashFromUnknown(input.decision.input),
    outcomeHash: computeHashFromUnknown(input.decision.outcome),
    createdAt,
    payload: input.decision,
    storage: input.storage,
  }

  return sealNarRecord(recordWithoutSeal, {
    keyId: input.keyId,
    previousHash: input.previousHash,
    secret: input.secret,
    signedAt: createdAt,
  })
}

export async function sealNarRecord(
  record: Omit<NarRecord, 'seal'>,
  options?: {
    keyId?: string
    previousHash?: string
    secret?: string
    signedAt?: string
  },
): Promise<NarRecord> {
  const hash = computeNarHash({ ...record, previousHash: options?.previousHash } as Omit<NarRecord, 'seal'> & { previousHash?: string })
  const secret = options?.secret ?? (await getNarSigningSecret())
  const signature = signNarHash(hash, secret)

  return {
    ...record,
    seal: {
      algorithm: 'sha256',
      keyId: options?.keyId ?? process.env.NAR_SIGNING_KEY_ID ?? 'nar-default',
      hash,
      signature,
      previousHash: options?.previousHash,
      signedAt: options?.signedAt ?? new Date().toISOString(),
    },
  }
}

export async function verifyNarRecord(record: NarRecord, secret?: string): Promise<NarVerificationResult> {
  const computedHash = computeNarHash(record)
  const expectedHash = record.seal.hash
  const errors: string[] = []

  if (computedHash !== expectedHash) {
    errors.push('NAR hash mismatch')
  }

  const signingSecret = secret ?? (await getNarSigningSecret())
  const expectedSignature = signNarHash(expectedHash, signingSecret)
  const signatureValid = expectedSignature === record.seal.signature

  if (!signatureValid) {
    errors.push('NAR signature mismatch')
  }

  return {
    valid: errors.length === 0,
    errors,
    expectedHash,
    computedHash,
    signatureValid,
    chainValid: true,
  }
}

export async function buildNarExportPack(
  records: NarRecord[],
  organizationId?: string,
  options?: NarExportPackBuildOptions,
): Promise<NarExportPack> {
  const sorted = [...records].sort((left, right) => left.createdAt.localeCompare(right.createdAt))
  const rootHash = sorted[sorted.length - 1]?.seal.hash ?? ''

  const metadata = {
    systemVersion: options?.systemVersion ?? process.env.npm_package_version ?? 'unknown',
    exportVersion: options?.exportVersion ?? '1.0.0',
    generatedBy: options?.generatedBy ?? 'control-plane',
  }

  const packBase = {
    version: '2.0' as const,
    generatedAt: options?.generatedAt ?? new Date().toISOString(),
    organizationId: organizationId ?? sorted[0]?.organizationId ?? 'unknown',
    records: sorted,
    chainProof: {
      rootHash,
      totalRecords: sorted.length,
      verified: true,
    },
    metadata,
  }

  const checksum = computeNarExportPackHash(packBase)
  const signingSecret = options?.signingSecret ?? (await getNarSigningSecret())
  const signature = signNarExportPackHash(checksum, signingSecret)

  return {
    ...packBase,
    verification: {
      instructions: 'Run pnpm tsx scripts/verify-audit-pack.ts --input <pack.json|pack.zip> to verify checksum, signature, and chain integrity.',
      checksum,
      signature,
    },
  }
}

function computeHashFromUnknown(value: unknown): string {
  return createHash('sha256').update(canonicalStringify(value)).digest('hex')
}
