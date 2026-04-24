#!/usr/bin/env tsx
/**
 * @nzila/staging-seed — CLI entrypoint.
 *
 * Commands:
 *   tsx src/cli.ts seed     [--profile=<p>] [--app=<a>] [--seed=<n>] [--dry-run] [--report=<path>]
 *   tsx src/cli.ts reseed   --app=<a> [--profile=<p>] [--seed=<n>] [--report=<path>]
 *   tsx src/cli.ts reset    [--app=<a>] [--yes] [--report=<path>]
 *
 * Per-app seeders are loaded from this file's `loadAppSeeders()` block so
 * their `registerSeeder()` side effects run before the CLI dispatches.
 * Phase 1 ships with NO per-app seeders registered — follow-up PRs add
 * imports here.
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
  type SeedProfile,
} from './core/types'

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
  yes: boolean
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
    if (token === '--yes' || token === '-y') {
      result.yes = true
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
    yes: false,
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
  --yes, -y                  Required to actually reset
  --report=<path>            JSON report output (default: demo-output/seed-report.json)
  --help, -h                 Show this help
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
  // Each per-app seeder registers itself on import via `registerSeeder(...)`.
  // Per-app seeder modules live inside this package (under `./seeders/`) so
  // they share a single registry instance — pnpm symlinks would otherwise
  // produce two distinct module instances when seeders import the package
  // from outside. New apps add an entry below.
  const loaders: readonly { app: string; load: () => Promise<unknown> }[] = [
    { app: 'union-eyes', load: () => import('./seeders/union-eyes') },
    { app: 'flow', load: () => import('./seeders/flow') },
    { app: 'zonga', load: () => import('./seeders/zonga') },
    { app: 'weekone', load: () => import('./seeders/weekone') },
    { app: 'agrimo', load: () => import('./seeders/agrimo') },
    { app: 'cora', load: () => import('./seeders/cora') },
    { app: 'faircase', load: () => import('./seeders/faircase') },
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

  if (args.command === 'reset' && !args.yes) {
    process.stderr.write('reset is destructive — re-run with --yes to confirm.\n')
    return 2
  }

  await loadAppSeeders()

  const registered = listSeeders()
  if (registered.length === 0) {
    consoleLogger.warn('No seeders registered. Phase 1 framework only.', {
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
      note: 'Phase 1 — no per-app seeders registered yet.',
    })
    return 0
  }

  const report = await runSeed({
    command: args.command,
    options: {
      profile: args.profile,
      seed: args.seed,
      dryRun: args.dryRun,
      app: args.app,
      logger: consoleLogger,
    },
  })

  writeReport(args.reportPath, report)

  consoleLogger.info('Done', {
    command: report.command,
    profile: report.profile,
    apps: report.apps.length,
    skipped: report.skippedApps.length,
    totalRecords: report.apps.reduce((s, a) => s + a.totalRecords, 0),
    durationMs: report.durationMs,
    report: args.reportPath,
  })
  return 0
}

// Detect direct execution (works for both `tsx src/cli.ts` and bin scripts).
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
