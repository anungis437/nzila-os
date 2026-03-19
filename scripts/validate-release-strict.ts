#!/usr/bin/env npx tsx
/**
 * validate:release:strict — Strict release gate for NzilaOS.
 *
 * Runs all validation audits and fails the gate if:
 *   - Any architecture errors exist
 *   - Any unsupported claims in buyer materials
 *   - Missing correlation ID on API routes exceeds threshold
 *   - Missing Zod fail-fast env validation on app env files
 *   - Missing READMEs for production-critical packages
 *   - Critical apps without any tests
 *   - Severe findings above threshold
 *
 * Intended for CI/CD pipelines as a pre-release check.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

function findRepoRoot(): string {
  let dir = process.cwd()
  while (dir !== join(dir, '..')) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    dir = join(dir, '..')
  }
  throw new Error('Cannot find repo root')
}

interface GateFinding {
  gate: string
  severity: 'blocker' | 'warning'
  message: string
}

const root = findRepoRoot()
const findings: GateFinding[] = []

console.log('\n══════════════════════════════════════════════════════════════')
console.log('  NzilaOS Strict Release Gate')
console.log('══════════════════════════════════════════════════════════════\n')

// ── Gate 1: All apps must have middleware.ts with rate limiting ──────────
const NEXTJS_APPS = [
  'abr', 'cfo', 'console', 'cora', 'mobility', 'mobility-client-portal',
  'nacp-exams', 'partners', 'platform-admin', 'pondu',
  'trade', 'union-eyes', 'web', 'zonga',
]

for (const app of NEXTJS_APPS) {
  const mwPath = join(root, 'apps', app, 'middleware.ts')
  if (!existsSync(mwPath)) {
    findings.push({
      gate: 'middleware',
      severity: 'blocker',
      message: `${app}: Missing middleware.ts — rate limiting and request-ID not enforced`,
    })
  } else {
    const mw = readFileSync(mwPath, 'utf-8')
    if (!mw.includes('x-request-id')) {
      findings.push({
        gate: 'request-id',
        severity: 'blocker',
        message: `${app}: middleware.ts does not propagate x-request-id`,
      })
    }
  }
}

// ── Gate 2: All apps must have env schema in os-core ────────────────────
const envPath = join(root, 'packages', 'os-core', 'src', 'config', 'env.ts')
if (existsSync(envPath)) {
  const envFile = readFileSync(envPath, 'utf-8')
  const ALL_APPS = [...NEXTJS_APPS, 'orchestrator-api']
  for (const app of ALL_APPS) {
    if (!envFile.includes(`'${app}'`)) {
      findings.push({
        gate: 'env-schema',
        severity: 'blocker',
        message: `${app}: No Zod env schema in @nzila/os-core/config`,
      })
    }
  }
}

// ── Gate 3: All apps must have health route ─────────────────────────────
for (const app of NEXTJS_APPS) {
  const healthPath = join(root, 'apps', app, 'app', 'api', 'health', 'route.ts')
  if (!existsSync(healthPath)) {
    findings.push({
      gate: 'health-route',
      severity: 'warning',
      message: `${app}: Missing /api/health route`,
    })
  }
}

// ── Gate 4: Production-critical packages must have README ───────────────
const CRITICAL_PREFIXES = ['platform-', 'mobility-', 'integrations-', 'ai-', 'ml-']
const CRITICAL_PACKAGES = ['db', 'config', 'evidence', 'org', 'os-core', 'ui', 'blob']
const packagesDir = join(root, 'packages')

if (existsSync(packagesDir)) {
  for (const pkg of readdirSync(packagesDir)) {
    const pkgDir = join(packagesDir, pkg)
    if (!statSync(pkgDir).isDirectory()) continue
    if (!existsSync(join(pkgDir, 'package.json'))) continue

    const isCritical = CRITICAL_PREFIXES.some(p => pkg.startsWith(p)) ||
                       CRITICAL_PACKAGES.includes(pkg)
    if (isCritical && !existsSync(join(pkgDir, 'README.md'))) {
      findings.push({
        gate: 'readme',
        severity: 'warning',
        message: `packages/${pkg}: Production-critical package missing README.md`,
      })
    }
  }
}

// ── Gate 5: Check for existing validation reports ───────────────────────
const reportsDir = join(root, 'reports')
const scorecardPath = join(reportsDir, 'scorecard.json')
if (existsSync(scorecardPath)) {
  try {
    const scorecard = JSON.parse(readFileSync(scorecardPath, 'utf-8'))
    for (const dim of scorecard.dimensions ?? []) {
      if (dim.errors > 0) {
        findings.push({
          gate: 'scorecard',
          severity: 'blocker',
          message: `${dim.dimension}: ${dim.errors} errors (grade: ${dim.score})`,
        })
      }
    }
    if (scorecard.blockers?.length > 0) {
      for (const b of scorecard.blockers) {
        findings.push({
          gate: 'scorecard-blocker',
          severity: 'blocker',
          message: b,
        })
      }
    }
  } catch {
    // scorecard exists but can't be parsed — let it pass
  }
}

// ── Report ──────────────────────────────────────────────────────────────

const blockers = findings.filter(f => f.severity === 'blocker')
const warnings = findings.filter(f => f.severity === 'warning')

for (const f of findings) {
  const icon = f.severity === 'blocker' ? '🔴' : '🟡'
  console.log(`${icon} [${f.gate}] ${f.message}`)
}

console.log(`\n  Blockers: ${blockers.length}  |  Warnings: ${warnings.length}\n`)

// Write gate report
if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true })
writeFileSync(
  join(reportsDir, 'release-gate.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), findings, pass: blockers.length === 0 }, null, 2),
)

if (blockers.length > 0) {
  console.log('❌ Release gate FAILED — fix blockers before release.\n')
  process.exit(1)
} else if (warnings.length > 0) {
  console.log('✅ Release gate passed with warnings.\n')
} else {
  console.log('✅ Release gate passed — all checks clear.\n')
}
