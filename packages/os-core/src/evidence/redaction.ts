/**
 * @nzila/os-core — Evidence Redaction Layer
 *
 * Controls which artifact fields are visible per audience:
 *   - 'internal': full fidelity (compliance officers, auditors)
 *   - 'partner':  PII stripped, internal-only fields removed
 *   - 'public':   further reduced, only aggregate/non-identifiable fields
 */

import type { EvidenceArtifact } from './types'

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
  'tenantId',
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
