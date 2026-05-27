/**
 * db:doctor — Comprehensive database health validation.
 *
 * Checks:
 *   1. Migration ordering integrity (no gaps, no duplicates)
 *   2. Destructive DDL detection (DROP TABLE, DROP COLUMN, TRUNCATE)
 *   3. Required extensions present in SQL
 *   4. Rollback scripts exist for manual migrations
 *   5. Drizzle journal consistency
 *   6. No raw credentials in migration files
 *
 * Usage:
 *   pnpm exec tsx scripts/db/doctor.ts
 *   pnpm exec tsx scripts/db/doctor.ts --strict     # fail on warnings too
 *   pnpm exec tsx scripts/db/doctor.ts --verbose    # show all file checks
 *
 * Exit codes:
 *   0 = all checks pass
 *   1 = critical failures
 *   2 = warnings only (pass unless --strict)
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const strict = process.argv.includes('--strict')
const verbose = process.argv.includes('--verbose')

function parseArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name)
  if (idx < 0) return undefined
  return process.argv[idx + 1]
}

const baselineArg = parseArg('--baseline')
const writeBaselineArg = parseArg('--write-baseline')

interface DoctorBaseline {
  tool: 'db-doctor'
  generatedAt: string
  allowFailKeys: string[]
}

interface DiagnosticResult {
  check: string
  status: 'pass' | 'warn' | 'fail'
  message: string
  file?: string
}

const results: DiagnosticResult[] = []

function resultKey(result: DiagnosticResult): string {
  return [result.check, result.message, result.file ?? ''].join('|')
}

function readBaseline(filePath: string): DoctorBaseline | null {
  const resolved = path.resolve(filePath)
  if (!resolved.startsWith(ROOT) || !fs.existsSync(resolved)) return null
  try {
    const parsed = JSON.parse(fs.readFileSync(resolved, 'utf8')) as DoctorBaseline
    if (parsed.tool !== 'db-doctor' || !Array.isArray(parsed.allowFailKeys)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeBaseline(filePath: string, fails: DiagnosticResult[]): string {
  const resolved = path.resolve(filePath)
  if (!resolved.startsWith(ROOT)) {
    throw new Error(`Refusing to write baseline outside repository: ${filePath}`)
  }
  const dir = path.dirname(resolved)
  fs.mkdirSync(dir, { recursive: true })

  const payload: DoctorBaseline = {
    tool: 'db-doctor',
    generatedAt: new Date().toISOString(),
    allowFailKeys: fails.map((item) => resultKey(item)),
  }
  fs.writeFileSync(resolved, JSON.stringify(payload, null, 2) + '\n', 'utf8')
  return resolved
}

// ── Migration paths ───────────────────────────────────────────────────────────

const MIGRATION_DIRS = [
  'migrations',
  'migrations/platform',
  'apps/union-eyes/db/migrations',
  'apps/union-eyes/db/migrations/manual',
  'apps/union-eyes/db/migrations/compliance',
  'apps/zonga/db/migrations',
]

const DRIZZLE_JOURNAL = 'apps/union-eyes/db/migrations/meta/_journal.json'
const ROLLBACK_DIR = 'apps/union-eyes/db/migrations/rollback'

// ── Dangerous DDL patterns ────────────────────────────────────────────────────

const DESTRUCTIVE_PATTERNS = [
  { pattern: /\bDROP\s+TABLE\b/i, label: 'DROP TABLE' },
  { pattern: /\bDROP\s+COLUMN\b/i, label: 'DROP COLUMN' },
  { pattern: /\bTRUNCATE\b/i, label: 'TRUNCATE' },
  { pattern: /\bDROP\s+INDEX\b/i, label: 'DROP INDEX' },
  { pattern: /\bALTER\s+TYPE\b.*\bRENAME\b/i, label: 'ALTER TYPE RENAME' },
  { pattern: /\bDROP\s+SCHEMA\b/i, label: 'DROP SCHEMA' },
]

const CREDENTIAL_PATTERNS = [
  { pattern: /password\s*[:=]\s*['"][^'"]+['"]/i, label: 'hardcoded password' },
  { pattern: /\bsk_live_\w+/i, label: 'API key (stripe-like)' },
  { pattern: /\bAKIA[0-9A-Z]{16}/i, label: 'AWS access key' },
]

const REQUIRED_EXTENSIONS = ['uuid-ossp', 'pgcrypto']

// ── Check 1: Migration file ordering ─────────────────────────────────────────

function checkMigrationOrdering(): void {
  const dir = path.join(ROOT, 'apps/union-eyes/db/migrations')
  if (!fs.existsSync(dir)) {
    results.push({ check: 'migration-ordering', status: 'warn', message: 'Drizzle migrations dir not found' })
    return
  }

  const sqlFiles = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.sql') && /^\d{4}_/.test(f))
    .sort()

  const indices = sqlFiles.map((f) => parseInt(f.slice(0, 4), 10))
  for (let i = 1; i < indices.length; i++) {
    if (indices[i] !== indices[i - 1] + 1) {
      results.push({
        check: 'migration-ordering',
        status: 'fail',
        message: `Gap detected: ${indices[i - 1]} → ${indices[i]}`,
        file: sqlFiles[i],
      })
    }
  }

  const duplicates = indices.filter((v, i, a) => a.indexOf(v) !== i)
  if (duplicates.length > 0) {
    results.push({
      check: 'migration-ordering',
      status: 'fail',
      message: `Duplicate indices: ${duplicates.join(', ')}`,
    })
  }

  if (results.filter((r) => r.check === 'migration-ordering').length === 0) {
    results.push({ check: 'migration-ordering', status: 'pass', message: `${sqlFiles.length} migrations in correct order` })
  }
}

// ── Check 2: Destructive DDL detection ────────────────────────────────────────

function checkDestructiveDDL(): void {
  let found = 0
  for (const dir of MIGRATION_DIRS) {
    const fullDir = path.join(ROOT, dir)
    if (!fs.existsSync(fullDir)) continue
    const files = fs.readdirSync(fullDir).filter((f) => f.endsWith('.sql'))
    for (const file of files) {
      const content = fs.readFileSync(path.join(fullDir, file), 'utf8')
      for (const { pattern, label } of DESTRUCTIVE_PATTERNS) {
        if (pattern.test(content)) {
          results.push({
            check: 'destructive-ddl',
            status: 'warn',
            message: `${label} found in ${dir}/${file}`,
            file: `${dir}/${file}`,
          })
          found++
        }
      }
    }
  }
  if (found === 0) {
    results.push({ check: 'destructive-ddl', status: 'pass', message: 'No destructive DDL detected' })
  }
}

// ── Check 3: Required extensions ──────────────────────────────────────────────

function checkRequiredExtensions(): void {
  const allSql: string[] = []
  for (const dir of MIGRATION_DIRS) {
    const fullDir = path.join(ROOT, dir)
    if (!fs.existsSync(fullDir)) continue
    const files = fs.readdirSync(fullDir).filter((f) => f.endsWith('.sql'))
    for (const file of files) {
      allSql.push(fs.readFileSync(path.join(fullDir, file), 'utf8'))
    }
  }
  const combined = allSql.join('\n')

  for (const ext of REQUIRED_EXTENSIONS) {
    if (combined.includes(`CREATE EXTENSION`) && combined.includes(ext)) {
      results.push({ check: 'required-extensions', status: 'pass', message: `Extension "${ext}" enabled` })
    } else if (combined.includes(`gen_random_uuid()`) && ext === 'pgcrypto') {
      results.push({ check: 'required-extensions', status: 'pass', message: `Extension "${ext}" implicitly used (gen_random_uuid)` })
    } else {
      results.push({ check: 'required-extensions', status: 'warn', message: `Extension "${ext}" not explicitly created` })
    }
  }
}

// ── Check 4: Rollback scripts ─────────────────────────────────────────────────

function checkRollbackScripts(): void {
  const rollbackDir = path.join(ROOT, ROLLBACK_DIR)
  if (!fs.existsSync(rollbackDir)) {
    results.push({ check: 'rollback-scripts', status: 'warn', message: 'No rollback/ directory found' })
    return
  }
  const files = fs.readdirSync(rollbackDir).filter((f) => f.endsWith('.sql'))
  results.push({
    check: 'rollback-scripts',
    status: files.length > 0 ? 'pass' : 'warn',
    message: `${files.length} rollback scripts available`,
  })
}

// ── Check 5: Drizzle journal consistency ──────────────────────────────────────

function checkDrizzleJournal(): void {
  const journalPath = path.join(ROOT, DRIZZLE_JOURNAL)
  if (!fs.existsSync(journalPath)) {
    results.push({ check: 'drizzle-journal', status: 'warn', message: 'Drizzle journal not found' })
    return
  }
  try {
    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as {
      entries: { idx: number; tag: string }[]
    }
    const entries = journal.entries
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].idx !== i) {
        results.push({
          check: 'drizzle-journal',
          status: 'fail',
          message: `Journal entry ${i} has mismatched idx=${entries[i].idx}`,
        })
        return
      }
    }
    results.push({ check: 'drizzle-journal', status: 'pass', message: `${entries.length} entries, all sequential` })
  } catch (err) {
    results.push({ check: 'drizzle-journal', status: 'fail', message: `Journal parse error: ${err}` })
  }
}

// ── Check 6: No credentials in migrations ────────────────────────────────────

function checkNoCredentials(): void {
  let found = 0
  for (const dir of MIGRATION_DIRS) {
    const fullDir = path.join(ROOT, dir)
    if (!fs.existsSync(fullDir)) continue
    const files = fs.readdirSync(fullDir).filter((f) => f.endsWith('.sql'))
    for (const file of files) {
      const content = fs.readFileSync(path.join(fullDir, file), 'utf8')
      for (const { pattern, label } of CREDENTIAL_PATTERNS) {
        if (pattern.test(content)) {
          results.push({
            check: 'no-credentials',
            status: 'fail',
            message: `${label} in ${dir}/${file}`,
            file: `${dir}/${file}`,
          })
          found++
        }
      }
    }
  }
  if (found === 0) {
    results.push({ check: 'no-credentials', status: 'pass', message: 'No credentials detected in migration files' })
  }
}

// ── Run ───────────────────────────────────────────────────────────────────────

function main(): void {
  console.log('\n── DB Doctor ───────────────────────────────────────────')
  console.log(`  Mode: ${strict ? 'strict' : 'standard'}`)
  console.log()

  checkMigrationOrdering()
  checkDestructiveDDL()
  checkRequiredExtensions()
  checkRollbackScripts()
  checkDrizzleJournal()
  checkNoCredentials()

  // Report
  const passes = results.filter((r) => r.status === 'pass')
  const warns = results.filter((r) => r.status === 'warn')
  const fails = results.filter((r) => r.status === 'fail')

  if (writeBaselineArg) {
    const written = writeBaseline(writeBaselineArg, fails)
    console.log(`  Baseline written: ${path.relative(ROOT, written)}`)
  }

  let unmatchedFails = fails
  if (baselineArg) {
    const baseline = readBaseline(baselineArg)
    if (!baseline) {
      results.push({
        check: 'baseline',
        status: 'warn',
        message: `Baseline file unreadable: ${baselineArg}`,
      })
    } else {
      const allowed = new Set(baseline.allowFailKeys)
      unmatchedFails = fails.filter((item) => !allowed.has(resultKey(item)))
      const suppressed = fails.length - unmatchedFails.length
      results.push({
        check: 'baseline',
        status: suppressed > 0 ? 'warn' : 'pass',
        message:
          suppressed > 0
            ? `Suppressed ${suppressed} known fail finding(s) from baseline`
            : 'No baseline suppressions applied',
      })
    }
  }

  for (const r of results) {
    const icon = r.status === 'pass' ? '✓' : r.status === 'warn' ? '⚠' : '✗'
    if (verbose || r.status !== 'pass') {
      console.log(`  ${icon} [${r.check}] ${r.message}`)
    }
  }

  console.log()
  console.log(`  Results: ${passes.length} pass, ${warns.length} warn, ${fails.length} fail`)
  if (baselineArg) {
    console.log(`  New failures (post-baseline): ${unmatchedFails.length}`)
  }

  if (unmatchedFails.length > 0) {
    console.log('\n  ✗ DB Doctor FAILED — resolve critical issues before deploy')
    process.exit(1)
  }
  if (warns.length > 0 && strict) {
    console.log('\n  ✗ DB Doctor FAILED (strict) — resolve warnings')
    process.exit(2)
  }
  console.log('\n  ✓ DB Doctor passed')
}

main()
