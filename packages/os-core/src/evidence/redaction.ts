/**
 * @nzila/os-core — Evidence Redaction Layer
 *
 * Controls which artifact fields are visible per audience:
 *   - 'internal': full fidelity (compliance officers, auditors)
 *   - 'partner':  PII stripped, internal-only fields removed
 *   - 'public':   further reduced, only aggregate/non-identifiable fields
 *
 * When redacting a sealed pack index, the redacted copy is re-sealed to
 * maintain tamper-evidence. See redactAndReseal().
 */

import type { EvidenceArtifact } from './types'
import { generateSeal, type SealEnvelope, type SealOptions, type SealablePackIndex } from './seal'

export type { EvidenceArtifact }
export type RedactionMode = 'internal' | 'partner' | 'public'

/**
 * Artifact types that are NEVER exposed to partners or the public.
 * Any evidence artifact whose type is in this list will be fully
 * removed (not redacted) from partner/public bundles.
 */
export const PARTNER_RESTRICTED_ARTIFACT_TYPES = [
  'security-scan-findings',
  'secret-scan-findings',
  'dependency-audit',
  'codeql-results',
  'sbom',
  'incident-root-cause',
  'ml-drift-raw',
] as const

export type PartnerRestrictedArtifactType = (typeof PARTNER_RESTRICTED_ARTIFACT_TYPES)[number]

/**
 * Fields that are always stripped when producing a partner bundle.
 */
const PARTNER_STRIPPED_FIELDS = [
  'clerkUserId',
  'email',
  'ipAddress',
  'userAgent',
  'internalNotes',
  'rawErrorStack',
  'personalData',
  'actorEmail',
]

/**
 * Fields stripped in public bundles (superset of partner).
 */
const PUBLIC_STRIPPED_FIELDS = [
  ...PARTNER_STRIPPED_FIELDS,
  'entityId',
  'partnerId',
  'orgId',
]

/**
 * Redact a single evidence artifact for the given audience.
 * Returns `null` if the artifact should be fully excluded.
 */
export function redactArtifact(
  artifact: EvidenceArtifact,
  mode: RedactionMode,
): EvidenceArtifact | null {
  if (mode === 'internal') {
    return artifact
  }

  const restrictedType = PARTNER_RESTRICTED_ARTIFACT_TYPES.find((t) => t === artifact.type)
  if (restrictedType) {
    return null
  }

  const stripped = mode === 'public' ? PUBLIC_STRIPPED_FIELDS : PARTNER_STRIPPED_FIELDS
  return deepStrip(artifact, stripped)
}

/**
 * Redact an array of evidence artifacts.
 * Null artifacts (excluded by policy) are removed from the array.
 */
export function redactArtifacts(
  artifacts: EvidenceArtifact[],
  mode: RedactionMode,
): EvidenceArtifact[] {
  return artifacts
    .map((a) => redactArtifact(a, mode))
    .filter((a): a is EvidenceArtifact => a !== null)
}

/**
 * Recursively strip fields from an object.
 */
function deepStrip(
  obj: Record<string, unknown>,
  fields: string[],
): EvidenceArtifact {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (fields.includes(key)) continue
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = deepStrip(value as Record<string, unknown>, fields)
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item !== null && typeof item === 'object'
          ? deepStrip(item as Record<string, unknown>, fields)
          : item,
      )
    } else {
      result[key] = value
    }
  }
  return result as EvidenceArtifact
}

// ── Sealed pack redaction with re-seal ──────────────────────────────────────

export interface RedactedPackIndex {
  /** The redacted pack index without the seal field */
  index: SealablePackIndex & { redactedFor: RedactionMode; originalPackDigest: string }
  /** Fresh seal covering the redacted content */
  seal: SealEnvelope
}

/**
 * Redact a sealed evidence pack index for a given audience and re-seal it.
 *
 * This ensures redacted copies are still tamper-evident:
 *  1. Strip the original seal
 *  2. Deep-strip PII/restricted fields from each artifact entry
 *  3. Remove fully-restricted artifact types
 *  4. Stamp the redaction audience and original pack digest
 *  5. Re-seal the redacted index
 *
 * @param sealedIndex - The original sealed pack index (with seal and artifacts)
 * @param mode        - Target audience: 'internal' | 'partner' | 'public'
 * @param sealOpts    - Optional seal options (HMAC key, timestamp override)
 * @returns           - The redacted index with a fresh seal
 */
export function redactAndReseal(
  sealedIndex: SealablePackIndex & { seal?: SealEnvelope },
  mode: RedactionMode,
  sealOpts?: SealOptions,
): RedactedPackIndex {
  // 1. Extract original digest for provenance
  const originalPackDigest = sealedIndex.seal?.packDigest ?? 'no-original-seal'

  // 2. Strip seal from the working copy
  const { seal: _seal, ...indexWithoutSeal } = sealedIndex as Record<string, unknown>

  // 3. If internal, return as-is with re-seal
  if (mode === 'internal') {
    const internalIndex = {
      ...indexWithoutSeal,
      redactedFor: mode,
      originalPackDigest,
      artifacts: sealedIndex.artifacts,
    } as SealablePackIndex & { redactedFor: RedactionMode; originalPackDigest: string }

    const newSeal = generateSeal(internalIndex, sealOpts)
    return { index: internalIndex, seal: newSeal }
  }

  // 4. Filter out restricted artifact types and strip PII fields
  const stripped = mode === 'public' ? PUBLIC_STRIPPED_FIELDS : PARTNER_STRIPPED_FIELDS
  const redactedArtifacts = sealedIndex.artifacts
    .filter((a) => {
      const artType = (a as Record<string, unknown>).artifactType as string | undefined
      return !PARTNER_RESTRICTED_ARTIFACT_TYPES.find((t) => t === artType)
    })
    .map((a) => {
      const cleaned = deepStrip(a as Record<string, unknown>, stripped) as unknown as {
        sha256: string
        [key: string]: unknown
      }
      return cleaned
    })

  // 5. Build redacted index and re-seal
  const redactedIndex = {
    ...deepStrip(indexWithoutSeal as Record<string, unknown>, stripped),
    redactedFor: mode,
    originalPackDigest,
    artifacts: redactedArtifacts,
  } as SealablePackIndex & { redactedFor: RedactionMode; originalPackDigest: string }

  const newSeal = generateSeal(redactedIndex, sealOpts)
  return { index: redactedIndex, seal: newSeal }
}
