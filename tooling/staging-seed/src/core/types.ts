/**
 * Core types for the staging-seed framework.
 *
 * Per-app seeders implement {@link SeederModule} and register with
 * {@link registerSeeder} from the package root. The CLI runner orchestrates
 * registered seeders for a given {@link SeedProfile}.
 */

export const SEED_PROFILES = [
  'demo-light',
  'demo-standard',
  'executive-showcase',
  'investor-showcase',
] as const

export type SeedProfile = (typeof SEED_PROFILES)[number]

/** Apps known to the registry. Add new entries as seeders come online. */
export const SEED_APPS = [
  'union-eyes',
  'flow',
  'zonga',
  'weekone',
  'faircase',
  'agrimo',
  'cora',
  'console',
  'control-plane',
] as const

export type SeedApp = (typeof SEED_APPS)[number]

/**
 * Per-profile volume + intensity targets that shared fakers and per-app
 * seeders consult to scale data realistically.
 */
export interface ProfileTargets {
  /** Per-entity row counts. Per-app seeders may override. */
  readonly people: number
  readonly organizations: number
  readonly users: number
  readonly invoices: number
  readonly tickets: number
  readonly events: number
  readonly notifications: number
  readonly activityLogs: number
  /** How aggressive trends/growth/alerts should look on dashboards. 0..1 */
  readonly dashboardIntensity: number
  /** Months of historical back-dated activity to generate. */
  readonly historyMonths: number
  /** Future-scheduled items window in days. */
  readonly futureWindowDays: number
}

export type ProfileTargetMap = Readonly<Record<SeedProfile, ProfileTargets>>

/**
 * Deterministic RNG. Implementations MUST be seeded from
 * {@link SeedContext.seed} and produce identical sequences across runs.
 */
export interface SeedRng {
  /** Uniform float in [0, 1). */
  next(): number
  /** Integer in [min, max] inclusive. */
  intBetween(min: number, max: number): number
  /** Pick one element. Throws if the array is empty. */
  pick<T>(items: readonly T[]): T
  /** Pick `n` distinct elements without replacement. */
  sample<T>(items: readonly T[], n: number): T[]
  /** Stable id. `prefix-XXXXXXXX` (8 hex chars, deterministic). */
  id(prefix: string): string
  /** Boolean with `pTrue` probability of true. */
  boolean(pTrue?: number): boolean
}

/** Time-realism helpers. All dates are UTC. */
export interface SeedTime {
  /** Today at 00:00:00 UTC. */
  today(): Date
  /** N days ago at 00:00:00 UTC. */
  daysAgo(days: number): Date
  /** N days in the future at 00:00:00 UTC. */
  daysAhead(days: number): Date
  /** Window covering the historical horizon for the active profile. */
  historyWindow(): { start: Date; end: Date }
  /** Window covering the future horizon for the active profile. */
  futureWindow(): { start: Date; end: Date }
}

/** Minimal logger surface so tests can capture output. */
export interface SeedLogger {
  info(msg: string, fields?: Record<string, unknown>): void
  warn(msg: string, fields?: Record<string, unknown>): void
  error(msg: string, fields?: Record<string, unknown>): void
}

/** Per-step record that bubbles up into the JSON report. */
export interface SeedStepRecord {
  readonly step: string
  readonly entity?: string
  readonly count: number
  readonly skipped?: boolean
  readonly note?: string
}

/** Per-app reporter. Returned from each seeder via `ctx.report.finish()`. */
export interface SeedReporter {
  step(record: SeedStepRecord): void
  /** Snapshot of all steps recorded so far. */
  steps(): readonly SeedStepRecord[]
  /** Materialize the per-app report. */
  finish(): SeedAppReport
}

export interface SeedAppReport {
  readonly app: SeedApp
  readonly profile: SeedProfile
  readonly dryRun: boolean
  readonly startedAt: string
  readonly finishedAt: string
  readonly durationMs: number
  readonly steps: readonly SeedStepRecord[]
  readonly totalRecords: number
}

/** What a seeder receives at runtime. */
export interface SeedContext {
  readonly app: SeedApp
  readonly profile: SeedProfile
  readonly targets: ProfileTargets
  readonly rng: SeedRng
  readonly time: SeedTime
  readonly seed: number
  readonly dryRun: boolean
  readonly logger: SeedLogger
  readonly report: SeedReporter
  /**
   * When set, the seeder SHOULD call it once with a plan snapshot to
   * persist the synthetic data via the staging-seed framework's audit +
   * JSONB store. Absent when the runner has no DB adapter (plan-only
   * runs, e.g. CI without `STAGING_SEED_ENABLED`).
   */
  readonly persist?: (plan: SeedPlanSnapshot) => Promise<SeedPersistOutcome>
}

/** What a seeder hands to `ctx.persist` for the framework to write. */
export interface SeedPlanSnapshot {
  readonly orgId: string
  readonly entities: ReadonlyArray<{
    readonly entityType: string
    readonly rows: ReadonlyArray<{ readonly id: string }>
  }>
}

export interface SeedPersistOutcome {
  readonly runId: string
  readonly status: 'ok' | 'dry-run' | 'error'
  readonly totals: Record<string, number>
  readonly durationMs: number
}

/** Seeder module — what apps register. */
export interface SeederModule {
  readonly app: SeedApp
  readonly description: string
  readonly supportedProfiles: readonly SeedProfile[]
  /** Idempotent seed (upsert-style). */
  seed(ctx: SeedContext): Promise<SeedAppReport>
  /**
   * Optional reset (DESTRUCTIVE — wipes seeded rows for the app).
   * Implementations MUST scope deletes to seeded data only.
   */
  reset?(ctx: SeedContext): Promise<SeedAppReport>
}

/** Top-level CLI run result. */
export interface SeedRunReport {
  readonly profile: SeedProfile
  readonly seed: number
  readonly dryRun: boolean
  readonly command: 'seed' | 'reseed' | 'reset'
  readonly startedAt: string
  readonly finishedAt: string
  readonly durationMs: number
  readonly apps: readonly SeedAppReport[]
  readonly skippedApps: readonly { app: SeedApp; reason: string }[]
}
