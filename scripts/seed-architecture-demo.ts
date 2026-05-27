/**
 * Seed Architecture Demo — generates a static JSON snapshot of architecture
 * governance data that the control plane can consume without live filesystem access.
 *
 * Usage: pnpm exec tsx scripts/seed-architecture-demo.ts
 * Output: demo-output/architecture-summary.json
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const PACKAGES_DIR = path.join(ROOT, 'packages')
const OUTPUT_DIR = path.join(ROOT, 'demo-output')

const TARGET_APPS = [
  'union-eyes',
  'shop-quoter',
  'zonga',
  'cfo',
  'partners',
  'web',
  'console',
]

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

// ── Package stats ─────────────────────────────

let totalPackages = 0
let withMeta = 0
let deprecated = 0
const categories: Record<string, number> = {}
const packageList: Array<{ name: string; category: string; stability: string; deprecated: boolean }> = []

const dirs = fs.readdirSync(PACKAGES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(PACKAGES_DIR, d.name, 'package.json')))

totalPackages = dirs.length

for (const dir of dirs) {
  const metaPath = path.join(PACKAGES_DIR, dir.name, 'package.meta.json')
  if (fs.existsSync(metaPath)) {
    withMeta++
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
    const cat = meta.category || 'UNKNOWN'
    categories[cat] = (categories[cat] || 0) + 1
    if (meta.deprecated) deprecated++
    packageList.push({
      name: dir.name,
      category: cat,
      stability: meta.stability || 'UNKNOWN',
      deprecated: !!meta.deprecated,
    })
  }
}

// ── App compliance ────────────────────────────

const apps = TARGET_APPS.map((app) => {
  const appDir = path.join(ROOT, 'apps', app)
  if (!fs.existsSync(appDir)) {
    return { app, checks: 0, passed: 0, level: 'MISSING' }
  }

  let checks = 0
  let passed = 0
  const assert = (ok: boolean) => { checks++; if (ok) passed++ }

  assert(fileExists(path.join(appDir, 'app', 'api', 'health', 'route.ts')))
  assert(
    fileExists(path.join(appDir, 'app', 'api', 'metrics', 'route.ts')) ||
    fileExists(path.join(appDir, 'app', 'api', 'analytics', 'route.ts'))
  )
  assert(
    fileExists(path.join(appDir, 'app', 'api', 'evidence', 'export', 'route.ts')) ||
    fileExists(path.join(appDir, 'lib', 'evidence.ts'))
  )
  assert(
    fileExists(path.join(appDir, 'lib', 'policy-enforcement.ts')) ||
    fileExists(path.join(appDir, 'lib', 'policyEnforcement.ts')) ||
    fileExists(path.join(appDir, 'lib', 'services', 'policy-engine.ts'))
  )
  assert(fileExists(path.join(appDir, 'docs', 'DOMAIN_MODEL.md')))
  assert(countTestFiles(appDir) >= 3)

  const pct = checks > 0 ? Math.round((passed / checks) * 100) : 0
  const level = pct === 100 ? 'FULL' : pct >= 50 ? 'PARTIAL' : 'NON_COMPLIANT'

  return { app, checks, passed, level }
})

// ── Write snapshot ──────────────────────────────

const snapshot = {
  generated_at: new Date().toISOString(),
  packages: {
    total: totalPackages,
    withMeta,
    deprecated,
    categories,
    metaCoverage: totalPackages > 0 ? Math.round((withMeta / totalPackages) * 100) : 0,
    items: packageList,
  },
  apps: {
    items: apps,
    fullCompliance: apps.filter((a) => a.level === 'FULL').length,
    partialCompliance: apps.filter((a) => a.level === 'PARTIAL').length,
    total: apps.length,
  },
  overall: {
    metaCoverage: totalPackages > 0 ? Math.round((withMeta / totalPackages) * 100) : 0,
    appComplianceRate: apps.length > 0 ? Math.round((apps.filter((a) => a.level === 'FULL').length / apps.length) * 100) : 0,
    deprecatedPackages: deprecated,
  },
}

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

const outPath = path.join(OUTPUT_DIR, 'architecture-summary.json')
fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2))

process.stdout.write(`\n✓ Architecture snapshot written to ${path.relative(ROOT, outPath)}\n`)
process.stdout.write(`  Packages: ${totalPackages} (${withMeta} with meta, ${deprecated} deprecated)\n`)
process.stdout.write(`  Apps: ${apps.filter((a) => a.level === 'FULL').length}/${apps.length} governance-complete\n\n`)
