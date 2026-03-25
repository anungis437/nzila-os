/**
 * Staging Parity Lock — Environment Configuration Verification (Phase 7)
 *
 * Verifies that deployed apps have consistent environment configuration:
 *   1. Each deployed app has env vars documented (.env.example)
 *   2. No dev-only key fallbacks in production code paths
 *   3. No localhost fallbacks that would break staging/prod
 *
 * Usage:
 *   pnpm tsx tooling/env/parity-check.ts             # check all deployed apps
 *   pnpm tsx tooling/env/parity-check.ts --app web    # check specific app
 *   pnpm tsx tooling/env/parity-check.ts --strict     # exit 1 on any issue
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO_ROOT = resolve(join(__dirname, '..', '..'))
const APPS_DIR = join(REPO_ROOT, 'apps')

/** Apps currently deployed to staging (from gitops-deploy.yml) */
export const DEPLOYED_APPS = [
  'web',
  'console',
  'partners',
  'union-eyes',
  'orchestrator-api',
  'cfo',
  'zonga',
]

interface ParityIssue {
  severity: 'error' | 'warning'
  message: string
}

export interface ParityResult {
  app: string
  passed: boolean
  issues: ParityIssue[]
}

function walkFiles(
  dir: string,
  callback: (filePath: string) => void,
  depth = 0,
): void {
  if (depth > 4) return
  try {
    for (const entry of readdirSync(dir)) {
      if (
        entry === 'node_modules' ||
        entry === '.next' ||
        entry === 'dist' ||
        entry === '.turbo' ||
        entry.startsWith('.')
      )
        continue
      const full = join(dir, entry)
      try {
        const stat = statSync(full)
        if (stat.isDirectory()) {
          walkFiles(full, callback, depth + 1)
        } else {
          callback(full)
        }
      } catch {
        /* skip inaccessible */
      }
    }
  } catch {
    /* skip inaccessible dirs */
  }
}

export function checkAppParity(appName: string): ParityResult {
  const issues: ParityIssue[] = []
  const appDir = join(APPS_DIR, appName)

  if (!existsSync(appDir)) {
    return {
      app: appName,
      passed: false,
      issues: [{ severity: 'error', message: `App directory not found: apps/${appName}` }],
    }
  }

  // ── Check for .env.example documentation ─────────────────────────────
  const envExamplePaths = [
    join(appDir, '.env.example'),
    join(appDir, '.env.local.example'),
    join(appDir, 'env.example'),
  ]
  if (!envExamplePaths.some((p) => existsSync(p))) {
    issues.push({
      severity: 'warning',
      message: 'Missing .env.example — required env vars not documented',
    })
  }

  // ── Check for dev-only fallbacks in source code ──────────────────────
  const dangerousPatterns: { pattern: RegExp; message: string }[] = [
    { pattern: /process\.env\.\w+\s*\|\|\s*['"]sk_test_/g, message: 'Dev-only Clerk secret key fallback' },
    { pattern: /process\.env\.\w+\s*\|\|\s*['"]pk_test_/g, message: 'Dev-only Clerk publishable key fallback' },
    { pattern: /process\.env\.\w+\s*\|\|\s*['"]localhost/g, message: 'Localhost fallback in env var' },
    { pattern: /process\.env\.\w+\s*\|\|\s*['"]sk_live_/g, message: 'Hardcoded live Stripe key' },
  ]

  const scanDirs = [join(appDir, 'app'), join(appDir, 'src'), join(appDir, 'lib')]

  for (const dir of scanDirs) {
    if (!existsSync(dir)) continue
    walkFiles(dir, (filePath) => {
      if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return
      const content = readFileSync(filePath, 'utf-8')
      for (const { pattern, message } of dangerousPatterns) {
        pattern.lastIndex = 0
        if (pattern.test(content)) {
          const relPath = filePath.slice(REPO_ROOT.length + 1).replace(/\\/g, '/')
          issues.push({ severity: 'warning', message: `${message} in ${relPath}` })
        }
        pattern.lastIndex = 0
      }
    })
  }

  return {
    app: appName,
    passed: issues.filter((i) => i.severity === 'error').length === 0,
    issues,
  }
}

// ── CLI entrypoint ─────────────────────────────────────────────────────────
const isCli =
  typeof require !== 'undefined' && require.main === module

if (isCli) {
  const args = process.argv.slice(2)
  const appIdx = args.indexOf('--app')
  const strict = args.includes('--strict')
  const appsToCheck = appIdx >= 0 && args[appIdx + 1] ? [args[appIdx + 1]] : DEPLOYED_APPS

  console.log('\n📋 Staging Parity Check\n')

  let hasErrors = false
  let hasWarnings = false

  for (const app of appsToCheck) {
    const result = checkAppParity(app)
    const icon = result.issues.length === 0 ? '✅' : result.passed ? '⚠️' : '❌'
    console.log(`  ${icon} ${result.app}`)
    for (const issue of result.issues) {
      const prefix = issue.severity === 'error' ? '❌' : '⚠️'
      console.log(`      ${prefix} ${issue.message}`)
    }
    if (!result.passed) hasErrors = true
    if (result.issues.length > 0) hasWarnings = true
  }

  console.log('')

  if (hasErrors) {
    console.error('❌ Parity check failed — fix errors above.\n')
    process.exit(1)
  }

  if (hasWarnings && strict) {
    console.error('⚠️  Parity warnings detected in --strict mode.\n')
    process.exit(1)
  }

  if (hasWarnings) {
    console.warn('⚠️  Parity warnings detected (non-blocking). Use --strict to enforce.\n')
  } else {
    console.log('✅ All deployed apps pass parity check.\n')
  }
}
