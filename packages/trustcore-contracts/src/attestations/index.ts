import { z } from 'zod'
import { TrustSeveritySchema } from '../trust-severity/index'

/**
 * Generic attestation envelope contract — used by TrustOps and TrustCore
 * to record signed claims (e.g., trustee attesting an inventory snapshot,
 * creditor attesting a proof of claim).
 *
 * Pure contract: signing/verification lives in @nzila/trustcore-core or
 * the platform attestation service.
 */
export const AttestationSubjectSchema = z.object({
  kind: z.enum([
    'mandate',
    'creditor',
    'proof_of_claim',
    'restructuring_plan',
    'distribution',
    'compliance_program',
  ]),
  id: z.string().uuid(),
})
export type AttestationSubject = z.infer<typeof AttestationSubjectSchema>

export const AttestationContractSchema = z.object({
  /** Stable contract identifier (e.g., 'trustops.proof_of_claim.v1'). */
  contractId: z.string().min(1).max(128),
  version: z.string().min(1).max(32),
  subject: AttestationSubjectSchema,
  attesterUserId: z.string().min(1),
  orgId: z.string().uuid(),
  /** Severity of the underlying claim being attested. */
  severity: TrustSeveritySchema.default('medium'),
  /** Hash of the canonical payload that was signed. */
  payloadHash: z.string().regex(/^[A-Fa-f0-9]{64}$/),
  signedAt: z.string().datetime(),
  /** Opaque signature blob (base64). */
  signature: z.string().min(1),
})
export type AttestationContract = z.infer<typeof AttestationContractSchema>
