import { DatabaseSync } from 'node:sqlite'
import { z } from 'zod'
import type { InstitutionalScope } from '@nzila/platform-contracts'
import { institutionalScopeSchema } from '@nzila/platform-contracts'

export const storedInstitutionalRecordSchema = z.object({
  scope: institutionalScopeSchema,
  kind: z.string(),
  id: z.string(),
  version: z.number().int().positive(),
  data: z.unknown(),
})
export type StoredInstitutionalRecord = z.infer<typeof storedInstitutionalRecordSchema>

/** Ephemeral/local proof adapter only; never composed into a production host. */
export class LocalInstitutionalStore {
  readonly #db: DatabaseSync
  #inTransaction = false

  constructor(filename: string) {
    this.#db = new DatabaseSync(filename)
    this.#db.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS revisions (
        scope_type TEXT NOT NULL, scope_id TEXT NOT NULL,
        kind TEXT NOT NULL, id TEXT NOT NULL, version INTEGER NOT NULL,
        record TEXT NOT NULL,
        PRIMARY KEY(scope_type, scope_id, kind, id, version)
      );
      CREATE TABLE IF NOT EXISTS successors (
        scope_type TEXT NOT NULL, scope_id TEXT NOT NULL,
        predecessor TEXT NOT NULL, successor TEXT NOT NULL,
        PRIMARY KEY(scope_type, scope_id, predecessor)
      );
    `)
  }

  close(): void { this.#db.close() }

  transaction<T>(work: () => T): T {
    if (this.#inTransaction) throw new Error('NESTED_TRANSACTION')
    this.#db.exec('BEGIN IMMEDIATE')
    this.#inTransaction = true
    try {
      const result = work()
      if (result instanceof Promise) throw new Error('ASYNC_TRANSACTION_NOT_SUPPORTED')
      this.#db.exec('COMMIT')
      return result
    } catch (error) {
      this.#db.exec('ROLLBACK')
      throw error
    } finally {
      this.#inTransaction = false
    }
  }

  get(scope: InstitutionalScope, kind: string, id: string, revision?: number): StoredInstitutionalRecord | undefined {
    const parsed = institutionalScopeSchema.parse(scope)
    const row = revision === undefined
      ? this.#db.prepare(`SELECT record FROM revisions WHERE scope_type=? AND scope_id=? AND kind=? AND id=? ORDER BY version DESC LIMIT 1`)
        .get(parsed.type, parsed.id, kind, id)
      : this.#db.prepare(`SELECT record FROM revisions WHERE scope_type=? AND scope_id=? AND kind=? AND id=? AND version=?`)
        .get(parsed.type, parsed.id, kind, id, revision)
    if (!row) return undefined
    if (typeof row.record !== 'string') throw new Error('STORAGE_INTEGRITY_ERROR')
    return storedInstitutionalRecordSchema.parse(JSON.parse(row.record))
  }

  list(scope: InstitutionalScope, kind: string): StoredInstitutionalRecord[] {
    const parsed = institutionalScopeSchema.parse(scope)
    return this.#db.prepare(`SELECT record FROM revisions r WHERE scope_type=? AND scope_id=? AND kind=?
      AND version=(SELECT MAX(version) FROM revisions h WHERE h.scope_type=r.scope_type AND h.scope_id=r.scope_id AND h.kind=r.kind AND h.id=r.id)
      ORDER BY id`).all(parsed.type, parsed.id, kind).map(row => {
      if (typeof row.record !== 'string') throw new Error('STORAGE_INTEGRITY_ERROR')
      return storedInstitutionalRecordSchema.parse(JSON.parse(row.record))
    })
  }

  revisions(scope: InstitutionalScope, kind: string): StoredInstitutionalRecord[] {
    const parsed = institutionalScopeSchema.parse(scope)
    return this.#db.prepare('SELECT record FROM revisions WHERE scope_type=? AND scope_id=? AND kind=? ORDER BY id, version')
      .all(parsed.type, parsed.id, kind).map(row => {
        if (typeof row.record !== 'string') throw new Error('STORAGE_INTEGRITY_ERROR')
        return storedInstitutionalRecordSchema.parse(JSON.parse(row.record))
      })
  }

  append(scope: InstitutionalScope, kind: string, id: string, expectedVersion: number, data: unknown): StoredInstitutionalRecord {
    this.#assertTransaction()
    if (kind === 'GovernanceRationale' && expectedVersion !== 0) throw new Error('DECIDED_RATIONALE_IMMUTABLE_USE_SUPERSESSION')
    if (['BenefitObservation', 'BenefitAcceptance'].includes(kind) && expectedVersion !== 0) throw new Error('IMMUTABLE_RECORD_USE_NEW_RECEIPT')
    if ((this.get(scope, kind, id)?.version ?? 0) !== expectedVersion) throw new Error('CONFLICT')
    const record = storedInstitutionalRecordSchema.parse({ scope, kind, id, version: expectedVersion + 1, data })
    this.#db.prepare('INSERT INTO revisions VALUES (?,?,?,?,?,?)')
      .run(scope.type, scope.id, kind, id, record.version, JSON.stringify(record))
    return record
  }

  successor(scope: InstitutionalScope, predecessor: string): string | undefined {
    const row = this.#db.prepare('SELECT successor FROM successors WHERE scope_type=? AND scope_id=? AND predecessor=?')
      .get(scope.type, scope.id, predecessor)
    if (!row) return undefined
    if (typeof row.successor !== 'string') throw new Error('STORAGE_INTEGRITY_ERROR')
    return row.successor
  }

  linkSuccessor(scope: InstitutionalScope, predecessor: string, successor: string): void {
    this.#assertTransaction()
    if (predecessor === successor || this.successor(scope, predecessor)) throw new Error('CONFLICT')
    this.#db.prepare('INSERT INTO successors VALUES (?,?,?,?)').run(scope.type, scope.id, predecessor, successor)
  }

  #assertTransaction(): void {
    if (!this.#inTransaction) throw new Error('TRANSACTION_REQUIRED')
  }
}
