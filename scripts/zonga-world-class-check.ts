/**
 * Zonga World-Class Readiness Check — Master Validation Script
 *
 * Validates all 10 phases of the Zonga world-class upgrade are complete
 * and meet acceptance criteria. Run as a CI gate or pre-deploy check.
 *
 * Usage: npx tsx scripts/zonga-world-class-check.ts
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

// ── Types ───────────────────────────────────────────────────────────────────

interface CheckResult {
  phase: number
  name: string
  check: string
  passed: boolean
  detail: string
}

const results: CheckResult[] = []

function check(phase: number, name: string, checkName: string, passed: boolean, detail: string) {
  results.push({ phase, name, check: checkName, passed, detail })
}

function fileExists(relative: string): boolean {
  return fs.existsSync(path.join(ROOT, relative))
}

function fileContains(relative: string, pattern: RegExp): boolean {
  const full = path.join(ROOT, relative)
  if (!fs.existsSync(full)) return false
  return pattern.test(fs.readFileSync(full, 'utf-8'))
}

function fileExports(relative: string, exportName: string): boolean {
  return fileContains(relative, new RegExp(`export\\s+(function|const|interface|type|class)\\s+${exportName}\\b`))
}

// ── Phase 1: Royalty Engine (Trust Core) ────────────────────────────────────

const P1 = 'packages/zonga-rights/src/royalty-engine.ts'
check(1, 'Royalty Engine', 'File exists', fileExists(P1), P1)
check(1, 'Royalty Engine', 'computeRoyalty exported', fileExports(P1, 'computeRoyalty'), 'Deterministic computation')
check(1, 'Royalty Engine', 'CALCULATION_VERSION exported', fileContains(P1, /CALCULATION_VERSION/), 'Versioned computation')
check(1, 'Royalty Engine', 'Deterministic hashing', fileContains(P1, /computeHash|createHash|calculationHash/), 'Hash sealing')
check(1, 'Royalty Engine', 'Split validation', fileContains(P1, /totalPercent\s*!==\s*100|splits.*sum.*100/i), 'Must sum to 100%')

// ── Phase 2: Payout Proof (Non-Negotiable) ─────────────────────────────────

const P2 = 'packages/zonga-rights/src/payout-proof.ts'
check(2, 'Payout Proof', 'File exists', fileExists(P2), P2)
check(2, 'Payout Proof', 'generatePayoutProof exported', fileExports(P2, 'generatePayoutProof'), 'Proof generation')
check(2, 'Payout Proof', 'markProofDisbursed exported', fileExports(P2, 'markProofDisbursed'), 'Disbursement tracking')
check(2, 'Payout Proof', 'verifyProofIntegrity exported', fileExports(P2, 'verifyProofIntegrity'), 'Integrity verification')
check(2, 'Payout Proof', 'Hash verification', fileContains(P2, /createHash|sha256|proofHash/), 'Cryptographic proof')

// ── Phase 3: Single Payout Orchestrator ────────────────────────────────────

const P3 = 'packages/zonga-payments/src/payout-orchestrator.ts'
check(3, 'Payout Orchestrator', 'File exists', fileExists(P3), P3)
check(3, 'Payout Orchestrator', 'createPayoutOrchestrator exported', fileExports(P3, 'createPayoutOrchestrator'), 'Factory function')
check(3, 'Payout Orchestrator', 'DI ports pattern', fileContains(P3, /PayoutOrchestratorPorts|ports\.\w+/), 'Dependency injection')
check(3, 'Payout Orchestrator', 'Audit trail', fileContains(P3, /recordAuditEvent|audit/i), 'Audit event recording')

const P3_REMOVED_MACHINE = 'packages/zonga-payments/src/payout-machine.ts'
const P3_REMOVED_SETTLEMENT = 'packages/zonga-payments/src/payout-settlement.ts'
check(3, 'Payout Orchestrator', 'payout-machine.ts removed', !fileExists(P3_REMOVED_MACHINE), 'Legacy file must not exist')
check(3, 'Payout Orchestrator', 'payout-settlement.ts removed', !fileExists(P3_REMOVED_SETTLEMENT), 'Legacy file must not exist')

const P3_CHECK = 'scripts/zonga-payout-check.ts'
check(3, 'Payout Orchestrator', 'Enforcement script exists', fileExists(P3_CHECK), P3_CHECK)

// ── Phase 4: Event Economics (Full Closure) ────────────────────────────────

const P4_ECON = 'packages/zonga-events/src/event-economics.ts'
const P4_SETTLE = 'packages/zonga-events/src/event-settlement.ts'
check(4, 'Event Economics', 'event-economics.ts exists', fileExists(P4_ECON), P4_ECON)
check(4, 'Event Economics', 'Fee models defined', fileContains(P4_ECON, /DEFAULT_EVENT_FEE_MODEL|PREMIUM_EVENT_FEE_MODEL/), 'Standard + premium models')
check(4, 'Event Economics', 'Refund policy', fileContains(P4_ECON, /calculateRefund|DEFAULT_REFUND_POLICY/), 'Refund modeling')
check(4, 'Event Economics', 'Ticket class revenue', fileContains(P4_ECON, /computeTicketClassRevenue/), 'Multi-class tickets')
check(4, 'Event Economics', 'event-settlement.ts exists', fileExists(P4_SETTLE), P4_SETTLE)
check(4, 'Event Economics', 'Settlement splits', fileContains(P4_SETTLE, /DEFAULT_EVENT_SPLITS/), 'Platform/promoter/artist splits')
check(4, 'Event Economics', 'Settlement readiness', fileContains(P4_SETTLE, /checkSettlementReadiness/), 'Pre-settlement validation')

// ── Phase 5: Monetization Model ────────────────────────────────────────────

const P5_TIERS = 'packages/zonga-economics/src/pricing-tiers.ts'
const P5_FEES = 'packages/zonga-economics/src/fees.ts'
const P5_PLANS = 'apps/zonga/lib/plans.ts'
check(5, 'Monetization Model', 'pricing-tiers.ts exists', fileExists(P5_TIERS), P5_TIERS)
check(5, 'Monetization Model', 'PRICING_TIERS constant', fileContains(P5_TIERS, /PRICING_TIERS/), '4-tier definition')
check(5, 'Monetization Model', 'resolveTierFeeRules', fileExports(P5_TIERS, 'resolveTierFeeRules'), 'Fee rule resolution')
check(5, 'Monetization Model', 'getEffectiveTierCommission', fileExports(P5_TIERS, 'getEffectiveTierCommission'), 'Commission lookup')
check(5, 'Monetization Model', 'DEFAULT_FEE_RULES', fileContains(P5_FEES, /DEFAULT_FEE_RULES/), 'Platform fee rules')
check(5, 'Monetization Model', 'Creator plans defined', fileContains(P5_PLANS, /CREATOR_PLANS/), 'App-level plan configs')
check(5, 'Monetization Model', 'Listener plans defined', fileContains(P5_PLANS, /LISTENER_PLANS/), 'Listener free/premium')

// ── Phase 6: Creator Economy Loop ──────────────────────────────────────────

const P6_ENGAGE = 'packages/zonga-growth/src/engagement-engine.ts'
const P6_SOCIAL = 'packages/zonga-growth/src/social.ts'
const P6_DISCOVERY = 'packages/zonga-growth/src/discovery.ts'
check(6, 'Creator Economy', 'engagement-engine.ts exists', fileExists(P6_ENGAGE), P6_ENGAGE)
check(6, 'Creator Economy', 'Regional charts', fileContains(P6_ENGAGE, /computeRegionalChart/), 'Chart computation')
check(6, 'Creator Economy', 'Velocity ranking', fileContains(P6_ENGAGE, /computeVelocityRanking/), 'Trending detection')
check(6, 'Creator Economy', 'Fan scoring', fileContains(P6_ENGAGE, /scoreFanEngagement/), 'Fan tier system')
check(6, 'Creator Economy', 'Creator momentum', fileContains(P6_ENGAGE, /computeCreatorMomentum/), 'Growth metrics')
check(6, 'Creator Economy', 'Social graph', fileExists(P6_SOCIAL), P6_SOCIAL)
check(6, 'Creator Economy', 'Discovery service', fileExists(P6_DISCOVERY), P6_DISCOVERY)

// ── Phase 7: AI Productization ─────────────────────────────────────────────

const P7_RECO = 'packages/zonga-intelligence/src/recommendation-engine.ts'
const P7_SCORES = 'packages/zonga-intelligence/src/recommendations.ts'
const P7_ASSIST = 'packages/zonga-intelligence/src/creator-assist.ts'
const P7_FRAUD = 'packages/zonga-intelligence/src/fraud.ts'
const P7_MOD = 'packages/zonga-intelligence/src/moderation.ts'
check(7, 'AI Productization', 'recommendation-engine.ts exists', fileExists(P7_RECO), P7_RECO)
check(7, 'AI Productization', 'createRecommendationEngine', fileExports(P7_RECO, 'createRecommendationEngine'), 'Engine factory')
check(7, 'AI Productization', 'DI ports pattern', fileContains(P7_RECO, /RecommendationPorts/), 'Injectable ports')
check(7, 'AI Productization', 'Multi-strategy support', fileContains(P7_RECO, /collaborative.*trending.*content|hybrid/s), 'Hybrid strategy')
check(7, 'AI Productization', 'Scoring pipeline', fileExports(P7_SCORES, 'scoreItemsBySignals'), 'Signal scoring')
check(7, 'AI Productization', 'Creator assist', fileExists(P7_ASSIST), P7_ASSIST)
check(7, 'AI Productization', 'Fraud detection', fileExists(P7_FRAUD), P7_FRAUD)
check(7, 'AI Productization', 'Moderation engine', fileExists(P7_MOD), P7_MOD)

// ── Phase 8: Control + Meta Alignment ──────────────────────────────────────

const P8_META = 'apps/zonga/app-architecture.meta.json'
const P8_CONTROL = 'apps/zonga/control-manifest.json'

check(8, 'Control + Meta', 'app-architecture.meta.json exists', fileExists(P8_META), P8_META)
check(8, 'Control + Meta', 'control-manifest.json exists', fileExists(P8_CONTROL), P8_CONTROL)

if (fileExists(P8_META)) {
  const meta = JSON.parse(fs.readFileSync(path.join(ROOT, P8_META), 'utf-8'))
  check(8, 'Control + Meta', 'Migration complete', meta.migration_status === 'complete', `Status: ${meta.migration_status}`)
  check(8, 'Control + Meta', 'App tier PRODUCTION', meta.app_tier === 'PRODUCTION', `Tier: ${meta.app_tier}`)
  check(8, 'Control + Meta', 'No pending migrations', Array.isArray(meta.priority_migrations) && meta.priority_migrations.length === 0, `Pending: ${meta.priority_migrations?.length ?? 'missing'}`)
}

if (fileExists(P8_CONTROL)) {
  const ctrl = JSON.parse(fs.readFileSync(path.join(ROOT, P8_CONTROL), 'utf-8'))
  check(8, 'Control + Meta', 'Policy profile set', ctrl.policyProfile === 'creator-economy', `Profile: ${ctrl.policyProfile}`)
  check(8, 'Control + Meta', 'AI control enabled', ctrl.controls?.aiControl === true, 'aiControl flag')
  check(8, 'Control + Meta', 'Enforcement enabled', ctrl.controls?.enforcement === true, 'enforcement flag')
  check(8, 'Control + Meta', 'Commerce capability', ctrl.capabilities?.commerce === true, 'commerce flag')
  check(8, 'Control + Meta', 'Payouts capability', ctrl.capabilities?.payouts === true, 'payouts flag')
  check(8, 'Control + Meta', 'Rights capability', ctrl.capabilities?.rights === true, 'rights flag')
}

// ── Phase 9: Dashboard + Economics Visibility ──────────────────────────────

const P9_REPORTING = 'packages/zonga-economics/src/reporting.ts'
const P9_DASHBOARD = 'packages/zonga-growth/src/creator-dashboard.ts'
const P9_INSIGHTS = 'packages/zonga-intelligence/src/insights.ts'
check(9, 'Dashboards', 'Reporting engine', fileExists(P9_REPORTING), P9_REPORTING)
check(9, 'Dashboards', 'CreatorRevenueReport type', fileContains(P9_REPORTING, /CreatorRevenueReport/), 'Creator revenue reporting')
check(9, 'Dashboards', 'PlatformMetrics type', fileContains(P9_REPORTING, /PlatformMetrics/), 'Platform-wide metrics')
check(9, 'Dashboards', 'OrgFinancialSummary type', fileContains(P9_REPORTING, /OrgFinancialSummary/), 'Org-level visibility')
check(9, 'Dashboards', 'Revenue aggregation', fileContains(P9_REPORTING, /aggregateRevenueBySource/), 'By-source breakdown')
check(9, 'Dashboards', 'Creator dashboard', fileExists(P9_DASHBOARD), P9_DASHBOARD)
check(9, 'Dashboards', 'Creator insights', fileExists(P9_INSIGHTS), P9_INSIGHTS)

// ── Phase 10: Testing + Enforcement ────────────────────────────────────────

const TEST_FILES = [
  'packages/zonga-economics/src/economics.test.ts',
  'packages/zonga-economics/src/reporting.test.ts',
  'packages/zonga-rights/src/rights.test.ts',
  'packages/zonga-rights/src/rights-proof.test.ts',
  'packages/zonga-payments/src/payments.test.ts',
  'packages/zonga-events/src/events.test.ts',
  'packages/zonga-growth/src/engagement-engine.test.ts',
  'packages/zonga-intelligence/src/intelligence.test.ts',
]

for (const tf of TEST_FILES) {
  check(10, 'Testing', `Test file: ${path.basename(tf)}`, fileExists(tf), tf)
}

check(10, 'Testing', 'Payout enforcement script', fileExists('scripts/zonga-payout-check.ts'), 'Payout bypass detection')
check(10, 'Testing', 'World-class check script', fileExists('scripts/zonga-world-class-check.ts'), 'This script')

// ── Summary ─────────────────────────────────────────────────────────────────

console.log('')
console.log('🏆 Zonga World-Class Readiness Report')
console.log('═'.repeat(70))

const phaseGroups = new Map<number, CheckResult[]>()
for (const r of results) {
  const group = phaseGroups.get(r.phase) ?? []
  group.push(r)
  phaseGroups.set(r.phase, group)
}

let totalPassed = 0
let totalFailed = 0

for (const [phase, checks] of [...phaseGroups.entries()].sort((a, b) => a[0] - b[0])) {
  const passed = checks.filter((c) => c.passed).length
  const failed = checks.filter((c) => !c.passed).length
  totalPassed += passed
  totalFailed += failed

  const status = failed === 0 ? '✅' : '❌'
  console.log(`\n${status} Phase ${phase}: ${checks[0]!.name} (${passed}/${checks.length})`)

  for (const c of checks) {
    const icon = c.passed ? '  ✓' : '  ✗'
    console.log(`${icon} ${c.check} — ${c.detail}`)
  }
}

console.log('\n' + '═'.repeat(70))
console.log(`Total: ${totalPassed}/${totalPassed + totalFailed} checks passed`)

if (totalFailed > 0) {
  console.error(`\n❌ ${totalFailed} check(s) failed. Zonga is NOT world-class ready.`)
  process.exit(1)
} else {
  console.log('\n✅ All checks passed. Zonga is WORLD-CLASS READY. 🚀')
}
