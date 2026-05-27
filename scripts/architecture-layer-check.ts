/**
 * Architecture Layer Check — scans the workspace import/dependency graph,
 * maps modules to architectural layers, and detects forbidden dependency
 * directions.
 *
 * Usage: pnpm exec tsx scripts/architecture-layer-check.ts
 *
 * Checks:
 * 1. App-to-app coupling (apps importing other apps)
 * 2. Shared package → app dependency violations
 * 3. App importing scripts/tooling/infrastructure directly
 * 4. Platform service importing app code
 * 5. Package.json workspace dependency direction violations
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

// ── Layer definitions ───────────────────────────────

type Layer = 'apps' | 'platform_services' | 'shared_packages' | 'infrastructure'

interface LayerMap {
  layers: Record<Layer, { paths: string[]; excludes?: string[] }>
  dependency_rules: Array<{
    from: Layer
    may_depend_on: Layer[]
    must_not_depend_on: Layer[]
  }>
  overrides: {
    allowed_cross_layer: Array<{
      from: Layer
      to: Layer
      packages: string[]
    }>
  }
}

const layerMapPath = path.join(ROOT, 'platform', 'registry', 'layers.json')
if (!fs.existsSync(layerMapPath)) {
  process.stderr.write('✗ Missing platform/registry/layers.json\n')
  process.exit(1)
}

const layerMap: LayerMap = JSON.parse(fs.readFileSync(layerMapPath, 'utf-8'))

interface Violation {
  source: string
  issue: string
  severity: 'error' | 'warning'
}

const violations: Violation[] = []

// ── Classify a directory path to its layer ──────────

function classifyPath(relPath: string): Layer | null {
  if (relPath.startsWith('apps/')) return 'apps'
  if (relPath.startsWith('platform/')) return 'platform_services'
  if (relPath.startsWith('packages/platform-')) return 'platform_services'
  if (relPath.startsWith('packages/')) return 'shared_packages'
  if (
    relPath.startsWith('scripts/') ||
    relPath.startsWith('tooling/') ||
    relPath.startsWith('ops/') ||
    relPath.startsWith('infrastructure/') ||
    relPath.startsWith('governance/')
  ) {
    return 'infrastructure'
  }
  return null
}

function getAppName(relPath: string): string | null {
  const match = relPath.match(/^apps\/([^/]+)/)
  return match ? match[1] : null
}

function getPackageDirName(relPath: string): string | null {
  const match = relPath.match(/^packages\/([^/]+)/)
  return match ? match[1] : null
}

// ── Check if a cross-layer dependency is allowed via override ──

function isOverrideAllowed(fromPkg: string, toLayer: Layer): boolean {
  for (const override of layerMap.overrides.allowed_cross_layer) {
    if (override.to === toLayer && override.packages.includes(fromPkg)) {
      return true
    }
  }
  return false
}

// ── 1. Scan source files for relative imports that cross layers ──

function scanSourceImports(baseDir: string, relBase: string): void {
  if (!fs.existsSync(baseDir)) return

  const walkFiles = (dir: string): string[] => {
    const results: string[] = []
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          if (['node_modules', '.next', 'dist', '.turbo', 'coverage'].includes(entry.name)) continue
          results.push(...walkFiles(full))
        } else if (entry.isFile() && /\.(ts|tsx|js|jsx|mts|mjs)$/.test(entry.name)) {
          results.push(full)
        }
      }
    } catch {
      // Skip unreadable directories
    }
    return results
  }

  const files = walkFiles(baseDir)
  const sourceLayer = classifyPath(relBase)
  const sourceApp = getAppName(relBase)

  for (const file of files) {
    const relFile = path.relative(ROOT, file).replace(/\\/g, '/')
    let content: string
    try {
      content = fs.readFileSync(file, 'utf-8')
    } catch {
      continue
    }

    // Match import/require patterns with relative paths going above the module
    const importRegex = /(?:import|from|require\()\s*['"](\.\.[^'"]*)['"]/g
    let match: RegExpExecArray | null
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1]
      const resolved = path.resolve(path.dirname(file), importPath).replace(/\\/g, '/')
      const relResolved = path.relative(ROOT, resolved).replace(/\\/g, '/')
      const targetLayer = classifyPath(relResolved)

      if (!targetLayer || !sourceLayer) continue

      // App-to-app coupling
      if (sourceLayer === 'apps' && targetLayer === 'apps') {
        const targetApp = getAppName(relResolved)
        if (targetApp && sourceApp && targetApp !== sourceApp) {
          violations.push({
            source: relFile,
            issue: `App-to-app import: ${sourceApp} → ${targetApp} (${importPath})`,
            severity: 'error',
          })
        }
      }

      // App importing infrastructure directly
      if (sourceLayer === 'apps' && targetLayer === 'infrastructure') {
        violations.push({
          source: relFile,
          issue: `App importing infrastructure/tooling: ${importPath}`,
          severity: 'error',
        })
      }

      // Shared package importing app code
      if (sourceLayer === 'shared_packages' && targetLayer === 'apps') {
        violations.push({
          source: relFile,
          issue: `Shared package importing app code: ${importPath}`,
          severity: 'error',
        })
      }

      // Platform service importing app code
      if (sourceLayer === 'platform_services' && targetLayer === 'apps') {
        violations.push({
          source: relFile,
          issue: `Platform service importing app code: ${importPath}`,
          severity: 'error',
        })
      }
    }
  }
}

// ── 2. Check package.json workspace dependencies ────

function checkWorkspaceDeps(): void {
  const checkDir = (baseDir: string, layer: Layer) => {
    if (!fs.existsSync(baseDir)) return

    const dirs = fs.readdirSync(baseDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())

    for (const dir of dirs) {
      const pkgPath = path.join(baseDir, dir.name, 'package.json')
      if (!fs.existsSync(pkgPath)) continue

      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.peerDependencies,
      }

      const sourceName = dir.name
      const sourceRel = path.relative(ROOT, path.join(baseDir, dir.name)).replace(/\\/g, '/')

      for (const [depName, depVersion] of Object.entries(allDeps || {})) {
        if (!String(depVersion).startsWith('workspace:')) continue

        // Resolve the dep to a directory
        const depDirName = depName.replace('@nzila/', '')
        let depLayer: Layer | null = null

        if (depDirName.startsWith('platform-')) {
          depLayer = 'platform_services'
        } else if (fs.existsSync(path.join(ROOT, 'packages', depDirName))) {
          depLayer = 'shared_packages'
        }

        if (!depLayer) continue

        // Find the rule for this layer
        const rule = layerMap.dependency_rules.find((r) => r.from === layer)
        if (!rule) continue

        if (rule.must_not_depend_on.includes(depLayer)) {
          // Check overrides
          if (!isOverrideAllowed(sourceName, depLayer)) {
            violations.push({
              source: sourceRel,
              issue: `${layer} → ${depLayer} forbidden: ${sourceName} depends on ${depName}`,
              severity: 'error',
            })
          }
        }
      }
    }
  }

  checkDir(path.join(ROOT, 'apps'), 'apps')
  checkDir(path.join(ROOT, 'packages'), 'shared_packages')
}

// ── Run checks ──────────────────────────────────────

// Scan apps for cross-layer imports
const appsDir = path.join(ROOT, 'apps')
if (fs.existsSync(appsDir)) {
  for (const app of fs.readdirSync(appsDir, { withFileTypes: true })) {
    if (!app.isDirectory()) continue
    // Only scan key source directories to keep it fast
    for (const subdir of ['lib', 'app', 'components', 'src', 'actions']) {
      const dir = path.join(appsDir, app.name, subdir)
      if (fs.existsSync(dir)) {
        scanSourceImports(dir, `apps/${app.name}/${subdir}`)
      }
    }
  }
}

// Scan packages for upward imports
const packagesDir = path.join(ROOT, 'packages')
if (fs.existsSync(packagesDir)) {
  for (const pkg of fs.readdirSync(packagesDir, { withFileTypes: true })) {
    if (!pkg.isDirectory()) continue
    const srcDir = path.join(packagesDir, pkg.name, 'src')
    if (fs.existsSync(srcDir)) {
      scanSourceImports(srcDir, `packages/${pkg.name}/src`)
    }
  }
}

// Check workspace dependency directions
checkWorkspaceDeps()

// ── Report ──────────────────────────────────────────

const errors = violations.filter((v) => v.severity === 'error')
const warnings = violations.filter((v) => v.severity === 'warning')

process.stdout.write('\n')
process.stdout.write('═══════════════════════════════════════\n')
process.stdout.write('  Architecture Layer Check\n')
process.stdout.write('═══════════════════════════════════════\n\n')
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
  process.stderr.write('  See docs/architecture/ARCHITECTURAL_LAYERS.md for guidance.\n\n')
  process.exit(1)
} else {
  process.stdout.write('  ✓ All architectural layer boundaries are clean\n\n')
}
