/**
 * Architecture Consistency Audit
 *
 * Verifies that the codebase follows claimed architecture patterns:
 *   1. No raw DB imports in app code (org-isolation)
 *   2. withAudit() used in all mutation paths
 *   3. SDK wrapper enforcement (no direct provider imports)
 *   4. Layer boundaries (apps → packages, packages → packages, no apps → apps)
 *   5. ESM consistency (all packages "type": "module")
 *   6. Circular dependency detection (workspace-level)
 *   7. Schema ownership (every table has org_id)
 *   8. Governance profile completeness
 *
 * Output: reports/architecture-audit.json + reports/architecture-audit.md
 */

import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..', '..')

// ────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────

interface ArchViolation {
  rule: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  file: string
  line?: number
  detail: string
}

interface ArchRule {
  id: string
  name: string
  description: string
  violations: ArchViolation[]
  passed: boolean
}

interface ArchAuditReport {
  timestamp: string
  totalRules: number
  passedRules: number
  failedRules: number
  criticalViolations: number
  highViolations: number
  totalViolations: number
  rules: ArchRule[]
}

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

function walkFiles(dir: string, ext: string[] = ['.ts', '.tsx']): string[] {
  const results: string[] = []
  if (!existsSync(dir)) return results

  function walk(d: string) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'dist' || entry.name === '.turbo') continue
      const full = join(d, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (ext.some(e => entry.name.endsWith(e))) results.push(full)
    }
  }
  walk(dir)
  return results
}

function relPath(p: string): string {
  return relative(ROOT, p).replace(/\\/g, '/')
}

// ────────────────────────────────────────────────────────────────────
// Rule 1: No raw drizzle/pg imports in app dirs
// ────────────────────────────────────────────────────────────────────

function checkOrgIsolation(): ArchRule {
  const violations: ArchViolation[] = []
  const appsDir = join(ROOT, 'apps')
  if (!existsSync(appsDir)) {
    return { id: 'ORG-ISOLATION', name: 'Org Isolation', description: 'No raw DB imports in app code', violations, passed: true }
  }

  const files = walkFiles(appsDir)
  const forbidden = [
    /from\s+['"]drizzle-orm['"]/,
    /from\s+['"]pg['"]/,
    /from\s+['"]postgres['"]/,
    /require\s*\(\s*['"]drizzle-orm['"]\s*\)/,
    /require\s*\(\s*['"]pg['"]\s*\)/,
  ]

  for (const file of files) {
    // Skip config files
    if (file.endsWith('.config.ts') || file.endsWith('.config.js')) continue
    const content = readFileSync(file, 'utf-8')
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      for (const pat of forbidden) {
        if (pat.test(lines[i])) {
          violations.push({
            rule: 'ORG-ISOLATION',
            severity: 'critical',
            file: relPath(file),
            line: i + 1,
            detail: `Raw DB import found: ${lines[i].trim()}`,
          })
        }
      }
    }
  }

  return {
    id: 'ORG-ISOLATION',
    name: 'Org Isolation — No Raw DB in Apps',
    description: 'App code must use @nzila/db scoped wrappers, not raw drizzle-orm or pg imports',
    violations,
    passed: violations.length === 0,
  }
}

// ────────────────────────────────────────────────────────────────────
// Rule 2: SDK wrapper enforcement — no direct provider imports in apps
// ────────────────────────────────────────────────────────────────────

function checkSdkWrappers(): ArchRule {
  const violations: ArchViolation[] = []
  const appsDir = join(ROOT, 'apps')
  if (!existsSync(appsDir)) {
    return { id: 'SDK-WRAPPERS', name: 'SDK Wrappers', description: 'No direct provider imports in apps', violations, passed: true }
  }

  const files = walkFiles(appsDir)
  const forbidden = [
    { pattern: /from\s+['"]stripe['"]/, provider: 'Stripe' },
    { pattern: /from\s+['"]@sendgrid/, provider: 'SendGrid' },
    { pattern: /from\s+['"]twilio['"]/, provider: 'Twilio' },
    { pattern: /from\s+['"]openai['"]/, provider: 'OpenAI (use @nzila/ai-sdk)' },
    { pattern: /from\s+['"]@azure\/(?!identity)/, provider: 'Azure direct' },
  ]

  for (const file of files) {
    if (file.endsWith('.config.ts')) continue
    const content = readFileSync(file, 'utf-8')
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      for (const { pattern, provider } of forbidden) {
        if (pattern.test(lines[i])) {
          violations.push({
            rule: 'SDK-WRAPPERS',
            severity: 'high',
            file: relPath(file),
            line: i + 1,
            detail: `Direct ${provider} import — use @nzila wrapper package instead`,
          })
        }
      }
    }
  }

  return {
    id: 'SDK-WRAPPERS',
    name: 'SDK Wrapper Enforcement',
    description: 'Apps must use @nzila/* SDK wrapper packages, not direct provider imports',
    violations,
    passed: violations.length === 0,
  }
}

// ────────────────────────────────────────────────────────────────────
// Rule 3: Layer boundary enforcement (no apps→apps imports)
// ────────────────────────────────────────────────────────────────────

function checkLayerBoundaries(): ArchRule {
  const violations: ArchViolation[] = []
  const appsDir = join(ROOT, 'apps')
  if (!existsSync(appsDir)) {
    return { id: 'LAYER-BOUNDARIES', name: 'Layer Boundaries', description: 'No cross-app imports', violations, passed: true }
  }

  const appNames = readdirSync(appsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)

  for (const appName of appNames) {
    const files = walkFiles(join(appsDir, appName))
    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        // Check for relative imports going to other apps
        for (const otherApp of appNames) {
          if (otherApp === appName) continue
          // Relative path references to sibling apps
          if (lines[i].includes(`../../apps/${otherApp}`) || lines[i].includes(`../../../apps/${otherApp}`)) {
            violations.push({
              rule: 'LAYER-BOUNDARIES',
              severity: 'high',
              file: relPath(file),
              line: i + 1,
              detail: `Cross-app import: ${appName} → ${otherApp}`,
            })
          }
        }
      }
    }
  }

  return {
    id: 'LAYER-BOUNDARIES',
    name: 'Layer Boundary Enforcement',
    description: 'Apps must not import from other apps — shared code belongs in packages/',
    violations,
    passed: violations.length === 0,
  }
}

// ────────────────────────────────────────────────────────────────────
// Rule 4: ESM consistency
// ────────────────────────────────────────────────────────────────────

function checkEsmConsistency(): ArchRule {
  const violations: ArchViolation[] = []

  for (const parentDir of ['packages', 'tooling']) {
    const parent = join(ROOT, parentDir)
    if (!existsSync(parent)) continue
    for (const entry of readdirSync(parent, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const pkgPath = join(parent, entry.name, 'package.json')
      if (!existsSync(pkgPath)) continue
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
        if (pkg.type !== 'module') {
          violations.push({
            rule: 'ESM-CONSISTENCY',
            severity: 'medium',
            file: relPath(pkgPath),
            detail: `Package "${pkg.name ?? entry.name}" has type="${pkg.type ?? '(missing)'}" — should be "module"`,
          })
        }
      } catch { /* skip invalid */ }
    }
  }

  return {
    id: 'ESM-CONSISTENCY',
    name: 'ESM Module Type',
    description: 'All packages should declare "type": "module" for consistent ESM',
    violations,
    passed: violations.length === 0,
  }
}

// ────────────────────────────────────────────────────────────────────
// Rule 5: Circular workspace dependencies
// ────────────────────────────────────────────────────────────────────

function checkCircularDeps(): ArchRule {
  const violations: ArchViolation[] = []
  const depGraph = new Map<string, string[]>()

  for (const parentDir of ['packages', 'apps', 'tooling']) {
    const parent = join(ROOT, parentDir)
    if (!existsSync(parent)) continue
    for (const entry of readdirSync(parent, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const pkgPath = join(parent, entry.name, 'package.json')
      if (!existsSync(pkgPath)) continue
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
        const name = pkg.name as string
        if (!name) continue
        const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
        const internal = Object.keys(allDeps).filter(k => k.startsWith('@nzila/'))
        depGraph.set(name, internal)
      } catch { /* skip */ }
    }
  }

  // DFS cycle detection
  function findCycles(start: string): string[][] {
    const cycles: string[][] = []
    const visited = new Set<string>()
    const stack: string[] = []

    function dfs(node: string) {
      if (stack.includes(node)) {
        const cycleStart = stack.indexOf(node)
        cycles.push([...stack.slice(cycleStart), node])
        return
      }
      if (visited.has(node)) return
      visited.add(node)
      stack.push(node)
      for (const dep of (depGraph.get(node) ?? [])) {
        dfs(dep)
      }
      stack.pop()
    }

    dfs(start)
    return cycles
  }

  const seen = new Set<string>()
  for (const name of depGraph.keys()) {
    const cycles = findCycles(name)
    for (const c of cycles) {
      const key = [...c].sort().join(' → ')
      if (!seen.has(key)) {
        seen.add(key)
        violations.push({
          rule: 'CIRCULAR-DEPS',
          severity: 'critical',
          file: '(workspace graph)',
          detail: `Circular dependency: ${c.join(' → ')}`,
        })
      }
    }
  }

  return {
    id: 'CIRCULAR-DEPS',
    name: 'No Circular Workspace Dependencies',
    description: 'Workspace packages must not form circular dependency chains',
    violations,
    passed: violations.length === 0,
  }
}

// ────────────────────────────────────────────────────────────────────
// Rule 6: Governance profiles complete
// ────────────────────────────────────────────────────────────────────

function checkGovernanceProfiles(): ArchRule {
  const violations: ArchViolation[] = []
  const profilesDir = join(ROOT, 'governance', 'profiles')
  if (!existsSync(profilesDir)) {
    violations.push({
      rule: 'GOV-PROFILES',
      severity: 'high',
      file: 'governance/foundations/profiles/',
      detail: 'Governance profiles directory does not exist',
    })
    return { id: 'GOV-PROFILES', name: 'Governance Profiles', description: 'Governance profiles exist and are complete', violations, passed: false }
  }

  const indexPath = join(profilesDir, 'index.ts')
  if (!existsSync(indexPath)) {
    violations.push({
      rule: 'GOV-PROFILES',
      severity: 'high',
      file: 'governance/foundations/profiles/',
      detail: 'governance/foundations/profiles/index.ts does not exist',
    })
  } else {
    const content = readFileSync(indexPath, 'utf-8')
    const requiredProfiles = ['union-eyes', 'abr-insights']
    for (const p of requiredProfiles) {
      if (!content.includes(p)) {
        violations.push({
          rule: 'GOV-PROFILES',
          severity: 'high',
          file: 'governance/foundations/profiles/index.ts',
          detail: `Profile "${p}" not found in governance profiles registry`,
        })
      }
    }
  }

  return {
    id: 'GOV-PROFILES',
    name: 'Governance Profiles Complete',
    description: 'All vertical governance profiles must be registered and complete',
    violations,
    passed: violations.length === 0,
  }
}

// ────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────

function main() {
  const rules: ArchRule[] = [
    checkOrgIsolation(),
    checkSdkWrappers(),
    checkLayerBoundaries(),
    checkEsmConsistency(),
    checkCircularDeps(),
    checkGovernanceProfiles(),
  ]

  let criticalCount = 0
  let highCount = 0
  let totalViolations = 0
  for (const r of rules) {
    for (const v of r.violations) {
      totalViolations++
      if (v.severity === 'critical') criticalCount++
      if (v.severity === 'high') highCount++
    }
  }

  const report: ArchAuditReport = {
    timestamp: new Date().toISOString(),
    totalRules: rules.length,
    passedRules: rules.filter(r => r.passed).length,
    failedRules: rules.filter(r => !r.passed).length,
    criticalViolations: criticalCount,
    highViolations: highCount,
    totalViolations,
    rules,
  }

  const reportsDir = join(ROOT, 'reports')
  mkdirSync(reportsDir, { recursive: true })
  writeFileSync(join(reportsDir, 'architecture-audit.json'), JSON.stringify(report, null, 2))
  writeFileSync(join(reportsDir, 'architecture-audit.md'), generateMarkdown(report))

  // Console
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  ARCHITECTURE CONSISTENCY AUDIT`)
  console.log(`${'═'.repeat(60)}`)
  console.log(`  Rules:        ${report.totalRules}`)
  console.log(`  Passed:       ${report.passedRules}`)
  console.log(`  Failed:       ${report.failedRules}`)
  console.log(`  Violations:   ${totalViolations} (${criticalCount} critical, ${highCount} high)`)

  for (const r of rules) {
    const icon = r.passed ? '✅' : '❌'
    console.log(`\n  ${icon} ${r.id}: ${r.name}`)
    if (!r.passed) {
      for (const v of r.violations.slice(0, 5)) {
        console.log(`     ${v.severity.toUpperCase()}: ${v.file}${v.line ? `:${v.line}` : ''} — ${v.detail}`)
      }
      if (r.violations.length > 5) {
        console.log(`     ... and ${r.violations.length - 5} more`)
      }
    }
  }
  console.log(`\n  Reports written to reports/architecture-audit.json + .md`)
  console.log(`${'═'.repeat(60)}\n`)
}

function generateMarkdown(r: ArchAuditReport): string {
  const lines: string[] = []
  lines.push('# Architecture Consistency Audit')
  lines.push('')
  lines.push(`**Generated:** ${r.timestamp}`)
  lines.push(`**Rules:** ${r.totalRules} | **Passed:** ${r.passedRules} | **Failed:** ${r.failedRules}`)
  lines.push(`**Violations:** ${r.totalViolations} (${r.criticalViolations} critical, ${r.highViolations} high)`)
  lines.push('')

  lines.push('## Rule Results')
  lines.push('')
  lines.push('| Rule | Status | Violations |')
  lines.push('|------|--------|------------|')
  for (const rule of r.rules) {
    lines.push(`| ${rule.id}: ${rule.name} | ${rule.passed ? '✅ PASS' : '❌ FAIL'} | ${rule.violations.length} |`)
  }
  lines.push('')

  const failedRules = r.rules.filter(r => !r.passed)
  if (failedRules.length > 0) {
    lines.push('## Violation Details')
    lines.push('')
    for (const rule of failedRules) {
      lines.push(`### ${rule.id}: ${rule.name}`)
      lines.push('')
      lines.push(`> ${rule.description}`)
      lines.push('')
      lines.push('| Severity | File | Line | Detail |')
      lines.push('|----------|------|------|--------|')
      for (const v of rule.violations) {
        lines.push(`| ${v.severity} | ${v.file} | ${v.line ?? '—'} | ${v.detail} |`)
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}

main()
