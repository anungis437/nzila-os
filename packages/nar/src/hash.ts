import { createHash, createHmac } from 'node:crypto'
import type { NarExportPack, NarRecord } from './types'

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeValue(entry))
  }

  if (value && typeof value === 'object') {
    const input = value as Record<string, unknown>
    const output: Record<string, unknown> = {}
    const keys = Object.keys(input).sort((left, right) => left.localeCompare(right))
    for (const key of keys) {
      output[key] = normalizeValue(input[key])
    }
    return output
  }

  return value
}

export function canonicalStringify(value: unknown): string {
  return JSON.stringify(normalizeValue(value))
}

function narHashPayload(record: Omit<NarRecord, 'seal'> | NarRecord): Record<string, unknown> {
  const payload = record as NarRecord & { previousHash?: string }
  const previousHash = payload.seal?.previousHash ?? payload.previousHash
  return {
    id: payload.id,
    decisionRecordId: payload.decisionRecordId,
    organizationId: payload.organizationId,
    decisionType: payload.decisionType,
    actionType: payload.actionType,
    actorId: payload.actorId,
    actorType: payload.actorType,
    resourceType: payload.resourceType,
    resourceId: payload.resourceId,
    policyId: payload.policyId,
    policyVersion: payload.policyVersion,
    inputHash: payload.inputHash,
    outcomeHash: payload.outcomeHash,
    createdAt: payload.createdAt,
    payload: payload.payload,
    storage: payload.storage,
    previousHash,
  }
}

export function computeNarHash(record: Omit<NarRecord, 'seal'> | NarRecord): string {
  return createHash('sha256').update(canonicalStringify(narHashPayload(record))).digest('hex')
}

export function signNarHash(hash: string, secret: string): string {
  return createHmac('sha256', secret).update(hash).digest('hex')
}

export function computeNarExportPackHash(pack: Omit<NarExportPack, 'verification'>): string {
  return createHash('sha256').update(canonicalStringify(pack)).digest('hex')
}

export function signNarExportPackHash(checksum: string, secret: string): string {
  return createHmac('sha256', secret).update(checksum).digest('hex')
}
