#!/usr/bin/env tsx
/**
 * validate-prod-region.ts
 *
 * CI gate: confirms that all production configuration files target Canada Central
 * and contain no forbidden region references (eastus, westus, etc.).
 *
 * Regulatory basis: PIPEDA / Québec Law 25 — all PII must remain in Canada.
 *
 * Exit 0 = PASS  |  Exit 1 = FAIL
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = process.cwd()

// ─── Configuration ────────────────────────────────────────────────────────────

const REQUIRED_REGION = 'canadacentral'
const REQUIRED_RG = 'nzila-canada-prod-rg'
const REQUIRED_ACA_ENV = 'nzila-canada-prod-env'
const FORBIDDEN_REGIONS = ['eastus', 'eastus2', 'westus', 'westus2', 'centralus', 'northcentralus', 'southcentralus']

const TARGET_FILES = [
  'ops/environments/prod.env',
  'infrastructure/gitops/environments/production.yml',
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface CheckResult {
  file: string
  passed: boolean
  issues: string[]
  found: Record<string, string>
}

function readFile(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf-8')
}

function banner(label: string, passed: boolean): void {
  const mark = passed ? '✓' : '✗'
  const color = passed ? '\x1b[32m' : '\x1b[31m'
  console.log(`${color}${mark}\x1b[0m  ${label}`)
}

// ─── Checks ───────────────────────────────────────────────────────────────────

function checkProdEnv(): CheckResult {
  const file = 'ops/environments/prod.env'
  const content = readFile(file)
  const issues: string[] = []
  const found: Record<string, string> = {}

  // Must have canadacentral
  const regionMatch = content.match(/AZURE_REGION=(.+)/)
  found['AZURE_REGION'] = regionMatch?.[1]?.trim() ?? '(missing)'
  if (found['AZURE_REGION'] !== REQUIRED_REGION) {
    issues.push(`AZURE_REGION must be "${REQUIRED_REGION}", got "${found['AZURE_REGION']}"`)
  }

  const dataResidencyMatch = content.match(/DATA_RESIDENCY_REGION=(.+)/)
  found['DATA_RESIDENCY_REGION'] = dataResidencyMatch?.[1]?.trim() ?? '(missing)'
  if (found['DATA_RESIDENCY_REGION'] !== REQUIRED_REGION) {
    issues.push(`DATA_RESIDENCY_REGION must be "${REQUIRED_REGION}", got "${found['DATA_RESIDENCY_REGION']}"`)
  }

  const countryMatch = content.match(/DATA_RESIDENCY_COUNTRY=(.+)/)
  found['DATA_RESIDENCY_COUNTRY'] = countryMatch?.[1]?.trim() ?? '(missing)'
  if (found['DATA_RESIDENCY_COUNTRY'] !== 'CA') {
    issues.push(`DATA_RESIDENCY_COUNTRY must be "CA", got "${found['DATA_RESIDENCY_COUNTRY']}"`)
  }

  const rgMatch = content.match(/AZURE_RESOURCE_GROUP=(.+)/)
  found['AZURE_RESOURCE_GROUP'] = rgMatch?.[1]?.trim() ?? '(missing)'
  if (found['AZURE_RESOURCE_GROUP'] !== REQUIRED_RG) {
    issues.push(`AZURE_RESOURCE_GROUP must be "${REQUIRED_RG}", got "${found['AZURE_RESOURCE_GROUP']}"`)
  }

  const acaEnvMatch = content.match(/AZURE_CONTAINERAPPS_ENVIRONMENT=(.+)/)
  found['AZURE_CONTAINERAPPS_ENVIRONMENT'] = acaEnvMatch?.[1]?.trim() ?? '(missing)'
  if (found['AZURE_CONTAINERAPPS_ENVIRONMENT'] !== REQUIRED_ACA_ENV) {
    issues.push(`AZURE_CONTAINERAPPS_ENVIRONMENT must be "${REQUIRED_ACA_ENV}", got "${found['AZURE_CONTAINERAPPS_ENVIRONMENT']}"`)
  }

  // Must NOT have forbidden regions (excluding comments)
  const nonCommentLines = content.split('\n').filter(l => !l.trim().startsWith('#'))
  for (const forbidden of FORBIDDEN_REGIONS) {
    const offending = nonCommentLines.filter(l => l.toLowerCase().includes(forbidden))
    if (offending.length > 0) {
      issues.push(`Forbidden region "${forbidden}" found in non-comment lines: ${offending.map(l => `"${l.trim()}"`).join(', ')}`)
    }
  }

  return { file, passed: issues.length === 0, issues, found }
}

function checkProductionYml(): CheckResult {
  const file = 'infrastructure/gitops/environments/production.yml'
  const content = readFile(file)
  const issues: string[] = []
  const found: Record<string, string> = {}

  const regionMatch = content.match(/^region:\s*(.+)/m)
  found['region'] = regionMatch?.[1]?.trim() ?? '(missing)'
  if (found['region'] !== REQUIRED_REGION) {
    issues.push(`region must be "${REQUIRED_REGION}", got "${found['region']}"`)
  }

  const rgMatch = content.match(/^resource_group:\s*(.+)/m)
  found['resource_group'] = rgMatch?.[1]?.trim() ?? '(missing)'
  if (found['resource_group'] !== REQUIRED_RG) {
    issues.push(`resource_group must be "${REQUIRED_RG}", got "${found['resource_group']}"`)
  }

  const acaEnvMatch = content.match(/^container_apps:\n[ \t]+environment:[ \t]*(.+)/m)
  found['container_apps.environment'] = acaEnvMatch?.[1]?.trim() ?? '(missing)'
  if (found['container_apps.environment'] !== REQUIRED_ACA_ENV) {
    issues.push(`container_apps.environment must be "${REQUIRED_ACA_ENV}", got "${found['container_apps.environment']}"`)
  }

  // Must have data_residency enforcement block
  if (!content.includes('enforce: true')) {
    issues.push('data_residency.enforce must be true')
  }
  if (!content.includes('PIPEDA') && !content.includes('Québec Law 25')) {
    issues.push('data_residency.frameworks must reference PIPEDA / Québec Law 25')
  }

  // Must NOT have forbidden regions in active config lines (ignore comments)
  const nonCommentLines = content.split('\n').filter(l => !l.trim().startsWith('#'))
  for (const forbidden of FORBIDDEN_REGIONS) {
    // Allow 'canadaeast' as the DR region — it's a Canadian region
    if (forbidden === 'canadaeast') continue
    const offending = nonCommentLines.filter(l =>
      l.toLowerCase().includes(forbidden) && !l.includes('canadacentral') && !l.includes('canadaeast')
    )
    if (offending.length > 0) {
      issues.push(`Forbidden region "${forbidden}" found in active config lines: ${offending.map(l => `"${l.trim()}"`).join(', ')}`)
    }
  }

  return { file, passed: issues.length === 0, issues, found }
}

// ─── Runner ───────────────────────────────────────────────────────────────────

const results: CheckResult[] = [checkProdEnv(), checkProductionYml()]

console.log('\n╔══════════════════════════════════════════════════════╗')
console.log('║     PRODUCTION REGION VALIDATION — Canada Central   ║')
console.log('╚══════════════════════════════════════════════════════╝\n')
console.log(`  Required region  : ${REQUIRED_REGION}`)
console.log(`  Required RG      : ${REQUIRED_RG}`)
console.log(`  Required ACA env : ${REQUIRED_ACA_ENV}`)
console.log(`  Regulatory basis : PIPEDA / Québec Law 25`)
console.log()

for (const r of results) {
  banner(r.file, r.passed)
  for (const [key, val] of Object.entries(r.found)) {
    console.log(`     ${key.padEnd(36)} = ${val}`)
  }
  for (const issue of r.issues) {
    console.log(`     \x1b[31m✗ ISSUE:\x1b[0m ${issue}`)
  }
  console.log()
}

const allPassed = results.every(r => r.passed)
if (allPassed) {
  console.log('\x1b[32m✔ PROD_REGION_VALIDATION: PASS\x1b[0m')
  console.log('  All production configuration files correctly target canadacentral.\n')
  process.exit(0)
} else {
  const failCount = results.filter(r => !r.passed).length
  console.log(`\x1b[31m✘ PROD_REGION_VALIDATION: FAIL (${failCount}/${results.length} files failed)\x1b[0m`)
  console.log('  Fix the issues above before deploying to production.\n')
  process.exit(1)
}
