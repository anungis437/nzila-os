/**
 * Governance Fail-Closed Gate
 *
 * This script validates ALL governance packages and structural guards
 * are in place and passing. It is designed to run in CI as a mandatory
 * gate that BLOCKS deployment if ANY governance check fails.
 *
 * FAIL-CLOSED: If any check throws, the overall gate FAILS.
 * NO SKIP FLAGS. NO ENVIRONMENT OVERRIDES.
 *
 * Run: npx tsx tooling/governance/validate-governance-gate.ts
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')

// Relocated paths after docs reorg: prefer canonical locations under
// docs/categories/platform-and-operations/platform and governance/foundations/resilience.
const PLATFORM_DOCS = join(ROOT, 'docs', 'categories', 'platform-and-operations', 'platform')
const RESILIENCE_DIR = join(ROOT, 'governance', 'foundations', 'resilience')

// ── Types ───────────────────────────────────────────────────────────────────

interface CheckResult {
  name: string
  status: 'pass' | 'fail'
  detail: string
}

const results: CheckResult[] = []

function check(name: string, fn: () => string): void {
  try {
    const detail = fn()
    results.push({ name, status: 'pass', detail })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    results.push({ name, status: 'fail', detail: msg })
  }
}

// ── Checks ──────────────────────────────────────────────────────────────────

const GOVERNANCE_PACKAGES = [
  'observability',
  'audit',
  'ai-control',
  'contracts',
  'events',
  'governance',
  'security',
  'enforcement',
] as const

check('GOV-GATE-001: All governance packages have source', () => {
  const missing: string[] = []
  for (const pkg of GOVERNANCE_PACKAGES) {
    const src = join(ROOT, 'packages', pkg, 'src', 'index.ts')
    if (!existsSync(src)) missing.push(pkg)
  }
  if (missing.length > 0) {
    throw new Error(`Missing source: ${missing.join(', ')}`)
  }
  return `${GOVERNANCE_PACKAGES.length} packages verified`
})

check('GOV-GATE-002: All governance packages have package.json', () => {
  const missing: string[] = []
  for (const pkg of GOVERNANCE_PACKAGES) {
    const pkgJson = join(ROOT, 'packages', pkg, 'package.json')
    if (!existsSync(pkgJson)) missing.push(pkg)
  }
  if (missing.length > 0) {
    throw new Error(`Missing package.json: ${missing.join(', ')}`)
  }
  return `${GOVERNANCE_PACKAGES.length} package.json files verified`
})

check('GOV-GATE-003: All governance packages have test files', () => {
  const missing: string[] = []
  for (const pkg of GOVERNANCE_PACKAGES) {
    const srcDir = join(ROOT, 'packages', pkg, 'src')
    const hasTest = existsSync(srcDir) && findTestFiles(srcDir).length > 0
    if (!hasTest) missing.push(pkg)
  }
  if (missing.length > 0) {
    throw new Error(`No test files: ${missing.join(', ')}`)
  }
  return `${GOVERNANCE_PACKAGES.length} packages have tests`
})

check('GOV-GATE-004: Enforcement package exports pipeline', () => {
  const index = readFileSync(join(ROOT, 'packages/enforcement/src/index.ts'), 'utf-8')
  const required = ['composePipeline', 'createEnforcedHandler', 'createContext', 'withEnforcement', 'enforcementPlugin']
  const missing = required.filter(e => !index.includes(e))
  if (missing.length > 0) {
    throw new Error(`Missing exports: ${missing.join(', ')}`)
  }
  return `All ${required.length} enforcement exports present`
})

check('GOV-GATE-005: Enforcement layers are complete', () => {
  const index = readFileSync(join(ROOT, 'packages/enforcement/src/index.ts'), 'utf-8')
  const layers = ['traceLayer', 'authLayer', 'rateLimitLayer', 'governanceLayer', 'auditLayer']
  const missing = layers.filter(l => !index.includes(l))
  if (missing.length > 0) {
    throw new Error(`Missing layers: ${missing.join(', ')}`)
  }
  return `All ${layers.length} enforcement layers exported`
})

check('GOV-GATE-006: Governance no-bypass contract tests exist', () => {
  const testFile = join(ROOT, 'tooling/contract-tests/governance-no-bypass.test.ts')
  if (!existsSync(testFile)) {
    throw new Error('governance-no-bypass.test.ts not found')
  }
  const content = readFileSync(testFile, 'utf-8')
  const invariants = ['GOV-BYPASS-001', 'GOV-BYPASS-002', 'GOV-BYPASS-003', 'GOV-BYPASS-005', 'GOV-BYPASS-006']
  const missing = invariants.filter(i => !content.includes(i))
  if (missing.length > 0) {
    throw new Error(`Missing invariants: ${missing.join(', ')}`)
  }
  return `All ${invariants.length} bypass invariants present`
})

check('GOV-GATE-007: Runtime adoption matrix exists', () => {
  const matrixPath = join(ROOT, 'governance/runtime-adoption-matrix.json')
  if (!existsSync(matrixPath)) {
    throw new Error('runtime-adoption-matrix.json not found')
  }
  const matrix = JSON.parse(readFileSync(matrixPath, 'utf-8'))
  if (!matrix.apps || !Array.isArray(matrix.apps) || matrix.apps.length === 0) {
    throw new Error('runtime-adoption-matrix.json has no apps')
  }
  return `Matrix tracks ${matrix.apps.length} apps`
})

check('GOV-GATE-008: GA check script exists', () => {
  const gaCheck = join(ROOT, 'governance/ga-check.ts')
  if (!existsSync(gaCheck)) {
    throw new Error('governance/ga-check.ts not found')
  }
  const content = readFileSync(gaCheck, 'utf-8')
  if (!content.includes('NO BYPASS FLAGS')) {
    throw new Error('ga-check.ts missing no-bypass declaration')
  }
  return 'GA check script verified'
})

check('GOV-GATE-009: CODEOWNERS protects governance files', () => {
  const codeowners = join(ROOT, 'CODEOWNERS')
  if (!existsSync(codeowners)) {
    throw new Error('CODEOWNERS file not found')
  }
  const content = readFileSync(codeowners, 'utf-8')
  const required = ['/governance/', '/packages/enforcement/']
  const missing = required.filter(p => !content.includes(p))
  if (missing.length > 0) {
    throw new Error(`CODEOWNERS missing protection for: ${missing.join(', ')}`)
  }
  return `CODEOWNERS protects ${required.length} governance paths`
})

check('GOV-GATE-010: ESLint configs exist for governance packages', () => {
  const missing: string[] = []
  for (const pkg of GOVERNANCE_PACKAGES) {
    const eslintPath = join(ROOT, 'packages', pkg, 'eslint.config.mjs')
    if (!existsSync(eslintPath)) missing.push(pkg)
  }
  if (missing.length > 0) {
    throw new Error(`Missing ESLint config: ${missing.join(', ')}`)
  }
  return `${GOVERNANCE_PACKAGES.length} ESLint configs verified`
})

check('GOV-GATE-011: Vitest config includes governance packages', () => {
  const vitestConfig = readFileSync(join(ROOT, 'vitest.config.ts'), 'utf-8')
  const missing: string[] = []
  for (const pkg of GOVERNANCE_PACKAGES) {
    if (!vitestConfig.includes(`packages/${pkg}`)) missing.push(pkg)
  }
  if (missing.length > 0) {
    throw new Error(`Not in vitest.config.ts: ${missing.join(', ')}`)
  }
  return `${GOVERNANCE_PACKAGES.length} packages in vitest workspace`
})

check('GOV-GATE-012: Evidence lifecycle policy exists and is structured', () => {
  const policyPath = join(PLATFORM_DOCS, 'EVIDENCE_LIFECYCLE_POLICY.md')
  if (!existsSync(policyPath)) {
    throw new Error(`${policyPath} not found`)
  }
  const content = readFileSync(policyPath, 'utf-8')
  const required = [
    '## Evidence Classes',
    '## Legal Hold',
    '## Chain of Custody Requirements',
    '## Minimum CI Expectations',
  ]
  const missing = required.filter((h) => !content.includes(h))
  if (missing.length > 0) {
    throw new Error(`Evidence lifecycle policy missing sections: ${missing.join(', ')}`)
  }
  return 'Evidence lifecycle policy present with required sections'
})

check('GOV-GATE-013: AI incident playbooks exist', () => {
  const required = [
    join(PLATFORM_DOCS, 'AI_INCIDENT_PLAYBOOK_PROMPT_INJECTION.md'),
    join(PLATFORM_DOCS, 'AI_INCIDENT_PLAYBOOK_DATA_POISONING.md'),
    join(PLATFORM_DOCS, 'AI_INCIDENT_PLAYBOOK_MODEL_DRIFT_COMPROMISE.md'),
    join(PLATFORM_DOCS, 'AI_INCIDENT_PLAYBOOK_MODEL_INVERSION.md'),
    join(PLATFORM_DOCS, 'AI_INCIDENT_PLAYBOOK_ADVERSARIAL_INPUTS.md'),
    join(PLATFORM_DOCS, 'AI_INCIDENT_PLAYBOOK_HALLUCINATION.md'),
    join(PLATFORM_DOCS, 'AI_INCIDENT_PLAYBOOK_POST_QUANTUM_MIGRATION.md'),
    join(PLATFORM_DOCS, 'AI_INCIDENT_PLAYBOOK_DEPENDENCY_CONFUSION.md'),
    join(PLATFORM_DOCS, 'AI_INCIDENT_DRILL_RUNBOOK.md'),
  ]
  const missing = required.filter((p) => !existsSync(p))
  if (missing.length > 0) {
    throw new Error(`Missing AI incident playbooks: ${missing.map((p) => p.replace(ROOT + '/', '')).join(', ')}`)
  }
  return `${required.length} AI incident playbooks verified`
})

check('GOV-GATE-014: Strategic telemetry and command catalog exist', () => {
  const required = [
    join(PLATFORM_DOCS, 'STRATEGIC_TELEMETRY.md'),
    join(PLATFORM_DOCS, 'COMMAND_CATALOG.md'),
    join(ROOT, 'tooling', 'scripts', 'generate-quarterly-strategic-scorecard.mjs'),
    join(ROOT, 'tooling', 'scripts', 'show-command-catalog.mjs'),
  ]
  const missing = required.filter((p) => !existsSync(p))
  if (missing.length > 0) {
    throw new Error(`Missing telemetry/catalog artifacts: ${missing.map((p) => p.replace(ROOT + '/', '')).join(', ')}`)
  }
  return `${required.length} telemetry/catalog artifacts verified`
})

check('GOV-GATE-015: Onboarding guide exists', () => {
  const path = join(PLATFORM_DOCS, 'ONBOARDING.md')
  if (!existsSync(path)) throw new Error(`${path} not found`)
  const content = readFileSync(path, 'utf-8')
  const required = ['## Prerequisites', '## Making Your First PR', '## Common First-Week Pitfalls']
  const missing = required.filter((h) => !content.includes(h))
  if (missing.length > 0) throw new Error(`Onboarding guide missing sections: ${missing.join(', ')}`)
  return 'Onboarding guide present with required sections'
})

check('GOV-GATE-016: SLO policy, data residency, and alerting runbook exist', () => {
  const required = [
    join(PLATFORM_DOCS, 'SLO_ERROR_BUDGET_POLICY.md'),
    join(PLATFORM_DOCS, 'DATA_RESIDENCY_POLICY.md'),
    join(PLATFORM_DOCS, 'ALERTING_RUNBOOK.md'),
  ]
  const missing = required.filter((p) => !existsSync(p))
  if (missing.length > 0) {
    throw new Error(`Missing operational docs: ${missing.map((p) => p.replace(ROOT + '/', '')).join(', ')}`)
  }
  // Validate alerting runbook has alert IDs
  const runbook = readFileSync(required[2], 'utf-8')
  if (!runbook.includes('ALERT-SLO-001')) throw new Error('ALERTING_RUNBOOK.md missing ALERT-SLO-001')
  return `${required.length} operational docs verified`
})

check('GOV-GATE-017: DORA and cost attribution outputs exist', () => {
  const required = [
    join(ROOT, 'ops', 'outputs', 'dora-metrics.json'),
    join(ROOT, 'ops', 'outputs', 'cost-allocation.json'),
    join(ROOT, 'tooling', 'scripts', 'collect-dora-metrics.mjs'),
    join(ROOT, 'tooling', 'scripts', 'collect-cost-attribution.mjs'),
  ]
  const missing = required.filter((p) => !existsSync(p))
  if (missing.length > 0) {
    throw new Error(`Missing DORA/cost artifacts: ${missing.map((p) => p.replace(ROOT + '/', '')).join(', ')}`)
  }
  const dora = JSON.parse(readFileSync(required[0], 'utf-8'))
  if (!dora.metrics?.deployment_frequency) throw new Error('dora-metrics.json missing deployment_frequency')
  if (!dora.metrics?.predictive_signal) throw new Error('dora-metrics.json missing predictive_signal')

  const cost = JSON.parse(readFileSync(required[1], 'utf-8'))
  if (typeof cost.data_source !== 'string') throw new Error('cost-allocation.json missing data_source')
  if (typeof cost.unresolved_app_count !== 'number') {
    throw new Error('cost-allocation.json missing unresolved_app_count')
  }

  const doraCollector = readFileSync(required[2], 'utf-8')
  if (!doraCollector.includes('DORA_ENFORCE_THRESHOLDS') || !doraCollector.includes('--enforce')) {
    throw new Error('collect-dora-metrics.mjs missing threshold enforcement controls')
  }
  const costCollector = readFileSync(required[3], 'utf-8')
  if (!costCollector.includes('COST_ENFORCE_REAL_DATA') || !costCollector.includes('--enforce-real-data')) {
    throw new Error('collect-cost-attribution.mjs missing real-data enforcement controls')
  }

  return 'DORA + cost attribution pipeline verified with enforcement controls'
})

check('GOV-GATE-018: Container seccomp profile exists', () => {
  const path = join(ROOT, 'security', 'runtime', 'seccomp-default.json')
  if (!existsSync(path)) throw new Error('security/runtime/seccomp-default.json not found')
  const profile = JSON.parse(readFileSync(path, 'utf-8'))
  if (profile.defaultAction !== 'SCMP_ACT_ERRNO') {
    throw new Error('Seccomp profile defaultAction must be SCMP_ACT_ERRNO (deny-by-default)')
  }
  if (!Array.isArray(profile.syscalls) || profile.syscalls.length === 0) {
    throw new Error('Seccomp profile has no syscall allowlist')
  }
  // Verify docker-compose applies it
  const compose = readFileSync(join(ROOT, 'docker-compose.yml'), 'utf-8')
  const seccompCount = (compose.match(/seccomp:security\/runtime\/seccomp-default\.json/g) ?? []).length
  if (seccompCount < 5) throw new Error(`Expected seccomp on ≥5 services, found ${seccompCount}`)
  return `Seccomp profile verified (deny-by-default, ${profile.syscalls.length} allowlist entries, ${seccompCount} services)`
})

check('GOV-GATE-019: Third-party risk register exists', () => {
  const path = join(PLATFORM_DOCS, 'THIRD_PARTY_RISK_REGISTER.md')
  if (!existsSync(path)) throw new Error(`${path} not found`)
  const content = readFileSync(path, 'utf-8')
  const required = ['## Cloud Infrastructure', '## Supply Chain Controls', '## Vendor Incident Notification']
  const missing = required.filter((h) => !content.includes(h))
  if (missing.length > 0) throw new Error(`Risk register missing sections: ${missing.join(', ')}`)
  return 'Third-party risk register present with required sections'
})

check('GOV-GATE-020: Domain expertise map and turbo cache strategy exist', () => {
  const required = [
    join(PLATFORM_DOCS, 'DOMAIN_EXPERTISE_MAP.md'),
    join(PLATFORM_DOCS, 'TURBO_CACHE_STRATEGY.md'),
  ]
  const missing = required.filter((p) => !existsSync(p))
  if (missing.length > 0) {
    throw new Error(`Missing knowledge docs: ${missing.map((p) => p.replace(ROOT + '/', '')).join(', ')}`)
  }
  // Validate turbo.json has globalPassThroughEnv
  const turbo = JSON.parse(readFileSync(join(ROOT, 'turbo.json'), 'utf-8'))
  if (!Array.isArray(turbo.globalPassThroughEnv) || turbo.globalPassThroughEnv.length < 5) {
    throw new Error('turbo.json globalPassThroughEnv must list ≥5 platform-specific env vars')
  }
  return `Knowledge docs + turbo cache hardening verified (${turbo.globalPassThroughEnv.length} pass-through vars)`
})

check('GOV-GATE-021: Vendor diversification strategy and registry exist', () => {
  const required = [
    join(PLATFORM_DOCS, 'VENDOR_DIVERSIFICATION_STRATEGY.md'),
    join(RESILIENCE_DIR, 'vendor-diversification-registry.json'),
  ]
  const missing = required.filter((p) => !existsSync(p))
  if (missing.length > 0) {
    throw new Error(`Missing vendor diversification artifacts: ${missing.map((p) => p.replace(ROOT + '/', '')).join(', ')}`)
  }
  const registry = JSON.parse(readFileSync(required[1], 'utf-8')) as {
    capabilities?: Array<{ name?: string; secondary_provider?: string }>
  }
  const capabilities = Array.isArray(registry.capabilities) ? registry.capabilities : []
  if (capabilities.length < 3) throw new Error('Vendor diversification registry must list at least 3 capabilities')
  const missingSecondary = capabilities
    .filter((c) => !c.secondary_provider)
    .map((c) => c.name ?? 'unknown')
  if (missingSecondary.length > 0) {
    throw new Error(`Capabilities missing secondary_provider: ${missingSecondary.join(', ')}`)
  }
  return `Vendor diversification verified across ${capabilities.length} capabilities`
})

check('GOV-GATE-022: Emerging threat model covers hallucination, quantum, and dependency confusion', () => {
  const required = [
    join(PLATFORM_DOCS, 'EMERGING_THREAT_MODEL.md'),
    join(RESILIENCE_DIR, 'emerging-threat-register.json'),
  ]
  const missing = required.filter((p) => !existsSync(p))
  if (missing.length > 0) {
    throw new Error(`Missing emerging threat artifacts: ${missing.map((p) => p.replace(ROOT + '/', '')).join(', ')}`)
  }
  const register = JSON.parse(readFileSync(required[1], 'utf-8')) as {
    threats?: Array<{ id?: string }>
  }
  const ids = new Set((register.threats ?? []).map((t) => t.id))
  const expected = ['THREAT-AI-HALLUCINATION', 'THREAT-QUANTUM-CRYPTO', 'THREAT-DEPENDENCY-CONFUSION']
  const missingIds = expected.filter((id) => !ids.has(id))
  if (missingIds.length > 0) {
    throw new Error(`Emerging threat register missing: ${missingIds.join(', ')}`)
  }
  return 'Emerging threat model includes required future-risk categories'
})

check('GOV-GATE-023: Runtime data residency verifier exists', () => {
  const required = [
    join(ROOT, 'tooling', 'scripts', 'verify-data-residency-runtime.mjs'),
    join(PLATFORM_DOCS, 'DATA_RESIDENCY_POLICY.md'),
  ]
  const missing = required.filter((p) => !existsSync(p))
  if (missing.length > 0) {
    throw new Error(`Missing residency enforcement artifacts: ${missing.map((p) => p.replace(ROOT + '/', '')).join(', ')}`)
  }
  const script = readFileSync(required[0], 'utf-8')
  if (!script.includes('--enforce') || !script.includes('RESIDENCY_ALLOWED_REGIONS')) {
    throw new Error('verify-data-residency-runtime.mjs must support enforce mode and allowed-region controls')
  }
  return 'Runtime data residency verifier is present and configurable'
})

check('GOV-GATE-024: Human-factor resilience automation exists', () => {
  const required = [
    join(ROOT, 'tooling', 'scripts', 'collect-onboarding-kpis.mjs'),
    join(RESILIENCE_DIR, 'succession-and-cross-training.json'),
  ]
  const missing = required.filter((p) => !existsSync(p))
  if (missing.length > 0) {
    throw new Error(`Missing human-factor resilience artifacts: ${missing.map((p) => p.replace(ROOT + '/', '')).join(', ')}`)
  }
  const succession = JSON.parse(readFileSync(required[1], 'utf-8')) as {
    domains?: Array<{
      domain?: string
      mandatory_cross_training_hours_per_quarter?: number
      succession_backup_count?: number
    }>
  }
  if (!Array.isArray(succession.domains) || succession.domains.length < 5) {
    throw new Error('succession-and-cross-training.json must include at least 5 domains')
  }
  const missingTargets = succession.domains
    .filter((d) => d.mandatory_cross_training_hours_per_quarter == null || d.succession_backup_count == null)
    .map((d) => d.domain ?? 'unknown')
  if (missingTargets.length > 0) {
    throw new Error(`Domains missing cross-training/succession targets: ${missingTargets.join(', ')}`)
  }
  return `Human-factor resilience targets verified for ${succession.domains.length} domains`
})

check('GOV-GATE-025: Regulatory monitoring artifacts exist', () => {
  const required = [
    join(PLATFORM_DOCS, 'REGULATORY_CHANGE_MONITORING.md'),
    join(RESILIENCE_DIR, 'regulatory-watchlist.json'),
    join(ROOT, 'tooling', 'scripts', 'validate-strategic-resilience.mjs'),
  ]
  const missing = required.filter((p) => !existsSync(p))
  if (missing.length > 0) {
    throw new Error(`Missing regulatory monitoring artifacts: ${missing.map((p) => p.replace(ROOT + '/', '')).join(', ')}`)
  }
  const watchlist = JSON.parse(readFileSync(required[1], 'utf-8'))
  const entries = Array.isArray(watchlist.watchlist) ? watchlist.watchlist : []
  if (entries.length < 5) throw new Error('regulatory-watchlist.json must include at least 5 tracked regulations')
  return `Regulatory monitoring verified across ${entries.length} tracked regulations`
})

check('GOV-GATE-026: Disaster recovery region-loss playbook exists', () => {
  const path = join(PLATFORM_DOCS, 'DISASTER_RECOVERY_PLAYBOOK_AZURE_REGION_LOSS.md')
  if (!existsSync(path)) {
    throw new Error(`${path} not found`)
  }
  const content = readFileSync(path, 'utf-8')
  const required = ['## Trigger Conditions', '## Containment and Failover', '## Recovery']
  const missing = required.filter((h) => !content.includes(h))
  if (missing.length > 0) {
    throw new Error(`Region-loss DR playbook missing sections: ${missing.join(', ')}`)
  }
  return 'Region-loss disaster recovery playbook verified'
})

check('GOV-GATE-027: Governance runtime budget guardrail exists', () => {
  const path = join(ROOT, 'tooling', 'scripts', 'check-governance-runtime-budget.mjs')
  if (!existsSync(path)) {
    throw new Error('tooling/scripts/check-governance-runtime-budget.mjs not found')
  }
  const content = readFileSync(path, 'utf-8')
  if (!content.includes('GOVERNANCE_MAX_RUNTIME_MINUTES') || !content.includes('--enforce')) {
    throw new Error('Runtime budget script must support max-runtime env and enforce mode')
  }
  return 'Governance runtime budget guardrail script verified'
})

// ── Helper ──────────────────────────────────────────────────────────────────

function findTestFiles(dir: string): string[] {
  const { readdirSync } = require('node:fs') as typeof import('node:fs')
  const results: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && !['node_modules', 'dist'].includes(entry.name)) {
      results.push(...findTestFiles(join(dir, entry.name)))
    } else if (entry.name.endsWith('.test.ts')) {
      results.push(join(dir, entry.name))
    }
  }
  return results
}

// ── Output ──────────────────────────────────────────────────────────────────

const passed = results.filter(r => r.status === 'pass')
const failed = results.filter(r => r.status === 'fail')

console.log('\n╔══════════════════════════════════════════════════════════════╗')
console.log('║           GOVERNANCE FAIL-CLOSED GATE REPORT               ║')
console.log('╚══════════════════════════════════════════════════════════════╝\n')

for (const r of results) {
  const icon = r.status === 'pass' ? '✅' : '❌'
  console.log(`  ${icon}  ${r.name}`)
  console.log(`      ${r.detail}\n`)
}

console.log('─'.repeat(62))
console.log(`  Total: ${results.length}  |  Passed: ${passed.length}  |  Failed: ${failed.length}`)
console.log('─'.repeat(62))

// Write machine-readable report
const reportDir = join(ROOT, 'ops', 'outputs')
if (!existsSync(reportDir)) mkdirSync(reportDir, { recursive: true })
const reportPath = join(reportDir, 'governance-gate-report.json')
writeFileSync(
  reportPath,
  JSON.stringify({
    timestamp: new Date().toISOString(),
    total: results.length,
    passed: passed.length,
    failed: failed.length,
    checks: results,
  }, null, 2),
)
console.log(`\n  Report written to: ops/outputs/governance-gate-report.json`)

if (failed.length > 0) {
  console.error('\n❌ GOVERNANCE GATE FAILED — deployment blocked.\n')
  process.exit(1)
}

console.log('\n✅ GOVERNANCE GATE PASSED — all checks clean.\n')
