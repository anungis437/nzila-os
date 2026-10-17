import { computeAuditHash } from './engine.js'
import type { AuditEntry, VerificationResult } from './schema.js'
import { GENESIS_HASH } from './schema.js'
import type { AuditStore } from './store.js'

// ─── Chain Integrity Verification ───────────────────────────────────────────

export interface AuditVerificationOptions {
  /** Reject historical chains whose nested payloads were never covered by v1. */
  readonly requireFullCoverage?: boolean
}

export function verifyChain(
  entries: readonly AuditEntry[],
  options: AuditVerificationOptions = {},
): VerificationResult {
  let legacyEntriesChecked = 0
  let version2Seen = false
  const result = (core: Omit<VerificationResult, 'hashCoverage' | 'legacyEntriesChecked'>): VerificationResult => ({
    ...core,
    hashCoverage: legacyEntriesChecked > 0 ? 'LEGACY_PARTIAL' : 'FULL',
    legacyEntriesChecked,
  })
  if (entries.length === 0) {
    return result({
      valid: true,
      entriesChecked: 0,
    })
  }

  // Verify first entry links to genesis
  const first = entries[0]
  if (first.prevHash !== GENESIS_HASH) {
    return result({
      valid: false,
      entriesChecked: 1,
      firstEntry: first.id,
      brokenAt: first.id,
      error: `First entry prevHash should be genesis hash but was ${first.prevHash}`,
    })
  }

  // Verify each entry's hash and chain linkage
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const version = entry.hashVersion === undefined ? 1 : entry.hashVersion
    if (version !== 1 && version !== 2) {
      return result({ valid: false, entriesChecked: i + 1, brokenAt: entry.id, error: 'Unsupported audit hash version' })
    }
    if (version === 1) {
      legacyEntriesChecked++
      if (version2Seen || options.requireFullCoverage) {
        return result({
          valid: false, entriesChecked: i + 1, brokenAt: entry.id,
          error: version2Seen ? 'Audit hash version downgrade after v2' : 'Legacy audit hash lacks full payload coverage',
        })
      }
    } else {
      version2Seen = true
    }

    let expectedHash: string
    try {
      expectedHash = computeAuditHash(entry.prevHash, {
        id: entry.id,
        timestamp: entry.timestamp,
        actorId: entry.actorId,
        orgId: entry.orgId,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        payload: entry.payload,
      }, version)
    } catch {
      return result({ valid: false, entriesChecked: i + 1, brokenAt: entry.id, error: 'Audit payload cannot be serialized' })
    }

    if (entry.hash !== expectedHash) {
      return result({
        valid: false,
        entriesChecked: i + 1,
        firstEntry: entries[0].id,
        lastEntry: entry.id,
        brokenAt: entry.id,
        error: `Entry ${entry.id}: hash mismatch (expected ${expectedHash}, got ${entry.hash})`,
      })
    }

    // Verify chain linkage (entry N+1 should reference entry N's hash)
    if (i > 0) {
      const prev = entries[i - 1]
      if (entry.prevHash !== prev.hash) {
        return result({
          valid: false,
          entriesChecked: i + 1,
          firstEntry: entries[0].id,
          lastEntry: entry.id,
          brokenAt: entry.id,
          error: `Entry ${entry.id}: prevHash does not match previous entry hash`,
        })
      }
    }
  }

  return result({
    valid: true,
    entriesChecked: entries.length,
    firstEntry: entries[0].id,
    lastEntry: entries[entries.length - 1].id,
  })
}

// ─── Store-based Verification ───────────────────────────────────────────────

export async function verifyOrgChain(
  store: AuditStore,
  orgId: string,
  options: AuditVerificationOptions = {},
): Promise<VerificationResult> {
  const entries = await store.getEntries(orgId, { limit: 100_000 })
  return verifyChain(entries, options)
}
