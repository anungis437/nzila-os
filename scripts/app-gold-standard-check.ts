/**
 * App Gold Standard Check — validates that each target app meets the
 * structural, testing, and integration requirements defined in
 * docs/governance/APP_GOLD_STANDARD.md.
 *
 * Usage: pnpm app:gold-standard:check
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

const TARGET_APPS = [
  'union-eyes',
  'flow',
  'zonga',
  'cfo',
  'partners',
  'web',
  'console',
]

interface CheckResult {
  app: string
  check: string
  passed: boolean
  detail: string
}

const results: CheckResult[] = []

function check(app: string, name: string, passed: boolean, detail: string) {
  results.push({ app, check: name, passed, detail })
}

function fileExists(p: string): boolean {
  return fs.existsSync(p)
}

function countTestFiles(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0
  let count = 0
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.next') {
        walk(full)
      } else if (entry.isFile() && /\.test\.tsx?$/.test(entry.name)) {
        count++
      }
    }
  }
  walk(dirPath)
  return count
}

// ── Per-app checks ──────────────────────────────────

for (const app of TARGET_APPS) {
  const appDir = path.join(ROOT, 'apps', app)

  if (!fs.existsSync(appDir)) {
    check(app, 'exists', false, `apps/${app} not found`)
    continue
  }

  // 1. Health endpoint
  check(
    app,
    'health-endpoint',
    fileExists(path.join(appDir, 'app', 'api', 'health', 'route.ts')),
    'app/api/health/route.ts',
  )

  // 2. Metrics endpoint
  check(
    app,
    'metrics-endpoint',
    fileExists(path.join(appDir, 'app', 'api', 'metrics', 'route.ts')) ||
      fileExists(path.join(appDir, 'app', 'api', 'analytics', 'route.ts')),
    'app/api/metrics/ or analytics/',
  )

  // 3. Evidence export endpoint
  check(
    app,
    'evidence-endpoint',
    fileExists(path.join(appDir, 'app', 'api', 'evidence', 'export', 'route.ts')) ||
      fileExists(path.join(appDir, 'lib', 'evidence.ts')),
    'evidence export',
  )

  // 4. Policy enforcement module
  check(
    app,
    'policy-enforcement',
    fileExists(path.join(appDir, 'lib', 'policy-enforcement.ts')) ||
      fileExists(path.join(appDir, 'lib', 'policyEnforcement.ts')) ||
      fileExists(path.join(appDir, 'lib', 'services', 'policy-engine.ts')),
    'lib/policy-enforcement.ts',
  )

  // 5. Demo seed data
  check(
    app,
    'demo-seed',
    fileExists(path.join(appDir, 'lib', 'demoSeed.ts')) ||
      fileExists(path.join(appDir, 'lib', 'demo-seed.ts')) ||
      fileExists(path.join(appDir, 'seed.ts')),
    'lib/demoSeed.ts',
  )

  // 6. Docs directory
  check(
    app,
    'docs-directory',
    fs.existsSync(path.join(appDir, 'docs')),
    'docs/',
  )

  // 7. Domain model doc (new per anti-entropy)
  check(
    app,
    'domain-model-doc',
    fileExists(path.join(appDir, 'docs', 'DOMAIN_MODEL.md')),
    'docs/DOMAIN_MODEL.md',
  )

  // 8. Test coverage (minimum 3 test files)
  const testCount = countTestFiles(appDir)
  check(
    app,
    'test-coverage',
    testCount >= 3,
    `${testCount} test file(s) found (minimum 3)`,
  )

  // 9. Package.json test script without --passWithNoTests
  const pkgPath = path.join(appDir, 'package.json')
  if (fileExists(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    const testScript = pkg.scripts?.test ?? ''
    check(
      app,
      'strict-test-script',
      testScript.length > 0 && !testScript.includes('--passWithNoTests'),
      `test: "${testScript}"`,
    )
  }

  // 10. vitest.config.ts or vitest.config.mts
  check(
    app,
    'vitest-config',
    fileExists(path.join(appDir, 'vitest.config.ts')) ||
      fileExists(path.join(appDir, 'vitest.config.mts')),
    'vitest.config.ts',
  )

  // 11. tsconfig.json
  check(
    app,
    'tsconfig',
    fileExists(path.join(appDir, 'tsconfig.json')),
    'tsconfig.json',
  )

  // 12. next.config.ts or next.config.mjs or next.config.js
  check(
    app,
    'next-config',
    fileExists(path.join(appDir, 'next.config.ts')) ||
      fileExists(path.join(appDir, 'next.config.mjs')) ||
      fileExists(path.join(appDir, 'next.config.js')),
    'next.config.*',
  )
}

// ── Report ──────────────────────────────────────────

const appSummaries: Record<string, { total: number; passed: number }> = {}
for (const r of results) {
  if (!appSummaries[r.app]) appSummaries[r.app] = { total: 0, passed: 0 }
  appSummaries[r.app].total++
  if (r.passed) appSummaries[r.app].passed++
}

const failed = results.filter((r) => !r.passed)

process.stdout.write('\n')
process.stdout.write('═══════════════════════════════════════\n')
process.stdout.write('  App Gold Standard Check\n')
process.stdout.write('═══════════════════════════════════════\n\n')

for (const [app, summary] of Object.entries(appSummaries)) {
  const pct = Math.round((summary.passed / summary.total) * 100)
  const level = pct === 100 ? 'FULL' : pct >= 50 ? 'PARTIAL' : 'NON-COMPLIANT'
  const icon = pct === 100 ? '✓' : pct >= 50 ? '◐' : '✗'
  process.stdout.write(`  ${icon} ${app}: ${summary.passed}/${summary.total} (${level})\n`)
}

process.stdout.write('\n')

if (failed.length > 0) {
  process.stderr.write('  Failures:\n')
  for (const f of failed) {
    process.stderr.write(`    ✗ [${f.app}] ${f.check}: ${f.detail}\n`)
  }
  process.stderr.write('\n  See docs/governance/APP_GOLD_STANDARD.md for requirements.\n\n')
}

// Require at least PARTIAL compliance for all apps
const nonCompliantApps = Object.entries(appSummaries)
  .filter(([, s]) => (s.passed / s.total) < 0.5)
if (nonCompliantApps.length > 0) {
  process.stderr.write(`  ✗ ${nonCompliantApps.length} app(s) are NON-COMPLIANT\n\n`)
  process.exit(1)
} else {
  process.stdout.write('  ✓ All apps meet minimum compliance\n\n')
}
