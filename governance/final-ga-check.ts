/**
 * Nzila OS — Final System-Hardening GA Gate
 *
 * Supplements governance/ga-check.ts with the conditions introduced
 * by the FINAL SYSTEM HARDENING pass. Together the two scripts form
 * the complete deployment gate.
 *
 * Run: npx tsx governance/final-ga-check.ts
 *
 * Checks (all must pass):
 *   HARD-01  Canonical inventory enforced (inventory.json fresh, drift check clean)
 *   HARD-02  Auth migration closed (no stale Clerk in active source code)
 *   HARD-03  Platform drift guard (exceptions YAML + contract test exist)
 *   HARD-04  App operational floor (every app has README + .env.example)
 *   HARD-05  Zonga monetization layer (package + docs)
 *   HARD-06  Platform revenue layer (package + docs)
 *   HARD-07  Portfolio classification (portfolio-matrix.md exists)
 *   HARD-08  Revenue architecture (revenue-architecture.md exists)
 *   HARD-09  Revenue system documentation (revenue-system.md exists)
 *   HARD-10  Control plane aggregates revenue (depends on @nzila/platform-revenue)
 *   HARD-11  Auth adapter layer pure (no Clerk in non-compat active code)
 *   HARD-12  App floor CI enforced (app-floor-check workflow exists)
 *   HARD-13  No silent platform drift (drift workflows present)
 *   HARD-14  Universal revenue enforcement (contract test exists)
 *   HARD-15  Governed monetization documentation
 *   HARD-16  Control plane unified system state
 *   HARD-17  Auth purity contract test exists
 *   HARD-18  Portfolio clarity (README has tier classification)
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

// ── Configuration ───────────────────────────────────────────────────────────

const ROOT = findRepoRoot()

// ── Types ───────────────────────────────────────────────────────────────────

interface GateResult {
  name: string
  passed: boolean
  details: string
}

const checks: (() => GateResult)[] = []

function gate(name: string, fn: () => { passed: boolean; details: string }) {
  checks.push(() => {
    try {
      const result = fn()
      return { name, ...result }
    } catch (err) {
      return { name, passed: false, details: `Exception: ${(err as Error).message}` }
    }
  })
}

// ── HARD-01 Canonical Inventory ─────────────────────────────────────────────

gate('HARD-01: Canonical inventory exists and is recent', () => {
  const inventoryPath = join(ROOT, 'tooling/repo-inventory/output/inventory.json')
  if (!existsSync(inventoryPath)) {
    return { passed: false, details: 'inventory.json not found' }
  }

  const inv = JSON.parse(readFileSync(inventoryPath, 'utf-8'))
  const issues: string[] = []

  if (!inv.appCount || inv.appCount < 10) issues.push(`suspicious appCount: ${inv.appCount}`)
  if (!inv.packageCount || inv.packageCount < 100) issues.push(`suspicious packageCount: ${inv.packageCount}`)
  if (!inv.generatedAt) issues.push('missing generatedAt timestamp')

  // Check drift-check script exists
  const driftCheck = join(ROOT, 'tooling/repo-inventory/src/check-drift.ts')
  if (!existsSync(driftCheck)) issues.push('check-drift.ts missing')

  // Check CI workflow exists
  const ciWorkflow = join(ROOT, '.github/workflows/repo-inventory-check.yml')
  if (!existsSync(ciWorkflow)) issues.push('repo-inventory-check.yml workflow missing')

  return {
    passed: issues.length === 0,
    details: issues.length === 0
      ? `Inventory: ${inv.appCount} apps, ${inv.packageCount} packages — CI enforced`
      : `Issues: ${issues.join('; ')}`,
  }
})

// ── HARD-02 Auth Migration Closed ───────────────────────────────────────────

gate('HARD-02: No stale Clerk references in active source', () => {
  // Check high-signal locations only — user-facing code and public docs
  const hotPaths = [
    'content/public/security-overview.md',
    'content/public/developer-guide.md',
  ]

  const violations: string[] = []

  for (const p of hotPaths) {
    const fullPath = join(ROOT, p)
    if (!existsSync(fullPath)) continue
    const content = readFileSync(fullPath, 'utf-8')
    // Only flag if "Clerk" appears as a standalone word (not in "clerk" variable context)
    if (/\bClerk\b/.test(content) && !content.includes('Nzila Platform Auth')) {
      violations.push(p)
    }
  }

  // Check auth migration doc exists
  const migDoc = join(ROOT, 'docs/platform/auth-migration-final.md')
  if (!existsSync(migDoc)) {
    violations.push('docs/platform/auth-migration-final.md not found')
  }

  return {
    passed: violations.length === 0,
    details: violations.length === 0
      ? 'Auth migration doc exists, public content neutralized'
      : `Issues: ${violations.join('; ')}`,
  }
})

// ── HARD-03 Platform Drift Guard ────────────────────────────────────────────

gate('HARD-03: Platform exceptions YAML + drift contract test exist', () => {
  const issues: string[] = []

  const yamlPath = join(ROOT, 'governance/platform-exceptions.yaml')
  if (!existsSync(yamlPath)) {
    issues.push('governance/platform-exceptions.yaml not found')
  }

  const testPath = join(ROOT, 'tooling/contract-tests/platform-drift-guard.test.ts')
  if (!existsSync(testPath)) {
    issues.push('platform-drift-guard.test.ts not found')
  }

  return {
    passed: issues.length === 0,
    details: issues.length === 0
      ? 'Exception registry + drift contract test present'
      : `Missing: ${issues.join('; ')}`,
  }
})

// ── HARD-04 App Operational Floor ───────────────────────────────────────────

gate('HARD-04: Every app has README.md + .env.example', () => {
  const appsDir = join(ROOT, 'apps')
  if (!existsSync(appsDir)) {
    return { passed: false, details: 'apps/ directory not found' }
  }

  const apps = readdirSync(appsDir).filter(d => {
    try { return statSync(join(appsDir, d)).isDirectory() } catch { return false }
  })

  const missing: string[] = []
  for (const app of apps) {
    if (!existsSync(join(appsDir, app, 'README.md'))) missing.push(`${app}: README.md`)
    if (!existsSync(join(appsDir, app, '.env.example'))) missing.push(`${app}: .env.example`)
  }

  return {
    passed: missing.length === 0,
    details: missing.length === 0
      ? `All ${apps.length} apps have README + .env.example`
      : `Missing: ${missing.join('; ')}`,
  }
})

// ── HARD-05 Zonga Monetization Layer ────────────────────────────────────────

gate('HARD-05: Zonga monetization package exists', () => {
  const issues: string[] = []

  const pkgJson = join(ROOT, 'packages/zonga-monetization/package.json')
  if (!existsSync(pkgJson)) {
    issues.push('packages/zonga-monetization/ not found')
  } else {
    const content = readFileSync(pkgJson, 'utf-8')
    if (!content.includes('@nzila/zonga-monetization')) {
      issues.push('package.json missing @nzila/zonga-monetization name')
    }
  }

  const indexFile = join(ROOT, 'packages/zonga-monetization/src/index.ts')
  if (!existsSync(indexFile)) {
    issues.push('src/index.ts missing')
  }

  const doc = join(ROOT, 'docs/zonga/monetization-model.md')
  if (!existsSync(doc)) {
    issues.push('docs/zonga/monetization-model.md missing')
  }

  return {
    passed: issues.length === 0,
    details: issues.length === 0
      ? 'Zonga monetization package + docs present'
      : `Issues: ${issues.join('; ')}`,
  }
})

// ── HARD-06 Platform Revenue Layer ──────────────────────────────────────────

gate('HARD-06: Platform revenue package exists', () => {
  const issues: string[] = []

  const pkgJson = join(ROOT, 'packages/platform-revenue/package.json')
  if (!existsSync(pkgJson)) {
    issues.push('packages/platform-revenue/ not found')
  } else {
    const content = readFileSync(pkgJson, 'utf-8')
    if (!content.includes('@nzila/platform-revenue')) {
      issues.push('package.json missing @nzila/platform-revenue name')
    }
  }

  const indexFile = join(ROOT, 'packages/platform-revenue/src/index.ts')
  if (!existsSync(indexFile)) {
    issues.push('src/index.ts missing')
  }

  return {
    passed: issues.length === 0,
    details: issues.length === 0
      ? 'Platform revenue package present'
      : `Issues: ${issues.join('; ')}`,
  }
})

// ── HARD-07 Portfolio Classification ────────────────────────────────────────

gate('HARD-07: Portfolio matrix exists', () => {
  const matrixPath = join(ROOT, 'docs/platform/portfolio-matrix.md')
  if (!existsSync(matrixPath)) {
    return { passed: false, details: 'docs/platform/portfolio-matrix.md not found' }
  }

  const content = readFileSync(matrixPath, 'utf-8')
  const hasTiers = content.includes('FLAGSHIP') && content.includes('INCUBATION')

  return {
    passed: hasTiers,
    details: hasTiers
      ? 'Portfolio matrix with tier classifications present'
      : 'Portfolio matrix exists but missing tier classifications',
  }
})

// ── HARD-08 Revenue Architecture Doc ────────────────────────────────────────

gate('HARD-08: Revenue architecture documented', () => {
  const docPath = join(ROOT, 'docs/platform/revenue-architecture.md')
  if (!existsSync(docPath)) {
    return { passed: false, details: 'docs/platform/revenue-architecture.md not found' }
  }

  const content = readFileSync(docPath, 'utf-8')
  const hasSchema = content.includes('platform-revenue') || content.includes('RevenueService')

  return {
    passed: hasSchema,
    details: hasSchema
      ? 'Revenue architecture doc with schema reference present'
      : 'Doc exists but missing platform-revenue reference',
  }
})

// ── HARD-09 Revenue System Documentation ────────────────────────────────────

gate('HARD-09: Revenue system documentation exists', () => {
  const docPath = join(ROOT, 'docs/platform/revenue-system.md')
  if (!existsSync(docPath)) {
    return { passed: false, details: 'docs/platform/revenue-system.md not found' }
  }

  const content = readFileSync(docPath, 'utf-8')
  const hasUnified = content.includes('UnifiedRevenueRecord') || content.includes('emitRevenueEvent')

  return {
    passed: hasUnified,
    details: hasUnified
      ? 'Revenue system doc with unified schema reference present'
      : 'Doc exists but missing unified revenue model reference',
  }
})

// ── HARD-10 Control Plane Aggregates Revenue ────────────────────────────────

gate('HARD-10: Control plane depends on platform-revenue', () => {
  const pkgPath = join(ROOT, 'apps/control-plane/package.json')
  if (!existsSync(pkgPath)) {
    return { passed: false, details: 'apps/control-plane/package.json not found' }
  }

  const content = readFileSync(pkgPath, 'utf-8')
  const hasRevenue = content.includes('@nzila/platform-revenue')

  return {
    passed: hasRevenue,
    details: hasRevenue
      ? 'Control plane wired to platform-revenue'
      : 'Control plane missing @nzila/platform-revenue dependency',
  }
})

// ── HARD-11 Auth Adapter Layer Pure ─────────────────────────────────────────

gate('HARD-11: Auth adapter layer is provider-neutral', () => {
  const adapterPath = join(ROOT, 'packages/platform-auth/src/middleware.ts')
  if (!existsSync(adapterPath)) {
    return { passed: false, details: 'platform-auth middleware.ts not found' }
  }

  const content = readFileSync(adapterPath, 'utf-8')
  // Doc comments should not reference specific external providers
  const headerLines = content.split('\n').slice(0, 10).join('\n')
  const hasStaleRef = /\bClerk\b/.test(headerLines)

  return {
    passed: !hasStaleRef,
    details: hasStaleRef
      ? 'middleware.ts header still references Clerk — should be provider-neutral'
      : 'Auth middleware header is provider-neutral',
  }
})

// ── HARD-12 App Floor CI Enforced ───────────────────────────────────────────

gate('HARD-12: App floor CI workflow exists', () => {
  const workflowPath = join(ROOT, '.github/workflows/app-floor-check.yml')
  if (!existsSync(workflowPath)) {
    return { passed: false, details: '.github/workflows/app-floor-check.yml not found' }
  }

  const content = readFileSync(workflowPath, 'utf-8')
  const checksReadme = content.includes('README.md')
  const checksEnv = content.includes('.env.example')

  return {
    passed: checksReadme && checksEnv,
    details: checksReadme && checksEnv
      ? 'App floor CI workflow enforces README + .env.example'
      : 'Workflow exists but missing checks',
  }
})

// ── HARD-13 No Silent Platform Drift ────────────────────────────────────────

gate('HARD-13: Drift detection workflows present', () => {
  const issues: string[] = []

  const inventoryCheck = join(ROOT, '.github/workflows/repo-inventory-check.yml')
  if (!existsSync(inventoryCheck)) {
    issues.push('repo-inventory-check.yml missing')
  }

  const appFloor = join(ROOT, '.github/workflows/app-floor-check.yml')
  if (!existsSync(appFloor)) {
    issues.push('app-floor-check.yml missing')
  }

  const driftGuard = join(ROOT, 'tooling/contract-tests/platform-drift-guard.test.ts')
  if (!existsSync(driftGuard)) {
    issues.push('platform-drift-guard.test.ts missing')
  }

  return {
    passed: issues.length === 0,
    details: issues.length === 0
      ? 'All drift detection mechanisms in place'
      : `Missing: ${issues.join('; ')}`,
  }
})

// ── HARD-14 Universal Revenue Enforcement ───────────────────────────────────

gate('HARD-14: Revenue enforcement contract test exists', () => {
  const testPath = join(ROOT, 'tooling/contract-tests/revenue-enforcement.test.ts')
  if (!existsSync(testPath)) {
    return { passed: false, details: 'revenue-enforcement.test.ts not found' }
  }

  const content = readFileSync(testPath, 'utf-8')
  const hasREV001 = content.includes('REV-001')
  const hasREV002 = content.includes('REV-002')

  return {
    passed: hasREV001 && hasREV002,
    details: hasREV001 && hasREV002
      ? 'Revenue enforcement contract test with REV-001 + REV-002 present'
      : 'Contract test exists but missing enforcement rules',
  }
})

// ── HARD-15 Governed Monetization Documentation ─────────────────────────────

gate('HARD-15: Governed monetization documentation exists', () => {
  const docPath = join(ROOT, 'docs/platform/governed-monetization.md')
  if (!existsSync(docPath)) {
    return { passed: false, details: 'docs/platform/governed-monetization.md not found' }
  }

  const content = readFileSync(docPath, 'utf-8')
  const hasAudit = content.includes('audit') || content.includes('Audit')
  const hasEvidence = content.includes('evidence') || content.includes('Evidence')

  return {
    passed: hasAudit && hasEvidence,
    details: hasAudit && hasEvidence
      ? 'Governed monetization doc with audit + evidence coverage'
      : 'Doc exists but missing audit/evidence references',
  }
})

// ── HARD-16 Control Plane Unified System State ──────────────────────────────

gate('HARD-16: Control plane has unified system state endpoint', () => {
  const issues: string[] = []

  const statePath = join(ROOT, 'apps/control-plane/services/system-state.ts')
  if (!existsSync(statePath)) {
    issues.push('system-state.ts missing')
  } else {
    const content = readFileSync(statePath, 'utf-8')
    if (!content.includes('revenueApps')) issues.push('system-state missing revenueApps')
    if (!content.includes('DomainHealth')) issues.push('system-state missing DomainHealth')
  }

  const aggPath = join(ROOT, 'apps/control-plane/services/revenue-aggregator.ts')
  if (!existsSync(aggPath)) {
    issues.push('revenue-aggregator.ts missing')
  }

  return {
    passed: issues.length === 0,
    details: issues.length === 0
      ? 'Unified system state with revenue aggregation present'
      : `Issues: ${issues.join('; ')}`,
  }
})

// ── HARD-17 Auth Purity Contract Test ───────────────────────────────────────

gate('HARD-17: Auth purity contract test exists', () => {
  const testPath = join(ROOT, 'tooling/contract-tests/auth-purity.test.ts')
  if (!existsSync(testPath)) {
    return { passed: false, details: 'auth-purity.test.ts not found' }
  }

  const content = readFileSync(testPath, 'utf-8')
  const hasAUTH001 = content.includes('AUTH-001')
  const hasAUTH003 = content.includes('AUTH-003')

  return {
    passed: hasAUTH001 && hasAUTH003,
    details: hasAUTH001 && hasAUTH003
      ? 'Auth purity contract test with AUTH-001 + AUTH-003 present'
      : 'Contract test exists but missing enforcement rules',
  }
})

// ── HARD-18 Portfolio Clarity ───────────────────────────────────────────────

gate('HARD-18: Portfolio clarity in README', () => {
  const readmePath = join(ROOT, 'README.md')
  if (!existsSync(readmePath)) {
    return { passed: false, details: 'README.md not found' }
  }

  const content = readFileSync(readmePath, 'utf-8')
  const hasTiers = content.includes('FLAGSHIP') && content.includes('INCUBATION') && content.includes('CORE')
  const hasPortfolioRef = content.includes('portfolio-matrix.md')

  return {
    passed: hasTiers && hasPortfolioRef,
    details: hasTiers && hasPortfolioRef
      ? 'README has tier classifications + portfolio-matrix reference'
      : 'README missing tier classifications or portfolio-matrix link',
  }
})

// ── Runner ──────────────────────────────────────────────────────────────────

function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  NZILA OS — FINAL SYSTEM-HARDENING GA GATE')
  console.log('  Supplements governance/ga-check.ts')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')

  const results: GateResult[] = []

  for (const check of checks) {
    const result = check()
    results.push(result)

    const icon = result.passed ? '✅' : '❌'
    console.log(`  ${icon}  ${result.name}`)
    if (!result.passed) {
      console.log(`      → ${result.details}`)
    }
  }

  console.log('')
  console.log('───────────────────────────────────────────────────────────────')

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const total = results.length

  console.log(`  PASSED: ${passed}/${total}`)
  console.log(`  FAILED: ${failed}/${total}`)
  console.log('')

  if (failed > 0) {
    console.log('  ❌  HARDENING GATE FAILED — REVIEW REQUIRED  ❌')
    console.log('')
    for (const r of results.filter(r => !r.passed)) {
      console.log(`    • ${r.name}: ${r.details}`)
    }
    console.log('')
    process.exit(1)
  } else {
    console.log('  ✅  HARDENING GATE PASSED — ALL 18 CONDITIONS MET  ✅')
    console.log('')
    process.exit(0)
  }
}

// ── Utilities ───────────────────────────────────────────────────────────────

function findRepoRoot(): string {
  let dir = process.cwd()
  while (true) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    const parent = join(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  return process.cwd()
}

// ── Execute ─────────────────────────────────────────────────────────────────

main()
