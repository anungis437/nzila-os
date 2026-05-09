/**
 * @nzila/runtime-attestation — Ledger
 *
 * Append-only, content-addressable evidence ledger. Mutation is rejected;
 * updates are expressed as supersession.
 *
 * @module @nzila/runtime-attestation/ledger
 */
import { z } from 'zod'

import { computeContentHash } from './content-hash'
import type { LedgerRecord } from './types'

const accessClassSchema = z.enum([
  'platform-only',
  'governance-forum',
  'product-team',
  'external-attestation',
])

const retentionClassSchema = z.enum(['short', 'standard', 'extended', 'archival'])

export const ledgerRecordSchema: z.ZodType<LedgerRecord> = z
  .object({
    id: z.string().min(1),
    contentHash: z.string().min(8),
    type: z.string().min(1),
    subject: z
      .object({ kind: z.string().min(1), id: z.string().min(1) })
      .strict(),
    scope: z
      .object({
        product: z.string().min(1).optional(),
        environment: z.string().min(1).optional(),
      })
      .strict(),
    releaseId: z.string().min(1).optional(),
    payload: z.record(z.string(), z.unknown()),
    supersedes: z.string().min(1).optional(),
    supersededBy: z.string().min(1).optional(),
    retentionClass: retentionClassSchema,
    accessClass: accessClassSchema,
    writtenAt: z.string().refine((s) => !Number.isNaN(Date.parse(s))),
    signature: z
      .object({
        signer: z.string().min(1),
        algorithm: z.enum(['ed25519', 'ecdsa-p256']),
        value: z.string().min(1),
        signedAt: z.string().refine((s) => !Number.isNaN(Date.parse(s))),
      })
      .strict()
      .optional(),
  })
  .strict()

export class LedgerMutationRejectedError extends Error {
  constructor(id: string) {
    super(
      `ledger_mutation_rejected: record "${id}" already exists; issue a supersession instead`,
    )
    this.name = 'LedgerMutationRejectedError'
  }
}

export class ContentHashMismatchError extends Error {
  constructor(id: string) {
    super(`content_hash_mismatch: record "${id}" content hash does not match payload`)
    this.name = 'ContentHashMismatchError'
  }
}

export class GovernanceEvidenceLedger {
  private readonly records = new Map<string, LedgerRecord>()

  /**
   * Append a new record. Throws if a record with the same id already exists,
   * if the content hash doesn't match the payload, or if the record fails
   * schema validation.
   */
  append(record: LedgerRecord): LedgerRecord {
    const validated = ledgerRecordSchema.parse(record)
    if (this.records.has(validated.id)) {
      throw new LedgerMutationRejectedError(validated.id)
    }
    const expectedHash = computeContentHash(validated.payload)
    if (expectedHash !== validated.contentHash) {
      throw new ContentHashMismatchError(validated.id)
    }
    this.records.set(validated.id, validated)
    return validated
  }

  /**
   * Append a supersession record. Marks the prior record as supersededBy
   * the new one. The prior record's other fields remain unchanged.
   */
  supersede(priorId: string, newRecord: LedgerRecord): LedgerRecord {
    const prior = this.records.get(priorId)
    if (!prior) throw new Error(`no such record: ${priorId}`)
    if (prior.supersededBy) {
      throw new Error(`record "${priorId}" already superseded by ${prior.supersededBy}`)
    }
    const linked: LedgerRecord = { ...newRecord, supersedes: priorId }
    const appended = this.append(linked)
    this.records.set(priorId, { ...prior, supersededBy: appended.id })
    return appended
  }

  get(id: string): LedgerRecord | undefined {
    return this.records.get(id)
  }

  list(): readonly LedgerRecord[] {
    return Array.from(this.records.values())
  }

  size(): number {
    return this.records.size
  }
}
