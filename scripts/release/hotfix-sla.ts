/**
 * release:hotfix:sla — Check hotfix SLA compliance.
 *
 * Scans ops/hotfixes/ for records where status !== 'normalized'
 * and normalizationDeadline has passed. Alerts on overdue items.
 *
 * Hotfix governance: Every hotfix MUST be normalized within 48h.
 * "Normalized" = proper PR, tests, review, merged to main with
 * full governance compliance.
 *
 * Usage:
 *   pnpm release:hotfix:sla
 *   pnpm release:hotfix:sla --strict   # exit 1 on any overdue
 *
 * Exit codes:
 *   0 = all hotfixes normalized or within SLA
 *   1 = overdue hotfixes exist (--strict mode)
 *   2 = overdue hotfixes exist (warning mode)
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const HOTFIX_DIR = path.join(ROOT, 'ops/hotfixes')
const STRICT = process.argv.includes('--strict')

interface HotfixRecord {
  id: string
  tag: string
  description: string
  createdAt: string
  status: 'open' | 'normalized' | 'overdue'
  normalizationDeadline: string
  normalizedAt?: string
  normalizedPR?: string
  owner?: string
}

interface SLAResult {
  total: number
  normalized: number
  withinSLA: number
  overdue: HotfixRecord[]
}

function main(): void {
  console.log('\n── Hotfix SLA Compliance ────────────────────────────────')

  if (!fs.existsSync(HOTFIX_DIR)) {
    fs.mkdirSync(HOTFIX_DIR, { recursive: true })
    console.log('  ✓ No hotfixes recorded — all clear')
    process.exit(0)
  }

  const files = fs.readdirSync(HOTFIX_DIR).filter((f) => f.endsWith('.json'))
  if (files.length === 0) {
    console.log('  ✓ No hotfixes recorded — all clear')
    process.exit(0)
  }

  const now = new Date()
  const result: SLAResult = { total: files.length, normalized: 0, withinSLA: 0, overdue: [] }

  for (const file of files) {
    try {
      const record = JSON.parse(
        fs.readFileSync(path.join(HOTFIX_DIR, file), 'utf8'),
      ) as HotfixRecord

      if (record.status === 'normalized') {
        result.normalized++
        continue
      }

      const deadline = new Date(record.normalizationDeadline)
      if (now > deadline) {
        record.status = 'overdue'
        result.overdue.push(record)
      } else {
        result.withinSLA++
      }
    } catch {
      // Skip malformed files
    }
  }

  // Report
  console.log(`  Total hotfixes: ${result.total}`)
  console.log(`  Normalized:     ${result.normalized}`)
  console.log(`  Within SLA:     ${result.withinSLA}`)
  console.log(`  OVERDUE:        ${result.overdue.length}`)

  if (result.overdue.length > 0) {
    console.log('\n  ⚠ OVERDUE HOTFIXES:')
    for (const h of result.overdue) {
      const deadlineStr = new Date(h.normalizationDeadline).toISOString().split('T')[0]
      const hoursOverdue = Math.round(
        (now.getTime() - new Date(h.normalizationDeadline).getTime()) / (1000 * 60 * 60),
      )
      console.log(`    ✗ ${h.id} (${h.tag}) — ${hoursOverdue}h overdue (deadline: ${deadlineStr})`)
      console.log(`      "${h.description}"`)
      if (h.owner) console.log(`      Owner: ${h.owner}`)
    }

    if (STRICT) {
      console.log('\n  ✗ GOVERNANCE VIOLATION — hotfix(es) exceed 48h SLA')
      process.exit(1)
    }
    console.log('\n  ⚠ Hotfixes overdue — normalize immediately')
    process.exit(2)
  }

  console.log('\n  ✓ All hotfixes within SLA')
}

main()
