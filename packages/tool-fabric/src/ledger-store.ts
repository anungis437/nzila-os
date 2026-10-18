import { auditEntrySchema, verifyChain, type AuditEntry } from '@nzila/audit'

export const LEDGER_GENESIS_HASH = '0'.repeat(64)

export interface LedgerHead {
  /** Monotonic event count for this stream, not a separately fetched count. */
  readonly revision: number
  readonly headHash: string
}

export interface LedgerSnapshot extends LedgerHead {
  /** Complete ordered stream captured atomically with revision and headHash; never a live paginated query. */
  readonly entries: readonly AuditEntry[]
}

/**
 * Host-injected storage boundary. Implementations MUST atomically read a complete,
 * isolated snapshot, and atomically compare BOTH expected head fields and insert
 * exactly one entry. Failed/conflicting writes must leave the stream unchanged.
 * A persistent implementation additionally needs transaction/isolation and
 * uniqueness proofs; implementing this interface alone is not durability proof.
 * The host must protect the revision/head against rollback: hash chains alone
 * cannot detect a storage administrator replacing the entire valid history.
 */
export interface AtomicTrustLedgerStore {
  readonly atomicContract: 'tool-trust-ledger-cas-v1'
  readonly persistence: 'NON_DURABLE_CONTRACT_ONLY' | 'HOST_ATTESTED_PERSISTENT'
  readSnapshot(orgId: string): Promise<LedgerSnapshot>
  compareAndAppend(orgId: string, expected: LedgerHead, entry: AuditEntry): Promise<LedgerHead>
}

export class LedgerStoreUnavailableError extends Error {
  constructor(message = 'Atomic trust ledger storage is unavailable; broker remains on HOLD') {
    super(message)
    this.name = 'LedgerStoreUnavailableError'
  }
}

export class LedgerConflictError extends Error {
  constructor(message = 'Trust ledger revision conflict; re-evaluate against a fresh snapshot') {
    super(message)
    this.name = 'LedgerConflictError'
  }
}

export class LedgerDuplicateError extends Error {
  constructor() {
    super('Duplicate trust ledger entry or event hash')
    this.name = 'LedgerDuplicateError'
  }
}

/** Production default: no approved persistent adapter is shipped. */
export class DenyOnlyAtomicTrustLedgerStore implements AtomicTrustLedgerStore {
  readonly atomicContract = 'tool-trust-ledger-cas-v1' as const
  readonly persistence = 'NON_DURABLE_CONTRACT_ONLY' as const

  async readSnapshot(_orgId: string): Promise<LedgerSnapshot> {
    throw new LedgerStoreUnavailableError()
  }

  async compareAndAppend(_orgId: string, _expected: LedgerHead, _entry: AuditEntry): Promise<LedgerHead> {
    throw new LedgerStoreUnavailableError()
  }
}

/**
 * Deterministic single-process CAS contract adapter for tests only.
 * Deliberately NON-DURABLE: rebuilding this adapter loses all entries. Reusing
 * the same instance tests ledger replay, not process restart or database durability.
 */
export class InMemoryAtomicTrustLedgerStore implements AtomicTrustLedgerStore {
  readonly atomicContract = 'tool-trust-ledger-cas-v1' as const
  readonly persistence = 'NON_DURABLE_CONTRACT_ONLY' as const
  private readonly streams = new Map<string, AuditEntry[]>()

  async readSnapshot(orgId: string): Promise<LedgerSnapshot> {
    const entries = structuredClone(this.streams.get(orgId) ?? [])
    return { revision: entries.length, headHash: entries.at(-1)?.hash ?? LEDGER_GENESIS_HASH, entries }
  }

  async compareAndAppend(orgId: string, expected: LedgerHead, entry: AuditEntry): Promise<LedgerHead> {
    // No await between the comparison and insertion: one JS turn is the test transaction.
    const entries = this.streams.get(orgId) ?? []
    const headHash = entries.at(-1)?.hash ?? LEDGER_GENESIS_HASH
    if (expected.revision !== entries.length || expected.headHash !== headHash) {
      throw new LedgerConflictError()
    }
    const eventHash = entry.payload.eventHash
    if (
      [...this.streams.values()].some((stream) => stream.some((existing) => existing.id === entry.id)) ||
      entries.some((existing) => existing.hash === entry.hash || existing.payload.eventHash === eventHash)
    ) {
      throw new LedgerDuplicateError()
    }
    if (
      entry.orgId !== orgId ||
      entry.prevHash !== headHash ||
      entry.payload.seq !== entries.length + 1 ||
      typeof eventHash !== 'string' ||
      !/^[a-f0-9]{64}$/.test(eventHash)
    ) {
      throw new LedgerConflictError('Entry does not extend the expected trust ledger head')
    }
    if (!auditEntrySchema.safeParse(entry).success || !verifyChain([...entries, entry], { requireFullCoverage: true }).valid) {
      throw new LedgerConflictError('Entry has invalid audit integrity')
    }
    entries.push(structuredClone(entry))
    this.streams.set(orgId, entries)
    return { revision: entries.length, headHash: entry.hash }
  }
}
