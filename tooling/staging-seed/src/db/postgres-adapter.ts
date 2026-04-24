/**
 * Postgres adapter for the staging-seed persister.
 *
 * Loaded LAZILY via dynamic import so this package does NOT need the
 * `postgres` driver as a dependency for unit tests or for plan-only runs.
 * The driver MUST be available in the workspace at the call site (every
 * app that uses Drizzle already ships it).
 *
 * Required tables (see migrations/001_staging_seed_tables.sql). The
 * adapter assumes those tables already exist; callers should run the
 * migration once per staging DB.
 */
import type { DbAdapter, DbTx, StagingSeedArtifactRow, StagingSeedRunRow } from './adapter'

interface SqlTag {
  // Minimal slice of postgres-js's `Sql` we use. Kept narrow so the
  // dynamic import doesn't leak postgres-js types into our public API.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (strings: TemplateStringsArray, ...values: any[]): Promise<any>
  begin<T>(fn: (sql: SqlTag) => Promise<T>): Promise<T>
  end(opts?: { timeout?: number }): Promise<void>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json(value: unknown): any
}

export interface PostgresAdapterOptions {
  readonly databaseUrl: string
  /** Override `postgres` import for tests (rarely needed). */
  readonly postgresFactory?: (url: string) => SqlTag
}

export async function createPostgresAdapter(
  options: PostgresAdapterOptions,
): Promise<DbAdapter> {
  let factory = options.postgresFactory
  if (!factory) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import(/* @vite-ignore */ 'postgres' as string).catch(() => {
      throw new Error(
        'staging-seed: Postgres adapter requested but the "postgres" driver is not installed in this workspace.',
      )
    })
    const fn = (mod.default ?? mod) as (url: string) => SqlTag
    factory = (url: string) => fn(url)
  }
  const sql = factory(options.databaseUrl)

  function buildTx(scopedSql: SqlTag): DbTx {
    return {
      async insertRun(row: StagingSeedRunRow) {
        await scopedSql`
          insert into staging_seed_runs
            (id, app, profile, seed, command, dry_run, started_at, org_id, status)
          values
            (${row.id}::uuid, ${row.app}, ${row.profile}, ${row.seed},
             ${row.command}, ${row.dryRun}, ${row.startedAt}::timestamptz,
             ${row.orgId}, 'in_progress')
          on conflict (id) do nothing
        `
        return row.id
      },
      async finishRun(args) {
        await scopedSql`
          update staging_seed_runs
             set finished_at = ${args.finishedAt}::timestamptz,
                 duration_ms = ${args.durationMs},
                 status = ${args.status},
                 totals = ${scopedSql.json(args.totals)},
                 error_message = ${args.errorMessage ?? null}
           where id = ${args.runId}::uuid
        `
      },
      async upsertArtifacts(rows: ReadonlyArray<StagingSeedArtifactRow>) {
        if (rows.length === 0) return 0
        // Insert in batches of 500 to keep statements small.
        const BATCH = 500
        let written = 0
        for (let i = 0; i < rows.length; i += BATCH) {
          const slice = rows.slice(i, i + BATCH)
          // postgres-js handles array-of-records insert via `sql(values)`.
          const values = slice.map((r) => ({
            app: r.app,
            org_id: r.orgId,
            entity_type: r.entityType,
            entity_id: r.entityId,
            profile: r.profile,
            seed: r.seed,
            run_id: r.runId,
            payload: r.payload,
          })) as unknown
          await scopedSql`
            insert into staging_seed_artifacts ${scopedSql.json(values)}
            on conflict (app, org_id, entity_type, entity_id) do update
              set payload = excluded.payload,
                  profile = excluded.profile,
                  seed = excluded.seed,
                  run_id = excluded.run_id,
                  updated_at = now()
          `
          written += slice.length
        }
        return written
      },
      async deleteArtifactsForOrgs(orgIds: readonly string[]) {
        if (orgIds.length === 0) return {}
        const rows = await scopedSql`
          delete from staging_seed_artifacts
          where org_id = any(${orgIds as unknown as string[]}::text[])
          returning app, entity_type
        `
        const counts: Record<string, number> = {}
        for (const r of rows as unknown as ReadonlyArray<{ app: string; entity_type: string }>) {
          const k = `${r.app}::${r.entity_type}`
          counts[k] = (counts[k] ?? 0) + 1
        }
        return counts
      },
    }
  }

  return {
    async withTransaction<T>(fn: (tx: DbTx) => Promise<T>): Promise<T> {
      return sql.begin((scopedSql) => fn(buildTx(scopedSql)))
    },
    async close() {
      await sql.end({ timeout: 5 })
    },
  }
}
