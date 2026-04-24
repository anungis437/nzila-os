#!/usr/bin/env tsx
/**
 * @nzila/staging-seed — CLI entrypoint.
 *
 * Commands:
 *   tsx src/cli.ts seed     [--profile=<p>] [--app=<a>] [--seed=<n>] [--dry-run] [--report=<path>]
 *   tsx src/cli.ts reseed   --app=<a> [--profile=<p>] [--seed=<n>] [--report=<path>]
 *   tsx src/cli.ts reset    [--app=<a>] [--confirm] [--report=<path>]
 *
 * Persistence (Phase 3A.0):
 *   The CLI passes a `persist` hook to the runner ONLY when the safety
 *   gate {@link evaluateSafety} returns `allowed: true`. That hook writes
 *   into `staging_seed_artifacts` (JSONB) and `staging_seed_runs` (audit)
 *   inside a per-seeder transaction. Without `STAGING_SEED_ENABLED=true`
 *   the seeders run plan-only and emit a `db_write` step with
 *   `skipped: true` — safe by default.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runSeed } from './core/runner'
import { listSeeders } from './core/registry'
import { DEFAULT_PROFILE, isSeedProfile } from './core/profiles'
import { DEFAULT_SEED } from './core/rng'
import {
  SEED_APPS,
  SEED_PROFILES,
  type SeedApp,
  type SeedLogger,
  type SeedPersistOutcome,
  type SeedPlanSnapshot,
  type SeedProfile,
} from './core/types'
import {
  createPostgresAdapter,
  evaluateSafety,
  persistAppPlan,
  resetForOrgs,
  type DbAdapter,
  type SafetyDecision,
} from './db'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '../../..')
const DEFAULT_REPORT = path.join(REPO_ROOT, 'demo-output', 'seed-report.json')

type Command = 'seed' | 'reseed' | 'reset'
const VALID_COMMANDS: readonly Command[] = ['seed', 'reseed', 'reset']

interface ParsedArgs {
  command: Command
  profile: SeedProfile
  app?: SeedApp
  seed: number
  dryRun: boolean
  /** True when --confirm or --yes is passed. Required for `reset`. */
  confirm: boolean
  reportPath: string
  help: boolean
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const [rawCommand, ...rest] = argv
  if (!rawCommand || rawCommand === '--help' || rawCommand === '-h') {
    return makeDefaultArgs('seed', { help: true })
  }
  if (!(VALID_COMMANDS as readonly string[]).includes(rawCommand)) {
    throw new Error(
      `Unknown command "${rawCommand}". Expected one of: ${VALID_COMMANDS.join(', ')}.`,
    )
  }

  const result = makeDefaultArgs(rawCommand as Command)

  for (const token of rest) {
    if (token === '--dry-run') {
      result.dryRun = true
      continue
    }
    if (token === '--yes' || token === '-y' || token === '--confirm') {
      result.confirm = true
      continue
    }
    if (token === '--help' || token === '-h') {
      result.help = true
      continue
    }
    const m = /^--([a-z-]+)=(.+)$/.exec(token)
    if (!m) throw new Error(`Unrecognized argument: ${token}`)
    const [, key, value] = m
    switch (key) {
      case 'profile':
        if (!isSeedProfile(value)) {
          throw new Error(
            `Invalid profile "${value}". Expected one of: ${SEED_PROFILES.join(', ')}.`,
          )
        }
        result.profile = value
        break
      case 'app':
        if (!(SEED_APPS as readonly string[]).includes(value!)) {
          throw new Error(
            `Invalid app "${value}". Expected one of: ${SEED_APPS.join(', ')}.`,
          )
        }
        result.app = value as SeedApp
        break
      case 'seed': {
        const n = Number.parseInt(value!, 10)
        if (!Number.isFinite(n) || n < 0) {
          throw new Error(`Invalid --seed value "${value}" (expected non-negative integer).`)
        }
        result.seed = n
        break
      }
      case 'report':
        result.reportPath = path.isAbsolute(value!) ? value! : path.resolve(process.cwd(), value!)
        break
      default:
        throw new Error(`Unknown flag --${key}`)
    }
  }

  if (result.command === 'reseed' && !result.app) {
    throw new Error('reseed requires --app=<app>')
  }
  return result
}

function makeDefaultArgs(command: Command, overrides: Partial<ParsedArgs> = {}): ParsedArgs {
  return {
    command,
    profile: DEFAULT_PROFILE,
    seed: DEFAULT_SEED,
    dryRun: false,
    confirm: false,
    reportPath: DEFAULT_REPORT,
    help: false,
    ...overrides,
  }
}

function printHelp(): void {
  process.stdout.write(`@nzila/staging-seed CLI

Usage:
  tsx src/cli.ts <command> [options]

Commands:
  seed                       Run all (or one) registered seeders
  reseed   --app=<app>       Reset+seed a single app
  reset                      Run reset() on all (or one) registered seeders

Options:
  --profile=<name>           One of: ${SEED_PROFILES.join(', ')} (default: ${DEFAULT_PROFILE})
  --app=<name>               One of: ${SEED_APPS.join(', ')}
  --seed=<int>               Deterministic RNG seed (default: ${DEFAULT_SEED})
  --dry-run                  Compute plan + report, no writes
  --confirm, --yes, -y       Required to actually reset
  --report=<path>            JSON report output (default: demo-output/seed-report.json)
  --help, -h                 Show this help

Persistence:
  Set STAGING_SEED_ENABLED=true and DATABASE_URL=postgres://... to persist
  synthetic data into the framework's audit + JSONB store. Without those
  the CLI runs plan-only and emits a skipped 'db_write' step.
`)
}

const consoleLogger: SeedLogger = {
  info: (msg, fields) => process.stdout.write(formatLog('INFO', msg, fields) + '\n'),
  warn: (msg, fields) => process.stdout.write(formatLog('WARN', msg, fields) + '\n'),
  error: (msg, fields) => process.stderr.write(formatLog('ERROR', msg, fields) + '\n'),
}

function formatLog(level: string, msg: string, fields?: Record<string, unknown>): string {
  const suffix = fields ? ' ' + JSON.stringify(fields) : ''
  return `[${level}] ${msg}${suffix}`
}

async function loadAppSeeders(): Promise<void> {
  const loaders: readonly { app: string; load: () => Promise<unknown> }[] = [
    { app: 'union-eyes', load: () => import('./seeders/union-eyes') },
    { app: 'flow', load: () => import('./seeders/flow') },
    { app: 'zonga', load: () => import('./seeders/zonga') },
    { app: 'weekone', load: () => import('./seeders/weekone') },
    { app: 'agrimo', load: () => import('./seeders/agrimo') },
    { app: 'cora', load: () => import('./seeders/cora') },
    { app: 'faircase', load: () => import('./seeders/faircase') },
    { app: 'console', load: () => import('./seeders/console') },
    { app: 'control-plane', load: () => import('./seeders/control-plane') },
  ]
  for (const { app, load } of loaders) {
    try {
      await load()
    } catch (err) {
      process.stderr.write(
        `[staging-seed] failed to load seeder for "${app}": ${(err as Error).message}\n`,
      )
    }
  }
}

function writeReport(reportPath: string, payload: unknown): void {
  const dir = path.dirname(reportPath)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(reportPath, JSON.stringify(payload, null, 2), 'utf-8')
}

interface AdapterContext {
  readonly adapter: DbAdapter | null
  readonly safety: SafetyDecision
  readonly persistedRunIds: Set<string>
  readonly orgIds: Set<string>
}

async function buildAdapter(): Promise<AdapterContext> {
  const safety = evaluateSafety()
  if (!safety.allowed) {
    return { adapter: null, safety, persistedRunIds: new Set(), orgIds: new Set() }
  }
  const adapter = await createPostgresAdapter({ databaseUrl: safety.databaseUrl! })
  return { adapter, safety, persistedRunIds: new Set(), orgIds: new Set() }
}

function makePersistHook(
  ctx: AdapterContext,
):
  | ((args: {
      app: SeedApp
      command: 'seed' | 'reseed' | 'reset'
      profile: SeedProfile
      seed: number
      dryRun: boolean
      plan: SeedPlanSnapshot
    }) => Promise<SeedPersistOutcome>)
  | undefined {
  if (!ctx.adapter) return undefined
  const adapter = ctx.adapter
  return async (args) => {
    const result = await persistAppPlan(
      adapter,
      {
        app: args.app,
        orgId: args.plan.orgId,
        profile: args.profile,
        seed: args.seed,
        entities: args.plan.entities,
      },
      { command: args.command === 'reset' ? 'seed' : args.command, dryRun: args.dryRun },
    )
    ctx.persistedRunIds.add(result.runId)
    ctx.orgIds.add(args.plan.orgId)
    return result
  }
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  let args: ParsedArgs
  try {
    args = parseArgs(argv)
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n\n`)
    printHelp()
    return 2
  }

  if (args.help) {
    printHelp()
    return 0
  }

  if (args.command === 'reset' && !args.confirm) {
    process.stderr.write('reset is destructive — re-run with --confirm (or --yes).\n')
    return 2
  }

  await loadAppSeeders()

  const registered = listSeeders()
  if (registered.length === 0) {
    consoleLogger.warn('No seeders registered.', {
      command: args.command,
      profile: args.profile,
    })
    writeReport(args.reportPath, {
      profile: args.profile,
      seed: args.seed,
      dryRun: args.dryRun,
      command: args.command,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: 0,
      apps: [],
      skippedApps: [],
      note: 'No per-app seeders registered.',
    })
    return 0
  }

  const adapterCtx = await buildAdapter()
  if (!adapterCtx.adapter) {
    consoleLogger.warn('Persistence disabled — running plan-only.', {
      reason: adapterCtx.safety.reason,
    })
  } else {
    consoleLogger.info('Persistence enabled.', { hostMatched: adapterCtx.safety.hostMatched })
  }

  let resetCounts: Record<string, number> | null = null
  let exitCode = 0
  try {
    const persist = makePersistHook(adapterCtx)
    const report = await runSeed({
      command: args.command,
      options: {
        profile: args.profile,
        seed: args.seed,
        dryRun: args.dryRun,
        app: args.app,
        logger: consoleLogger,
        persist,
      },
    })

    if (args.command === 'reset' && adapterCtx.adapter && !args.dryRun) {
      const orgIds = Array.from(adapterCtx.orgIds)
      if (orgIds.length > 0) {
        resetCounts = await resetForOrgs(adapterCtx.adapter, orgIds)
        consoleLogger.info('Reset deletions', { orgIds, counts: resetCounts })
      }
    }

    const enriched = {
      ...report,
      persistence: {
        enabled: Boolean(adapterCtx.adapter),
        hostMatched: adapterCtx.safety.hostMatched ?? null,
        runIds: Array.from(adapterCtx.persistedRunIds),
        orgIds: Array.from(adapterCtx.orgIds),
        resetCounts,
      },
    }
    writeReport(args.reportPath, enriched)

    consoleLogger.info('Done', {
      command: report.command,
      profile: report.profile,
      apps: report.apps.length,
      skipped: report.skippedApps.length,
      totalRecords: report.apps.reduce((s, a) => s + a.totalRecords, 0),
      durationMs: report.durationMs,
      report: args.reportPath,
      persisted: adapterCtx.persistedRunIds.size,
    })
  } catch (err) {
    consoleLogger.error('Seed run failed', { message: (err as Error).message })
    exitCode = 1
  } finally {
    if (adapterCtx.adapter) await adapterCtx.adapter.close()
  }

  return exitCode
}

const invokedDirectly =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('cli.ts') === true ||
  process.argv[1]?.endsWith('cli.js') === true

if (invokedDirectly) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`Fatal: ${(err as Error).stack ?? String(err)}\n`)
      process.exit(1)
    },
  )
}
