import { computeAuditHash } from './engine.js'
import type { AuditEntry, VerificationResult } from './schema.js'
import { GENESIS_HASH } from './schema.js'
import type { AuditStore } from './store.js'

// ─── Chain Integrity Verification ───────────────────────────────────────────

export function verifyChain(entries: readonly AuditEntry[]): VerificationResult {
  if (entries.length === 0) {
    return {
      valid: true,
      entriesChecked: 0,
    }
  }

  // Verify first entry links to genesis
  const first = entries[0]
  if (first.prevHash !== GENESIS_HASH) {
    return {
      valid: false,
      entriesChecked: 1,
      firstEntry: first.id,
      brokenAt: first.id,
      error: `First entry prevHash should be genesis hash but was ${first.prevHash}`,
    }
  }

  // Verify each entry's hash and chain linkage
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]

    const expectedHash = computeAuditHash(entry.prevHash, {
      id: entry.id,
      timestamp: entry.timestamp,
      actorId: entry.actorId,
      tenantId: entry.tenantId,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId,
      payload: entry.payload,
    })

    if (entry.hash !== expectedHash) {
      return {
        valid: false,
        entriesChecked: i + 1,
        firstEntry: entries[0].id,
        lastEntry: entry.id,
        brokenAt: entry.id,
        error: `Entry ${entry.id}: hash mismatch (expected ${expectedHash}, got ${entry.hash})`,
      }
    }

    // Verify chain linkage (entry N+1 should reference entry N's hash)
    if (i > 0) {
      const prev = entries[i - 1]
      if (entry.prevHash !== prev.hash) {
        return {
          valid: false,
          entriesChecked: i + 1,
          firstEntry: entries[0].id,
          lastEntry: entry.id,
          brokenAt: entry.id,
          error: `Entry ${entry.id}: prevHash does not match previous entry hash`,
        }
      }
    }
  }

  return {
    valid: true,
    entriesChecked: entries.length,
    firstEntry: entries[0].id,
    lastEntry: entries[entries.length - 1].id,
  }
}

// ─── Store-based Verification ───────────────────────────────────────────────

export async function verifyTenantChain(
  store: AuditStore,
  tenantId: string,
): Promise<VerificationResult> {
  const entries = await store.getEntries(tenantId, { limit: 100_000 })
  return verifyChain(entries)
}
