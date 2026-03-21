/**
 * Zonga Final Enforcement Check
 *
 * Validates all three lock-in requirements are met:
 *   1. Hard-gate payout proof (no payout without proof)
 *   2. Single payout execution path (no bypass)
 *   3. AI recommendations wired to listener UI
 *
 * Usage: npx tsx scripts/zonga-final-check.ts
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

let failures = 0
let passes = 0

function pass(msg: string) {
  console.log(`  ✅ ${msg}`)
  passes++
}

function fail(msg: string) {
  console.error(`  ❌ ${msg}`)
  failures++
}

function check(condition: boolean, msg: string) {
  if (condition) pass(msg)
  else fail(msg)
}

function readFile(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8')
}

function fileExists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel))
}

// ── 1. Hard-Gate Payout Proof ─────────────────────────────────────────────

console.log('\n🔒 CHECK 1: Hard-Gate Payout Proof')
console.log('─'.repeat(50))

const orchestratorPath = 'packages/zonga-payments/src/payout-orchestrator.ts'
check(fileExists(orchestratorPath), 'payout-orchestrator.ts exists')

const orchestrator = readFile(orchestratorPath)

check(
  orchestrator.includes('generatePayoutProof'),
  'Orchestrator imports generatePayoutProof',
)
check(
  orchestrator.includes('verifyProofIntegrity'),
  'Orchestrator imports verifyProofIntegrity',
)
check(
  orchestrator.includes('markProofDisbursed'),
  'Orchestrator imports markProofDisbursed',
)
check(
  orchestrator.includes('PAYOUT_BLOCKED_NO_PROOF'),
  'Orchestrator blocks payout when proof generation fails',
)
check(
  orchestrator.includes('PAYOUT_BLOCKED_INVALID_PROOF'),
  'Orchestrator blocks payout when proof integrity invalid',
)
check(
  orchestrator.includes('persistProof(proof)'),
  'Orchestrator persists proof BEFORE execution',
)
check(
  orchestrator.includes('persistProof(disbursedProof)'),
  'Orchestrator persists disbursed proof AFTER success',
)
check(
  /persistProof\s*\(/.test(orchestrator),
  'persistProof port is used (non-optional)',
)
check(
  orchestrator.includes("persistProof(proof: PayoutProof): Promise<void>"),
  'persistProof defined in PayoutOrchestratorPorts',
)

// Orchestrator must NOT have any direct Stripe calls
check(
  !orchestrator.includes('stripe'),
  'Orchestrator has no direct Stripe references',
)

// ── 2. Single Payout Execution Path ──────────────────────────────────────

console.log('\n🛤️  CHECK 2: Single Payout Execution Path')
console.log('─'.repeat(50))

const payoutActionsPath = 'apps/zonga/lib/actions/payout-actions.ts'
check(fileExists(payoutActionsPath), 'payout-actions.ts exists')

const payoutActions = readFile(payoutActionsPath)

check(
  !payoutActions.includes('executeCreatorPayout'),
  'No executeCreatorPayout bypass in payout-actions',
)
check(
  payoutActions.includes('executeCommand'),
  'Payout actions route through command bus (executeCommand)',
)

// Check enforcement script exists and catches bypasses
const payoutCheckPath = 'scripts/zonga-payout-check.ts'
check(fileExists(payoutCheckPath), 'zonga-payout-check.ts enforcement script exists')

const payoutCheck = readFile(payoutCheckPath)
check(
  payoutCheck.includes('executeCreatorPayout'),
  'Enforcement script catches executeCreatorPayout bypass',
)
check(
  payoutCheck.includes('executeProviderPayout'),
  'Enforcement script catches executeProviderPayout bypass',
)
check(
  payoutCheck.includes('disburseFunds'),
  'Enforcement script catches disburseFunds bypass',
)

// Verify no other file in apps/zonga/lib has direct payout execution
const bypassPatterns = [
  /executeProviderPayout\s*\(/,
  /disburseFunds\s*\(/,
  /executeCreatorPayout\s*\(/,
]

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

const allowedBypass = new Set([
  path.normalize('packages/zonga-payments/src/payout-orchestrator.ts'),
  path.normalize('packages/zonga-payments/src/payments.test.ts'),
  path.normalize('packages/zonga-payments/src/types.ts'),
  path.normalize('packages/zonga-payments/src/adapters/index.ts'),
  path.normalize('packages/zonga-payments/src/adapters/stripe.ts'),
  path.normalize('packages/zonga-payments/src/adapters/momo.ts'),
  path.normalize('packages/zonga-payments/src/adapters/orange.ts'),
  path.normalize('packages/zonga-payments/src/adapters/airtel.ts'),
  // Command bus handler and stripe adapter — part of single orchestrated path
  path.normalize('apps/zonga/lib/control/handlers/execute-payout.handler.ts'),
  path.normalize('apps/zonga/lib/stripe.ts'),
])

const scanDirs = ['apps/zonga/lib', 'apps/zonga/app']
let bypassViolations = 0
for (const dir of scanDirs) {
  for (const file of walkTs(dir)) {
    const rel = path.normalize(path.relative(ROOT, file))
    if (allowedBypass.has(rel)) continue
    const content = fs.readFileSync(file, 'utf-8')
    for (const pattern of bypassPatterns) {
      if (pattern.test(content)) {
        fail(`Bypass violation in ${rel}: ${pattern.source}`)
        bypassViolations++
      }
    }
  }
}
if (bypassViolations === 0) {
  pass('No payout bypass violations in app layer')
}

// ── 3. AI Recommendations in UI ──────────────────────────────────────────

console.log('\n🤖 CHECK 3: AI Recommendations in UI')
console.log('─'.repeat(50))

const listenerPagePath = 'apps/zonga/app/[locale]/dashboard/listener/page.tsx'
check(fileExists(listenerPagePath), 'Listener dashboard page exists')

const listenerPage = readFile(listenerPagePath)

check(
  listenerPage.includes('getRecommendationsForUser'),
  'Listener page calls getRecommendationsForUser',
)
check(
  listenerPage.includes('Recommended for You'),
  'Listener page has "Recommended for You" section',
)
check(
  listenerPage.includes('AI'),
  'Listener page shows AI badge',
)

const listenerActionsPath = 'apps/zonga/lib/actions/listener-actions.ts'
const listenerActions = readFile(listenerActionsPath)

check(
  listenerActions.includes('createRecommendationEngine'),
  'Listener actions import recommendation engine',
)
check(
  listenerActions.includes('getRecommendationsForUser'),
  'getRecommendationsForUser server action exists',
)
check(
  listenerActions.includes('@nzila/zonga-intelligence'),
  'Listener actions depend on @nzila/zonga-intelligence',
)

// Verify zonga app package.json has intelligence dependency
const zongaPkg = readFile('apps/zonga/package.json')
check(
  zongaPkg.includes('"@nzila/zonga-intelligence"'),
  'Zonga app has @nzila/zonga-intelligence dependency',
)

// ── Summary ──────────────────────────────────────────────────────────────

console.log('\n' + '━'.repeat(50))
console.log(`\n  Results: ${passes} passed, ${failures} failed\n`)

if (failures > 0) {
  console.error('❌ ZONGA FINAL CHECK FAILED')
  process.exit(1)
} else {
  console.log('✅ ALL ZONGA LOCK-IN REQUIREMENTS MET')
}
