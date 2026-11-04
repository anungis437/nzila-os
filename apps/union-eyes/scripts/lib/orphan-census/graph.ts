/**
 * Which source files can run, read from the import graph of the tree.
 *
 * A file that nothing imports is not "unused code" to be tidied: it is a screen, a control or a message that exists in the repository, in the evidence documents and in the
 * census counts, and that no person can ever reach. The earlier clean-ups fixed findings inside such files; this finds the files. A module is reached from the
 * application (a route, a layout, the middleware, the instrumentation hook, the i18n config), reached only from tooling (a script, a test fixture, a database module), or
 * not reached at all. A test importing a module does not make it reachable: a module only its own tests import is dead.
 *
 * Imports are read with the TypeScript scanner (static imports, `export ... from`, `import()` and `require()` of a literal). A dynamic import whose specifier is not a literal
 * cannot be followed and is returned in `dynamic`, so a file that hides its imports from this reading is listed, not trusted.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

export type ModuleReach = 'app' | 'tools' | 'none'

export interface ModuleGraph {
  files: string[]
  edges: Map<string, Set<string>>
  /** Files holding an `import(...)` or `require(...)` whose specifier is not a string literal. */
  dynamic: string[]
}

const SOURCE = /\.(?:[cm]?[jt]s|[jt]sx)$/
// Never source, at any depth.
const SKIP_ANYWHERE = new Set(['node_modules', '.next', '.turbo', '.git', 'coverage', 'playwright-report', 'test-results', 'storybook-static', '.venv', 'venv'])
// Not this application's TypeScript, but only at the root: `components/public`, `app/.../reports` and `lib/archive` are source.
const SKIP_AT_ROOT = new Set(['reports', 'public', 'dist', 'build', 'out', 'backend', 'mobile', 'archive', 'backups'])
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']

export const isTestFile = (file: string): boolean => /(?:^|\/)(?:__tests__|__mocks__|__fixtures__)\//.test(file) || /\.(?:test|spec|stories)\.[cm]?[jt]sx?$/.test(file) || /\.d\.ts$/.test(file)

const walk = (root: string, dir: string, out: string[]): void => {
  for (const name of readdirSync(path.join(root, dir))) {
    if (SKIP_ANYWHERE.has(name) || (dir === '' && SKIP_AT_ROOT.has(name))) continue
    const relative = dir ? `${dir}/${name}` : name
    if (statSync(path.join(root, relative)).isDirectory()) walk(root, relative, out)
    else if (SOURCE.test(name)) out.push(relative)
  }
}

function resolveSpecifier(files: ReadonlySet<string>, from: string, specifier: string): string | null {
  let base: string
  if (specifier.startsWith('@/')) base = specifier.slice(2)
  else if (specifier.startsWith('.')) base = path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier))
  else return null
  const stripped = base.replace(/\.(?:[cm]?js|jsx)$/, '')
  for (const candidate of [base, ...EXTENSIONS.map((extension) => base + extension), ...EXTENSIONS.map((extension) => stripped + extension), ...EXTENSIONS.map((extension) => `${base}/index${extension}`)]) {
    if (files.has(candidate)) return candidate
  }
  return null
}

// An import or require whose argument is not a string literal: found by a cheap pattern first, then confirmed on the syntax tree (the pattern also matches prose in comments).
const NON_LITERAL_LOAD = /\b(?:import|require)\s*\(\s*(?!['"`])/

function loadsNonLiteral(file: string, text: string): boolean {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, false)
  let found = false
  const visit = (node: ts.Node): void => {
    if (found) return
    const isLoad = ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    if (isLoad && node.arguments.length > 0 && !ts.isStringLiteralLike(node.arguments[0])) found = true
    else ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

export function buildModuleGraph(root: string): ModuleGraph {
  const files: string[] = []
  walk(root, '', files)
  files.sort()
  const known = new Set(files)
  const edges = new Map<string, Set<string>>()
  const dynamic: string[] = []
  for (const file of files) {
    const text = readFileSync(path.join(root, file), 'utf8')
    const targets = new Set<string>()
    for (const imported of ts.preProcessFile(text, true, true).importedFiles) {
      const target = resolveSpecifier(known, file, imported.fileName)
      if (target && target !== file) targets.add(target)
    }
    edges.set(file, targets)
    if (NON_LITERAL_LOAD.test(text) && loadsNonLiteral(file, text)) dynamic.push(file)
  }
  return { files, edges, dynamic }
}

const ROUTE_FILE = /^app\/(?:.*\/)?(?:page|layout|route|loading|error|not-found|template|default|global-error|opengraph-image|twitter-image|icon|apple-icon|sitemap|robots|manifest)\.(?:ts|tsx|js|jsx)$/
const APP_ENTRY = /^(?:middleware|proxy|instrumentation|instrumentation-client|i18n|next\.config|sentry\.[a-z]+\.config)\.[cm]?[jt]s$/
// What runs without being imported by a route: scripts, tooling, the database and service modules, end-to-end and the root configs.
const TOOL_ENTRY = /^(?:scripts|tooling|e2e|tests?|db|services|ops|\.storybook)\/|^[^/]+\.(?:config|setup)\.[cm]?[jt]s$|^vitest\.[^/]+\.[cm]?[jt]s$|^playwright[^/]*\.[cm]?[jt]s$/

function reachFrom(graph: ModuleGraph, roots: string[]): Set<string> {
  const reached = new Set(roots)
  const queue = [...roots]
  while (queue.length) {
    const file = queue.pop()!
    if (isTestFile(file)) continue
    for (const target of graph.edges.get(file) ?? []) {
      if (!reached.has(target)) {
        reached.add(target)
        queue.push(target)
      }
    }
  }
  return reached
}

export function classifyReach(graph: ModuleGraph): Map<string, ModuleReach> {
  const production = graph.files.filter((file) => !isTestFile(file))
  const fromApp = reachFrom(graph, production.filter((file) => ROUTE_FILE.test(file) || APP_ENTRY.test(file)))
  const fromTools = reachFrom(graph, production.filter((file) => TOOL_ENTRY.test(file)))
  const reach = new Map<string, ModuleReach>()
  for (const file of production) reach.set(file, fromApp.has(file) ? 'app' : fromTools.has(file) ? 'tools' : 'none')
  return reach
}

/** The screens, controls, messages and server actions: a file here that no route can reach is a surface nobody can see. */
export const UI_SCOPE = /^(?:components|hooks|contexts|emails|actions|types|domain|app)\//

export interface OrphanReport {
  files: number
  /** UI-scope files no route reaches: the gate is zero. */
  unreachableUi: string[]
  /** `lib` modules nothing reaches, not even a script: the ceiling can only fall. */
  deadLib: string[]
  dynamic: string[]
}

export function findOrphans(root: string): OrphanReport {
  const graph = buildModuleGraph(root)
  const reach = classifyReach(graph)
  const unreachableUi: string[] = []
  const deadLib: string[] = []
  for (const [file, kind] of reach) {
    if (UI_SCOPE.test(file) && kind !== 'app') unreachableUi.push(file)
    else if (file.startsWith('lib/') && kind === 'none') deadLib.push(file)
  }
  return { files: graph.files.length, unreachableUi: unreachableUi.sort(), deadLib: deadLib.sort(), dynamic: graph.dynamic.filter((file) => !isTestFile(file)) }
}
