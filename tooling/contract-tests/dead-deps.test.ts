/**
 * Contract Test — Dead Production Dependencies (STUDIO-DEPS-01)
 *
 * Verifies:
 *   For every package listed in an app's `dependencies` (not devDependencies),
 *   at least one source file must import from it.
 *
 *   Unlike phantom-deps.test.ts (which only checks @nzila/* packages), this
 *   test covers ALL production dependencies: react libraries, npm packages,
 *   everything. If you pay for it at install time, you must actually use it.
 *
 * Exceptions:
 *   - Framework packages that Next.js/Fastify auto-import (react, next, etc.)
 *   - CSS/PostCSS/Tailwind packages used by config, not source
 *   - Type-only packages (@types/*)
 *   - Build tooling that runs via config files
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'

const ROOT = resolve(__dirname, '../..')

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

/**
 * Packages that are consumed by framework runtime or config files,
 * NOT via explicit ES/CJS imports in source code.
 */
const IMPLICIT_USE_ALLOWLIST = new Set([
  // Next.js / React runtime
  'react', 'react-dom', 'next',
  // Fastify (loaded via import but named differently)
  'pino-pretty',
  // CSS / Tailwind
  'tailwindcss', 'postcss', 'autoprefixer', '@tailwindcss/forms',
  '@tailwindcss/typography', 'tailwindcss-animate',
  // Build tooling
  'typescript', 'tslib',
  // Type packages
  // (handled by startsWith('@types/') check below)
  // Server runtime auto-loaded
  'sharp', 'encoding',
  // Misc runtime support loaded by framework, not source
  'server-only',
  // Universal schema library — peer dep required for type compatibility
  // across @nzila/db, @nzila/os-core, drizzle-zod, etc.
  'zod',
  // OTel / Sentry ESM + CJS instrumentation hooks — loaded by
  // runtime patching, never via explicit import statements
  'import-in-the-middle', 'require-in-the-middle',
  // Email dev server — executed as CLI (`npx react-email dev`),
  // actual code imports @react-email/components instead
  'react-email',
  // Platform mandate packages — declared as deps by CI adoption gate
  // before apps have started consuming them in source code
  '@nzila/schema-core',
  '@nzila/governed-workflow',
  '@nzila/platform-revenue',
])

function findFiles(dir: string, exts = ['.ts', '.tsx', '.mjs', '.js', '.jsx']): string[] {
  if (!existsSync(dir)) return []
  const results: string[] = []

  function recurse(currentDir: string) {
    let entries
    try {
      entries = readdirSync(currentDir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (
        entry.name === 'node_modules' ||
        entry.name === '.next' ||
        entry.name === '.turbo' ||
        entry.name === 'dist' ||
        entry.name === '_legacy'
      ) continue
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
  try { return readFileSync(path, 'utf-8') } catch { return '' }
}

function getDeps(appDir: string): string[] {
  const pkgPath = resolve(appDir, 'package.json')
  if (!existsSync(pkgPath)) return []
  const pkg = JSON.parse(readContent(pkgPath))
  return Object.keys(pkg.dependencies ?? {})
}

function isImported(files: string[], pkg: string): boolean {
  const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`['"]${escaped}(?:/[^'"]*)?['"]`)
  return files.some((f) => pattern.test(readContent(f)))
}

describe('Dead production dependencies — STUDIO-DEPS-01 contract', () => {
  for (const app of APPS) {
    const appDir = resolve(ROOT, 'apps', app)
    const deps = getDeps(appDir)
    if (deps.length === 0) continue

    describe(`apps/${app}`, () => {
      let files: string[]
      const getFiles = () => {
        if (!files) files = findFiles(appDir)
        return files
      }

      for (const dep of deps) {
        // Skip allowlisted packages
        if (IMPLICIT_USE_ALLOWLIST.has(dep)) continue
        if (dep.startsWith('@types/')) continue

        it(`${dep} is actually imported (not a dead dependency)`, () => {
          expect(
            isImported(getFiles(), dep),
            `apps/${app}/package.json declares "${dep}" in dependencies but ` +
            `no source file imports it. Remove it, move to devDependencies, or add an import.`,
          ).toBe(true)
        })
      }
    })
  }
})
