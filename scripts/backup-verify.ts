#!/usr/bin/env tsx
/**
 * Nzila OS — Backup Verification Script
 *
 * Verifies the integrity of critical backup artifacts and system
 * components required for disaster recovery.
 *
 * Checks:
 *   1. Lockfile integrity (pnpm-lock.yaml)
 *   2. Evidence system health (evidence pack generation)
 *   3. Build attestation presence + signature
 *   4. SBOM presence
 *   5. Critical configuration files
 *
 * Usage:
 *   pnpm exec tsx scripts/backup-verify.ts
 *
 * Exit codes:
 *   0 — all checks pass
 *   1 — one or more checks fail
 *
 * @module scripts/backup-verify
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'
import { nowISO } from '@nzila/platform-utils/time'

// ── Constants ───────────────────────────────────────────────────────────────

const ROOT = resolve(import.meta.dirname ?? __dirname, '..')

const CRITICAL_FILES = [
  'pnpm-lock.yaml',
  'package.json',
  'turbo.json',
  'pnpm-workspace.yaml',
  'tsconfig.json',
  'vitest.config.ts',
  'docker-compose.yml',
  'Dockerfile',
] as const

// ── Helpers ─────────────────────────────────────────────────────────────────

let passCount = 0
let failCount = 0
let warnCount = 0

function ok(msg: string): void {
  passCount++
  process.stdout.write(`  \u2714 ${msg}\n`)
}

function fail(msg: string): void {
  failCount++
  process.stderr.write(`  \u2718 ${msg}\n`)
}

function warn(msg: string): void {
  warnCount++
  process.stdout.write(`  \u26A0 ${msg}\n`)
}

function sha256(data: string): string {
  return createHash('sha256').update(data, 'utf-8').digest('hex')
}

// ── Checks ──────────────────────────────────────────────────────────────────

function checkLockfileIntegrity(): void {
  const path = resolve(ROOT, 'pnpm-lock.yaml')
  if (!existsSync(path)) {
    fail('Lockfile missing: pnpm-lock.yaml')
    return
  }
  const content = readFileSync(path, 'utf-8')
  if (content.length < 100) {
    fail('Lockfile appears truncated')
    return
  }
  const hash = sha256(content)
  ok(`Lockfile intact (sha256: ${hash.slice(0, 16)}\u2026)`)
}

function checkBuildAttestation(): void {
  const path = resolve(ROOT, 'ops', 'security', 'build-attestation.json')
  if (!existsSync(path)) {
    warn('Build attestation not found (run: npx tsx scripts/attest-build.ts)')
    return
  }
  try {
    const attestation = JSON.parse(readFileSync(path, 'utf-8')) as {
      commitHash?: string
      signature?: string | null
    }
    if (attestation.commitHash) {
      ok(`Build attestation present (commit: ${attestation.commitHash.slice(0, 12)})`)
    } else {
      fail('Build attestation missing commitHash')
    }
    if (attestation.signature) {
      ok('Build attestation is signed')
    } else {
      warn('Build attestation is unsigned')
    }
  } catch {
    fail('Build attestation is not valid JSON')
  }
}

function checkSbomPresence(): void {
  const path = resolve(ROOT, 'ops', 'security', 'sbom.json')
  if (!existsSync(path)) {
    warn('SBOM not found (run: pnpm exec tsx scripts/generate-sbom.ts)')
    return
  }
  try {
    const sbom = JSON.parse(readFileSync(path, 'utf-8')) as {
      bomFormat?: string
      components?: unknown[]
    }
    if (sbom.bomFormat === 'CycloneDX') {
      ok(`SBOM present (CycloneDX, ${sbom.components?.length ?? 0} components)`)
    } else {
      fail(`SBOM format unexpected: ${sbom.bomFormat}`)
    }
  } catch {
    fail('SBOM is not valid JSON')
  }
}

function checkCriticalFiles(): void {
  const missing: string[] = []
  for (const file of CRITICAL_FILES) {
    if (!existsSync(resolve(ROOT, file))) {
      missing.push(file)
    }
  }

  if (missing.length === 0) {
    ok(`All ${CRITICAL_FILES.length} critical configuration files present`)
  } else {
    fail(`Missing critical files: ${missing.join(', ')}`)
  }
}

function checkEvidenceSystem(): void {
  // Verify evidence-related packages exist
  const evidencePackages = [
    'packages/platform-evidence-pack',
    'packages/platform-compliance-snapshots',
    'packages/platform-procurement-proof',
  ] as const

  const missing: string[] = []
  for (const pkg of evidencePackages) {
    const pkgJson = resolve(ROOT, pkg, 'package.json')
    if (!existsSync(pkgJson)) {
      missing.push(pkg)
    }
  }

  if (missing.length === 0) {
    ok('Evidence system packages present')
  } else {
    fail(`Missing evidence packages: ${missing.join(', ')}`)
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

function main(): void {
  process.stdout.write(`\n\u2501\u2501\u2501 Nzila OS \u2014 Backup Verification \u2501\u2501\u2501\n`)
  process.stdout.write(`Started: ${nowISO()}\n\n`)

  process.stdout.write('[1/5] Lockfile integrity\n')
  checkLockfileIntegrity()

  process.stdout.write('\n[2/5] Build attestation\n')
  checkBuildAttestation()

  process.stdout.write('\n[3/5] SBOM presence\n')
  checkSbomPresence()

  process.stdout.write('\n[4/5] Critical configuration files\n')
  checkCriticalFiles()

  process.stdout.write('\n[5/5] Evidence system health\n')
  checkEvidenceSystem()

  process.stdout.write(`\n  ${passCount} passed, ${failCount} failed, ${warnCount} warnings\n\n`)

  if (failCount > 0) {
    process.exit(1)
  }
}

main()
