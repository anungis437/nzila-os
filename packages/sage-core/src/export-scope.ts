// ─── @nzila/sage-core — export scope canonicalization + hashing ──────────────
// An export scope is DERIVED, reviewable data. Its canonical representation is
// deterministic (stable key ordering, stable item ordering) so a scope hash is
// stable under input reordering but changes when any resource's content,
// authorization level, exclusion state, package type, or policy version changes.

import { createHash } from 'node:crypto'
import type {
  SageExportScope,
  SageExportScopeItem,
  SageExportResourceType,
} from './types'

/**
 * The export policy version. Participates in every scope hash so a policy change
 * invalidates previously approved scopes (they must be re-requested/re-approved).
 */
export const SAGE_EXPORT_POLICY_VERSION = 'sage-export-v1'

// Deterministic resource-type ordering for canonical item sequencing.
const RESOURCE_TYPE_ORDER: Record<SageExportResourceType, number> = {
  evidence_item: 0,
  boundary_flag: 1,
  review_note: 2,
  decision_record: 3,
}

/** Recursively stable-stringify a JSON value with sorted object keys. */
export function canonicalJsonStringify(value: unknown): string {
  return JSON.stringify(sortValue(value))
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortValue((value as Record<string, unknown>)[key])
    }
    return out
  }
  return value
}

/** Canonical, deterministically ordered items (stable under input reordering). */
export function canonicalScopeItems(items: SageExportScopeItem[]): SageExportScopeItem[] {
  const sorted = [...items].sort((a, b) => {
    const t = RESOURCE_TYPE_ORDER[a.resourceType] - RESOURCE_TYPE_ORDER[b.resourceType]
    if (t !== 0) return t
    return a.resourceId < b.resourceId ? -1 : a.resourceId > b.resourceId ? 1 : 0
  })
  // Re-index the deterministic order so it is independent of input ordering.
  return sorted.map((item, index) => ({ ...item, order: index }))
}

/** Produce the canonical scope (ordered items) for a raw scope. */
export function canonicalizeSageExportScope(scope: SageExportScope): SageExportScope {
  return {
    policyVersion: scope.policyVersion,
    packageType: scope.packageType,
    items: canonicalScopeItems(scope.items),
  }
}

/** SHA-256 hex hash of the canonical export scope. */
export function hashSageExportScope(scope: SageExportScope): string {
  const canonical = canonicalizeSageExportScope(scope)
  return sha256Hex(canonicalJsonStringify(canonical))
}

/** SHA-256 hex over an arbitrary byte payload (manifest / package content). */
export function sha256Hex(input: string | Uint8Array): string {
  return createHash('sha256').update(input).digest('hex')
}
