/**
 * Dependency Boundary Check — builds the package dependency graph and
 * detects circular deps, forbidden directions, and deprecated usage.
 *
 * Usage: pnpm exec tsx scripts/dependency-boundary-check.ts
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
  allowed_dependents: string[]
  forbidden_dependents: string[]
  deprecated: boolean
}

interface PkgInfo {
  name: string
  dirName: string
  meta: PackageMeta | null
  deps: string[]
}

interface Violation {
  pkg: string
  issue: string
}

const VERTICAL_GROUPS: Record<string, RegExp> = {
  commerce: /^(commerce-|pricing-engine|fx|tax|qbo|finops|payments-stripe|platform-commerce-org|shop-quoter)$/,
  agri: /^agri-/,
  mobility: /^mobility-/,
  trade: /^trade-/,
}

// Allowlisted cross-vertical exceptions
const CROSS_VERTICAL_ALLOWLIST: string[] = []

function getVertical(dirName: string): string | null {
  for (const [vertical, regex] of Object.entries(VERTICAL_GROUPS)) {
    if (regex.test(dirName)) return vertical
  }
  return null
}

// ── Build package graph ─────────────────────────────

const packages = new Map<string, PkgInfo>()
const nameToDir = new Map<string, string>()

const dirs = fs.readdirSync(PACKAGES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(PACKAGES_DIR, d.name, 'package.json')))

for (const dir of dirs) {
  const pkgPath = path.join(PACKAGES_DIR, dir.name, 'package.json')
  const metaPath = path.join(PACKAGES_DIR, dir.name, 'package.meta.json')

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  const meta: PackageMeta | null = fs.existsSync(metaPath)
    ? JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
    : null

  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
  }

  const workspaceDeps = Object.entries(allDeps || {})
    .filter(([, v]) => String(v).startsWith('workspace:'))
    .map(([name]) => name)

  packages.set(dir.name, {
    name: pkg.name || dir.name,
    dirName: dir.name,
    meta,
    deps: workspaceDeps,
  })

  if (pkg.name) {
    nameToDir.set(pkg.name, dir.name)
  }
}

// ── Run checks ──────────────────────────────────────

const violations: Violation[] = []

// 1. Circular dependency detection (DFS)
function detectCycle(start: string, visited: Set<string>, stack: Set<string>): string[] | null {
  visited.add(start)
  stack.add(start)

  const info = packages.get(start)
  if (!info) return null

  for (const dep of info.deps) {
    const depDir = nameToDir.get(dep)
    if (!depDir) continue

    if (stack.has(depDir)) {
      return [start, depDir]
    }

    if (!visited.has(depDir)) {
      const cycle = detectCycle(depDir, visited, stack)
      if (cycle) return cycle
    }
  }

  stack.delete(start)
  return null
}

const visited = new Set<string>()
for (const dirName of packages.keys()) {
  if (!visited.has(dirName)) {
    const cycle = detectCycle(dirName, visited, new Set())
    if (cycle) {
      violations.push({
        pkg: cycle[0],
        issue: `Circular dependency: ${cycle[0]} ↔ ${cycle[1]}`,
      })
    }
  }
}

// 2. Cross-vertical dependency check
for (const [dirName, info] of packages) {
  const sourceVertical = getVertical(dirName)
  if (!sourceVertical) continue

  for (const dep of info.deps) {
    const depDir = nameToDir.get(dep)
    if (!depDir) continue

    const depVertical = getVertical(depDir)
    if (!depVertical || depVertical === sourceVertical) continue

    const key = `${dirName}->${depDir}`
    if (!CROSS_VERTICAL_ALLOWLIST.includes(key)) {
      violations.push({
        pkg: dirName,
        issue: `Cross-vertical dependency: ${dirName} (${sourceVertical}) → ${depDir} (${depVertical})`,
      })
    }
  }
}

// 3. Deprecated package usage check
for (const [dirName, info] of packages) {
  for (const dep of info.deps) {
    const depDir = nameToDir.get(dep)
    if (!depDir) continue

    const depInfo = packages.get(depDir)
    if (!depInfo?.meta?.deprecated) continue

    violations.push({
      pkg: dirName,
      issue: `Depends on deprecated package: ${depDir}`,
    })
  }
}

// 4. Upward dependency check (platform packages must not depend on domain/app packages)
for (const [dirName, info] of packages) {
  if (info.meta?.category !== 'PLATFORM_CORE') continue

  for (const dep of info.deps) {
    const depDir = nameToDir.get(dep)
    if (!depDir) continue

    const depInfo = packages.get(depDir)
    if (!depInfo?.meta) continue

    if (depInfo.meta.category === 'APP_SUPPORT' || depInfo.meta.category === 'APP_LOCAL_EXTRACTION') {
      violations.push({
        pkg: dirName,
        issue: `Platform package depends on app-level package: ${depDir} (${depInfo.meta.category})`,
      })
    }
  }
}

// ── Report ──────────────────────────────────────────

process.stdout.write('\n')
process.stdout.write('═══════════════════════════════════════\n')
process.stdout.write('  Dependency Boundary Check\n')
process.stdout.write('═══════════════════════════════════════\n\n')
process.stdout.write(`  Packages scanned: ${packages.size}\n`)
process.stdout.write(`  Violations:       ${violations.length}\n\n`)

if (violations.length > 0) {
  for (const v of violations) {
    process.stderr.write(`  ✗ ${v.pkg}: ${v.issue}\n`)
  }
  process.stderr.write('\n  See docs/ARCHITECTURAL_BOUNDARIES.md for guidance.\n\n')
  process.exit(1)
} else {
  process.stdout.write('  ✓ All dependency boundaries are clean\n\n')
}
