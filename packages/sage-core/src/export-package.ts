// ─── @nzila/sage-core — deterministic export package builder ─────────────────
// Builds an immutable internal review package from an APPROVED, canonical scope.
// Given the same approved scope + policy version + resource content, the
// manifest hash and content hash are byte-stable. The generation timestamp is
// deliberately NOT part of any hashed structure, so it can differ across
// re-generation attempts without contaminating determinism.
//
// The manifest carries only provenance (ids, hashes, authorization labels,
// inclusion decisions, safe exclusion codes) — never narrative. Narrative
// content lives ONLY inside the package bytes stored privately.

import { canonicalJsonStringify, sha256Hex } from './export-scope'
import type {
  SageExportExclusionReason,
  SageExportPackageType,
  SageExportResourceType,
  SageExportScope,
  SageAuthorizationLevel,
} from './types'

export const SAGE_EXPORT_PACKAGE_MEDIA_TYPE = 'application/json'

/** One provenance line in the manifest — safe metadata only, no narrative. */
export type SageExportManifestItem = {
  resourceType: SageExportResourceType
  resourceId: string
  contentHash: string
  authorizationLevel: SageAuthorizationLevel
  excludedFromExternalReview: boolean
  included: boolean
  exclusionReason?: SageExportExclusionReason | null
  order: number
}

/** The auditable, narrative-free manifest. Deterministic + hashable. */
export type SageExportManifest = {
  packageType: SageExportPackageType
  policyVersion: string
  workspaceId: string
  exportRequestId: string
  approvedScopeHash: string
  itemCount: number
  excludedCount: number
  items: SageExportManifestItem[]
}

/** A resource projection embedded in the private package bytes. */
export type SageExportPackageResource = {
  resourceType: SageExportResourceType
  resourceId: string
  authorizationLevel: SageAuthorizationLevel
  contentHash: string
  content: Record<string, unknown>
}

export type SageExportPackageBuildInput = {
  scope: SageExportScope // already canonical
  workspaceId: string
  exportRequestId: string
  approvedScopeHash: string
  /** Included resources, keyed projections; excluded items are manifest-only. */
  resources: SageExportPackageResource[]
}

export type SageExportPackageArtifact = {
  manifest: SageExportManifest
  manifestJson: string
  manifestHash: string
  contentBytes: Uint8Array
  contentHash: string
  mediaType: string
  itemCount: number
  excludedCount: number
}

/** Build the narrative-free manifest from a canonical scope. */
export function buildSageExportManifest(input: {
  scope: SageExportScope
  workspaceId: string
  exportRequestId: string
  approvedScopeHash: string
}): SageExportManifest {
  const items: SageExportManifestItem[] = input.scope.items.map((i) => ({
    resourceType: i.resourceType,
    resourceId: i.resourceId,
    contentHash: i.contentHash,
    authorizationLevel: i.authorizationLevel,
    excludedFromExternalReview: i.excludedFromExternalReview,
    included: i.included,
    exclusionReason: i.exclusionReason ?? null,
    order: i.order,
  }))
  const included = items.filter((i) => i.included)
  const excluded = items.filter((i) => !i.included)
  return {
    packageType: input.scope.packageType,
    policyVersion: input.scope.policyVersion,
    workspaceId: input.workspaceId,
    exportRequestId: input.exportRequestId,
    approvedScopeHash: input.approvedScopeHash,
    itemCount: included.length,
    excludedCount: excluded.length,
    items,
  }
}

/**
 * Build the deterministic package artifact. `manifestHash` covers the manifest;
 * `contentHash` covers the full package bytes (manifest + included resource
 * content). No timestamp participates in either hash.
 */
export function buildSageExportPackage(
  input: SageExportPackageBuildInput,
): SageExportPackageArtifact {
  const manifest = buildSageExportManifest({
    scope: input.scope,
    workspaceId: input.workspaceId,
    exportRequestId: input.exportRequestId,
    approvedScopeHash: input.approvedScopeHash,
  })
  const manifestJson = canonicalJsonStringify(manifest)
  const manifestHash = sha256Hex(manifestJson)

  // Deterministic ordering of embedded resources mirrors the manifest order.
  const orderIndex = new Map(manifest.items.map((i) => [`${i.resourceType}:${i.resourceId}`, i.order]))
  const resources = [...input.resources].sort(
    (a, b) =>
      (orderIndex.get(`${a.resourceType}:${a.resourceId}`) ?? 0) -
      (orderIndex.get(`${b.resourceType}:${b.resourceId}`) ?? 0),
  )

  const packageDocument = { manifest, resources }
  const contentString = canonicalJsonStringify(packageDocument)
  const contentBytes = new TextEncoder().encode(contentString)
  const contentHash = sha256Hex(contentBytes)

  return {
    manifest,
    manifestJson,
    manifestHash,
    contentBytes,
    contentHash,
    mediaType: SAGE_EXPORT_PACKAGE_MEDIA_TYPE,
    itemCount: manifest.itemCount,
    excludedCount: manifest.excludedCount,
  }
}

export type SageExportIntegrityResult =
  | { ok: true }
  | { ok: false; reason: 'content_hash' | 'manifest_hash' | 'malformed' }

/**
 * Cryptographically verify stored package bytes against the immutable committed
 * hashes. Recomputes SHA-256 over the actual bytes (content hash) AND recomputes
 * the canonical manifest hash from the embedded manifest. Any divergence — a
 * modified byte, a modified embedded manifest, or a malformed document — fails.
 */
export function verifySageExportPackageBytes(
  bytes: Uint8Array,
  expected: { contentHash: string; manifestHash: string },
): SageExportIntegrityResult {
  if (sha256Hex(bytes) !== expected.contentHash) return { ok: false, reason: 'content_hash' }
  let doc: unknown
  try {
    doc = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return { ok: false, reason: 'malformed' }
  }
  const manifest = (doc as { manifest?: unknown } | null)?.manifest
  if (!manifest || typeof manifest !== 'object') return { ok: false, reason: 'malformed' }
  if (sha256Hex(canonicalJsonStringify(manifest)) !== expected.manifestHash) {
    return { ok: false, reason: 'manifest_hash' }
  }
  return { ok: true }
}
