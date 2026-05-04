#!/usr/bin/env tsx
/**
 * ue-prod-canadacentral-dry-run.ts
 *
 * Validates production deployment readiness for the Canada Central target WITHOUT deploying.
 * Mirrors the pre-flight checks that the GitOps pipeline would perform.
 *
 * Exit 0 = all checks pass  |  Exit 1 = one or more checks failed
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = process.cwd()

// ─── Types ────────────────────────────────────────────────────────────────────

interface DryRunCheck {
  id: string
  description: string
  run: () => { passed: boolean; detail: string }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf-8')
}
function exists(rel: string): boolean {
  return existsSync(resolve(ROOT, rel))
}

// ─── Checks ───────────────────────────────────────────────────────────────────

const checks: DryRunCheck[] = [
  {
    id: 'prod-env-loads',
    description: 'prod.env is readable and non-empty',
    run() {
      const content = read('ops/environments/prod.env')
      const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'))
      return { passed: lines.length >= 5, detail: `${lines.length} non-comment entries` }
    },
  },
  {
    id: 'prod-env-region',
    description: 'prod.env sets AZURE_REGION=canadacentral',
    run() {
      const content = read('ops/environments/prod.env')
      const match = content.match(/^AZURE_REGION=(.+)/m)
      const val = match?.[1]?.trim() ?? '(missing)'
      return { passed: val === 'canadacentral', detail: `AZURE_REGION=${val}` }
    },
  },
  {
    id: 'prod-env-data-residency',
    description: 'prod.env declares DATA_RESIDENCY_REGION=canadacentral and COUNTRY=CA',
    run() {
      const content = read('ops/environments/prod.env')
      const region = content.match(/^DATA_RESIDENCY_REGION=(.+)/m)?.[1]?.trim() ?? '(missing)'
      const country = content.match(/^DATA_RESIDENCY_COUNTRY=(.+)/m)?.[1]?.trim() ?? '(missing)'
      const passed = region === 'canadacentral' && country === 'CA'
      return { passed, detail: `region=${region}, country=${country}` }
    },
  },
  {
    id: 'prod-env-no-eastus',
    description: 'prod.env contains no eastus reference in non-comment lines',
    run() {
      const content = read('ops/environments/prod.env')
      const offending = content.split('\n')
        .filter(l => !l.trim().startsWith('#') && l.toLowerCase().includes('eastus'))
      return {
        passed: offending.length === 0,
        detail: offending.length === 0 ? 'clean' : `offending: ${offending.join('; ')}`,
      }
    },
  },
  {
    id: 'prod-env-no-secrets',
    description: 'prod.env does not contain secret values (no API_KEY=, SECRET=, PASSWORD= with values)',
    run() {
      const content = read('ops/environments/prod.env')
      const secretPatterns = /^(API_KEY|SECRET|PASSWORD|TOKEN|PRIVATE_KEY)=.+/m
      const found = secretPatterns.test(content)
      return { passed: !found, detail: found ? 'SECRETS DETECTED — must use CI secrets manager' : 'clean' }
    },
  },
  {
    id: 'gitops-manifest-parseable',
    description: 'production.yml is readable and non-empty',
    run() {
      const content = read('infrastructure/gitops/environments/production.yml')
      const lines = content.split('\n').filter(l => l.trim())
      return { passed: lines.length > 20, detail: `${lines.length} non-empty lines` }
    },
  },
  {
    id: 'gitops-region-canadacentral',
    description: 'production.yml region: canadacentral',
    run() {
      const content = read('infrastructure/gitops/environments/production.yml')
      const val = content.match(/^region:\s*(.+)/m)?.[1]?.trim() ?? '(missing)'
      return { passed: val === 'canadacentral', detail: `region=${val}` }
    },
  },
  {
    id: 'gitops-resource-group',
    description: 'production.yml resource_group: nzila-canada-prod-rg',
    run() {
      const content = read('infrastructure/gitops/environments/production.yml')
      const val = content.match(/^resource_group:\s*(.+)/m)?.[1]?.trim() ?? '(missing)'
      return { passed: val === 'nzila-canada-prod-rg', detail: `resource_group=${val}` }
    },
  },
  {
    id: 'gitops-aca-environment',
    description: 'production.yml container_apps.environment: nzila-canada-prod-env',
    run() {
      const content = read('infrastructure/gitops/environments/production.yml')
      const val = content.match(/^container_apps:\n[ \t]+environment:[ \t]*(.+)/m)?.[1]?.trim() ?? '(missing)'
      return { passed: val === 'nzila-canada-prod-env', detail: `container_apps.environment=${val}` }
    },
  },
  {
    id: 'gitops-required-apps',
    description: 'production.yml includes all required apps (union-eyes, web, console)',
    run() {
      const content = read('infrastructure/gitops/environments/production.yml')
      const required = ['union-eyes', 'web', 'console']
      const missing = required.filter(app => !content.includes(app))
      return { passed: missing.length === 0, detail: missing.length === 0 ? `all present (${required.join(', ')})` : `missing: ${missing.join(', ')}` }
    },
  },
  {
    id: 'gitops-data-residency-block',
    description: 'production.yml has data_residency block with enforce=true',
    run() {
      const content = read('infrastructure/gitops/environments/production.yml')
      const hasBlock = content.includes('data_residency') && content.includes('enforce: true')
      const hasPipeda = content.includes('PIPEDA')
      return { passed: hasBlock && hasPipeda, detail: `enforce block=${hasBlock}, PIPEDA=${hasPipeda}` }
    },
  },
  {
    id: 'evidence-pack-exists',
    description: 'Pilot launch evidence pack exists',
    run() {
      const path = 'artifacts/ue-pilot-launch/launch-evidence-pack.md'
      const ok = exists(path)
      return { passed: ok, detail: ok ? path : '(missing)' }
    },
  },
  {
    id: 'rollback-plan-exists',
    description: 'Evidence pack contains rollback procedure',
    run() {
      const content = read('artifacts/ue-pilot-launch/launch-evidence-pack.md')
      const hasRollback = content.toLowerCase().includes('rollback')
      return { passed: hasRollback, detail: hasRollback ? 'found' : '(missing)' }
    },
  },
  {
    id: 'transition-doc-exists',
    description: 'CUPE pilot-to-prod transition document exists',
    run() {
      const path = 'docs/union-eyes/deployment/cupe-pilot-to-prod-transition.md'
      const ok = exists(path)
      return { passed: ok, detail: ok ? path : '(missing)' }
    },
  },
  {
    id: 'pilot-env-config-exists',
    description: 'CUPE pilot environment config exists (ue-pilot-cupe.yml)',
    run() {
      const path = 'infrastructure/gitops/environments/ue-pilot-cupe.yml'
      const ok = exists(path)
      return { passed: ok, detail: ok ? path : '(missing)' }
    },
  },
]

// ─── Runner ───────────────────────────────────────────────────────────────────

const timestamp = new Date().toISOString()
console.log('\n╔══════════════════════════════════════════════════════╗')
console.log('║  UE PROD CANADA CENTRAL — PRE-FLIGHT DRY RUN        ║')
console.log('╚══════════════════════════════════════════════════════╝\n')
console.log(`  Target region  : canadacentral`)
console.log(`  Target RG      : nzila-canada-prod-rg`)
console.log(`  ACA env        : nzila-canada-prod-env`)
console.log(`  Run time       : ${timestamp}`)
console.log(`  Total checks   : ${checks.length}`)
console.log()

let passed = 0
let failed = 0
const failures: { id: string; description: string; detail: string }[] = []

for (const check of checks) {
  let result: { passed: boolean; detail: string }
  try {
    result = check.run()
  } catch (err) {
    result = { passed: false, detail: `ERROR: ${err instanceof Error ? err.message : String(err)}` }
  }

  const mark = result.passed ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'
  console.log(`  ${mark} [${check.id}] ${check.description}`)
  console.log(`       → ${result.detail}`)

  if (result.passed) {
    passed++
  } else {
    failed++
    failures.push({ id: check.id, description: check.description, detail: result.detail })
  }
}

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`)

if (failed === 0) {
  console.log('\x1b[32m╔══════════════════════════════════════════════════════╗\x1b[0m')
  console.log('\x1b[32m║  UE_PROD_DRY_RUN: PASS — Production-ready for ACA   ║\x1b[0m')
  console.log('\x1b[32m╚══════════════════════════════════════════════════════╝\x1b[0m\n')
  process.exit(0)
} else {
  console.log('\x1b[31m╔══════════════════════════════════════════════════════╗\x1b[0m')
  console.log(`\x1b[31m║  UE_PROD_DRY_RUN: FAIL — ${failed} check(s) failed${' '.repeat(Math.max(0, 26 - String(failed).length))}║\x1b[0m`)
  console.log('\x1b[31m╚══════════════════════════════════════════════════════╝\x1b[0m\n')
  console.log('  Failed checks:')
  for (const f of failures) {
    console.log(`  • [${f.id}] ${f.description}`)
    console.log(`    ${f.detail}`)
  }
  console.log()
  process.exit(1)
}
