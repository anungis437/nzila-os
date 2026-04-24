/**
 * Tiny helper that turns a list of (entityType, rows) pairs into the
 * `SeedPlanSnapshot` accepted by `ctx.persist`, plus emits the standard
 * `db_write` step on the reporter. Keeps every seeder's persist branch
 * down to a single call.
 *
 * Not part of the public API — internal to the per-app seeders.
 */
import type { SeedContext } from '../core/types'

export type EntityRows = ReadonlyArray<{ readonly id: string }>

export interface EntitySpec {
  readonly entityType: string
  readonly rows: EntityRows
}

export async function persistOrSkip(
  ctx: SeedContext,
  orgId: string,
  entities: ReadonlyArray<EntitySpec>,
): Promise<void> {
  if (ctx.dryRun) {
    ctx.report.step({ step: 'db_write', count: 0, skipped: true, note: 'dry-run mode' })
    return
  }
  if (!ctx.persist) {
    ctx.report.step({
      step: 'db_write',
      count: 0,
      skipped: true,
      note: 'no persist hook (STAGING_SEED_ENABLED unset or DB allowlist mismatch)',
    })
    return
  }
  const outcome = await ctx.persist({ orgId, entities })
  ctx.report.step({
    step: 'db_write',
    count: Object.values(outcome.totals).reduce((s, n) => s + n, 0),
    note: `persisted via run ${outcome.runId} (${outcome.status})`,
  })
}

export async function persistResetOrSkip(
  ctx: SeedContext,
  orgId: string,
): Promise<void> {
  if (ctx.dryRun) {
    ctx.report.step({ step: 'reset', count: 0, skipped: true, note: 'dry-run mode' })
    return
  }
  if (!ctx.persist) {
    ctx.report.step({
      step: 'reset',
      count: 0,
      skipped: true,
      note: `no persist hook — staging org "${orgId}" untouched`,
    })
    return
  }
  const outcome = await ctx.persist({ orgId, entities: [] })
  ctx.report.step({
    step: 'reset',
    count: 0,
    note: `reset audit row recorded as run ${outcome.runId}`,
  })
}
