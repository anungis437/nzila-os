/**
 * @nzila/runtime-attestation — Attestation
 *
 * Attestation envelope schema and helpers.
 *
 * @module @nzila/runtime-attestation/attestation
 */
import { z } from 'zod'

import type {
  AttestationManifest,
  AttestationSignature,
  RuntimeAttestation,
} from './types'

export const ATTESTATION_SCHEMA_VERSION = '1.0.0'

const evidenceReferenceSchema = z
  .object({
    id: z.string().min(1),
    contentHash: z.string().min(8),
    description: z.string().min(1),
  })
  .strict()

const signatureSchema: z.ZodType<AttestationSignature> = z
  .object({
    signer: z.string().min(1),
    algorithm: z.enum(['ed25519', 'ecdsa-p256']),
    value: z.string().min(1),
    signedAt: z.string().refine((s) => !Number.isNaN(Date.parse(s))),
  })
  .strict()

export const runtimeAttestationSchema: z.ZodType<RuntimeAttestation> = z
  .object({
    id: z.string().min(1),
    schemaVersion: z.literal(ATTESTATION_SCHEMA_VERSION),
    class: z.enum([
      'deployment',
      'doctrine-compliance',
      'continuity-governance',
      'pilot-safety',
      'ai-governance',
      'environment-legitimacy',
    ]),
    releaseId: z.string().min(1, {
      message: 'attestations must be release-bound; releaseId is required',
    }),
    environment: z.string().min(1, {
      message: 'attestations must be environment-bound; environment is required',
    }),
    subject: z
      .object({
        kind: z.string().min(1),
        id: z.string().min(1),
      })
      .strict(),
    verdict: z.enum(['verified', 'partial', 'unverified', 'rejected']),
    rationale: z.string().min(1),
    citedEvidence: z.array(evidenceReferenceSchema).min(1, {
      message: 'attestations must cite at least one evidence record',
    }),
    issuedBy: z.string().min(1),
    issuedAt: z.string().refine((s) => !Number.isNaN(Date.parse(s))),
    window: z
      .object({
        start: z.string().refine((s) => !Number.isNaN(Date.parse(s))),
        end: z.string().refine((s) => !Number.isNaN(Date.parse(s))),
      })
      .strict(),
    signature: signatureSchema.optional(),
  })
  .strict()

export const attestationManifestSchema: z.ZodType<AttestationManifest> = z
  .object({
    id: z.string().min(1),
    schemaVersion: z.literal(ATTESTATION_SCHEMA_VERSION),
    releaseId: z.string().min(1),
    environment: z.string().min(1),
    attestations: z.array(runtimeAttestationSchema),
    issuedAt: z.string().refine((s) => !Number.isNaN(Date.parse(s))),
  })
  .strict()
  .refine(
    (m) =>
      m.attestations.every(
        (a) => a.releaseId === m.releaseId && a.environment === m.environment,
      ),
    {
      message:
        'all attestations in a manifest must share the manifest releaseId and environment',
      path: ['attestations'],
    },
  )

export function validateAttestation(value: unknown): RuntimeAttestation {
  return runtimeAttestationSchema.parse(value)
}

export function validateManifest(value: unknown): AttestationManifest {
  return attestationManifestSchema.parse(value)
}
