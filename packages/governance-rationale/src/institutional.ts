import { createHash } from 'node:crypto'
import { z } from 'zod'
import { canonicalStringify } from '@nzila/nar'
import { institutionalScopeSchema, institutionalReferenceSchema } from '@nzila/platform-contracts'
import { governanceRationaleSchema } from './schema'

export const institutionalRationalePayloadSchema = z.object({
  scope: institutionalScopeSchema,
  schemaVersion: z.literal(1),
  rationale: governanceRationaleSchema,
  analysisRef: institutionalReferenceSchema,
  evidenceRefs: z.array(institutionalReferenceSchema).min(1),
  uncertaintyStatement: z.string().min(1),
  effectiveAt: z.string().datetime(),
  reviewAt: z.string().datetime().nullable(),
  authorityRef: z.string().min(1),
  decidedBy: z.string().min(1),
  decidedAt: z.string().datetime(),
}).strict()
export type InstitutionalRationalePayload = z.infer<typeof institutionalRationalePayloadSchema>
export interface DecidedInstitutionalRationale {
  payload: InstitutionalRationalePayload
  hashVersion: 1
  payloadHash: string
}

export function decideInstitutionalRationale(raw: unknown): DecidedInstitutionalRationale {
  const payload = institutionalRationalePayloadSchema.parse(raw)
  if (payload.rationale.status !== 'active' || payload.rationale.ownerId !== payload.decidedBy
    || payload.rationale.supersededBy !== null) throw new Error('INVALID_DECIDED_RATIONALE')
  const payloadHash = createHash('sha256').update(canonicalStringify(payload)).digest('hex')
  return { payload, hashVersion: 1, payloadHash }
}

export function verifyInstitutionalRationale(record: DecidedInstitutionalRationale): void {
  const verified = decideInstitutionalRationale(record.payload)
  if (record.hashVersion !== 1 || record.payloadHash !== verified.payloadHash) {
    throw new Error('RATIONALE_INTEGRITY_ERROR')
  }
}

export function assertRationaleIsImmutable(): never {
  throw new Error('DECIDED_RATIONALE_IMMUTABLE_USE_SUPERSESSION')
}
