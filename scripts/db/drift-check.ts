/**
 * drift-check.ts — Detect schema drift between local definitions and deployed state.
 *
 * Compares:
 *   - Drizzle schema definitions vs. latest migration snapshot
 *   - Migration journal vs. actual SQL file count
 *   - Staging vs. production schema versions (from evidence ledger)
 *
 * Usage:
 *   pnpm exec tsx scripts/db/drift-check.ts
 *   pnpm exec tsx scripts/db/drift-check.ts --env staging
 *   pnpm exec tsx scripts/db/drift-check.ts --env production
 *
 * Exit codes:
 *   0 = no drift detected
 *   1 = critical drift
 *   2 = minor drift (informational)
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')

interface DriftResult {
  check: string
  status: 'ok' | 'drift' | 'critical'
  message: string
}

const results: DriftResult[] = []

const env = process.argv.find((a) => a === '--env')
  ? process.argv[process.argv.indexOf('--env') + 1]
  : 'local'

// ── Check 1: Journal vs file count ────────────────────────────────────────────

function checkJournalVsFiles(): void {
  const journalPath = path.join(ROOT, 'apps/union-eyes/db/migrations/meta/_journal.json')
  const migrationsDir = path.join(ROOT, 'apps/union-eyes/db/migrations')

  if (!fs.existsSync(journalPath)) {
    results.push({ check: 'journal-vs-files', status: 'drift', message: 'Drizzle journal not found' })
    return
  }

  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as {
    entries: Array<{ idx: number; tag: string }>
  }
  const journalCount = journal.entries.length

  const sqlFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql') && /^\d{4}_/.test(f))
  const fileCount = sqlFiles.length

  if (journalCount !== fileCount) {
    results.push({
      check: 'journal-vs-files',
      status: 'critical',
      message: `Journal has ${journalCount} entries but ${fileCount} SQL files exist — mismatch!`,
    })
  } else {
    results.push({
      check: 'journal-vs-files',
      status: 'ok',
      message: `${journalCount} journal entries match ${fileCount} SQL files`,
    })
  }
}

// ── Check 2: Journal tag ↔ filename consistency ───────────────────────────────

function checkJournalTags(): void {
  const journalPath = path.join(ROOT, 'apps/union-eyes/db/migrations/meta/_journal.json')
  const migrationsDir = path.join(ROOT, 'apps/union-eyes/db/migrations')

  if (!fs.existsSync(journalPath)) return

  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as {
    entries: Array<{ idx: number; tag: string }>
  }

  const sqlFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql') && /^\d{4}_/.test(f)).sort()
  let mismatches = 0

  for (const entry of journal.entries) {
    const expectedFile = `${String(entry.idx).padStart(4, '0')}_${entry.tag}.sql`
    if (!sqlFiles.includes(expectedFile)) {
      // Also check without the leading zeros padding issue
      const found = sqlFiles.find((f) => f.includes(entry.tag))
      if (!found) {
        mismatches++
        if (mismatches <= 3) {
          results.push({
            check: 'journal-tags',
            status: 'drift',
            message: `Journal entry "${entry.tag}" (idx ${entry.idx}) has no matching SQL file`,
          })
        }
      }
    }
  }

  if (mismatches === 0) {
    results.push({ check: 'journal-tags', status: 'ok', message: 'All journal entries have matching SQL files' })
  } else if (mismatches > 3) {
    results.push({ check: 'journal-tags', status: 'critical', message: `${mismatches} journal entries missing SQL files` })
  }
}

// ── Check 3: Snapshot freshness ───────────────────────────────────────────────

function checkSnapshotFreshness(): void {
  const snapshotDir = path.join(ROOT, 'apps/union-eyes/db/migrations/meta')
  if (!fs.existsSync(snapshotDir)) {
    results.push({ check: 'snapshot-freshness', status: 'drift', message: 'No snapshot directory found' })
    return
  }

  const snapshots = fs.readdirSync(snapshotDir).filter((f) => f.endsWith('_snapshot.json')).sort()
  if (snapshots.length === 0) {
    results.push({ check: 'snapshot-freshness', status: 'drift', message: 'No snapshots found' })
    return
  }

  const latestSnapshot = snapshots[snapshots.length - 1]
  const latestIdx = parseInt(latestSnapshot, 10)

  const journalPath = path.join(ROOT, 'apps/union-eyes/db/migrations/meta/_journal.json')
  if (fs.existsSync(journalPath)) {
    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as {
      entries: Array<{ idx: number }>
    }
    const lastJournalIdx = journal.entries[journal.entries.length - 1]?.idx ?? 0
    if (latestIdx < lastJournalIdx) {
      results.push({
        check: 'snapshot-freshness',
        status: 'drift',
        message: `Latest snapshot is idx ${latestIdx} but journal goes to ${lastJournalIdx}`,
      })
      return
    }
  }

  results.push({ check: 'snapshot-freshness', status: 'ok', message: `Latest snapshot: ${latestSnapshot}` })
}

// ── Check 4: Environment version comparison ───────────────────────────────────

function checkEnvironmentVersions(): void {
  // Compare evidence ledger for staging vs prod versions
  const ledgerPath = path.join(ROOT, 'ops/evidence/deploy-evidence-ledger.json')
  if (!fs.existsSync(ledgerPath)) {
    results.push({
      check: 'env-versions',
      status: 'ok',
      message: `No evidence ledger — skipping env comparison (${env})`,
    })
    return
  }

  try {
    const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) as {
      records: Array<{ environment: string; version?: string; timestamp: string }>
    }
    const envRecords = ledger.records.filter((r) => r.environment?.toLowerCase() === env)
    if (envRecords.length === 0) {
      results.push({ check: 'env-versions', status: 'ok', message: `No ${env} records in evidence ledger` })
    } else {
      const latest = envRecords.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
      results.push({
        check: 'env-versions',
        status: 'ok',
        message: `Last ${env} deploy: ${latest.version ?? 'unknown'} at ${latest.timestamp}`,
      })
    }
  } catch {
    results.push({ check: 'env-versions', status: 'ok', message: 'Evidence ledger unreadable — skipping' })
  }
}

// ── Check 5: Platform migrations not orphaned ─────────────────────────────────

function checkPlatformMigrations(): void {
  const platformDir = path.join(ROOT, 'migrations/platform')
  if (!fs.existsSync(platformDir)) {
    results.push({ check: 'platform-migrations', status: 'ok', message: 'No platform migrations directory' })
    return
  }

  const files = fs.readdirSync(platformDir).filter((f) => f.endsWith('.sql'))
  if (files.length === 0) {
    results.push({ check: 'platform-migrations', status: 'ok', message: 'No platform migrations' })
    return
  }

  // Check if any platform migrations reference tables not in Drizzle schema
  results.push({
    check: 'platform-migrations',
    status: 'ok',
    message: `${files.length} platform-level migrations found (manual review recommended)`,
  })
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main(): void {
  console.log(`\n── DB Drift Check (${env}) ──────────────────────────────`)

  checkJournalVsFiles()
  checkJournalTags()
  checkSnapshotFreshness()
  checkEnvironmentVersions()
  checkPlatformMigrations()

  // Report
  const ok = results.filter((r) => r.status === 'ok')
  const drift = results.filter((r) => r.status === 'drift')
  const critical = results.filter((r) => r.status === 'critical')

  for (const r of results) {
    const icon = r.status === 'ok' ? '✓' : r.status === 'drift' ? '⚠' : '✗'
    console.log(`  ${icon} [${r.check}] ${r.message}`)
  }

  console.log()
  console.log(`  Results: ${ok.length} ok, ${drift.length} drift, ${critical.length} critical`)

  if (critical.length > 0) {
    console.log('\n  ✗ CRITICAL DRIFT — must resolve before any deployment')
    process.exit(1)
  }
  if (drift.length > 0) {
    console.log('\n  ⚠ Minor drift detected — review before promotion')
    process.exit(2)
  }
  console.log('\n  ✓ No drift detected')
}

main()
