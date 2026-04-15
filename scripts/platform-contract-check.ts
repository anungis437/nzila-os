/**
 * Platform Contract Check — validates that target apps have
 * the platform-adapters scaffold and that the platform-contracts
 * package contract modules are structurally valid.
 *
 * Usage: pnpm platform:contract:check
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

const CONTRACTS_PKG = path.join(ROOT, 'packages', 'platform-contracts')
const APPS_DIR = path.join(ROOT, 'apps')

const TARGET_APPS = [
  'union-eyes',
  'zonga',
  'cfo',
  'partners',
  'control-plane',
  'web',
] as const

const CONTRACT_MODULES = [
  'health',
  'metrics',
  'governance',
  'evidence',
  'environment',
  'change',
  'schemas',
] as const

interface Violation {
  scope: string
  issue: string
  severity: 'error' | 'warning'
}

const violations: Violation[] = []

// ── Check platform-contracts package exists ─────────

if (!fs.existsSync(CONTRACTS_PKG)) {
  violations.push({
    scope: 'platform-contracts',
    issue: 'packages/platform-contracts does not exist',
    severity: 'error',
  })
} else {
  // Check package.json
  const pkgPath = path.join(CONTRACTS_PKG, 'package.json')
  if (!fs.existsSync(pkgPath)) {
    violations.push({
      scope: 'platform-contracts',
      issue: 'Missing package.json',
      severity: 'error',
    })
  }

  // Check contract modules exist
  for (const mod of CONTRACT_MODULES) {
    const modPath = path.join(CONTRACTS_PKG, 'src', `${mod}.ts`)
    if (!fs.existsSync(modPath)) {
      violations.push({
        scope: 'platform-contracts',
        issue: `Missing contract module: src/${mod}.ts`,
        severity: 'error',
      })
    }
  }

  // Check barrel index
  const indexPath = path.join(CONTRACTS_PKG, 'src', 'index.ts')
  if (!fs.existsSync(indexPath)) {
    violations.push({
      scope: 'platform-contracts',
      issue: 'Missing barrel src/index.ts',
      severity: 'error',
    })
  }
}

// ── Check app platform-adapters scaffolds ───────────

for (const appName of TARGET_APPS) {
  const adaptersDir = path.join(APPS_DIR, appName, 'lib', 'platform-adapters')

  if (!fs.existsSync(adaptersDir)) {
    violations.push({
      scope: appName,
      issue: 'Missing lib/platform-adapters/ directory',
      severity: 'error',
    })
    continue
  }

  const indexPath = path.join(adaptersDir, 'index.ts')
  if (!fs.existsSync(indexPath)) {
    violations.push({
      scope: appName,
      issue: 'Missing lib/platform-adapters/index.ts barrel',
      severity: 'error',
    })
  }
}

// ── Report ──────────────────────────────────────────

const errors = violations.filter((v) => v.severity === 'error')
const warnings = violations.filter((v) => v.severity === 'warning')

process.stdout.write('\n')
process.stdout.write('═══════════════════════════════════════\n')
process.stdout.write('  Platform Contract Check\n')
process.stdout.write('═══════════════════════════════════════\n\n')

// Package status
const pkgExists = fs.existsSync(CONTRACTS_PKG)
const pkgIssues = violations.filter((v) => v.scope === 'platform-contracts')
process.stdout.write(`  ${pkgIssues.length === 0 ? '✓' : '✗'} platform-contracts package: ${pkgExists ? `${CONTRACT_MODULES.length} modules` : 'MISSING'}\n`)

// App adapter status
for (const appName of TARGET_APPS) {
  const appIssues = violations.filter((v) => v.scope === appName)
  const adaptersDir = path.join(APPS_DIR, appName, 'lib', 'platform-adapters')
  const hasAdapters = fs.existsSync(adaptersDir)
  process.stdout.write(`  ${appIssues.length === 0 ? '✓' : '✗'} ${appName}: ${hasAdapters ? 'adapters scaffold present' : 'no adapters'}\n`)
}

process.stdout.write(`\n  Errors:   ${errors.length}\n`)
process.stdout.write(`  Warnings: ${warnings.length}\n\n`)

if (errors.length > 0) {
  for (const v of errors) {
    process.stderr.write(`  ✗ [${v.scope}] ${v.issue}\n`)
  }
  process.stderr.write('\n')
  process.exit(1)
} else {
  process.stdout.write('  ✓ All platform contract scaffolds in place\n\n')
}
