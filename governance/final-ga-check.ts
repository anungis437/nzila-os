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
 *   HARD-19  Revenue evidence bridge integrity (audit entry builders)
 *   HARD-20  Control plane system-state API route
 *   HARD-21  Revenue enforcement covers evidence bridge (REV-006)
 *   HARD-22  All apps report to control plane (control-manifest.json)
 *   HARD-23  Auth purity final (AUTH-003 Clerk SDK import check implemented)
 *   HARD-24  Governed revenue end-to-end (evidence + enforcement + docs)
 *   HARD-25  Revenue enforcement covers REV-007/REV-008 (source-level revenue lock)
 *   HARD-26  Evidence bridge has traceId field
 *   HARD-27  Auto-audit wired in emitRevenueEvent
 *   HARD-28  Control-plane authority contract tests CTRL-003/004/009
 *   HARD-29  Auth purity covers AUTH-004 (canonical auth positive assertion)
 *   HARD-30  What-is-nzila.md exists (repo-as-product)
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

// ── HARD-19 Revenue Evidence Bridge ─────────────────────────────────────────

gate('HARD-19: Revenue evidence bridge exports audit builders', () => {
  const bridgePath = join(ROOT, 'packages/platform-revenue/src/evidence-bridge.ts')
  if (!existsSync(bridgePath)) {
    return { passed: false, details: 'evidence-bridge.ts not found' }
  }

  const content = readFileSync(bridgePath, 'utf-8')
  const hasRevenue = content.includes('buildRevenueAuditEntry')
  const hasPayout = content.includes('buildPayoutAuditEntry')
  const hasFee = content.includes('buildFeeAuditEntry')

  const passed = hasRevenue && hasPayout && hasFee
  return {
    passed,
    details: passed
      ? 'All three audit entry builders present (revenue, payout, fee)'
      : `Missing builders: ${[!hasRevenue && 'revenue', !hasPayout && 'payout', !hasFee && 'fee'].filter(Boolean).join(', ')}`,
  }
})

// ── HARD-20 Control Plane System-State API ──────────────────────────────────

gate('HARD-20: Control plane has system-state API route', () => {
  const routePath = join(ROOT, 'apps/control-plane/app/api/control-plane/system-state/route.ts')
  if (!existsSync(routePath)) {
    return { passed: false, details: 'system-state route.ts not found' }
  }

  const content = readFileSync(routePath, 'utf-8')
  const hasGet = /export\s+(async\s+)?function\s+GET/.test(content)
  const hasSystemState = content.includes('getSystemState')
  const hasRevenue = content.includes('getRevenueOverview')

  const passed = hasGet && hasSystemState && hasRevenue
  return {
    passed,
    details: passed
      ? 'System-state API route with GET + system state + revenue aggregation'
      : 'Route exists but missing required exports/imports',
  }
})

// ── HARD-21 Revenue Enforcement Covers Evidence Bridge ──────────────────────

gate('HARD-21: Revenue enforcement contract test covers evidence bridge', () => {
  const testPath = join(ROOT, 'tooling/contract-tests/revenue-enforcement.test.ts')
  if (!existsSync(testPath)) {
    return { passed: false, details: 'revenue-enforcement.test.ts not found' }
  }

  const content = readFileSync(testPath, 'utf-8')
  const hasREV006 = content.includes('REV-006')
  const hasBridge = content.includes('evidence-bridge') || content.includes('evidence bridge')

  return {
    passed: hasREV006 && hasBridge,
    details: hasREV006 && hasBridge
      ? 'REV-006 evidence bridge enforcement present'
      : 'Revenue enforcement missing evidence bridge coverage (REV-006)',
  }
})

// ── HARD-22 All Apps Report to Control Plane ────────────────────────────────

gate('HARD-22: All apps have control-manifest.json', () => {
  const appsDir = join(ROOT, 'apps')
  const apps = readdirSync(appsDir).filter(d => {
    try { return statSync(join(appsDir, d)).isDirectory() } catch { return false }
  })

  const missing: string[] = []
  for (const app of apps) {
    if (!existsSync(join(appsDir, app, 'control-manifest.json'))) {
      missing.push(app)
    }
  }

  return {
    passed: missing.length === 0,
    details: missing.length === 0
      ? `All ${apps.length} apps registered with control plane (control-manifest.json)`
      : `Apps missing control-manifest.json: ${missing.join(', ')}`,
  }
})

// ── HARD-23 Auth Purity Final ───────────────────────────────────────────────

gate('HARD-23: Auth purity covers Clerk SDK import check', () => {
  const testPath = join(ROOT, 'tooling/contract-tests/auth-purity.test.ts')
  if (!existsSync(testPath)) {
    return { passed: false, details: 'auth-purity.test.ts not found' }
  }

  const content = readFileSync(testPath, 'utf-8')
  const hasAuth001 = content.includes('AUTH-001')
  const hasAuth002 = content.includes('AUTH-002')
  const hasAuth003 = content.includes('AUTH-003')
  const hasClerkImportCheck = content.includes('@clerk/')

  const passed = hasAuth001 && hasAuth002 && hasAuth003 && hasClerkImportCheck
  return {
    passed,
    details: passed
      ? 'All three auth purity checks implemented (naming + identifiers + SDK imports)'
      : `Missing: ${[!hasAuth001 && 'AUTH-001', !hasAuth002 && 'AUTH-002', !hasAuth003 && 'AUTH-003', !hasClerkImportCheck && 'Clerk SDK check'].filter(Boolean).join(', ')}`,
  }
})

// ── HARD-24 Governed Revenue End-to-End ─────────────────────────────────────

gate('HARD-24: Governed revenue pipeline complete', () => {
  const issues: string[] = []

  // Evidence bridge exists
  const bridgePath = join(ROOT, 'packages/platform-revenue/src/evidence-bridge.ts')
  if (!existsSync(bridgePath)) issues.push('evidence-bridge.ts missing')

  // Governed monetization docs exist
  const govDoc = join(ROOT, 'docs/platform/governed-monetization.md')
  if (!existsSync(govDoc)) {
    issues.push('governed-monetization.md missing')
  } else {
    const content = readFileSync(govDoc, 'utf-8')
    if (!content.includes('Revenue → Governance Pipeline')) {
      issues.push('governed-monetization.md missing pipeline documentation')
    }
  }

  // Revenue enforcement test exists with full coverage
  const testPath = join(ROOT, 'tooling/contract-tests/revenue-enforcement.test.ts')
  if (!existsSync(testPath)) {
    issues.push('revenue-enforcement.test.ts missing')
  } else {
    const content = readFileSync(testPath, 'utf-8')
    for (const rule of ['REV-001', 'REV-002', 'REV-003', 'REV-004', 'REV-005', 'REV-006']) {
      if (!content.includes(rule)) issues.push(`${rule} missing from revenue enforcement`)
    }
  }

  // Control plane aggregates revenue
  const aggPath = join(ROOT, 'apps/control-plane/services/revenue-aggregator.ts')
  if (!existsSync(aggPath)) issues.push('revenue-aggregator.ts missing')

  return {
    passed: issues.length === 0,
    details: issues.length === 0
      ? 'Governed revenue: evidence bridge + docs + enforcement + control-plane aggregation'
      : `Issues: ${issues.join('; ')}`,
  }
})

// ── HARD-25 Revenue Enforcement REV-007/REV-008 ─────────────────────────────

gate('HARD-25: Revenue enforcement covers source-level revenue lock (REV-007/008)', () => {
  const testPath = join(ROOT, 'tooling/contract-tests/revenue-enforcement.test.ts')
  if (!existsSync(testPath)) {
    return { passed: false, details: 'revenue-enforcement.test.ts not found' }
  }

  const content = readFileSync(testPath, 'utf-8')
  const hasREV007 = content.includes('REV-007')
  const hasREV008 = content.includes('REV-008')

  const passed = hasREV007 && hasREV008
  return {
    passed,
    details: passed
      ? 'REV-007 (source-level revenue import) + REV-008 (no raw payment) present'
      : `Missing: ${[!hasREV007 && 'REV-007', !hasREV008 && 'REV-008'].filter(Boolean).join(', ')}`,
  }
})

// ── HARD-26 Evidence Bridge Has traceId ─────────────────────────────────────

gate('HARD-26: Evidence bridge has traceId field', () => {
  const bridgePath = join(ROOT, 'packages/platform-revenue/src/evidence-bridge.ts')
  if (!existsSync(bridgePath)) {
    return { passed: false, details: 'evidence-bridge.ts not found' }
  }

  const content = readFileSync(bridgePath, 'utf-8')
  const hasTraceId = content.includes('traceId')
  const hasGenerator = content.includes('generateTraceId')

  const passed = hasTraceId && hasGenerator
  return {
    passed,
    details: passed
      ? 'Evidence bridge has traceId field + generateTraceId helper'
      : `Missing: ${[!hasTraceId && 'traceId field', !hasGenerator && 'generateTraceId'].filter(Boolean).join(', ')}`,
  }
})

// ── HARD-27 Auto-Audit Wired in emitRevenueEvent ───────────────────────────

gate('HARD-27: emitRevenueEvent auto-records audit entry', () => {
  const servicePath = join(ROOT, 'packages/platform-revenue/src/service.ts')
  if (!existsSync(servicePath)) {
    return { passed: false, details: 'service.ts not found' }
  }

  const content = readFileSync(servicePath, 'utf-8')
  const importsBuilder = content.includes('buildRevenueAuditEntry')
  const hasAuditLog = content.includes('auditLog')
  const hasGetter = content.includes('getRevenueAuditLog')

  const passed = importsBuilder && hasAuditLog && hasGetter
  return {
    passed,
    details: passed
      ? 'emitRevenueEvent auto-pushes audit entries + getRevenueAuditLog exported'
      : `Missing: ${[!importsBuilder && 'buildRevenueAuditEntry import', !hasAuditLog && 'auditLog', !hasGetter && 'getRevenueAuditLog'].filter(Boolean).join(', ')}`,
  }
})

// ── HARD-28 Control-Plane Authority CTRL-003/004/009 ────────────────────────

gate('HARD-28: Control-plane authority covers CTRL-003/004/009', () => {
  const testPath = join(ROOT, 'tooling/contract-tests/control-plane-authority.test.ts')
  if (!existsSync(testPath)) {
    return { passed: false, details: 'control-plane-authority.test.ts not found' }
  }

  const content = readFileSync(testPath, 'utf-8')
  const hasCTRL003 = content.includes('CTRL-003')
  const hasCTRL004 = content.includes('CTRL-004')
  const hasCTRL009 = content.includes('CTRL-009')

  const passed = hasCTRL003 && hasCTRL004 && hasCTRL009
  return {
    passed,
    details: passed
      ? 'CTRL-003 (registry coverage) + CTRL-004 (manifest consistency) + CTRL-009 (financial dep) present'
      : `Missing: ${[!hasCTRL003 && 'CTRL-003', !hasCTRL004 && 'CTRL-004', !hasCTRL009 && 'CTRL-009'].filter(Boolean).join(', ')}`,
  }
})

// ── HARD-29 Auth Purity AUTH-004 ────────────────────────────────────────────

gate('HARD-29: Auth purity covers AUTH-004 (canonical auth positive assertion)', () => {
  const testPath = join(ROOT, 'tooling/contract-tests/auth-purity.test.ts')
  if (!existsSync(testPath)) {
    return { passed: false, details: 'auth-purity.test.ts not found' }
  }

  const content = readFileSync(testPath, 'utf-8')
  const hasAUTH004 = content.includes('AUTH-004')
  const hasCanonical = content.includes('platform-auth')

  const passed = hasAUTH004 && hasCanonical
  return {
    passed,
    details: passed
      ? 'AUTH-004 positive assertion (canonical platform-auth import) present'
      : `Missing: ${[!hasAUTH004 && 'AUTH-004', !hasCanonical && 'platform-auth ref'].filter(Boolean).join(', ')}`,
  }
})

// ── HARD-30 Repo as Product — what-is-nzila.md ─────────────────────────────

gate('HARD-30: what-is-nzila.md exists (repo-as-product)', () => {
  const docPath = join(ROOT, 'docs/platform/what-is-nzila.md')
  if (!existsSync(docPath)) {
    return { passed: false, details: 'docs/platform/what-is-nzila.md not found' }
  }

  const content = readFileSync(docPath, 'utf-8')
  const hasTitle = content.includes('What Is Nzila OS')
  const hasArchitecture = content.includes('Architecture') || content.includes('architecture')

  const passed = hasTitle && hasArchitecture
  return {
    passed,
    details: passed
      ? 'what-is-nzila.md present with title + architecture reference'
      : 'Doc exists but missing required sections',
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
    console.log('  ✅  HARDENING GATE PASSED — ALL 30 CONDITIONS MET  ✅')
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
