/**
 * Zonga Payout Bypass Check — Enforcement Script
 *
 * Ensures ALL payout logic routes through the single payout orchestrator
 * in @nzila/zonga-payments. Fails CI if any file outside the orchestrator
 * contains direct payout execution, provider calls, or disbursement logic.
 *
 * Usage: npx tsx scripts/zonga-payout-check.ts
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

// ── Configuration ───────────────────────────────────────────────────────────

/** The single authorized payout execution file */
const AUTHORIZED_PAYOUT_FILE = path.join(
  ROOT,
  'packages/zonga-payments/src/payout-orchestrator.ts',
)

/** Directories to scan for violations */
const SCAN_DIRS = [
  'packages/zonga-rights/src',
  'packages/zonga-economics/src',
  'packages/zonga-events/src',
  'packages/zonga-growth/src',
  'packages/zonga-intelligence/src',
  'packages/zonga-core/src',
  'packages/zonga-control-plane/src',
  'apps/zonga/lib',
  'apps/zonga/app',
]

/** Patterns that indicate direct payout logic bypass */
const VIOLATION_PATTERNS: { pattern: RegExp; description: string }[] = [
  {
    pattern: /executeProviderPayout\s*\(/,
    description: 'Direct provider payout execution',
  },
  {
    pattern: /disburseFunds\s*\(/,
    description: 'Direct fund disbursement call',
  },
  {
    pattern: /sendPayout\s*\(/,
    description: 'Direct payout send call',
  },
  {
    pattern: /transferToExternalAccount\s*\(/,
    description: 'Direct external account transfer',
  },
  {
    pattern: /new\s+PayoutMachine\s*\(/,
    description: 'Legacy PayoutMachine instantiation (removed)',
  },
  {
    pattern: /PayoutSettlement\s*\(/,
    description: 'Legacy PayoutSettlement usage (removed)',
  },
]

/**
 * Files that are explicitly allowed to reference payout patterns.
 * Only the orchestrator itself and its test file.
 */
const ALLOWED_FILES = new Set([
  path.normalize('packages/zonga-payments/src/payout-orchestrator.ts'),
  path.normalize('packages/zonga-payments/src/payments.test.ts'),
  path.normalize('packages/zonga-payments/src/types.ts'),
])

// ── Scanner ─────────────────────────────────────────────────────────────────

interface Violation {
  file: string
  line: number
  pattern: string
  content: string
}

function walkTs(dir: string): string[] {
  const fullDir = path.join(ROOT, dir)
  if (!fs.existsSync(fullDir)) return []

  const files: string[] = []
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name)
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.next') {
        walk(full)
      } else if (entry.isFile() && /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        files.push(full)
      }
    }
  }
  walk(fullDir)
  return files
}

function scanFile(filePath: string): Violation[] {
  const rel = path.normalize(path.relative(ROOT, filePath))
  if (ALLOWED_FILES.has(rel)) return []

  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const violations: Violation[] = []

  for (let i = 0; i < lines.length; i++) {
    for (const { pattern, description } of VIOLATION_PATTERNS) {
      if (pattern.test(lines[i]!)) {
        violations.push({
          file: rel,
          line: i + 1,
          pattern: description,
          content: lines[i]!.trim(),
        })
      }
    }
  }

  return violations
}

// ── Main ────────────────────────────────────────────────────────────────────

console.log('🔒 Zonga Payout Bypass Check')
console.log('━'.repeat(60))

// Verify orchestrator exists
if (!fs.existsSync(AUTHORIZED_PAYOUT_FILE)) {
  console.error('❌ CRITICAL: payout-orchestrator.ts not found!')
  console.error(`   Expected: ${path.relative(ROOT, AUTHORIZED_PAYOUT_FILE)}`)
  process.exit(1)
}

console.log(`✅ Orchestrator: ${path.relative(ROOT, AUTHORIZED_PAYOUT_FILE)}`)

// Scan for violations
const allViolations: Violation[] = []
let filesScanned = 0

for (const dir of SCAN_DIRS) {
  const files = walkTs(dir)
  filesScanned += files.length
  for (const file of files) {
    allViolations.push(...scanFile(file))
  }
}

console.log(`📂 Scanned ${filesScanned} files across ${SCAN_DIRS.length} directories`)
console.log('')

if (allViolations.length > 0) {
  console.error(`❌ FAILED: ${allViolations.length} payout bypass violation(s) found:\n`)
  for (const v of allViolations) {
    console.error(`  ${v.file}:${v.line}`)
    console.error(`    Pattern: ${v.pattern}`)
    console.error(`    Code:    ${v.content}`)
    console.error('')
  }
  console.error('All payout logic MUST route through payout-orchestrator.ts.')
  console.error('Remove direct payout calls and use the orchestrator instead.')
  process.exit(1)
} else {
  console.log('✅ No payout bypass violations found.')
  console.log('   All payout logic routes through the single orchestrator.')
}
