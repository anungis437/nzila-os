// ---------------------------------------------------------------------------
// @nzila/agri-traceability — Chain Builder
// ---------------------------------------------------------------------------
// Builds a hash chain linking successive traceability events together.
// Each entry's hash = SHA-256(previousHash + entityType + subjectId + action + timestamp).
// ---------------------------------------------------------------------------

import { createHash } from 'node:crypto'

export interface ChainEntry {
  entityType: string
  subjectId: string
  action: string
  timestamp: string
}

export interface HashChainEntry extends ChainEntry {
  hash: string
  previousHash: string
}

/** A hash-linked traceability chain (distinct from agri-core TraceabilityChain link type). */
export interface TraceabilityHashChain {
  orgId: string
  rootHash: string
  entries: HashChainEntry[]
  entryCount: number
  createdAt: string
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

/**
 * Build a traceability hash chain from an ordered list of events.
 * The first entry's previousHash is the SHA-256 of the empty string (genesis).
 */
export function buildTraceabilityChain(
  orgId: string,
  entries: ChainEntry[],
): TraceabilityHashChain {
  const genesis = sha256('')
  const chain: TraceabilityHashChain = {
    orgId,
    rootHash: genesis,
    entries: [],
    entryCount: 0,
    createdAt: new Date().toISOString(),
  }

  let previousHash = genesis
  for (const entry of entries) {
    const hash = sha256(
      previousHash + entry.entityType + entry.subjectId + entry.action + entry.timestamp,
    )
    chain.entries.push({
      entityType: entry.entityType,
      subjectId: entry.subjectId,
      action: entry.action,
      timestamp: entry.timestamp,
      hash,
      previousHash,
    })
    previousHash = hash
  }

  chain.entryCount = chain.entries.length
  if (chain.entries.length > 0) {
    chain.rootHash = chain.entries[chain.entries.length - 1]!.hash
  }

  return chain
}

/**
 * Verify the integrity of an existing traceability chain.
 * Returns true if every entry's hash matches the expected recomputation.
 */
export function verifyTraceabilityChain(chain: TraceabilityHashChain): boolean {
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
