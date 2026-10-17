import { z } from 'zod'
import {
  identityResolutionSchema,
  namespacedSourceRefSchema,
  rightStateSchema,
  semanticMappingSchema,
  sourceCaptureSchema,
} from './contracts'
import { verifySourceCaptureIntegrity } from './capture'
import { CANONICALIZATION_VERSION, INTEGRITY_ALGORITHM, sha256Canonical } from './integrity'
import { evaluateRights } from './rights'
import { semanticMappingResultSchema, verifySemanticMapping } from './semantic-mapping'

export const capsuleIntegritySchema = z
  .object({
    algorithm: z.literal(INTEGRITY_ALGORITHM),
    canonicalizationVersion: z.literal(CANONICALIZATION_VERSION),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()

export const capsuleRetentionManifestSchema = z
  .object({
    version: z.literal('1.0'),
    entries: z
      .array(
        z
          .object({
            captureId: z.string().min(1),
            rightsDecisionRef: z.string().min(1),
            retentionState: z.literal('UNKNOWN'),
            retentionDurationSeconds: z.null(),
            retentionExpiresAt: z.null(),
            retentionAfterDisconnect: rightStateSchema,
            deletion: rightStateSchema,
          })
          .strict(),
      )
      .min(1),
  })
  .strict()

export const continuityCapsuleSchema = z
  .object({
    format: z.literal('CORA_CONTINUITY_CAPSULE'),
    formatVersion: z.literal('1.0'),
    capsuleId: z.string().min(1),
    orgId: z.string().min(1),
    purpose: z.string().min(1),
    createdAt: z.string().datetime(),
    subjectRef: namespacedSourceRefSchema,
    captures: z.array(sourceCaptureSchema).min(1),
    mappings: z.array(semanticMappingSchema),
    mappingResults: z.array(semanticMappingResultSchema).optional(),
    retentionManifest: capsuleRetentionManifestSchema,
    identityResolution: identityResolutionSchema.optional(),
    limitations: z.array(z.string().min(1)),
    integrity: capsuleIntegritySchema,
  })
  .strict()

export type CapsuleIntegrity = z.infer<typeof capsuleIntegritySchema>
export type ContinuityCapsule = z.infer<typeof continuityCapsuleSchema>

type CapsuleDraft = Omit<ContinuityCapsule, 'integrity' | 'retentionManifest'>

export function computeCapsuleIntegrity(capsule: CapsuleDraft): CapsuleIntegrity {
  return {
    algorithm: INTEGRITY_ALGORITHM,
    canonicalizationVersion: CANONICALIZATION_VERSION,
    sha256: sha256Canonical(capsule),
  }
}

export function verifyCapsuleIntegrity(capsule: ContinuityCapsule): boolean {
  const parsed = continuityCapsuleSchema.parse(capsule)
  const { integrity, ...draft } = parsed
  return (
    parsed.captures.every(verifySourceCaptureIntegrity) &&
    parsed.mappings.every(verifySemanticMapping) &&
    computeCapsuleIntegrity(draft).sha256 === integrity.sha256
  )
}

export function assembleContinuityCapsule(
  input: CapsuleDraft,
  trustedOrgId: string,
): ContinuityCapsule {
  const draftInput = input
  const draft = {
    ...draftInput,
    captures: [...draftInput.captures].sort((left, right) =>
      left.captureId.localeCompare(right.captureId),
    ),
    mappings: [...draftInput.mappings].sort(
      (left, right) =>
        left.mappingId.localeCompare(right.mappingId) || left.version.localeCompare(right.version),
    ),
  }
  const parsedCaptures = draft.captures.map((capture) => sourceCaptureSchema.parse(capture))
  if (draft.orgId !== trustedOrgId) {
    throw new Error('Capsule organization does not match trusted Cora organization')
  }
  if (parsedCaptures.some((capture) => capture.orgId !== trustedOrgId)) {
    throw new Error('Capsule cannot contain captures from another organization')
  }
  if (parsedCaptures.some((capture) => !verifySourceCaptureIntegrity(capture))) {
    throw new Error('Capsule contains a capture with invalid integrity')
  }
  if (draft.identityResolution && draft.identityResolution.orgId !== trustedOrgId) {
    throw new Error('Identity resolution organization does not match capsule')
  }

  const mappings = draft.mappings.map((mapping) => semanticMappingSchema.parse(mapping))
  const mappingResults = draft.mappingResults?.map((result) =>
    semanticMappingResultSchema.parse(result),
  )
  if (mappings.some((mapping) => !verifySemanticMapping(mapping))) {
    throw new Error('Capsule contains a mapping with invalid definition integrity')
  }
  if (new Set(parsedCaptures.map((capture) => capture.captureId)).size !== parsedCaptures.length) {
    throw new Error('Capsule capture identities must be unique')
  }
  if (
    new Set(mappings.map((mapping) => `${mapping.mappingId}@${mapping.version}`)).size !==
    mappings.length
  ) {
    throw new Error('Capsule mapping identities must be unique by ID and version')
  }
  for (const capture of parsedCaptures) {
    const decision = evaluateRights(capture.rights, 'PERSIST', {
      purpose: draft.purpose,
      recipientId: capture.recipientId,
      at: draft.createdAt,
    })
    if (!decision.allowed) {
      throw new Error(`Capsule persistence is not authorized: ${decision.reasons.join(', ')}`)
    }
    for (const reference of capture.mappingRefs) {
      if (
        !mappings.some(
          (mapping) =>
            mapping.mappingId === reference.mappingId && mapping.version === reference.version,
        )
      ) {
        throw new Error(`Capsule is missing mapping ${reference.mappingId}@${reference.version}`)
      }
    }
  }
  if (mappingResults) {
    for (const result of mappingResults) {
      const capture = parsedCaptures.find((item) => item.captureId === result.captureId)
      const mapping = mappings.find(
        (item) => item.mappingId === result.mappingId && item.version === result.mappingVersion,
      )
      if (!capture || !mapping) {
        throw new Error('Capsule mapping result must reference an included capture and mapping')
      }
      if (
        capture.sourceRef.providerId !== result.sourceProviderId ||
        capture.acquisitionRoute.channel !== result.acquisitionChannel ||
        !capture.mappingRefs.some(
          (reference) =>
            reference.mappingId === result.mappingId && reference.version === result.mappingVersion,
        )
      ) {
        throw new Error('Capsule mapping result does not match its capture provenance')
      }
    }
  }

  const subjectRef = namespacedSourceRefSchema.parse(draft.subjectRef)
  const identityResolution = draft.identityResolution
    ? identityResolutionSchema.parse(draft.identityResolution)
    : undefined
  const completeDraft = {
    format: 'CORA_CONTINUITY_CAPSULE' as const,
    formatVersion: '1.0' as const,
    capsuleId: draft.capsuleId,
    orgId: draft.orgId,
    purpose: draft.purpose,
    createdAt: draft.createdAt,
    subjectRef,
    captures: parsedCaptures,
    mappings,
    ...(mappingResults ? { mappingResults } : {}),
    retentionManifest: {
      version: '1.0' as const,
      entries: parsedCaptures.map((capture) => ({
        captureId: capture.captureId,
        rightsDecisionRef: capture.rights.decisionRef,
        retentionState: 'UNKNOWN' as const,
        retentionDurationSeconds: null,
        retentionExpiresAt: null,
        retentionAfterDisconnect: capture.rights.retentionAfterDisconnect,
        deletion: capture.rights.deletion,
      })),
    },
    ...(identityResolution ? { identityResolution } : {}),
    limitations: draft.limitations,
  }

  return continuityCapsuleSchema.parse({
    ...completeDraft,
    integrity: computeCapsuleIntegrity(completeDraft),
  })
}
