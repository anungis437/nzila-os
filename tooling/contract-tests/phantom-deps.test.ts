/**
 * Contract Test — Phantom Dependencies (STUDIO-01)
 *
 * Verifies:
 *   For every `@nzila/*` package listed in an app's `dependencies`,
 *   at least one `.ts` or `.tsx` file in that app MUST contain an import
 *   from that package.
 *
 * A phantom dependency is one declared in package.json but never actually
 * imported — it inflates the dependency graph, breaks tree-shaking, and
 * gives a false impression of platform adoption.
 *
 * This test enforces the rule: if you declare it, you must use it.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'

const ROOT = resolve(__dirname, '../..')

/**
 * All apps that must be checked for phantom @nzila/* dependencies.
 * orchestrator-api uses a different structure (Fastify, not Next.js) but the
 * same rule applies — if you declare it, you must import it.
 */
const APPS = [
  'console',
  'partners',
  'web',
  'union-eyes',
  'cfo',
  'nacp-exams',
  'zonga',
  'abr',
  'orchestrator-api',
]

// ── Helpers ─────────────────────────────────────────────────────────────────

function findFiles(dir: string, exts = ['.ts', '.tsx', '.mjs']): string[] {
  if (!existsSync(dir)) return []
  const results: string[] = []

  function recurse(currentDir: string) {
    const entries = readdirSync(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name === 'node_modules') continue
      if (entry.name === '.next' || entry.name === '.turbo') continue
      if (entry.name === '_legacy') continue
      const fullPath = join(currentDir, entry.name)
      if (entry.isDirectory()) {
        recurse(fullPath)
      } else if (entry.isFile() && exts.some((e) => entry.name.endsWith(e))) {
        results.push(fullPath)
      }
    }
  }

  recurse(dir)
  return results
}

function readContent(path: string): string {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return ''
  }
}

/**
 * Extract `@nzila/*` package names from the `dependencies` section of a
 * package.json (NOT devDependencies — those are build-time only).
 */
function getNzilaDeps(appDir: string): string[] {
  const pkgPath = resolve(appDir, 'package.json')
  if (!existsSync(pkgPath)) return []
  const pkg = JSON.parse(readContent(pkgPath))
  const deps: Record<string, string> = pkg.dependencies ?? {}
  return Object.keys(deps).filter((d) => d.startsWith('@nzila/'))
}

/**
 * Check whether any source file in the app imports from the given package.
 * Matches:
 *   - `from '@nzila/foo'`
 *   - `from '@nzila/foo/bar'`
 *   - `import('@nzila/foo')`
 *   - `require('@nzila/foo')`
 */
function isImported(files: string[], pkg: string): boolean {
  // Escape the package name for regex safety
  const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`['"]${escaped}(?:/[^'"]*)?['"]`)
  return files.some((file) => {
    const content = readContent(file)
    return pattern.test(content)
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

/**
 * Platform mandate packages — declared by CI adoption gate before apps
 * have started consuming them in source code.
 */
const MANDATE_DEPS = new Set([
  '@nzila/schema-core',
  '@nzila/governed-workflow',
  '@nzila/platform-revenue',
])

describe('Phantom Dependencies — STUDIO-01 contract', () => {
  for (const app of APPS) {
    const appDir = resolve(ROOT, `apps/${app}`)
    const deps = getNzilaDeps(appDir)

    if (deps.length === 0) continue

    describe(`apps/${app}`, () => {
      // Cache files once per app to avoid redundant re-scans
      let files: string[]
      const getFiles = () => {
        if (!files) files = findFiles(appDir)
        return files
      }

      for (const dep of deps) {
        if (MANDATE_DEPS.has(dep)) continue

        it(`${dep} is actually imported (not a phantom dependency)`, () => {
          const appFiles = getFiles()
          expect(
            isImported(appFiles, dep),
            `apps/${app}/package.json declares "${dep}" in dependencies but no source file imports it. ` +
            `Either add a real import or remove it from package.json.`,
          ).toBe(true)
        })
      }
    })
  }
})
