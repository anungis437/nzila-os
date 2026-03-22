// ---------------------------------------------------------------------------
// @nzila/agri-provenance — Hash chain builder & verifier
// ---------------------------------------------------------------------------
// Links successive provenance events into a tamper-evident chain.
// Compatible with @nzila/agri-traceability evidence packs.
// ---------------------------------------------------------------------------

import { createHash } from 'node:crypto'
import type { ProvenanceRecord } from '@nzila/agri-core'

export interface ChainEntry {
  readonly entityType: string
  readonly subjectId: string
  readonly action: string
  readonly timestamp: string
  readonly provenanceRef?: string
}

export interface HashChainEntry extends ChainEntry {
  readonly hash: string
  readonly previousHash: string
}

export interface ProvenanceHashChain {
  readonly orgId: string
  readonly rootHash: string
  readonly entries: readonly HashChainEntry[]
  readonly entryCount: number
  readonly createdAt: string
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

/**
 * Build a provenance hash chain from ordered events.
 * Genesis hash = SHA-256('').
 */
export function buildProvenanceChain(
  orgId: string,
  entries: readonly ChainEntry[],
): ProvenanceHashChain {
  const genesis = sha256('')
  const linkedEntries: HashChainEntry[] = []
  let previousHash = genesis

  for (const entry of entries) {
    const hash = sha256(
      previousHash + entry.entityType + entry.subjectId + entry.action + entry.timestamp,
    )
    linkedEntries.push({
      ...entry,
      hash,
      previousHash,
    })
    previousHash = hash
  }

  return {
    orgId,
    rootHash: linkedEntries.length > 0 ? linkedEntries[linkedEntries.length - 1]!.hash : genesis,
    entries: linkedEntries,
    entryCount: linkedEntries.length,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Verify the integrity of a provenance hash chain.
 */
export function verifyProvenanceChain(chain: ProvenanceHashChain): boolean {
  let previousHash = sha256('')
  for (const entry of chain.entries) {
    if (entry.previousHash !== previousHash) return false
    const expected = sha256(
      previousHash + entry.entityType + entry.subjectId + entry.action + entry.timestamp,
    )
    if (entry.hash !== expected) return false
    previousHash = entry.hash
  }
  return true
}

/**
 * Convert provenance records to chain entries for linking.
 */
export function provenanceRecordsToChainEntries(
  records: readonly ProvenanceRecord[],
  entityType: string,
  action: string,
): ChainEntry[] {
  return records.map((r) => ({
    entityType,
    subjectId: r.id,
    action,
    timestamp: r.createdAt,
    provenanceRef: r.id,
  }))
}
