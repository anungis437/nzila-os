/**
 * Which source files the env census reads (UE-CONV-H-024): the application's production code, and the workspace packages that code can load.
 *
 * The application is everything under apps/union-eyes that runs, which leaves out tests, fixtures, end-to-end suites, tooling under scripts/, the Python
 * backend, the mobile client and build output. Its packages are what it imports: each `@nzila/<name>[/<subpath>]` specifier is resolved through the package's
 * `exports` map to a file, and the files that file imports (relative paths inside the package, other packages by specifier) are followed in turn. That is the
 * import closure, so a package that is a dependency but is never imported contributes nothing, and a barrel that re-exports a whole package brings the whole package
 * in: over-approximate by design, because a variable read by code that is loaded is a variable the deployment may have to supply.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import type { SourceText } from './collect'

// Skipped at any depth: never source. Skipped only at the root: not this application's source, but `components/public` and `app/api/reports` are, and a census that skipped them by name would never read them.
const APP_SKIP_ANYWHERE = new Set(['node_modules', '.next', '.turbo', 'coverage', '.storybook', '.git', '__tests__', '__mocks__'])
const APP_SKIP_AT_ROOT = new Set(['dist', 'archive', 'backups', 'mobile', 'backend', 'e2e', 'tests', 'public', 'docs', 'scripts', 'reports'])
const PACKAGE_SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', '.turbo', '__tests__', '__mocks__', 'tests', 'test', 'scripts', 'docs', '.next', 'build', 'bootstrap'])
const SKIP_FILES = /(\.test\.|\.spec\.|\.stories\.|\.d\.ts$)/
const SOURCE = /\.(ts|tsx|js|jsx|mts|mjs|cjs)$/

export const posix = (value: string): string => value.replace(/\\/g, '/')

/** The application's production source files, relative to the application root. */
export function appSourceFiles(appRoot: string): string[] {
  const out: string[] = []
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name)
      if (statSync(full).isDirectory()) {
        // A directory with its own package.json is another deliverable (its own dependencies, its own environment), not part of the application.
        if (!(APP_SKIP_ANYWHERE.has(name) || (dir === appRoot && APP_SKIP_AT_ROOT.has(name))) && !existsSync(path.join(full, 'package.json'))) walk(full)
      } else if (SOURCE.test(name) && !SKIP_FILES.test(name)) out.push(posix(path.relative(appRoot, full)))
    }
  }
  walk(appRoot)
  return out.sort()
}

interface PackageInfo {
  /** Repo-relative directory: `packages/os-core`. */
  dir: string
  exports: Record<string, unknown>
  main: string | undefined
}

function loadPackages(repoRoot: string): Map<string, PackageInfo> {
  const packages = new Map<string, PackageInfo>()
  const base = path.join(repoRoot, 'packages')
  if (!existsSync(base)) return packages
  for (const entry of readdirSync(base)) {
    const manifest = path.join(base, entry, 'package.json')
    if (!existsSync(manifest)) continue
    const json = JSON.parse(readFileSync(manifest, 'utf8')) as { name?: string; exports?: unknown; main?: string }
    if (!json.name) continue
    const exportsMap = json.exports && typeof json.exports === 'object' ? (json.exports as Record<string, unknown>) : {}
    packages.set(json.name, { dir: `packages/${entry}`, exports: exportsMap, main: json.main })
  }
  return packages
}

/** The file an export entry points to: a string, or the first of the conditions a bundler would try. */
function exportTarget(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    for (const condition of ['import', 'default', 'require', 'types']) {
      const found = exportTarget((value as Record<string, unknown>)[condition])
      if (found) return found
    }
  }
  return null
}

/** The repo-relative file a `@nzila/<name>[/<subpath>]` specifier names, or null when it is not a workspace package. */
export function resolvePackageSpecifier(specifier: string, packages: Map<string, PackageInfo>): string | null {
  const match = /^(@nzila\/[^/]+)(\/.*)?$/.exec(specifier)
  if (!match) return null
  const info = packages.get(match[1])
  if (!info) return null
  const key = match[2] ? `.${match[2]}` : '.'
  const target = exportTarget(info.exports[key]) ?? (key === '.' ? info.main : null)
  return target ? posix(path.posix.join(info.dir, target)) : null
}

const RELATIVE_EXTENSIONS = ['', '.ts', '.tsx', '.mts', '.js', '.mjs', '/index.ts', '/index.tsx', '/index.js']

function resolveRelative(from: string, specifier: string, exists: (file: string) => boolean): string | null {
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier))
  // TypeScript sources import `./x.js` for `./x.ts`.
  const stripped = base.replace(/\.(m?js)$/, '')
  for (const candidate of [base, stripped]) {
    for (const extension of RELATIVE_EXTENSIONS) {
      const file = `${candidate}${extension}`
      if (exists(file) && SOURCE.test(file)) return file
    }
  }
  return null
}

export interface PackageClosure {
  sources: SourceText[]
  /** The workspace packages the application imports, by name. */
  packages: string[]
}

/** The workspace package files the application can load: the closure of its `@nzila/*` imports. */
export function packageClosure(repoRoot: string, appSources: readonly SourceText[]): PackageClosure {
  const packages = loadPackages(repoRoot)
  const exists = (file: string): boolean => {
    const full = path.join(repoRoot, file)
    return existsSync(full) && statSync(full).isFile()
  }
  const importedBy = (file: string, text: string): string[] =>
    ts
      .preProcessFile(text, true, true)
      .importedFiles.map((imported) => imported.fileName)
      .map((specifier) => (specifier.startsWith('.') ? resolveRelative(file, specifier, exists) : resolvePackageSpecifier(specifier, packages)))
      .filter((resolved): resolved is string => Boolean(resolved))

  const seen = new Set<string>()
  const queue: string[] = []
  const imported = new Set<string>()
  for (const source of appSources) {
    for (const specifier of ts.preProcessFile(source.text, true, true).importedFiles.map((item) => item.fileName)) {
      const name = /^(@nzila\/[^/]+)/.exec(specifier)?.[1]
      if (!name || !packages.has(name)) continue
      imported.add(name)
      const resolved = resolvePackageSpecifier(specifier, packages)
      if (resolved && !seen.has(resolved)) {
        seen.add(resolved)
        queue.push(resolved)
      }
    }
  }

  const sources: SourceText[] = []
  while (queue.length > 0) {
    const file = queue.pop() as string
    if (!exists(file) || SKIP_FILES.test(file) || file.split('/').some((part) => PACKAGE_SKIP_DIRS.has(part))) continue
    const text = readFileSync(path.join(repoRoot, file), 'utf8')
    sources.push({ file, text })
    for (const next of importedBy(file, text)) {
      if (!seen.has(next)) {
        seen.add(next)
        queue.push(next)
      }
    }
  }
  return { sources: sources.sort((a, b) => a.file.localeCompare(b.file)), packages: [...imported].sort() }
}
