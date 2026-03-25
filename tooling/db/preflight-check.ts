/**
 * DB Preflight Check — Schema Integrity Guardrail (Phase 3)
 *
 * Verifies structural prerequisites before code runs against the DB:
 *   1. Schema snapshot file exists and is parseable
 *   2. Schema index exports all required domain modules
 *   3. Canonical schema manifest is present
 *   4. Snapshot is not stale (>30 days)
 *
 * Usage:
 *   pnpm tsx tooling/db/preflight-check.ts          # CI / manual
 *   import { runPreflightCheck } from './preflight-check'  # app startup
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO_ROOT = resolve(join(__dirname, '..', '..'))
const SNAPSHOT_PATH = join(REPO_ROOT, 'tooling', 'db', 'schema-snapshot.json')
const SCHEMA_INDEX = join(REPO_ROOT, 'packages', 'db', 'src', 'schema', 'index.ts')
const MANIFEST_PATH = join(REPO_ROOT, 'tooling', 'db', 'canonical-schema', 'manifest.json')

interface CheckResult {
  name: string
  passed: boolean
  message: string
}

export interface PreflightResult {
  passed: boolean
  checks: CheckResult[]
}

export function runPreflightCheck(): PreflightResult {
  const checks: CheckResult[] = []

  // ── 1. Schema snapshot exists ────────────────────────────────────────────
  const snapshotExists = existsSync(SNAPSHOT_PATH)
  checks.push({
    name: 'schema-snapshot-exists',
    passed: snapshotExists,
    message: snapshotExists
      ? 'Schema snapshot file present'
      : 'Schema snapshot missing — run: pnpm tsx tooling/db/schema-snapshot.ts write',
  })

  // ── 2. Schema index exports required modules ────────────────────────────
  const indexExists = existsSync(SCHEMA_INDEX)
  if (indexExists) {
    const indexContent = readFileSync(SCHEMA_INDEX, 'utf-8')
    const requiredExports = [
      'orgs',
      'governance',
      'finance',
      'operations',
      'payments',
      'commerce',
      'ai',
      'ml',
    ]
    const missing = requiredExports.filter((mod) => !indexContent.includes(`'./${mod}'`))
    checks.push({
      name: 'schema-index-exports',
      passed: missing.length === 0,
      message:
        missing.length === 0
          ? `Schema index exports all ${requiredExports.length} required modules`
          : `Missing schema exports: ${missing.join(', ')}`,
    })
  } else {
    checks.push({
      name: 'schema-index-exports',
      passed: false,
      message: 'Schema index file not found at packages/db/src/schema/index.ts',
    })
  }

  // ── 3. Canonical schema manifest exists ─────────────────────────────────
  const manifestExists = existsSync(MANIFEST_PATH)
  checks.push({
    name: 'canonical-manifest-exists',
    passed: manifestExists,
    message: manifestExists
      ? 'Canonical schema manifest present'
      : 'Canonical schema manifest not found at tooling/db/canonical-schema/manifest.json',
  })

  // ── 4. Snapshot freshness ───────────────────────────────────────────────
  if (snapshotExists) {
    try {
      const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf-8'))
      const capturedAt = new Date(snapshot.capturedAt)
      const ageMs = Date.now() - capturedAt.getTime()
      const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24))
      const isStale = ageDays > 30
      checks.push({
        name: 'snapshot-freshness',
        passed: !isStale,
        message: isStale
          ? `Schema snapshot is ${ageDays} days old (max 30) — refresh with: pnpm tsx tooling/db/schema-snapshot.ts write`
          : `Schema snapshot is ${ageDays} day(s) old`,
      })
    } catch {
      checks.push({
        name: 'snapshot-freshness',
        passed: false,
        message: 'Failed to parse schema snapshot JSON',
      })
    }
  }

  const passed = checks.every((c) => c.passed)
  return { passed, checks }
}

// ── CLI entrypoint ─────────────────────────────────────────────────────────
const isCli =
  typeof require !== 'undefined' && require.main === module

if (isCli) {
  const result = runPreflightCheck()

  console.log('\n📋 DB Preflight Check\n')
  for (const check of result.checks) {
    console.log(`  ${check.passed ? '✅' : '❌'} ${check.name}: ${check.message}`)
  }
  console.log('')

  if (!result.passed) {
    console.error('❌ Preflight check failed — fix the above issues before proceeding.\n')
    process.exit(1)
  }
  console.log('✅ All preflight checks passed.\n')
}
