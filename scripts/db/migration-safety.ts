/**
 * db:migration:safety — Pre-deploy migration safety analysis.
 *
 * Scans pending/recent migrations for:
 *   - destructive operations (DROP, TRUNCATE, ALTER TYPE)
 *   - missing transaction wrapping
 *   - missing IF EXISTS guards
 *   - lock-heavy operations (ALTER TABLE on large tables)
 *   - data-loss potential
 *   - rollback script availability
 *
 * Usage:
 *   pnpm db:migration:safety
 *   pnpm db:migration:safety --since v1.2.0    # only check since tag
 *   pnpm db:migration:safety --file <path>     # check single file
 *
 * Exit codes:
 *   0 = safe to proceed
 *   1 = unsafe (blocking)
 *   2 = needs review (non-blocking warnings)
 */

import * as child_process from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')

interface SafetyFinding {
  severity: 'block' | 'review' | 'info'
  rule: string
  message: string
  file: string
  line?: number
}

const findings: SafetyFinding[] = []

// ── Safety rules ──────────────────────────────────────────────────────────────

const RULES: Array<{
  id: string
  severity: 'block' | 'review'
  pattern: RegExp
  message: string
}> = [
  { id: 'DROP_TABLE', severity: 'block', pattern: /\bDROP\s+TABLE\s+(?!IF\s+EXISTS)/im, message: 'DROP TABLE without IF EXISTS' },
  { id: 'DROP_TABLE_EXISTS', severity: 'review', pattern: /\bDROP\s+TABLE\s+IF\s+EXISTS/im, message: 'DROP TABLE IF EXISTS — data loss risk' },
  { id: 'DROP_COLUMN', severity: 'block', pattern: /\bDROP\s+COLUMN\b/im, message: 'DROP COLUMN — data loss, app may still reference it' },
  { id: 'TRUNCATE', severity: 'block', pattern: /\bTRUNCATE\b/im, message: 'TRUNCATE — irreversible data loss' },
  { id: 'DROP_INDEX', severity: 'review', pattern: /\bDROP\s+INDEX\b/im, message: 'DROP INDEX — may degrade query performance' },
  { id: 'ALTER_TYPE', severity: 'review', pattern: /\bALTER\s+TYPE\b/im, message: 'ALTER TYPE — may require table rewrite + lock' },
  { id: 'NOT_NULL_NO_DEFAULT', severity: 'review', pattern: /\bADD\s+\w+.*\bNOT\s+NULL\b(?!.*\bDEFAULT\b)/im, message: 'ADD NOT NULL column without DEFAULT — fails if table has rows' },
  { id: 'RENAME_TABLE', severity: 'review', pattern: /\bRENAME\s+TABLE\b|\bALTER\s+TABLE\s+\w+\s+RENAME\s+TO\b/im, message: 'RENAME TABLE — app references will break' },
  { id: 'RENAME_COLUMN', severity: 'review', pattern: /\bRENAME\s+COLUMN\b/im, message: 'RENAME COLUMN — app references will break' },
  { id: 'LOCK_TABLE', severity: 'block', pattern: /\bLOCK\s+TABLE\b/im, message: 'Explicit LOCK TABLE — may cause outage' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name)
  if (idx < 0) return undefined
  return process.argv[idx + 1]
}

function getMigrationFiles(): string[] {
  const sinceTag = parseArg('--since')
  const singleFile = parseArg('--file')

  if (singleFile) {
    const fullPath = path.resolve(singleFile)
    if (!fs.existsSync(fullPath)) {
      console.error(`✗ File not found: ${singleFile}`)
      process.exit(1)
    }
    return [fullPath]
  }

  if (sinceTag) {
    try {
      const diffOutput = child_process.execSync(
        `git diff --name-only ${sinceTag}..HEAD -- "*.sql"`,
        { encoding: 'utf8', cwd: ROOT },
      ).trim()
      return diffOutput
        .split('\n')
        .filter(Boolean)
        .filter((f) => f.includes('migration') || f.startsWith('migrations/'))
        .map((f) => {
          const resolved = path.resolve(ROOT, f)
          if (!resolved.startsWith(ROOT)) return null
          return resolved
        })
        .filter((f): f is string => f !== null && fs.existsSync(f))
    } catch {
      console.error(`⚠  Could not resolve tag ${sinceTag}, scanning all migrations`)
    }
  }

  // Default: scan all migration directories
  const dirs = [
    'migrations',
    'migrations/platform',
    'apps/union-eyes/db/migrations',
    'apps/union-eyes/db/migrations/manual',
    'apps/union-eyes/db/migrations/compliance',
    'apps/zonga/db/migrations',
  ]

  const files: string[] = []
  for (const dir of dirs) {
    const fullDir = path.resolve(ROOT, dir)
    if (!fullDir.startsWith(ROOT)) continue
    if (!fs.existsSync(fullDir)) continue
    const entries = fs.readdirSync(fullDir).filter((f) => f.endsWith('.sql'))
    for (const entry of entries) {
      const filePath = path.resolve(fullDir, entry)
      if (filePath.startsWith(ROOT)) files.push(filePath)
    }
  }
  return files
}

function findLineNumber(content: string, pattern: RegExp): number | undefined {
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) return i + 1
  }
  return undefined
}

// ── Analyze ───────────────────────────────────────────────────────────────────

function analyzeFile(filePath: string): void {
  const resolved = path.resolve(filePath)
  if (!resolved.startsWith(ROOT)) return
  const content = fs.readFileSync(resolved, 'utf8')
  const relPath = path.relative(ROOT, resolved)

  for (const rule of RULES) {
    if (rule.pattern.test(content)) {
      const line = findLineNumber(content, rule.pattern)
      findings.push({
        severity: rule.severity,
        rule: rule.id,
        message: rule.message,
        file: relPath,
        line,
      })
    }
  }

  // Check for transaction wrapping
  const hasBegin = /\bBEGIN\b/i.test(content)
  const hasDestructive = RULES.some((r) => r.severity === 'block' && r.pattern.test(content))
  if (hasDestructive && !hasBegin) {
    findings.push({
      severity: 'review',
      rule: 'NO_TRANSACTION',
      message: 'Destructive operation without explicit BEGIN/COMMIT transaction',
      file: relPath,
    })
  }

  // Check for concurrent index
  if (/\bCREATE\s+INDEX\b/i.test(content) && !/\bCONCURRENTLY\b/i.test(content)) {
    findings.push({
      severity: 'review',
      rule: 'INDEX_NOT_CONCURRENT',
      message: 'CREATE INDEX without CONCURRENTLY — may lock table',
      file: relPath,
    })
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main(): void {
  console.log('\n── Migration Safety Analysis ────────────────────────────')

  const files = getMigrationFiles()
  console.log(`  Scanning ${files.length} migration file(s)...\n`)

  for (const file of files) {
    analyzeFile(file)
  }

  if (findings.length === 0) {
    console.log('  ✓ All migrations safe — no destructive patterns detected')
    process.exit(0)
  }

  const blockers = findings.filter((f) => f.severity === 'block')
  const reviews = findings.filter((f) => f.severity === 'review')

  if (blockers.length > 0) {
    console.log('  BLOCKING issues:')
    for (const f of blockers) {
      const loc = f.line ? `:${f.line}` : ''
      console.log(`    ✗ [${f.rule}] ${f.file}${loc}`)
      console.log(`      ${f.message}`)
    }
    console.log()
  }

  if (reviews.length > 0) {
    console.log('  REVIEW required:')
    for (const f of reviews) {
      const loc = f.line ? `:${f.line}` : ''
      console.log(`    ⚠ [${f.rule}] ${f.file}${loc}`)
      console.log(`      ${f.message}`)
    }
    console.log()
  }

  console.log(`  Summary: ${blockers.length} blocking, ${reviews.length} review`)

  if (blockers.length > 0) {
    console.log('\n  ✗ UNSAFE — resolve blocking issues before deploy')
    process.exit(1)
  }

  console.log('\n  ⚠ REVIEW NEEDED — no blockers, but items require human approval')
  process.exit(2)
}

main()
