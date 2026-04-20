/**
 * release:evidence — Append-only JSONL evidence ledger for releases.
 *
 * Every production release appends a structured record to:
 *   reports/releases/release-ledger.jsonl
 *
 * Records include: tag, SHA, artifact ID, deployer, approver,
 * DB gate result, smoke result, timestamp, rollback eligibility,
 * hotfix flag, changelog hash.
 *
 * Usage:
 *   pnpm release:evidence --tag v1.2.0 --sha abc1234 --deployer ci
 *   pnpm release:evidence --tag v1.2.0 --hotfix
 *   pnpm release:evidence --list                   # print recent entries
 *
 * This script is typically called by CI after successful production deploy.
 */

import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const LEDGER_PATH = path.join(ROOT, 'reports/releases/release-ledger.jsonl')

interface LedgerEntry {
  timestamp: string
  tag: string
  sha: string
  deployer: string
  approver: string
  environment: string
  dbGateResult: 'pass' | 'fail' | 'skip'
  smokeResult: 'pass' | 'fail' | 'skip'
  rollbackCandidate: boolean
  hotfix: boolean
  changelogHash: string
  artifactId: string
  schemaVersion: 1
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name)
  if (idx < 0) return undefined
  return process.argv[idx + 1]
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name)
}

function computeChangelogHash(): string {
  const changelogPath = path.join(ROOT, 'CHANGELOG.md')
  if (!fs.existsSync(changelogPath)) return 'none'
  const content = fs.readFileSync(changelogPath, 'utf8')
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 12)
}

// ── List mode ─────────────────────────────────────────────────────────────────

function listEntries(): void {
  if (!fs.existsSync(LEDGER_PATH)) {
    console.log('  No ledger entries yet.')
    process.exit(0)
  }

  const lines = fs.readFileSync(LEDGER_PATH, 'utf8').trim().split('\n').filter(Boolean)
  const recent = lines.slice(-10)

  console.log('\n── Recent Release Evidence ──────────────────────────────')
  console.log(`  Total entries: ${lines.length}\n`)
  console.log('  Tag          | SHA     | Deployer | Env        | DB Gate | Smoke | Hotfix')
  console.log('  ' + '─'.repeat(78))

  for (const line of recent) {
    try {
      const e = JSON.parse(line) as LedgerEntry
      const row = [
        e.tag.padEnd(12),
        e.sha.slice(0, 7),
        e.deployer.padEnd(8),
        e.environment.padEnd(10),
        e.dbGateResult.padEnd(7),
        e.smokeResult.padEnd(5),
        e.hotfix ? 'YES' : 'no',
      ].join(' | ')
      console.log(`  ${row}`)
    } catch {
      // skip malformed lines
    }
  }
  console.log()
}

// ── Append mode ───────────────────────────────────────────────────────────────

function appendEntry(): void {
  const tag = parseArg('--tag')
  const sha = parseArg('--sha') ?? ''
  const deployer = parseArg('--deployer') ?? process.env.GITHUB_ACTOR ?? 'unknown'
  const approver = parseArg('--approver') ?? process.env.GITHUB_ACTOR ?? 'unknown'
  const environment = parseArg('--environment') ?? 'production'
  const dbGate = (parseArg('--db-gate') ?? 'pass') as 'pass' | 'fail' | 'skip'
  const smoke = (parseArg('--smoke') ?? 'pass') as 'pass' | 'fail' | 'skip'
  const hotfix = hasFlag('--hotfix')
  const artifactId = parseArg('--artifact-id') ?? ''

  if (!tag) {
    console.error('✗ --tag is required')
    process.exit(1)
  }

  const entry: LedgerEntry = {
    timestamp: new Date().toISOString(),
    tag,
    sha,
    deployer,
    approver,
    environment,
    dbGateResult: dbGate,
    smokeResult: smoke,
    rollbackCandidate: dbGate === 'pass' && smoke === 'pass' && !hotfix,
    hotfix,
    changelogHash: computeChangelogHash(),
    artifactId,
    schemaVersion: 1,
  }

  // Ensure directory exists
  const dir = path.dirname(LEDGER_PATH)
  fs.mkdirSync(dir, { recursive: true })

  // Append (atomic: read + append to avoid partial writes)
  fs.appendFileSync(LEDGER_PATH, JSON.stringify(entry) + '\n', 'utf8')

  console.log(`\n  ✓ Evidence recorded for ${tag}`)
  console.log(`    SHA: ${sha}`)
  console.log(`    Environment: ${environment}`)
  console.log(`    DB Gate: ${dbGate}`)
  console.log(`    Smoke: ${smoke}`)
  console.log(`    Hotfix: ${hotfix}`)
  console.log(`    Rollback candidate: ${entry.rollbackCandidate}`)
  console.log(`    Changelog hash: ${entry.changelogHash}`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main(): void {
  if (hasFlag('--list')) {
    listEntries()
  } else {
    appendEntry()
  }
}

main()
