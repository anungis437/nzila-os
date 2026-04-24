/**
 * Driver-agnostic DB adapter for staging-seed persistence.
 *
 * The staging-seed framework deliberately depends on NO DB driver
 * (postgres-js, drizzle-orm, etc.) so tests can run hermetically and so
 * the package doesn't drag a Postgres client into apps that already ship
 * one. Callers (the CLI, an app's reseed script) inject an adapter at
 * runtime via {@link createStagingPersister}.
 *
 * Two adapters ship with this package:
 *   - {@link createInMemoryAdapter} — used by tests + dry-run preview.
 *   - {@link createPostgresAdapter} — thin wrapper over `postgres` (porsager)
 *     loaded ONLY when `STAGING_SEED_ENABLED=true`.
 */

export interface DbAdapter {
  /** Begin a transaction, run the callback, commit on success, rollback on throw. */
  withTransaction<T>(fn: (tx: DbTx) => Promise<T>): Promise<T>
  /** Used by tests to inspect contents. Optional in prod adapters. */
  dump?(): {
    runs: ReadonlyArray<Record<string, unknown>>
    artifacts: ReadonlyArray<Record<string, unknown>>
  }
  /** Release any underlying resources. */
  close(): Promise<void>
}

export interface DbTx {
  /** Insert one staging_seed_runs row, returns the run id (UUID string). */
  insertRun(row: StagingSeedRunRow): Promise<string>
  /** Mark an in-progress run row as finished. */
  finishRun(args: {
    runId: string
    finishedAt: string
    durationMs: number
    status: 'ok' | 'error' | 'dry-run'
    totals: Record<string, number>
    errorMessage?: string | null
  }): Promise<void>
  /**
   * Upsert one batch of staging_seed_artifacts. Idempotency key:
   * (app, org_id, entity_type, entity_id). Subsequent runs replace the
   * payload + bump updated_at.
   */
  upsertArtifacts(rows: ReadonlyArray<StagingSeedArtifactRow>): Promise<number>
  /**
   * Delete all artifacts for the given allowlisted org ids. Returns
   * deletion counts per (app, entity_type) so reset prints them.
   */
  deleteArtifactsForOrgs(orgIds: readonly string[]): Promise<Record<string, number>>
}

export interface StagingSeedRunRow {
  readonly id: string
  readonly app: string
  readonly profile: string
  readonly seed: number
  readonly command: 'seed' | 'reseed' | 'reset'
  readonly dryRun: boolean
  readonly startedAt: string
  readonly orgId: string | null
}

export interface StagingSeedArtifactRow {
  readonly app: string
  readonly orgId: string
  readonly entityType: string
  readonly entityId: string
  readonly profile: string
  readonly seed: number
  readonly runId: string
  readonly payload: Record<string, unknown>
}

// ----------------------------------------------------------------------
// In-memory adapter (tests + --dry-run preview)
// ----------------------------------------------------------------------

interface InMemoryRun extends StagingSeedRunRow {
  finishedAt?: string
  durationMs?: number
  status?: 'ok' | 'error' | 'dry-run'
  totals?: Record<string, number>
  errorMessage?: string | null
}

export function createInMemoryAdapter(): DbAdapter {
  const runs: InMemoryRun[] = []
  const artifacts = new Map<string, StagingSeedArtifactRow & { updatedAt: string }>()

  function key(row: Pick<StagingSeedArtifactRow, 'app' | 'orgId' | 'entityType' | 'entityId'>) {
    return `${row.app}::${row.orgId}::${row.entityType}::${row.entityId}`
  }

  let txDepth = 0
  let snapshot:
    | {
        runs: InMemoryRun[]
        artifacts: typeof artifacts
      }
    | null = null

  const tx: DbTx = {
    async insertRun(row) {
      runs.push({ ...row })
      return row.id
    },
    async finishRun(args) {
      const found = runs.find((r) => r.id === args.runId)
      if (!found) throw new Error(`run ${args.runId} not found`)
      found.finishedAt = args.finishedAt
      found.durationMs = args.durationMs
      found.status = args.status
      found.totals = args.totals
      found.errorMessage = args.errorMessage ?? null
    },
    async upsertArtifacts(rows) {
      const now = new Date().toISOString()
      for (const r of rows) artifacts.set(key(r), { ...r, updatedAt: now })
      return rows.length
    },
    async deleteArtifactsForOrgs(orgIds) {
      const counts: Record<string, number> = {}
      const allow = new Set(orgIds)
      for (const [k, v] of Array.from(artifacts.entries())) {
        if (!allow.has(v.orgId)) continue
        artifacts.delete(k)
        const ck = `${v.app}::${v.entityType}`
        counts[ck] = (counts[ck] ?? 0) + 1
      }
      return counts
    },
  }

  return {
    async withTransaction(fn) {
      if (txDepth === 0) {
        snapshot = {
          runs: runs.map((r) => ({ ...r })),
          artifacts: new Map(artifacts),
        }
      }
      txDepth++
      try {
        const result = await fn(tx)
        txDepth--
        if (txDepth === 0) snapshot = null
        return result
      } catch (err) {
        txDepth--
        if (txDepth === 0 && snapshot) {
          runs.length = 0
          runs.push(...snapshot.runs)
          artifacts.clear()
          for (const [k, v] of snapshot.artifacts) artifacts.set(k, v)
          snapshot = null
        }
        throw err
      }
    },
    dump() {
      return {
        runs: runs.map((r) => ({ ...r })),
        artifacts: Array.from(artifacts.values()).map((a) => ({ ...a })),
      }
    },
    async close() {
      runs.length = 0
      artifacts.clear()
    },
  }
}
