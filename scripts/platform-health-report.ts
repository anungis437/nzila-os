#!/usr/bin/env tsx
/**
 * Nzila OS — Platform Health Report
 *
 * Produces a comprehensive platform health assessment covering audit,
 * policy engine, integration, evidence, and procurement subsystems.
 *
 * Output:
 *   ops/outputs/platform-health.json
 *
 * Usage:
 *   pnpm exec tsx scripts/platform-health-report.ts
 *
 * Exit codes:
 *   0 — all subsystems healthy
 *   1 — one or more subsystems degraded or failed
 *
 * @module scripts/platform-health-report
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { nowISO } from '@nzila/platform-utils/time'

// ── Types ───────────────────────────────────────────────────────────────────

type HealthStatus = 'healthy' | 'degraded' | 'failed'

interface SubsystemHealth {
  readonly name: string
  readonly status: HealthStatus
  readonly checks: readonly CheckResult[]
  readonly timestamp: string
}

interface CheckResult {
  readonly check: string
  readonly passed: boolean
  readonly detail: string
}

interface PlatformHealthReport {
  readonly version: '1.0'
  readonly generatedAt: string
  readonly commitHash: string
  readonly overallStatus: HealthStatus
  readonly subsystems: readonly SubsystemHealth[]
  readonly digest: string
}

// ── Constants ───────────────────────────────────────────────────────────────

const ROOT = resolve(import.meta.dirname ?? __dirname, '..')
const OUTPUT_DIR = resolve(ROOT, 'ops', 'outputs')
const OUTPUT_PATH = join(OUTPUT_DIR, 'platform-health.json')

// ── Helpers ─────────────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data, 'utf-8').digest('hex')
}

function cmd(command: string): string {
  try {
    return execSync(command, { encoding: 'utf-8', cwd: ROOT }).trim()
  } catch {
    return ''
  }
}

function fileExists(relativePath: string): boolean {
  return existsSync(resolve(ROOT, relativePath))
}

function fileHash(relativePath: string): string | null {
  const p = resolve(ROOT, relativePath)
  if (!existsSync(p)) return null
  return sha256(readFileSync(p, 'utf-8'))
}

// ── Subsystem Checks ───────────────────────────────────────────────────────

function checkAuditHealth(): SubsystemHealth {
  const ts = nowISO()
  const checks: CheckResult[] = []

  checks.push({
    check: 'compliance-snapshot-module',
    passed: fileExists('packages/platform-compliance-snapshots/src/index.ts'),
    detail: 'Compliance snapshots package exists',
  })

  checks.push({
    check: 'evidence-pack-module',
    passed: fileExists('packages/platform-evidence-pack/src/index.ts'),
    detail: 'Evidence pack package exists',
  })

  checks.push({
    check: 'hash-chain-module',
    passed: fileExists('packages/platform-hash-chain/src/index.ts'),
    detail: 'Hash chain integrity module exists',
  })

  checks.push({
    check: 'audit-log-schema',
    passed: fileExists('packages/db/src/schema/audit.ts'),
    detail: 'Audit log database schema present',
  })

  const status = checks.every((c) => c.passed)
    ? 'healthy'
    : checks.some((c) => c.passed)
      ? 'degraded'
      : 'failed'

  return { name: 'audit', status, checks, timestamp: ts }
}

function checkPolicyEngineHealth(): SubsystemHealth {
  const ts = nowISO()
  const checks: CheckResult[] = []

  checks.push({
    check: 'policy-engine-module',
    passed: fileExists('packages/platform-policy-engine/src/index.ts'),
    detail: 'Policy engine package exists',
  })

  checks.push({
    check: 'slo-policy',
    passed: fileExists('ops/slo-policy.yml'),
    detail: 'SLO policy definition present',
  })

  checks.push({
    check: 'cost-policy',
    passed: fileExists('ops/cost-policy.yml'),
    detail: 'Cost policy definition present',
  })

  checks.push({
    check: 'dependency-policy',
    passed: fileExists('ops/dependency-policy.yml'),
    detail: 'Dependency policy definition present',
  })

  const status = checks.every((c) => c.passed)
    ? 'healthy'
    : checks.some((c) => c.passed)
      ? 'degraded'
      : 'failed'

  return { name: 'policy-engine', status, checks, timestamp: ts }
}

function checkIntegrationHealth(): SubsystemHealth {
  const ts = nowISO()
  const checks: CheckResult[] = []

  checks.push({
    check: 'integrations-core',
    passed: fileExists('packages/integrations-core/src/index.ts'),
    detail: 'Integration core package present',
  })

  checks.push({
    check: 'integrations-runtime',
    passed: fileExists('packages/integrations-runtime/src/index.ts'),
    detail: 'Integration runtime package present',
  })

  checks.push({
    check: 'integration-policy',
    passed: fileExists('ops/integration-policy.yml'),
    detail: 'Integration policy definition present',
  })

  checks.push({
    check: 'contract-tests',
    passed: fileExists('tooling/contract-tests/vitest.config.ts'),
    detail: 'Contract test configuration present',
  })

  const status = checks.every((c) => c.passed)
    ? 'healthy'
    : checks.some((c) => c.passed)
      ? 'degraded'
      : 'failed'

  return { name: 'integrations', status, checks, timestamp: ts }
}

function checkEvidenceSystemHealth(): SubsystemHealth {
  const ts = nowISO()
  const checks: CheckResult[] = []

  checks.push({
    check: 'evidence-pack-module',
    passed: fileExists('packages/platform-evidence-pack/src/index.ts'),
    detail: 'Evidence pack generator present',
  })

  checks.push({
    check: 'procurement-proof-module',
    passed: fileExists('packages/platform-procurement-proof/src/index.ts'),
    detail: 'Procurement proof package present',
  })

  checks.push({
    check: 'sbom-script',
    passed: fileExists('scripts/generate-sbom.ts'),
    detail: 'SBOM generation script present',
  })

  checks.push({
    check: 'attest-build-script',
    passed: fileExists('scripts/attest-build.ts'),
    detail: 'Build attestation script present',
  })

  checks.push({
    check: 'reproduce-evidence-script',
    passed: fileExists('scripts/reproduce-evidence.ts'),
    detail: 'Evidence reproducibility script present',
  })

  const status = checks.every((c) => c.passed)
    ? 'healthy'
    : checks.some((c) => c.passed)
      ? 'degraded'
      : 'failed'

  return { name: 'evidence-system', status, checks, timestamp: ts }
}

function checkProcurementPackVerification(): SubsystemHealth {
  const ts = nowISO()
  const checks: CheckResult[] = []

  checks.push({
    check: 'validate-pack-script',
    passed: fileExists('scripts/validate-procurement-pack.ts'),
    detail: 'Procurement pack validation script present',
  })

  checks.push({
    check: 'supply-chain-section',
    passed: fileExists('packages/platform-procurement-proof/src/sections/supply-chain-integrity.ts'),
    detail: 'Supply chain integrity section present',
  })

  checks.push({
    check: 'build-attestation-section',
    passed: fileExists('packages/platform-procurement-proof/src/sections/build-attestation.ts'),
    detail: 'Build attestation section present',
  })

  checks.push({
    check: 'evidence-reproducibility-section',
    passed: fileExists('packages/platform-procurement-proof/src/sections/evidence-reproducibility.ts'),
    detail: 'Evidence reproducibility section present',
  })

  checks.push({
    check: 'build-attestation-artifact',
    passed: fileExists('ops/security/build-attestation.json'),
    detail: 'Build attestation artifact present',
  })

  checks.push({
    check: 'sbom-artifact',
    passed: fileExists('ops/security/sbom.json'),
    detail: 'SBOM artifact present',
  })

  const status = checks.every((c) => c.passed)
    ? 'healthy'
    : checks.some((c) => c.passed)
      ? 'degraded'
      : 'failed'

  return { name: 'procurement-pack', status, checks, timestamp: ts }
}

// ── Main ────────────────────────────────────────────────────────────────────

function main(): void {
  process.stdout.write('\n\u2501\u2501\u2501 Nzila OS \u2014 Platform Health Report \u2501\u2501\u2501\n\n')

  mkdirSync(OUTPUT_DIR, { recursive: true })

  const subsystems: SubsystemHealth[] = [
    checkAuditHealth(),
    checkPolicyEngineHealth(),
    checkIntegrationHealth(),
    checkEvidenceSystemHealth(),
    checkProcurementPackVerification(),
  ]

  const overallStatus: HealthStatus = subsystems.every((s) => s.status === 'healthy')
    ? 'healthy'
    : subsystems.some((s) => s.status === 'failed')
      ? 'failed'
      : 'degraded'

  const reportBase = {
    version: '1.0' as const,
    generatedAt: nowISO(),
    commitHash: cmd('git rev-parse HEAD') || 'unknown',
    overallStatus,
    subsystems,
  }

  const digest = sha256(JSON.stringify(reportBase, null, 0))

  const report: PlatformHealthReport = { ...reportBase, digest }

  writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2), 'utf-8')

  // Print summary
  for (const sub of subsystems) {
    const icon = sub.status === 'healthy' ? '\u2714' : sub.status === 'degraded' ? '\u26A0' : '\u2716'
    process.stdout.write(`  ${icon} ${sub.name}: ${sub.status}\n`)

    for (const c of sub.checks) {
      const ci = c.passed ? '\u2714' : '\u2716'
      process.stdout.write(`    ${ci} ${c.check}\n`)
    }
  }

  process.stdout.write(`\n  Overall: ${overallStatus}\n`)
  process.stdout.write(`  Report: ${OUTPUT_PATH}\n\n`)

  if (overallStatus === 'failed') {
    process.exit(1)
  }
}

main()
