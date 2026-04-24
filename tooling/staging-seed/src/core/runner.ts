import { listSeeders, getSeeder } from './registry'
import { createReporter } from './reporter'
import { createRng, DEFAULT_SEED } from './rng'
import { createTime } from './time'
import { getProfileTargets } from './profiles'
import type {
  SeedApp,
  SeedAppReport,
  SeedContext,
  SeedLogger,
  SeedPersistOutcome,
  SeedPlanSnapshot,
  SeedProfile,
  SeedRunReport,
  SeederModule,
} from './types'

export interface RunOptions {
  profile: SeedProfile
  seed?: number
  dryRun?: boolean
  /** Restrict to a single registered app. */
  app?: SeedApp
  /** Override `new Date()` (used by tests). */
  now?: () => Date
  logger?: SeedLogger
  /**
   * Optional persistence hook. Called once per seeder with the seeder's
   * plan snapshot. The runner does NOT decide whether to persist — it
   * just forwards the call. Callers (CLI) construct this hook only when
   * the safety gate has passed.
   */
  persist?: (args: {
    app: SeedApp
    command: 'seed' | 'reseed' | 'reset'
    profile: SeedProfile
    seed: number
    dryRun: boolean
    plan: SeedPlanSnapshot
  }) => Promise<SeedPersistOutcome>
}

const noopLogger: SeedLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
}

function buildContext(args: {
  module: SeederModule
  options: RunOptions
  command: 'seed' | 'reseed' | 'reset'
}): SeedContext {
  const { module, options, command } = args
  const seed = options.seed ?? DEFAULT_SEED
  const targets = getProfileTargets(options.profile)
  // Each app gets its own RNG seeded from `seed + hash(app)` so different
  // apps generate independent streams while remaining deterministic.
  const appSeed = (seed + hashApp(module.app)) >>> 0
  const rng = createRng(appSeed)
  const time = createTime(targets, options.now?.())
  const report = createReporter({
    app: module.app,
    profile: options.profile,
    dryRun: options.dryRun ?? false,
    now: options.now,
  })
  const persist = options.persist
    ? (plan: SeedPlanSnapshot) =>
        options.persist!({
          app: module.app,
          command,
          profile: options.profile,
          seed: appSeed,
          dryRun: options.dryRun ?? false,
          plan,
        })
    : undefined
  return {
    app: module.app,
    profile: options.profile,
    targets,
    rng,
    time,
    seed: appSeed,
    dryRun: options.dryRun ?? false,
    logger: options.logger ?? noopLogger,
    report,
    persist,
  }
}

function hashApp(app: SeedApp): number {
  // Tiny deterministic string hash (FNV-1a 32-bit) so per-app RNG seeds
  // are stable across machines.
  let h = 0x811c9dc5
  for (let i = 0; i < app.length; i++) {
    h ^= app.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function pickSeeders(app?: SeedApp): {
  modules: readonly SeederModule[]
  skipped: { app: SeedApp; reason: string }[]
} {
  if (!app) return { modules: listSeeders(), skipped: [] }
  const m = getSeeder(app)
  if (!m) {
    return {
      modules: [],
      skipped: [{ app, reason: 'no seeder registered for this app' }],
    }
  }
  return { modules: [m], skipped: [] }
}

async function executeOne(args: {
  module: SeederModule
  command: 'seed' | 'reseed' | 'reset'
  options: RunOptions
}): Promise<SeedAppReport | { skipped: true; reason: string }> {
  const { module, command, options } = args
  const ctx = buildContext({ module, options, command })

  if (!module.supportedProfiles.includes(options.profile)) {
    return {
      skipped: true,
      reason: `profile "${options.profile}" not supported by app "${module.app}"`,
    }
  }

  if (command === 'reset') {
    if (!module.reset) {
      return {
        skipped: true,
        reason: `app "${module.app}" does not implement reset()`,
      }
    }
    return module.reset(ctx)
  }

  if (command === 'reseed' && module.reset) {
    // reset → seed within the same context (counts accumulate).
    await module.reset(ctx)
  }

  return module.seed(ctx)
}

export async function runSeed(args: {
  command: 'seed' | 'reseed' | 'reset'
  options: RunOptions
}): Promise<SeedRunReport> {
  const { command, options } = args
  const startedAt = (options.now?.() ?? new Date()).toISOString()
  const startMs = (options.now?.() ?? new Date()).getTime()

  const { modules, skipped } = pickSeeders(options.app)
  const apps: SeedAppReport[] = []
  const skippedApps: { app: SeedApp; reason: string }[] = [...skipped]

  for (const module of modules) {
    const result = await executeOne({ module, command, options })
    if ('skipped' in result) {
      skippedApps.push({ app: module.app, reason: result.reason })
    } else {
      apps.push(result)
    }
  }

  const finishedAtDate = options.now?.() ?? new Date()
  return {
    profile: options.profile,
    seed: options.seed ?? DEFAULT_SEED,
    dryRun: options.dryRun ?? false,
    command,
    startedAt,
    finishedAt: finishedAtDate.toISOString(),
    durationMs: finishedAtDate.getTime() - startMs,
    apps,
    skippedApps,
  }
}
