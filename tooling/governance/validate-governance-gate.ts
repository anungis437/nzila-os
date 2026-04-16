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
  const policyPath = join(ROOT, 'docs', 'platform', 'EVIDENCE_LIFECYCLE_POLICY.md')
  if (!existsSync(policyPath)) {
    throw new Error('docs/platform/EVIDENCE_LIFECYCLE_POLICY.md not found')
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
    join(ROOT, 'docs', 'platform', 'AI_INCIDENT_PLAYBOOK_PROMPT_INJECTION.md'),
    join(ROOT, 'docs', 'platform', 'AI_INCIDENT_PLAYBOOK_DATA_POISONING.md'),
    join(ROOT, 'docs', 'platform', 'AI_INCIDENT_PLAYBOOK_MODEL_DRIFT_COMPROMISE.md'),
    join(ROOT, 'docs', 'platform', 'AI_INCIDENT_PLAYBOOK_MODEL_INVERSION.md'),
    join(ROOT, 'docs', 'platform', 'AI_INCIDENT_PLAYBOOK_ADVERSARIAL_INPUTS.md'),
    join(ROOT, 'docs', 'platform', 'AI_INCIDENT_DRILL_RUNBOOK.md'),
  ]
  const missing = required.filter((p) => !existsSync(p))
  if (missing.length > 0) {
    throw new Error(`Missing AI incident playbooks: ${missing.map((p) => p.replace(ROOT + '/', '')).join(', ')}`)
  }
  return `${required.length} AI incident playbooks verified`
})

check('GOV-GATE-014: Strategic telemetry and command catalog exist', () => {
  const required = [
    join(ROOT, 'docs', 'platform', 'STRATEGIC_TELEMETRY.md'),
    join(ROOT, 'docs', 'platform', 'COMMAND_CATALOG.md'),
    join(ROOT, 'tooling', 'scripts', 'generate-quarterly-strategic-scorecard.mjs'),
    join(ROOT, 'tooling', 'scripts', 'show-command-catalog.mjs'),
  ]
  const missing = required.filter((p) => !existsSync(p))
  if (missing.length > 0) {
    throw new Error(`Missing telemetry/catalog artifacts: ${missing.map((p) => p.replace(ROOT + '/', '')).join(', ')}`)
  }
  return `${required.length} telemetry/catalog artifacts verified`
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
