/**
 * Platform Adoption Gate
 *
 * Concern-based adoption validation that measures real app adoption of the
 * authoritative platform package map in governance/platform-package-authority.json.
 *
 * Usage: pnpm platform:adoption:check
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

const REGISTRY_PATH = path.join(ROOT, 'platform', 'registry', 'platform-registry.json')
const AUTHORITY_PATH = path.join(ROOT, 'governance', 'platform-package-authority.json')
const EXCEPTIONS_PATH = path.join(ROOT, 'governance', 'exceptions', 'platform-concern-adoption-exceptions.json')
const REPORT_PATH = path.join(ROOT, 'governance', 'reports', 'platform-concern-adoption-report.json')

type Tier = 'PRODUCTION' | 'PILOT' | 'INCUBATING' | 'EXPERIMENTAL'
type ConcernId =
  | 'auth'
  | 'contracts'
  | 'eventing'
  | 'observability'
  | 'org-context'
  | 'evidence'
  | 'notifications'
  | 'integrations'
  | 'revenue'
  | 'billing'
  | 'deployment'
  | 'feature-flags'
  | 'data-fabric'

type AppClassification =
  | 'fully adopted'
  | 'partially adopted'
  | 'exception-approved'
  | 'legacy migration path'

interface RegistryApp {
  name: string
  path: string
  tier: Tier
}

interface ConcernAuthority {
  id: ConcernId
  authoritative: string[]
}

interface AuthorityMap {
  concerns: ConcernAuthority[]
}

interface ExceptionEntry {
  app: string
  concern: ConcernId
  status: 'exception-approved' | 'legacy-migration-path'
  owner: string
  justification: string
  expiresOn: string
}

interface ExceptionFile {
  entries: ExceptionEntry[]
}

interface ConcernResult {
  concern: ConcernId
  passed: boolean
  required: boolean
  detail: string
  exception?: ExceptionEntry
  blockingFailure: boolean
}

interface AppResult {
  app: string
  tier: Tier
  classification: AppClassification
  requiredConcerns: ConcernId[]
  concernResults: ConcernResult[]
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T
}

function readFileText(p: string): string | null {
  try {
    return fs.readFileSync(p, 'utf-8')
  } catch {
    return null
  }
}

function readPkg(appDir: string): Record<string, unknown> {
  const pkgPath = path.join(appDir, 'package.json')
  if (!fs.existsSync(pkgPath)) return {}
  try {
    return readJson<Record<string, unknown>>(pkgPath)
  } catch {
    return {}
  }
}

function appDeps(pkg: Record<string, unknown>): Set<string> {
  const deps = (pkg.dependencies ?? {}) as Record<string, string>
  const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>
  return new Set<string>([...Object.keys(deps), ...Object.keys(devDeps)])
}

function hasAnyDep(deps: Set<string>, names: string[]): boolean {
  return names.some((name) => deps.has(name))
}

function walkFiles(dir: string, match: RegExp, maxDepth = 5): boolean {
  if (!fs.existsSync(dir)) return false
  const search = (d: string, depth: number): boolean => {
    if (depth > maxDepth) return false
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'dist') continue
      const full = path.join(d, entry.name)
      if (entry.isDirectory()) {
        if (search(full, depth + 1)) return true
      } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
        const text = readFileText(full)
        if (text && match.test(text)) return true
      }
    }
    return false
  }
  return search(dir, 0)
}

function exceptionFor(
  app: string,
  concern: ConcernId,
  exceptions: ExceptionEntry[],
): ExceptionEntry | undefined {
  const now = new Date()
  return exceptions.find((e) => {
    if (e.app !== app || e.concern !== concern) return false
    const expiry = new Date(`${e.expiresOn}T23:59:59Z`)
    return expiry >= now
  })
}

function isExpired(entry: ExceptionEntry): boolean {
  const expiry = new Date(`${entry.expiresOn}T23:59:59Z`)
  return expiry < new Date()
}

const BASE_REQUIRED_BY_TIER: Record<Tier, ConcernId[]> = {
  PRODUCTION: ['auth', 'org-context', 'observability'],
  PILOT: ['auth', 'org-context', 'observability'],
  INCUBATING: ['auth', 'observability'],
  EXPERIMENTAL: ['auth'],
}

const EXTRA_REQUIRED_BY_APP: Record<string, ConcernId[]> = {
  'control-plane': ['eventing', 'contracts', 'evidence', 'feature-flags', 'integrations', 'revenue'],
  'console': ['eventing', 'evidence', 'integrations'],
  'flow': ['eventing', 'contracts', 'revenue'],
  'cfo': ['contracts', 'revenue'],
  'partners': ['revenue'],
  'trade': ['revenue', 'evidence'],
  'zonga': ['revenue'],
  'platform-admin': ['eventing', 'integrations', 'data-fabric'],
  'orchestrator-api': ['eventing'],
}

function evaluateConcern(
  concern: ConcernId,
  appDir: string,
  deps: Set<string>,
): { passed: boolean; detail: string } {
  switch (concern) {
    case 'auth': {
      const passed = deps.has('@nzila/platform-auth')
      return {
        passed,
        detail: passed ? 'depends on @nzila/platform-auth' : 'missing @nzila/platform-auth dependency',
      }
    }
    case 'contracts': {
      const hasAdaptersDir = fs.existsSync(path.join(appDir, 'lib', 'platform-adapters'))
      const passed = deps.has('@nzila/platform-contracts') || hasAdaptersDir
      return {
        passed,
        detail: passed
          ? 'platform contracts adapter/dependency present'
          : 'no @nzila/platform-contracts dependency or platform-adapters scaffold',
      }
    }
    case 'eventing': {
      const passed = hasAnyDep(deps, ['@nzila/platform-events', '@nzila/platform-event-fabric'])
      return {
        passed,
        detail: passed
          ? 'depends on platform event layer'
          : 'missing @nzila/platform-events or @nzila/platform-event-fabric dependency',
      }
    }
    case 'observability': {
      const hasInstrumentation = fs.existsSync(path.join(appDir, 'instrumentation.ts'))
      const usesBoot = hasInstrumentation
        ? /createAppBoot/.test(readFileText(path.join(appDir, 'instrumentation.ts')) ?? '')
        : false
      const passed = deps.has('@nzila/os-core')
      return {
        passed,
        detail: passed
          ? usesBoot
            ? 'os-core telemetry dependency with canonical boot wiring'
            : 'os-core telemetry dependency present (custom boot wiring)'
          : 'missing canonical os-core telemetry dependency or boot wiring',
      }
    }
    case 'org-context': {
      const passed =
        deps.has('@nzila/platform-auth') ||
        walkFiles(appDir, /resolveOrgContext|OrgContext|@nzila\/org/, 6)
      return {
        passed,
        detail: passed
          ? 'org context propagation markers or platform-auth boundary found'
          : 'no resolveOrgContext/OrgContext/@nzila/org usage detected',
      }
    }
    case 'evidence': {
      const passed = hasAnyDep(deps, ['@nzila/platform-evidence-pack', '@nzila/evidence'])
      return {
        passed,
        detail: passed
          ? 'evidence dependency present'
          : 'missing @nzila/platform-evidence-pack or @nzila/evidence dependency',
      }
    }
    case 'notifications': {
      const passed = deps.has('@nzila/platform-notifications')
      return {
        passed,
        detail: passed ? 'depends on @nzila/platform-notifications' : 'notifications package not adopted',
      }
    }
    case 'integrations': {
      const passed = hasAnyDep(deps, [
        '@nzila/platform-integrations',
        '@nzila/platform-integrations-control-plane',
        '@nzila/integrations-runtime',
      ])
      return {
        passed,
        detail: passed ? 'integration layer dependency present' : 'no platform integration dependency found',
      }
    }
    case 'revenue': {
      const passed = deps.has('@nzila/platform-revenue')
      return {
        passed,
        detail: passed ? 'depends on @nzila/platform-revenue' : 'platform revenue dependency not adopted',
      }
    }
    case 'billing': {
      const passed = deps.has('@nzila/platform-billing')
      return {
        passed,
        detail: passed ? 'depends on @nzila/platform-billing' : 'platform billing dependency not adopted',
      }
    }
    case 'deployment': {
      const passed = deps.has('@nzila/platform-deploy')
      return {
        passed,
        detail: passed ? 'depends on @nzila/platform-deploy' : 'platform deploy dependency not adopted',
      }
    }
    case 'feature-flags': {
      const passed = deps.has('@nzila/platform-feature-flags')
      return {
        passed,
        detail: passed ? 'depends on @nzila/platform-feature-flags' : 'feature flag dependency not adopted',
      }
    }
    case 'data-fabric': {
      const passed = deps.has('@nzila/platform-data-fabric')
      return {
        passed,
        detail: passed ? 'depends on @nzila/platform-data-fabric' : 'data fabric dependency not adopted',
      }
    }
  }
}

const registry = readJson<{ apps: RegistryApp[] }>(REGISTRY_PATH)
const authority = readJson<AuthorityMap>(AUTHORITY_PATH)
const exceptionFile = readJson<ExceptionFile>(EXCEPTIONS_PATH)

const concernIds = authority.concerns.map((c) => c.id)
const appResults: AppResult[] = []
const failures: string[] = []

for (const entry of exceptionFile.entries) {
  if (isExpired(entry)) {
    failures.push(
      `[${entry.app}] ${entry.concern}: exception expired on ${entry.expiresOn} (owner: ${entry.owner})`,
    )
  }
}

for (const app of registry.apps) {
  const appDir = path.join(ROOT, app.path)
  if (!fs.existsSync(appDir)) {
    failures.push(`[${app.name}] app path missing: ${app.path}`)
    continue
  }

  const pkg = readPkg(appDir)
  const deps = appDeps(pkg)
  const required = new Set<ConcernId>([
    ...BASE_REQUIRED_BY_TIER[app.tier],
    ...(EXTRA_REQUIRED_BY_APP[app.name] ?? []),
  ])

  const concernResults: ConcernResult[] = concernIds.map((concern) => {
    const evaluated = evaluateConcern(concern, appDir, deps)
    const requiredConcern = required.has(concern)
    const ex = exceptionFor(app.name, concern, exceptionFile.entries)

    if (evaluated.passed || !requiredConcern) {
      return {
        concern,
        passed: evaluated.passed,
        required: requiredConcern,
        detail: evaluated.detail,
        blockingFailure: false,
      }
    }

    if (ex) {
      return {
        concern,
        passed: true,
        required: true,
        detail: `${evaluated.detail} (exception: ${ex.status}, expires ${ex.expiresOn})`,
        exception: ex,
        blockingFailure: false,
      }
    }

    const blocking = app.tier === 'PRODUCTION' || app.tier === 'PILOT'
    return {
      concern,
      passed: false,
      required: true,
      detail: evaluated.detail,
      blockingFailure: blocking,
    }
  })

  const requiredResults = concernResults.filter((r) => r.required)
  const requiredFailed = requiredResults.filter((r) => !r.passed)
  const hasBlocking = requiredFailed.some((r) => r.blockingFailure)
  const hasLegacyException = requiredResults.some((r) => r.exception?.status === 'legacy-migration-path')
  const hasAnyException = requiredResults.some((r) => Boolean(r.exception))

  let classification: AppClassification = 'fully adopted'
  if (hasBlocking || requiredFailed.length > 0) {
    classification = 'partially adopted'
  } else if (hasLegacyException) {
    classification = 'legacy migration path'
  } else if (hasAnyException) {
    classification = 'exception-approved'
  }

  if (hasBlocking) {
    for (const failure of requiredFailed.filter((r) => r.blockingFailure)) {
      failures.push(`[${app.name}] ${failure.concern}: ${failure.detail}`)
    }
  }

  appResults.push({
    app: app.name,
    tier: app.tier,
    classification,
    requiredConcerns: Array.from(required),
    concernResults,
  })
}

const byClassification: Record<AppClassification, number> = {
  'fully adopted': 0,
  'partially adopted': 0,
  'exception-approved': 0,
  'legacy migration path': 0,
}

for (const app of appResults) {
  byClassification[app.classification]++
}

process.stdout.write('\n')
process.stdout.write('═══════════════════════════════════════\n')
process.stdout.write('  Platform Concern Adoption Gate\n')
process.stdout.write('═══════════════════════════════════════\n\n')
process.stdout.write(`  Apps scanned: ${appResults.length}\n`)
process.stdout.write(`  Fully adopted: ${byClassification['fully adopted']}\n`)
process.stdout.write(`  Exception-approved: ${byClassification['exception-approved']}\n`)
process.stdout.write(`  Legacy migration path: ${byClassification['legacy migration path']}\n`)
process.stdout.write(`  Partially adopted: ${byClassification['partially adopted']}\n\n`)

for (const app of appResults) {
  const required = app.concernResults.filter((c) => c.required)
  const passed = required.filter((c) => c.passed).length
  const icon =
    app.classification === 'fully adopted'
      ? '✓'
      : app.classification === 'partially adopted'
        ? '◐'
        : '•'
  process.stdout.write(`  ${icon} ${app.app} [${app.tier}] ${app.classification} (${passed}/${required.length})\n`)
}

process.stdout.write('\n')

const reportDir = path.dirname(REPORT_PATH)
if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true })
}

fs.writeFileSync(
  REPORT_PATH,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      authorityMap: path.relative(ROOT, AUTHORITY_PATH).replaceAll('\\\\', '/'),
      exceptions: path.relative(ROOT, EXCEPTIONS_PATH).replaceAll('\\\\', '/'),
      summary: byClassification,
      apps: appResults,
    },
    null,
    2,
  ),
)

process.stdout.write(`  Report: ${path.relative(ROOT, REPORT_PATH).replaceAll('\\\\', '/')}\n\n`)

if (failures.length > 0) {
  process.stderr.write('  Blocking failures:\n')
  for (const failure of failures) {
    process.stderr.write(`    ✗ ${failure}\n`)
  }
  process.stderr.write('\n')
  process.exit(1)
}

process.stdout.write('  ✓ Platform concern adoption policy satisfied\n\n')
