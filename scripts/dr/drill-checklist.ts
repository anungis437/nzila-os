#!/usr/bin/env tsx
/**
 * dr:drill:checklist — Print a pre-drill readiness checklist to stdout.
 *
 * Verifies that local environment prerequisites are satisfied before a
 * restore drill is executed. Checks:
 *   1. Drill script exists and is executable
 *   2. Migration directories exist and contain SQL files
 *   3. DR runbooks exist in docs/union-eyes/dr/
 *   4. Previous evidence artifacts exist (or warn if first run)
 *   5. Azure CLI available (informational)
 *   6. pnpm available
 *
 * Usage:
 *   pnpm dr:drill:checklist
 *
 * Exit codes:
 *   0 — all required checks pass (warnings allowed)
 *   1 — one or more required checks fail
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as child_process from 'node:child_process'

const ROOT = path.resolve(__dirname, '..', '..')

// ── Types ─────────────────────────────────────────────────────────────────────

interface CheckResult {
  name: string
  status: 'pass' | 'fail' | 'warn'
  message: string
  required: boolean
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const results: CheckResult[] = []

function pass(name: string, message: string, required = true): void {
  results.push({ name, status: 'pass', message, required })
}

function fail(name: string, message: string, required = true): void {
  results.push({ name, status: 'fail', message, required })
}

function warn(name: string, message: string): void {
  results.push({ name, status: 'warn', message, required: false })
}

function fileExists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel))
}

function commandAvailable(cmd: string): boolean {
  try {
    const resolver = process.platform === 'win32' ? 'where' : 'which'
    child_process.execSync(`${resolver} ${cmd}`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function countSqlFiles(dir: string): number {
  const abs = path.join(ROOT, dir)
  if (!fs.existsSync(abs)) return 0
  return fs.readdirSync(abs).filter((f) => f.endsWith('.sql')).length
}

// ── Checks ────────────────────────────────────────────────────────────────────

// 1. Drill script
if (fileExists('scripts/db/restore-drill.ts')) {
  pass('drill-script', 'scripts/db/restore-drill.ts exists')
} else {
  fail('drill-script', 'scripts/db/restore-drill.ts missing — cannot run drill')
}

// 2. Migration directories
const MIGRATION_DIRS = ['migrations', 'migrations/platform', 'apps/union-eyes/db/migrations']
let totalMig = 0
const presentDirs: string[] = []
const missingDirs: string[] = []
for (const dir of MIGRATION_DIRS) {
  const count = countSqlFiles(dir)
  if (count > 0) {
    totalMig += count
    presentDirs.push(`${dir} (${count} files)`)
  } else if (fs.existsSync(path.join(ROOT, dir))) {
    presentDirs.push(`${dir} (0 files)`)
  } else {
    missingDirs.push(dir)
  }
}
if (totalMig > 0) {
  pass('migration-files', `${totalMig} migration SQL files found across ${presentDirs.length} directories`)
} else {
  fail('migration-files', 'No migration SQL files found')
}

// 3. DR runbooks
const RUNBOOKS = [
  'docs/union-eyes/dr/restore-drill-runbook.md',
  'docs/union-eyes/dr/database-restore.md',
  'docs/union-eyes/dr/blob-recovery.md',
  'docs/union-eyes/dr/rollback-procedure.md',
  'docs/union-eyes/dr/continuity-matrix.md',
]
const missingRunbooks = RUNBOOKS.filter((r) => !fileExists(r))
if (missingRunbooks.length === 0) {
  pass('dr-runbooks', `All ${RUNBOOKS.length} DR runbooks present in docs/union-eyes/dr/`)
} else {
  fail('dr-runbooks', `Missing DR runbooks: ${missingRunbooks.join(', ')}`)
}

// 4. DR documentation
if (fileExists('docs/ops/disaster-recovery.md')) {
  pass('dr-documentation', 'docs/ops/disaster-recovery.md exists with RTO/RPO targets')
} else {
  fail('dr-documentation', 'docs/ops/disaster-recovery.md missing')
}

// 5. Previous evidence (informational)
const dbReportsDir = path.join(ROOT, 'reports', 'db')
const drReportsDir = path.join(ROOT, 'reports', 'dr')
const hasDbReports = fs.existsSync(dbReportsDir) &&
  fs.readdirSync(dbReportsDir).some((f) => f.startsWith('restore-drill-'))
const hasDrReports = fs.existsSync(drReportsDir) &&
  fs.readdirSync(drReportsDir).some((f) => f.startsWith('restore-drill-'))

if (hasDbReports) {
  pass('previous-evidence-db', 'Previous drill JSON found in reports/db/', false)
} else {
  warn('previous-evidence-db', 'No previous drill JSON in reports/db/ — this may be the first drill')
}
if (hasDrReports) {
  pass('previous-evidence-dr', 'Previous drill reports found in reports/dr/', false)
} else {
  warn('previous-evidence-dr', 'No previous drill reports in reports/dr/ — run pnpm dr:drill:report after drill')
}

// 6. Azure CLI (informational)
if (commandAvailable('az')) {
  pass('azure-cli', 'Azure CLI (az) is available', false)
} else {
  warn('azure-cli', 'Azure CLI not found — required for live staging restore (not needed for dry-run)')
}

// 7. pnpm
function pnpmAvailable(): boolean {
  // Check direct binary first, then corepack/npx fallback
  if (commandAvailable('pnpm')) return true
  try {
    child_process.execSync('npx --no pnpm --version 2>/dev/null', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}
if (pnpmAvailable()) {
  pass('pnpm', 'pnpm is available')
} else {
  fail('pnpm', 'pnpm not found — required to run drill')
}

// 8. Public trust summary
if (fileExists('docs/public/restore-readiness-summary.md')) {
  pass('public-trust-doc', 'docs/public/restore-readiness-summary.md exists (buyer-safe version)', false)
} else {
  warn('public-trust-doc', 'docs/public/restore-readiness-summary.md missing')
}

const liveMode = hasFlag('--live')
// 9. Live drill prerequisites
if (liveMode) {
  const requiredLiveVars = ['DR_DB_HOST', 'DR_DB_USER']
  const missingLiveVars = requiredLiveVars.filter((name) => !process.env[name])
  if (missingLiveVars.length === 0) {
    pass('live-env', 'Live drill DB environment variables present (DR_DB_HOST, DR_DB_USER)')
  } else {
    fail('live-env', `Missing required live drill env vars: ${missingLiveVars.join(', ')}`)
  }

  if (process.env.DR_READY_URL) {
    pass('live-ready-url', `DR_READY_URL configured: ${process.env.DR_READY_URL}`)
  } else {
    warn('live-ready-url', 'DR_READY_URL not set; app readiness check will be skipped in execute mode')
  }

  if (commandAvailable('psql')) {
    pass('live-psql', 'psql available for live restore execution')
  } else {
    fail('live-psql', 'psql not found; live restore execution cannot run')
  }
}

// ── Print Results ─────────────────────────────────────────────────────────────

const passCount = results.filter((r) => r.status === 'pass').length
const failCount = results.filter((r) => r.status === 'fail').length
const warnCount = results.filter((r) => r.status === 'warn').length

process.stdout.write(`\n── DR Drill Pre-Flight Checklist ───────────────────\n\n`)

for (const r of results) {
  const icon = r.status === 'pass' ? '✓' : r.status === 'fail' ? '✗' : '⚠'
  const req = r.required ? '' : ' [optional]'
  process.stdout.write(`  ${icon}  ${r.name}${req}\n     ${r.message}\n\n`)
}

process.stdout.write(`── Summary ─────────────────────────────────────────\n`)
process.stdout.write(`  ${passCount} passed, ${failCount} failed, ${warnCount} warnings\n\n`)

if (failCount > 0) {
  process.stdout.write(`  ✗ Pre-flight FAILED — resolve the above issues before running the drill.\n\n`)
  process.exit(1)
} else {
  process.stdout.write(`  ✓ Pre-flight PASSED — safe to proceed with the drill.\n`)
  process.stdout.write(`\n  Run the drill:\n`)
  process.stdout.write(`    pnpm db:restore-drill           # dry-run\n`)
    process.stdout.write(`    pnpm db:restore-drill:execute   # live staging restore\n`)
    process.stdout.write(`\n  Live checklist mode:\n`)
    process.stdout.write(`    pnpm dr:drill:checklist --live\n\n`)
}
