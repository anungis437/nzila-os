/**
 * Package Deprecation Check — validates that deprecated packages have
 * correct metadata and that no non-allowlisted consumers depend on them.
 *
 * Usage: pnpm exec tsx scripts/package-deprecation-check.ts
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const PACKAGES_DIR = path.join(ROOT, 'packages')

interface PackageMeta {
  owner: string
  category: string
  stability: string
  deprecated: boolean
  deprecation_note?: string
  replacement_for?: string
}

interface Violation {
  pkg: string
  issue: string
}

const violations: Violation[] = []
let totalDeprecated = 0

const dirs = fs.readdirSync(PACKAGES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(PACKAGES_DIR, d.name, 'package.meta.json')))

// ── Collect metadata ────────────────────────────────

const allMeta = new Map<string, { dirName: string; meta: PackageMeta; pkgName: string }>()
const nameToDir = new Map<string, string>()

for (const dir of dirs) {
  const metaPath = path.join(PACKAGES_DIR, dir.name, 'package.meta.json')
  const pkgPath = path.join(PACKAGES_DIR, dir.name, 'package.json')
  const meta: PackageMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
  const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) : {}

  allMeta.set(dir.name, { dirName: dir.name, meta, pkgName: pkg.name || dir.name })
  if (pkg.name) nameToDir.set(pkg.name, dir.name)
}

// ── Check 1: Deprecated metadata consistency ───────

for (const [dirName, { meta }] of allMeta) {
  if (meta.deprecated) {
    totalDeprecated++

    if (meta.stability !== 'DEPRECATED') {
      violations.push({
        pkg: dirName,
        issue: 'deprecated=true but stability is not DEPRECATED',
      })
    }

    if (!meta.deprecation_note || meta.deprecation_note.trim() === '') {
      violations.push({
        pkg: dirName,
        issue: 'deprecated=true but missing deprecation_note',
      })
    }
  }

  if (meta.stability === 'DEPRECATED' && !meta.deprecated) {
    violations.push({
      pkg: dirName,
      issue: 'stability=DEPRECATED but deprecated flag is not true',
    })
  }
}

// ── Check 2: Consumers of deprecated packages ──────

const deprecatedNames = new Set<string>()
for (const [dirName, { meta, pkgName }] of allMeta) {
  if (meta.deprecated) {
    deprecatedNames.add(pkgName)
  }
}

for (const [dirName, { pkgName }] of allMeta) {
  const pkgPath = path.join(PACKAGES_DIR, dirName, 'package.json')
  if (!fs.existsSync(pkgPath)) continue

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  }

  for (const [dep, ver] of Object.entries(allDeps || {})) {
    if (String(ver).startsWith('workspace:') && deprecatedNames.has(dep)) {
      violations.push({
        pkg: dirName,
        issue: `Depends on deprecated package: ${dep}`,
      })
    }
  }
}

// ── Report ──────────────────────────────────────────

process.stdout.write('\n')
process.stdout.write('═══════════════════════════════════════\n')
process.stdout.write('  Package Deprecation Check\n')
process.stdout.write('═══════════════════════════════════════\n\n')
process.stdout.write(`  Packages scanned:    ${allMeta.size}\n`)
process.stdout.write(`  Deprecated packages: ${totalDeprecated}\n`)
process.stdout.write(`  Violations:          ${violations.length}\n\n`)

if (violations.length > 0) {
  for (const v of violations) {
    process.stderr.write(`  ✗ ${v.pkg}: ${v.issue}\n`)
  }
  process.stderr.write('\n  See docs/governance/PACKAGE_LIFECYCLE_POLICY.md for guidance.\n\n')
  process.exit(1)
} else {
  process.stdout.write('  ✓ All deprecation metadata is consistent\n\n')
}
