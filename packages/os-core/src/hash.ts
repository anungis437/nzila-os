/**
 * @nzila/os-core — Append-only hash-chain utilities
 */
import { createHash } from 'node:crypto'
import type { Hashable } from './types'

/**
 * Compute the SHA-256 hash for a new ledger/audit entry.
 *
 * @param payload  The JSON-serialisable content of the entry.
 * @param previousHash  The hash of the previous entry (or null for genesis).
 * @returns  hex digest
 */
export function computeEntryHash(payload: unknown, previousHash: string | null): string {
  const data = JSON.stringify({ payload, previousHash })
  return createHash('sha256').update(data).digest('hex')
}

/**
 * Verify that a chain of entries has not been tampered with.
 *
 * @param entries  Ordered oldest→newest
 * @param payloadExtractor  Pull the hashable payload from each entry
 * @returns  { valid: boolean, brokenAtIndex?: number }
 */
export function verifyChain<T extends Hashable>(
  entries: T[],
  payloadExtractor: (e: T) => unknown,
): { valid: boolean; brokenAtIndex?: number } {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const expectedPrev = i === 0 ? null : entries[i - 1].hash
    if (entry.previousHash !== expectedPrev) {
      return { valid: false, brokenAtIndex: i }
    }
    const recomputed = computeEntryHash(payloadExtractor(entry), entry.previousHash)
    if (recomputed !== entry.hash) {
      return { valid: false, brokenAtIndex: i }
    }
  }
  return { valid: true }
}
