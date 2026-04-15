/**
 * Platform vs App Decision Check — validates that new packages and platform
 * services are properly registered, documented, and classified.
 *
 * Usage: pnpm platform:vs-app:check
 *
 * Checks:
 * 1. Every package in packages/ has a package.meta.json
 * 2. Every platform service (packages/platform-*) is registered in the platform registry
 * 3. No shared package silently acts as a platform service (cross-app reuse without registration)
 * 4. ADR template exists at templates/architecture-decision-record.md
 * 5. packages with PLATFORM_CORE or AI_INTELLIGENCE category are registered as platform_services
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

interface Violation {
  source: string
  issue: string
  severity: 'error' | 'warning'
}

interface AuthorityConcern {
  id: string
  authoritative: string[]
}

interface AuthorityMap {
  concerns: AuthorityConcern[]
}

const violations: Violation[] = []

// ── Load platform registry ─────────────────────────

const registryPath = path.join(ROOT, 'platform', 'registry', 'platform-registry.json')
if (!fs.existsSync(registryPath)) {
  process.stderr.write('✗ Missing platform/registry/platform-registry.json\n')
  process.exit(1)
}

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'))
const registeredServiceNames = new Set<string>(
  (registry.platform_services || []).map((s: { name: string }) => s.name),
)
const registeredPackageNames = new Set<string>(
  (registry.shared_packages || []).map((p: { name: string }) => p.name),
)

// ── Validate concern authority map ──────────────────

const authorityMapPath = path.join(ROOT, 'governance', 'platform-package-authority.json')
if (!fs.existsSync(authorityMapPath)) {
  violations.push({
    source: 'governance/',
    issue: 'Missing governance/platform-package-authority.json',
    severity: 'error',
  })
} else {
  try {
    const authority = JSON.parse(fs.readFileSync(authorityMapPath, 'utf-8')) as AuthorityMap
    const concerns = authority.concerns || []
    if (concerns.length === 0) {
      violations.push({
        source: 'governance/platform-package-authority.json',
        issue: 'Concern authority map has no concerns',
        severity: 'error',
      })
    }

    for (const concern of concerns) {
      if (!concern.authoritative || concern.authoritative.length === 0) {
        violations.push({
          source: 'governance/platform-package-authority.json',
          issue: `Concern ${concern.id} has no authoritative package`,
          severity: 'error',
        })
        continue
      }

      for (const pkgName of concern.authoritative) {
        const short = pkgName.replace('@nzila/', '')
        const pkgDir = path.join(ROOT, 'packages', short)
        if (!fs.existsSync(path.join(pkgDir, 'package.json'))) {
          violations.push({
            source: `packages/${short}`,
            issue: `Authoritative concern package missing for ${concern.id}`,
            severity: 'error',
          })
          continue
        }

        if (!registeredServiceNames.has(short) && !registeredPackageNames.has(short)) {
          violations.push({
            source: `packages/${short}`,
            issue: `Authoritative concern package not registered in platform-registry.json`,
            severity: 'warning',
          })
        }
      }
    }
  } catch {
    violations.push({
      source: 'governance/platform-package-authority.json',
      issue: 'Invalid JSON in platform-package-authority.json',
      severity: 'error',
    })
  }
}

// ── Check ADR template exists ───────────────────────

const adrTemplatePath = path.join(ROOT, 'templates', 'architecture-decision-record.md')
if (!fs.existsSync(adrTemplatePath)) {
  violations.push({
    source: 'templates/',
    issue: 'Missing architecture-decision-record.md template',
    severity: 'error',
  })
}

// ── Scan packages/ ──────────────────────────────────

const packagesDir = path.join(ROOT, 'packages')
const packageDirs = fs.existsSync(packagesDir)
  ? fs.readdirSync(packagesDir, { withFileTypes: true }).filter((d) => d.isDirectory())
  : []

// Only check directories that are real Node packages (have package.json).
// Python packages, data directories, etc. are managed separately.
const nodePackageDirs = packageDirs.filter((d) =>
  fs.existsSync(path.join(packagesDir, d.name, 'package.json')),
)

for (const dir of nodePackageDirs) {
  const pkgDir = path.join(packagesDir, dir.name)
  const metaPath = path.join(pkgDir, 'package.meta.json')
  const pkgJsonPath = path.join(pkgDir, 'package.json')
  const isPlatformService = dir.name.startsWith('platform-')
  const relPath = `packages/${dir.name}`

  // 1. Every package must have package.meta.json
  if (!fs.existsSync(metaPath)) {
    violations.push({
      source: relPath,
      issue: `Missing package.meta.json — cannot classify platform vs app concern`,
      severity: 'error',
    })
    continue
  }

  let meta: Record<string, unknown>
  try {
    meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
  } catch {
    violations.push({
      source: relPath,
      issue: `Invalid JSON in package.meta.json`,
      severity: 'error',
    })
    continue
  }

  // 2. Platform service packages must be registered
  if (isPlatformService && !registeredServiceNames.has(dir.name)) {
    violations.push({
      source: relPath,
      issue: `Platform service package not registered in platform-registry.json`,
      severity: 'error',
    })
  }

  // 3. Non-platform packages must be registered as shared_packages
  if (!isPlatformService && !registeredPackageNames.has(dir.name)) {
    violations.push({
      source: relPath,
      issue: `Shared package not registered in platform-registry.json`,
      severity: 'warning',
    })
  }

  // 4. Packages with PLATFORM_CORE category that are not registered anywhere
  const category = meta.category as string | undefined
  if (
    category &&
    (category === 'PLATFORM_CORE' || category === 'AI_INTELLIGENCE') &&
    !isPlatformService &&
    !registeredServiceNames.has(dir.name) &&
    !registeredPackageNames.has(dir.name)
  ) {
    violations.push({
      source: relPath,
      issue: `Category ${category} but not registered in platform-registry.json (neither platform_services nor shared_packages)`,
      severity: 'warning',
    })
  }

  // 5. Check for suspicious cross-app reuse patterns in non-platform packages
  if (!isPlatformService && fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'))
      const pkgName = pkg.name as string | undefined

      // Count how many apps depend on this package via workspace protocol
      let appConsumerCount = 0
      const appsDir = path.join(ROOT, 'apps')
      if (fs.existsSync(appsDir) && pkgName) {
        for (const app of fs.readdirSync(appsDir, { withFileTypes: true })) {
          if (!app.isDirectory()) continue
          const appPkgPath = path.join(appsDir, app.name, 'package.json')
          if (!fs.existsSync(appPkgPath)) continue
          try {
            const appPkg = JSON.parse(fs.readFileSync(appPkgPath, 'utf-8'))
            const allDeps = { ...appPkg.dependencies, ...appPkg.devDependencies }
            if (allDeps[pkgName]) appConsumerCount++
          } catch {
            // skip unparseable
          }
        }
      }

      // If used by 5+ apps, not a platform service, and not already registered
      if (
        appConsumerCount >= 5 &&
        category !== 'DOMAIN_SHARED' &&
        category !== 'PLATFORM_CORE' &&
        !registeredPackageNames.has(dir.name)
      ) {
        violations.push({
          source: relPath,
          issue: `Used by ${appConsumerCount} apps — consider whether this should be a platform service (see ADR template)`,
          severity: 'warning',
        })
      }
    } catch {
      // skip
    }
  }

  // 6. Platform service packages should have owner field
  if (isPlatformService && !meta.owner) {
    violations.push({
      source: relPath,
      issue: `Platform service missing 'owner' in package.meta.json`,
      severity: 'error',
    })
  }
}

// ── Report ──────────────────────────────────────────

const errors = violations.filter((v) => v.severity === 'error')
const warnings = violations.filter((v) => v.severity === 'warning')

process.stdout.write('\n')
process.stdout.write('═══════════════════════════════════════\n')
process.stdout.write('  Platform vs App Decision Check\n')
process.stdout.write('═══════════════════════════════════════\n\n')
process.stdout.write(`  Packages scanned: ${nodePackageDirs.length}\n`)
process.stdout.write(`  Registered services: ${registeredServiceNames.size}\n`)
process.stdout.write(`  Registered packages: ${registeredPackageNames.size}\n`)
process.stdout.write(`  Errors:   ${errors.length}\n`)
process.stdout.write(`  Warnings: ${warnings.length}\n\n`)

if (errors.length > 0) {
  for (const v of errors) {
    process.stderr.write(`  ✗ [${v.source}] ${v.issue}\n`)
  }
  process.stderr.write('\n')
}

if (warnings.length > 0) {
  for (const v of warnings) {
    process.stderr.write(`  ⚠ [${v.source}] ${v.issue}\n`)
  }
  process.stderr.write('\n')
}

if (errors.length > 0) {
  process.stdout.write('  RESULT: FAIL\n\n')
  process.exit(1)
} else if (warnings.length > 0) {
  process.stdout.write('  RESULT: PASS (with warnings)\n\n')
} else {
  process.stdout.write('  RESULT: PASS\n\n')
}
