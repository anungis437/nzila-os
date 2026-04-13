/**
 * Platform Adoption Gate — enforces that every governed Next.js app adopts
 * the four mandatory platform packages introduced during consolidation:
 *
 *   1. Shell:        imports NzilaAppShell from @nzila/platform-shell
 *   2. Schema-core:  declares @nzila/schema-core as dependency
 *   3. Workflow:     declares @nzila/governed-workflow as dependency
 *   4. Observability: instrumentation.ts imports createAppBoot from @nzila/os-core/telemetry
 *
 * Usage: pnpm platform:adoption:check
 *
 * Exceptions listed in KNOWN_EXCEPTIONS are documented and do NOT fail the gate.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

// ── Governed apps — all Next.js apps under apps/ ────
const GOVERNED_APPS = [
  'abr',
  'agrimo',
  'cfo',
  'console',
  'control-plane',
  'cora',
  'flow',
  'mobility',
  'mobility-client-portal',
  'nacp-exams',
  'partners',
  'platform-admin',
  'trade',
  'web',
  'zonga',
]

// ── Documented exceptions ───────────────────────────
// union-eyes:       Django hybrid — custom instrumentation, shell-free SSR
// orchestrator-api: Fastify (non-Next.js) — different boot path
// web:              Public marketing site — own nav/footer, not internal app shell
// mobility-client-portal: External client portal — own branding, not internal ops shell
const KNOWN_EXCEPTIONS: Record<string, string[]> = {
  'union-eyes': ['shell', 'observability'],
  'orchestrator-api': ['shell', 'schema-core', 'observability'],
  'web': ['shell'],
  'mobility-client-portal': ['shell'],
}

// ── Results ─────────────────────────────────────────

interface CheckResult {
  app: string
  check: string
  passed: boolean
  detail: string
  exception?: boolean
}

const results: CheckResult[] = []

function record(
  app: string,
  check: string,
  passed: boolean,
  detail: string,
) {
  const exception = KNOWN_EXCEPTIONS[app]?.includes(check) ?? false
  results.push({ app, check, passed: passed || exception, detail, exception })
}

function readFileText(p: string): string | null {
  try {
    return fs.readFileSync(p, 'utf-8')
  } catch {
    return null
  }
}

function readPkgJson(appDir: string): Record<string, unknown> | null {
  const text = readFileText(path.join(appDir, 'package.json'))
  if (!text) return null
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return null
  }
}

function hasDep(pkg: Record<string, unknown>, dep: string): boolean {
  const deps = (pkg.dependencies ?? {}) as Record<string, string>
  const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>
  return dep in deps || dep in devDeps
}

// ── Walk to find import string in .ts/.tsx files ────

function walkFiles(dir: string, match: RegExp, maxDepth = 4): boolean {
  if (!fs.existsSync(dir)) return false
  const search = (d: string, depth: number): boolean => {
    if (depth > maxDepth) return false
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue
      const full = path.join(d, entry.name)
      if (entry.isDirectory()) {
        if (search(full, depth + 1)) return true
      } else if (/\.tsx?$/.test(entry.name)) {
        const text = readFileText(full)
        if (text && match.test(text)) return true
      }
    }
    return false
  }
  return search(dir, 0)
}

// ── Run checks ──────────────────────────────────────

for (const app of GOVERNED_APPS) {
  const appDir = path.join(ROOT, 'apps', app)
  if (!fs.existsSync(appDir)) {
    record(app, 'exists', false, `apps/${app} not found`)
    continue
  }

  const pkg = readPkgJson(appDir)

  // 1. Shell — NzilaAppShell import in layout or components
  const shellImport = walkFiles(
    appDir,
    /from\s+['"]@nzila\/platform-shell/,
    5,
  )
  record(app, 'shell', shellImport, shellImport
    ? 'imports @nzila/platform-shell'
    : 'missing NzilaAppShell import')

  // 2. Schema-core — declared as dependency
  const hasSchema = pkg ? hasDep(pkg, '@nzila/schema-core') : false
  record(app, 'schema-core', hasSchema, hasSchema
    ? '@nzila/schema-core in dependencies'
    : '@nzila/schema-core not in package.json')

  // 3. Governed-workflow — declared as dependency
  const hasWorkflow = pkg ? hasDep(pkg, '@nzila/governed-workflow') : false
  record(app, 'governed-workflow', hasWorkflow, hasWorkflow
    ? '@nzila/governed-workflow in dependencies'
    : '@nzila/governed-workflow not in package.json')

  // 4. Observability — instrumentation.ts with createAppBoot
  const instrPath = path.join(appDir, 'instrumentation.ts')
  const instrText = readFileText(instrPath)
  const hasCanonicalBoot =
    instrText !== null && /createAppBoot/.test(instrText)
  record(app, 'observability', hasCanonicalBoot, hasCanonicalBoot
    ? 'instrumentation.ts uses createAppBoot'
    : instrText === null
      ? 'instrumentation.ts missing'
      : 'instrumentation.ts does not use createAppBoot')
}

// ── Scorecard ───────────────────────────────────────

const CHECKS = ['shell', 'schema-core', 'governed-workflow', 'observability'] as const

const appScores: Record<string, { total: number; passed: number; exceptions: number }> = {}
for (const r of results) {
  if (r.check === 'exists') continue
  if (!appScores[r.app]) appScores[r.app] = { total: 0, passed: 0, exceptions: 0 }
  appScores[r.app].total++
  if (r.passed) appScores[r.app].passed++
  if (r.exception) appScores[r.app].exceptions++
}

const failed = results.filter((r) => !r.passed)
const totalChecks = results.filter((r) => r.check !== 'exists').length
const totalPassed = results.filter((r) => r.check !== 'exists' && r.passed).length

process.stdout.write('\n')
process.stdout.write('═══════════════════════════════════════\n')
process.stdout.write('  Platform Adoption Gate\n')
process.stdout.write('═══════════════════════════════════════\n\n')

// Per-check summary
for (const check of CHECKS) {
  const checkResults = results.filter((r) => r.check === check)
  const pass = checkResults.filter((r) => r.passed).length
  const total = checkResults.length
  const icon = pass === total ? '✓' : '◐'
  process.stdout.write(`  ${icon} ${check}: ${pass}/${total} apps\n`)
}

process.stdout.write('\n')

// Per-app scorecard
for (const [app, score] of Object.entries(appScores)) {
  const pct = Math.round((score.passed / score.total) * 100)
  const icon = pct === 100 ? '✓' : pct >= 50 ? '◐' : '✗'
  const excNote = score.exceptions > 0 ? ` (${score.exceptions} exception${score.exceptions > 1 ? 's' : ''})` : ''
  process.stdout.write(`  ${icon} ${app}: ${score.passed}/${score.total} (${pct}%)${excNote}\n`)
}

process.stdout.write('\n')
process.stdout.write(`  Total: ${totalPassed}/${totalChecks} checks passing\n\n`)

if (failed.length > 0) {
  process.stderr.write('  Failures:\n')
  for (const f of failed) {
    process.stderr.write(`    ✗ [${f.app}] ${f.check}: ${f.detail}\n`)
  }
  process.stderr.write('\n')
  process.exit(1)
} else {
  process.stdout.write('  ✓ All governed apps meet platform adoption requirements\n\n')
}
