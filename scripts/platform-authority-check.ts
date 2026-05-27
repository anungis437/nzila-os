/**
 * Platform Authority Check
 *
 * Validates authoritative package map coherence and prevents overlap drift
 * between authoritative and subordinate platform abstractions.
 *
 * Usage: pnpm exec tsx scripts/platform-authority-check.ts
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

const AUTHORITY_PATH = path.join(ROOT, 'governance', 'platform-package-authority.json')
const REGISTRY_PATH = path.join(ROOT, 'platform', 'registry', 'platform-registry.json')

interface ConcernEntry {
  id: string
  authoritative: string[]
  supporting?: string[]
  legacy?: string[]
  deprecatedForNewWork?: string[]
}

interface AuthorityMap {
  concerns: ConcernEntry[]
}

interface Registry {
  platform_services?: Array<{ name: string }>
  shared_packages?: Array<{ name: string }>
}

interface Violation {
  scope: string
  severity: 'error' | 'warning'
  issue: string
}

const violations: Violation[] = []

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T
}

function normalizePkgName(pkg: string): string {
  return pkg.replace('@nzila/', '')
}

function packageExists(pkg: string): boolean {
  const dir = path.join(ROOT, 'packages', normalizePkgName(pkg))
  return fs.existsSync(dir) && fs.existsSync(path.join(dir, 'package.json'))
}

function hasReadme(pkg: string): boolean {
  const dir = path.join(ROOT, 'packages', normalizePkgName(pkg))
  return fs.existsSync(path.join(dir, 'README.md'))
}

const authority = readJson<AuthorityMap>(AUTHORITY_PATH)
const registry = readJson<Registry>(REGISTRY_PATH)

const registryNames = new Set<string>([
  ...(registry.platform_services ?? []).map((x) => x.name),
  ...(registry.shared_packages ?? []).map((x) => x.name),
])

for (const concern of authority.concerns) {
  if (!concern.authoritative || concern.authoritative.length === 0) {
    violations.push({
      scope: concern.id,
      severity: 'error',
      issue: 'Concern has no authoritative package',
    })
    continue
  }

  for (const pkg of concern.authoritative) {
    if (!packageExists(pkg)) {
      violations.push({
        scope: concern.id,
        severity: 'error',
        issue: `Authoritative package does not exist: ${pkg}`,
      })
      continue
    }

    if (!hasReadme(pkg)) {
      violations.push({
        scope: concern.id,
        severity: 'error',
        issue: `Authoritative package missing README: ${pkg}`,
      })
    }

    const normalized = normalizePkgName(pkg)
    if (!registryNames.has(normalized)) {
      violations.push({
        scope: concern.id,
        severity: 'warning',
        issue: `Authoritative package not registered in platform-registry.json: ${normalized}`,
      })
    }
  }
}

const appDirs = fs
  .readdirSync(path.join(ROOT, 'apps'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)

const overlapPairs: Array<{ concern: string; authoritative: string[]; subordinate: string[] }> = [
  {
    concern: 'contracts',
    authoritative: ['@nzila/platform-contracts'],
    subordinate: ['@nzila/contracts'],
  },
  {
    concern: 'eventing',
    authoritative: ['@nzila/platform-events', '@nzila/platform-event-fabric'],
    subordinate: ['@nzila/events'],
  },
  {
    concern: 'observability',
    authoritative: ['@nzila/os-core', '@nzila/platform-observability'],
    subordinate: ['@nzila/observability'],
  },
  {
    concern: 'integrations',
    authoritative: ['@nzila/platform-integrations', '@nzila/platform-integrations-control-plane'],
    subordinate: ['@nzila/integrations'],
  },
]

for (const appName of appDirs) {
  const pkgPath = path.join(ROOT, 'apps', appName, 'package.json')
  if (!fs.existsSync(pkgPath)) continue

  const pkg = readJson<Record<string, unknown>>(pkgPath)
  const deps = {
    ...((pkg.dependencies ?? {}) as Record<string, string>),
    ...((pkg.devDependencies ?? {}) as Record<string, string>),
  }

  for (const pair of overlapPairs) {
    const hasAuth = pair.authoritative.some((p) => p in deps)
    const subordinateUsed = pair.subordinate.filter((p) => p in deps)

    if (hasAuth && subordinateUsed.length > 0) {
      violations.push({
        scope: `apps/${appName}`,
        severity: 'warning',
        issue: `Ambiguous ${pair.concern} adoption: authoritative and subordinate packages both declared (${subordinateUsed.join(', ')})`,
      })
    } else if (!hasAuth && subordinateUsed.length > 0) {
      violations.push({
        scope: `apps/${appName}`,
        severity: 'warning',
        issue: `Subordinate ${pair.concern} package in use without authoritative package (${subordinateUsed.join(', ')})`,
      })
    }
  }
}

const errors = violations.filter((v) => v.severity === 'error')
const warnings = violations.filter((v) => v.severity === 'warning')

process.stdout.write('\n')
process.stdout.write('═══════════════════════════════════════\n')
process.stdout.write('  Platform Authority Check\n')
process.stdout.write('═══════════════════════════════════════\n\n')
process.stdout.write(`  Concerns: ${authority.concerns.length}\n`)
process.stdout.write(`  Errors:   ${errors.length}\n`)
process.stdout.write(`  Warnings: ${warnings.length}\n\n`)

for (const v of violations) {
  const icon = v.severity === 'error' ? '✗' : '⚠'
  process.stderr.write(`  ${icon} [${v.scope}] ${v.issue}\n`)
}

if (violations.length > 0) {
  process.stderr.write('\n')
}

if (errors.length > 0) {
  process.stderr.write('  RESULT: FAIL\n\n')
  process.exit(1)
}

if (warnings.length > 0) {
  process.stdout.write('  RESULT: PASS (with warnings)\n\n')
} else {
  process.stdout.write('  RESULT: PASS\n\n')
}
