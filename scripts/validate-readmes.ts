#!/usr/bin/env npx tsx
/**
 * validate-readmes.ts — Checks that production-critical packages have README.md.
 *
 * Lists all packages under packages/, classifies them as critical or not,
 * and reports missing READMEs with a summary.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

function findRepoRoot(): string {
  let dir = process.cwd()
  while (dir !== join(dir, '..')) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    dir = join(dir, '..')
  }
  throw new Error('Cannot find repo root')
}

const CRITICAL_PREFIXES = ['platform-', 'mobility-', 'integrations-', 'ai-', 'ml-']
const CRITICAL_PACKAGES = ['db', 'config', 'evidence', 'org', 'os-core', 'ui', 'blob', 'otel-core', 'qbo', 'payments-stripe']

const root = findRepoRoot()
const packagesDir = join(root, 'packages')
const reportsDir = join(root, 'reports')
if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true })

interface ReadmeCheck {
  package: string
  critical: boolean
  hasReadme: boolean
  readmeLength: number
}

const checks: ReadmeCheck[] = []

for (const pkg of readdirSync(packagesDir).sort()) {
  const pkgDir = join(packagesDir, pkg)
  if (!statSync(pkgDir).isDirectory()) continue
  if (!existsSync(join(pkgDir, 'package.json'))) continue

  const isCritical = CRITICAL_PREFIXES.some(p => pkg.startsWith(p)) || CRITICAL_PACKAGES.includes(pkg)
  const readmePath = join(pkgDir, 'README.md')
  const hasReadme = existsSync(readmePath)
  const readmeLength = hasReadme ? readFileSync(readmePath, 'utf-8').trim().length : 0

  checks.push({ package: pkg, critical: isCritical, hasReadme, readmeLength })
}

const criticalMissing = checks.filter(c => c.critical && !c.hasReadme)
const criticalStub = checks.filter(c => c.critical && c.hasReadme && c.readmeLength < 100)
const nonCriticalMissing = checks.filter(c => !c.critical && !c.hasReadme)

const report = {
  generatedAt: new Date().toISOString(),
  totalPackages: checks.length,
  criticalPackages: checks.filter(c => c.critical).length,
  criticalMissing: criticalMissing.map(c => c.package),
  criticalStub: criticalStub.map(c => c.package),
  nonCriticalMissing: nonCriticalMissing.map(c => c.package),
  checks,
}

writeFileSync(join(reportsDir, 'readme-audit.json'), JSON.stringify(report, null, 2))

// Print
console.log('\n══════════════════════════════════════════════════════════════')
console.log('  NzilaOS README Audit')
console.log('══════════════════════════════════════════════════════════════\n')

if (criticalMissing.length > 0) {
  console.log('🔴 Critical packages MISSING README:')
  for (const c of criticalMissing) console.log(`   - packages/${c.package}`)
}
if (criticalStub.length > 0) {
  console.log('\n🟡 Critical packages with STUB README (<100 chars):')
  for (const c of criticalStub) console.log(`   - packages/${c.package}`)
}
if (nonCriticalMissing.length > 0) {
  console.log(`\n📝 ${nonCriticalMissing.length} non-critical packages without README`)
}

const total = checks.filter(c => c.hasReadme && c.readmeLength >= 100).length
console.log(`\n  ${total}/${checks.length} packages have adequate READMEs`)

if (criticalMissing.length > 0) {
  console.log('\n❌ README audit FAILED — critical packages missing documentation.\n')
  process.exit(1)
} else {
  console.log('\n✅ README audit passed — all critical packages documented.\n')
}
