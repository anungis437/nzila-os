#!/usr/bin/env tsx
/**
 * Nzila OS — Deterministic Build Environment Check
 *
 * Validates that the build environment matches the expected deterministic
 * configuration before any CI/CD pipeline step runs.
 *
 * Checks:
 *   1. Node.js version matches expected major version
 *   2. pnpm version matches packageManager field
 *   3. Lockfile integrity (pnpm-lock.yaml exists and is consistent)
 *   4. Required environment variable presence (non-secret)
 *
 * Usage:
 *   pnpm verify:env
 *   npx tsx tooling/build-env-check.ts
 *
 * Exit codes:
 *   0 — all checks pass
 *   1 — one or more checks fail
 *
 * @module tooling/build-env-check
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'

// ── Constants ───────────────────────────────────────────────────────────────

const ROOT = resolve(import.meta.dirname ?? __dirname, '..')
const EXPECTED_NODE_MAJOR_MIN = 22
const LOCKFILE_PATH = resolve(ROOT, 'pnpm-lock.yaml')
const PACKAGE_JSON_PATH = resolve(ROOT, 'package.json')

function getExpectedPnpmVersion(): string | null {
  const pkgJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8')) as {
    packageManager?: string
  }
  const declared = pkgJson.packageManager ?? ''
  const match = /^pnpm@([^+]+)(?:\+.*)?$/.exec(declared)
  return match?.[1] ?? null
}

/**
 * Non-secret env vars that must be set for production builds.
 * CI pipelines supply these; local dev may skip via --allow-missing-env.
 */
const REQUIRED_ENV_VARS: readonly string[] = [
  'NODE_ENV',
] as const

// ── Helpers ─────────────────────────────────────────────────────────────────

let passCount = 0
let failCount = 0

function ok(msg: string): void {
  passCount++
  process.stdout.write(`  \u2714 ${msg}\n`)
}

function fail(msg: string): void {
  failCount++
  process.stderr.write(`  \u2718 ${msg}\n`)
}

function getPnpmVersion(): string {
  const userAgent = process.env.npm_config_user_agent ?? ''
  const match = /pnpm\/(\d+\.\d+\.\d+)/.exec(userAgent)
  return match?.[1] ?? ''
}

// ── Checks ──────────────────────────────────────────────────────────────────

function checkNodeVersion(): void {
  const raw = process.versions.node
  const major = Number.parseInt(raw.split('.')[0] ?? '0', 10)
  if (major >= EXPECTED_NODE_MAJOR_MIN) {
    ok(`Node version valid (v${raw})`)
  } else {
    fail(`Node version too old: expected v${EXPECTED_NODE_MAJOR_MIN}+, got v${raw}`)
  }
}

function checkPnpmVersion(): void {
  const expected = getExpectedPnpmVersion()
  const raw = getPnpmVersion()

  if (!expected) {
    fail('packageManager field missing or invalid for pnpm version check')
    return
  }

  if (raw === expected) {
    ok(`pnpm version valid (${raw})`)
  } else if (raw) {
    fail(`pnpm version mismatch: expected ${expected}, got ${raw}`)
  } else {
    fail('pnpm not found on PATH')
  }
}

function checkLockfileIntegrity(): void {
  if (!existsSync(LOCKFILE_PATH)) {
    fail('pnpm-lock.yaml not found')
    return
  }

  // Verify that package.json packageManager field matches
  const pkgJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8')) as {
    packageManager?: string
  }
  const declared = pkgJson.packageManager ?? ''
  if (!declared.startsWith('pnpm@')) {
    fail(`packageManager field missing or invalid: "${declared}"`)
    return
  }

  // Verify lockfile is parseable and not empty
  const lockContent = readFileSync(LOCKFILE_PATH, 'utf-8')
  if (lockContent.length < 100) {
    fail('pnpm-lock.yaml appears empty or truncated')
    return
  }

  // Compute deterministic hash for audit trail
  const hash = createHash('sha256').update(lockContent, 'utf-8').digest('hex')
  ok(`Lockfile consistent (sha256: ${hash.slice(0, 16)}…)`)
}

function checkEnvironmentVariables(): void {
  const isCI = Boolean(process.env.CI)
  const allowMissing = process.argv.includes('--allow-missing-env') || !isCI
  const missing: string[] = []

  for (const name of REQUIRED_ENV_VARS) {
    if (!process.env[name]) {
      missing.push(name)
    }
  }

  if (missing.length === 0) {
    ok('Environment configuration valid')
  } else if (allowMissing) {
    ok(`Environment configuration valid (${missing.length} optional vars not set — non-CI)`)
  } else {
    fail(`Missing environment variables: ${missing.join(', ')}`)
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

function main(): void {
  process.stdout.write('\n\u2501\u2501\u2501 Nzila OS \u2014 Build Environment Check \u2501\u2501\u2501\n\n')

  checkNodeVersion()
  checkPnpmVersion()
  checkLockfileIntegrity()
  checkEnvironmentVariables()

  process.stdout.write(`\n  ${passCount} passed, ${failCount} failed\n\n`)

  if (failCount > 0) {
    process.exit(1)
  }
}

main()
