#!/usr/bin/env npx tsx
/**
 * validate:runtime — Checks all apps for runtime contract compliance.
 *
 * Verifies:
 *   1. middleware.ts exists and has rate limiting + request-ID propagation
 *   2. Env schema exists in @nzila/os-core/config for the app
 *   3. API health route exists
 *   4. @nzila/os-core is in dependencies
 *
 * Exit code 1 if any app fails a required check.
 */

import { readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const APPS_DIR = join(ROOT, 'apps')

// All apps expected to follow runtime contracts
const APPS = [
  'abr',
  'cfo',
  'console',
  'cora',
  'mobility',
  'mobility-client-portal',
  'nacp-exams',
  'orchestrator-api',
  'partners',
  'platform-admin',
  'agrimo',
  'shop-quoter',
  'trade',
  'union-eyes',
  'web',
  'zonga',
]

// Apps that have env schemas in os-core
const ENV_SCHEMA_APPS = [
  'abr',
  'cfo',
  'console',
  'cora',
  'mobility',
  'mobility-client-portal',
  'nacp-exams',
  'orchestrator-api',
  'partners',
  'platform-admin',
  'agrimo',
  'shop-quoter',
  'trade',
  'union-eyes',
  'web',
  'zonga',
]

interface Finding {
  app: string
  check: string
  severity: 'error' | 'warning'
  message: string
}

const findings: Finding[] = []

for (const app of APPS) {
  const appDir = join(APPS_DIR, app)
  if (!existsSync(appDir)) {
    findings.push({
      app,
      check: 'app-exists',
      severity: 'error',
      message: `App directory does not exist: ${appDir}`,
    })
    continue
  }

  // 1. Check middleware.ts (Next.js apps only; orchestrator-api is Fastify)
  if (app !== 'orchestrator-api') {
    const mwPath = join(appDir, 'middleware.ts')
    if (!existsSync(mwPath)) {
      findings.push({
        app,
        check: 'middleware-exists',
        severity: 'error',
        message: 'Missing middleware.ts — no rate limiting or request-ID propagation',
      })
    } else {
      const mw = readFileSync(mwPath, 'utf-8')
      if (!mw.includes('checkRateLimit')) {
        findings.push({
          app,
          check: 'middleware-rate-limit',
          severity: 'error',
          message: 'middleware.ts does not use checkRateLimit from @nzila/os-core',
        })
      }
      if (!mw.includes('x-request-id')) {
        findings.push({
          app,
          check: 'middleware-request-id',
          severity: 'error',
          message: 'middleware.ts does not propagate x-request-id header',
        })
      }
    }
  }

  // 2. Check @nzila/os-core dependency
  const pkgPath = join(appDir, 'package.json')
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    if (!deps['@nzila/os-core']) {
      findings.push({
        app,
        check: 'os-core-dep',
        severity: 'warning',
        message: '@nzila/os-core is not in dependencies',
      })
    }
  }

  // 3. Check health route
  const healthPaths = [
    join(appDir, 'app', 'api', 'health', 'route.ts'),
    join(appDir, 'src', 'routes', 'health.ts'),
  ]
  const hasHealth = healthPaths.some((p) => existsSync(p))
  if (!hasHealth) {
    findings.push({
      app,
      check: 'health-route',
      severity: 'warning',
      message: 'No health check route found',
    })
  }
}

// 4. Check env schema coverage
const envPath = join(ROOT, 'packages', 'os-core', 'src', 'config', 'env.ts')
if (existsSync(envPath)) {
  const envFile = readFileSync(envPath, 'utf-8')
  for (const app of ENV_SCHEMA_APPS) {
    // Check if app name appears in SCHEMAS record
    if (!envFile.includes(`'${app}'`)) {
      findings.push({
        app,
        check: 'env-schema',
        severity: 'error',
        message: `No Zod env schema defined in @nzila/os-core/config for '${app}'`,
      })
    }
  }
}

// ── Report ──────────────────────────────────────────────────────────────────

const errors = findings.filter((f) => f.severity === 'error')
const warnings = findings.filter((f) => f.severity === 'warning')

console.log('\n══════════════════════════════════════════════════════════════')
console.log('  NzilaOS Runtime Contract Validation')
console.log('══════════════════════════════════════════════════════════════\n')

if (findings.length === 0) {
  console.log('✅ All apps pass runtime contract checks.\n')
} else {
  for (const f of findings) {
    const icon = f.severity === 'error' ? '❌' : '⚠️'
    console.log(`${icon} [${f.app}] ${f.check}: ${f.message}`)
  }
  console.log(
    `\n  Errors: ${errors.length}  |  Warnings: ${warnings.length}  |  Total: ${findings.length}\n`,
  )
}

if (errors.length > 0) {
  console.log('❌ Runtime contract validation FAILED.\n')
  process.exit(1)
} else {
  console.log('✅ Runtime contract validation passed (with warnings).\n')
}
