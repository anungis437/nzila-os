/**
 * PostgreSQL CAS implementation of the Trust Ledger persistence contract.
 *
 * The host passes a separately authenticated and least-privileged SQL client.
 * This module never creates connections, reads secrets or permits tool execution.
 * Applying the database migration is a separately governed operation.
 *
 * Every read uses a database row lock to obtain an atomic snapshot. Every
 * append locks the same row and commits the entry plus the new stream head
 * in one transaction. An externally managed rollback witness is STILL
 * mandatory (ToolTrustLedger); this DB is not its own trust anchor.
 */
import type { AuditEntry } from '@nzila/audit'
import { computeAuditHash, verifyChain } from '@nzila/audit'
import {
  LEDGER_GENESIS_HASH, LedgerConflictError, LedgerDuplicateError,
  trustLedgerAuditEntrySchema,
  LedgerStoreUnavailableError, type AtomicTrustLedgerStore,
  type LedgerHead, type LedgerSnapshot,
} from './ledger-store'

export const TOOL_FABRIC_PG_STREAM = 'platform:tool-fabric:trust'

export interface PostgresTrustQuery {
  unsafe(query: string, params?: unknown[]): Promise<readonly Record<string, unknown>[]>
}
export interface PostgresTrustConnection extends PostgresTrustQuery {
  begin<T>(callback: (tx: PostgresTrustQuery) => Promise<T>): Promise<T>
}

function assertStream(orgId: string): void {
  if (orgId !== TOOL_FABRIC_PG_STREAM) {
    throw new LedgerStoreUnavailableError('Trust store is restricted to the canonical platform stream')
  }
}
function assertHead(row: Record<string, unknown>): LedgerHead {
  // PostgreSQL returns BIGINT as text. Number(null), Number('') and
  // Number('  ') are all zero: never treat a missing/invalid revision as
  // a legitimate genesis stream. Reject noncanonical and unsafe integers.
  const rawRevision = row.revision
  if (typeof rawRevision !== 'string' || !/^(0|[1-9][0-9]*)$/.test(rawRevision)) {
    throw new LedgerStoreUnavailableError('Persistent trust stream head is invalid')
  }
  const revision = Number(rawRevision)
  const headHash = row.head_hash
  if (!Number.isSafeInteger(revision) ||
      typeof headHash !== 'string' || !/^[0-9a-f]{64}$/.test(headHash)) {
    throw new LedgerStoreUnavailableError('Persistent trust stream head is invalid')
  }
  return Object.freeze({ revision, headHash })
}

/** PostgreSQL BIGINT is selected as text; reject coercible row indexes. */
function assertSequence(value: unknown, expected: number): void {
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value) ||
      !Number.isSafeInteger(Number(value)) || Number(value) !== expected) {
    throw new LedgerStoreUnavailableError('Persistent trust stream has invalid sequence index')
  }
}

function parseAuditEntry(row: Record<string, unknown>): AuditEntry {
  let value = row.entry
  try {
    if (typeof value === 'string') value = JSON.parse(value)
  } catch {
    throw new LedgerStoreUnavailableError('Persistent audit entry could not be decoded')
  }
  const result = trustLedgerAuditEntrySchema.safeParse(value)
  if (!result.success) throw new LedgerStoreUnavailableError('Persistent audit entry is malformed')
  return result.data
}

/**
 * Real database adapter with no fallback to a development/in-memory ledger.
 * The host is responsible for connecting this to its independently controlled
 * rollback witness. An SQL client without begin()/unsafe() fails closed.
 */
export class PostgresAtomicTrustLedgerStore implements AtomicTrustLedgerStore {
  readonly atomicContract = 'tool-trust-ledger-cas-v1' as const
  readonly persistence = 'HOST_ATTESTED_PERSISTENT' as const

  constructor(private readonly sql: PostgresTrustConnection) {
    if (!sql || typeof sql.begin !== 'function' || typeof sql.unsafe !== 'function') {
      throw new LedgerStoreUnavailableError('Authenticated transactional Postgres client required')
    }
  }

  async readSnapshot(orgId: string): Promise<LedgerSnapshot> {
    assertStream(orgId)
    return this.transaction(tx => this.readSnapshotLocked(tx, orgId, 'SHARE'))
  }

  /**
   * Revalidate the complete durable stream while holding the stream lock.
   * The append path MUST use the same integrity proof as a read: an intact
   * indexed head alone is not evidence that historical records were untampered.
   */
  private async readSnapshotLocked(
    tx: PostgresTrustQuery, orgId: string, lock: 'SHARE' | 'UPDATE',
  ): Promise<LedgerSnapshot> {
      const heads = await tx.unsafe(
        `SELECT revision::text AS revision, head_hash FROM tool_fabric_trust_stream WHERE stream_id = $1 FOR ${lock}`,
        [orgId],
      )
      if (heads.length !== 1) {
        throw new LedgerStoreUnavailableError('Canonical trust stream not initialized by approved migration')
      }
      const head = assertHead(heads[0]!)
      const rows = await tx.unsafe(
        'SELECT seq::text AS seq, audit_id::text AS audit_id, entry_hash, entry FROM tool_fabric_trust_entry WHERE stream_id = $1 ORDER BY seq ASC',
        [orgId],
      )
      if (rows.length !== head.revision) {
        throw new LedgerStoreUnavailableError('Persistent trust stream has missing or excess events')
      }
      const entries = rows.map((r, i) => {
        assertSequence(r.seq, i + 1)
        const entry = parseAuditEntry(r)
        // The relational identity/hash columns are immutable receipt indexes.
        // Verify them against the canonical full-coverage JSON event on every
        // read; a separately poisoned index must never be silently trusted.
        if (typeof r.audit_id !== 'string' ||
            r.audit_id.toLowerCase() !== entry.id.toLowerCase() ||
            typeof r.entry_hash !== 'string' || r.entry_hash !== entry.hash) {
          throw new LedgerStoreUnavailableError('Persistent trust audit receipt columns disagree with entry')
        }
        return entry
      })
      if ((entries.at(-1)?.hash ?? LEDGER_GENESIS_HASH) !== head.headHash) {
        throw new LedgerStoreUnavailableError('Persistent trust head does not match stored events')
      }
      // Do not expose a self-consistent head whose intermediate audit records
      // were altered, downgraded, duplicated or replayed. The higher-level
      // ToolTrustLedger additionally verifies event-body and policy semantics.
      if (entries.some(entry => entry.orgId !== orgId) ||
          new Set(entries.map(entry => entry.id)).size !== entries.length ||
          !verifyChain(entries, { requireFullCoverage: true }).valid) {
        throw new LedgerStoreUnavailableError('Persistent trust audit chain failed integrity verification')
      }
      return structuredClone({ revision: head.revision, headHash: head.headHash, entries })
  }

  async compareAndAppend(orgId: string, expected: LedgerHead, entry: AuditEntry): Promise<LedgerHead> {
    assertStream(orgId)
    if (!trustLedgerAuditEntrySchema.safeParse(entry).success || entry.orgId !== orgId ||
        entry.prevHash !== expected.headHash ||
        entry.payload.seq !== expected.revision + 1 ||
        !/^[0-9a-f]{64}$/.test(entry.hash ?? '')) {
      throw new LedgerConflictError('Append does not extend the expected trust head')
    }
    // A syntactically valid SHA-256 string is not proof that the audit record
    // authenticates its full payload. Reject invalid and legacy partial-coverage
    // records BEFORE the transaction, rather than persisting a poisoned head.
    if (entry.hashVersion !== 2 || computeAuditHash(expected.headHash, {
      id: entry.id,
      timestamp: entry.timestamp,
      actorId: entry.actorId,
      orgId: entry.orgId,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId,
      payload: entry.payload,
    }) !== entry.hash) {
      throw new LedgerConflictError('Append requires an authentic full-coverage audit v2 hash')
    }
    return this.transaction(async tx => {
      // Read and verify every committed audit event under the SAME exclusive
      // stream lock as the subsequent insert/head CAS. A poisoned history must
      // not be extended, even when its indexed head happens to match expected.
      const snapshot = await this.readSnapshotLocked(tx, orgId, 'UPDATE')
      const current: LedgerHead = { revision: snapshot.revision, headHash: snapshot.headHash }
      if (current.revision !== expected.revision || current.headHash !== expected.headHash) {
        throw new LedgerConflictError('Persistent trust ledger changed during CAS append')
      }
      try {
        const inserted = await tx.unsafe(
          'INSERT INTO tool_fabric_trust_entry (stream_id, seq, audit_id, entry_hash, entry) VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING seq::text AS seq',
          [orgId, current.revision + 1, entry.id, entry.hash, JSON.stringify(entry)],
        )
        if (inserted.length !== 1) {
          throw new LedgerConflictError('Persistent trust append returned invalid receipt')
        }
        try {
          assertSequence(inserted[0]!.seq, current.revision + 1)
        } catch {
          throw new LedgerConflictError('Persistent trust append returned invalid receipt')
        }
        const updated = await tx.unsafe(
          'UPDATE tool_fabric_trust_stream SET revision = $2, head_hash = $3, updated_at = now() WHERE stream_id = $1 AND revision = $4 AND head_hash = $5 RETURNING revision::text AS revision, head_hash',
          [orgId, current.revision + 1, entry.hash, current.revision, current.headHash],
        )
        if (updated.length !== 1) throw new LedgerConflictError('Persistent CAS stream head conflict')
        const head = assertHead(updated[0]!)
        if (head.revision !== current.revision + 1 || head.headHash !== entry.hash) {
          throw new LedgerConflictError('Persistent CAS returned unexpected head')
        }
        return head
      } catch (error) {
        if (error instanceof LedgerConflictError) throw error
        const pgCode = typeof error === 'object' && error !== null && 'code' in error
          ? String(error.code) : ''
        if (pgCode === '23505') throw new LedgerDuplicateError()
        // A lost connection or unknown failure is NEVER a successful append.
        throw new LedgerStoreUnavailableError('Persistent trust ledger append transaction failed')
      }
    })
  }

  private async transaction<T>(run: (tx: PostgresTrustQuery) => Promise<T>): Promise<T> {
    try {
      return await this.sql.begin(run)
    } catch (error) {
      if (error instanceof LedgerConflictError || error instanceof LedgerDuplicateError ||
          error instanceof LedgerStoreUnavailableError) throw error
      throw new LedgerStoreUnavailableError('Transactional trust ledger database unavailable')
    }
  }
}
