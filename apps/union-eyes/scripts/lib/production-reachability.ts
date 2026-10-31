/**
 * Static reachability of Union Eyes modules from production entry points.
 *
 * Used by the schema and mutation batch program. A table is production-reachable when a non-test,
 * non-declaration file that names it is imported, directly or through re-exports, from an App Router
 * entry. An unresolved relative or `@/` import makes the graph incomplete: nothing may be classified
 * as dead from an incomplete graph.
 *
 * This does not start a database and does not change the schema census or the mutation baseline.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

export const APP = path.resolve(__dirname, '../..')
const SKIP = new Set(['node_modules', '.next', 'dist', 'coverage', '.git', 'migrations-cache'])

const ENTRY = /^app\/(?:.*\/)?(?:route|page|layout|default|template|error|loading)\.(?:ts|tsx)$|^middleware\.(?:ts|tsx)$|^instrumentation\.(?:ts|tsx)$/

const SPEC = /(?:import|export)\s+(?:type\s+)?(?:[^'"\n]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g

export interface ReachIndex {
  graphComplete: boolean
  unresolved: string[]
  /** Repo-relative files reachable from an App Router entry, middleware, or instrumentation. */
  reachable: ReadonlySet<string>
  references: ReadonlyMap<string, readonly string[]>
  djangoTables: ReadonlySet<string>
}

function walk(dir: string, out: string[] = []): string[] {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of names) {
    if (SKIP.has(name)) continue
    const full = path.join(dir, name)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) walk(full, out)
    else if (/\.(?:ts|tsx|js|mjs|py)$/.test(name)) out.push(full)
  }
  return out
}

function resolveExisting(base: string, files: Set<string>): string | null {
  const stripped = base.replace(/\.(?:js|mjs|cjs)$/, '')
  const candidates = [
    base,
    stripped,
    `${stripped}.ts`,
    `${stripped}.tsx`,
    `${stripped}.js`,
    `${stripped}.mjs`,
    path.join(stripped, 'index.ts'),
    path.join(stripped, 'index.tsx'),
    path.join(base, 'index.ts'),
  ]
  for (const candidate of candidates) if (files.has(candidate)) return candidate
  return null
}

function isTest(rel: string): boolean {
  return rel.includes('/__tests__/') || /\.test\.(?:ts|tsx)$/.test(rel) || /\.spec\.(?:ts|tsx)$/.test(rel)
}

function isDeclaration(rel: string): boolean {
  return rel.startsWith('db/schema')
    || rel.startsWith('db/rls-')
    || rel.startsWith('scripts/')
    || rel === 'services/financial-service/src/db/schema.ts'
    || rel === 'services/financial-service/drizzle/schema.ts'
    || rel.startsWith('db/migrations')
    || rel.startsWith('backend/')
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:\\])\/\/[^\n]*/g, '$1')
}

function tableExports(): Map<string, string> {
  const out = new Map<string, string>()
  const dir = path.join(APP, 'db/schema')
  for (const file of walk(dir).filter((f) => f.endsWith('.ts'))) {
    const text = readFileSync(file, 'utf8')
    for (const match of text.matchAll(/export const (\w+)\s*=\s*pgTable\(\s*["'`]([\w.]+)["'`]/g)) {
      out.set(match[1], match[2])
    }
  }
  return out
}

function importedSchemaNames(text: string): Set<string> | 'namespace' | null {
  const names = new Set<string>()
  let schema = false
  const fromRe = /import\s+(type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g
  for (const match of text.matchAll(fromRe)) {
    const spec = match[3]
    if (!spec.includes('db/schema')) continue
    schema = true
    const clause = match[2].replace(/\s+/g, ' ')
    if (clause.includes('* as ')) return 'namespace'
    for (const part of clause.replace(/[{}]/g, '').split(',')) {
      const piece = part.trim()
      if (!piece) continue
      const original = piece.split(/\s+as\s+/)[0].trim()
      if (/^\w+$/.test(original)) names.add(original)
    }
  }
  return schema ? names : null
}

export function buildReachIndex(tables: readonly string[]): ReachIndex {
  const files = walk(APP)
  const fileSet = new Set(files)
  const relOf = new Map(files.map((file) => [file, path.relative(APP, file).split(path.sep).join('/')]))
  const textOf = new Map(files.map((file) => [file, readFileSync(file, 'utf8')]))
  const unresolved: string[] = []
  const edges = new Map<string, string[]>()

  for (const file of files) {
    const rel = relOf.get(file)!
    if (!/\.(?:ts|tsx|js|mjs)$/.test(file)) continue
    const text = stripComments(textOf.get(file)!).replace(/\r?\n/g, ' ')
    const next: string[] = []
    for (const match of text.matchAll(SPEC)) {
      const spec = match[1] || match[2] || match[3]
      if (!spec || (!spec.startsWith('.') && !spec.startsWith('@/'))) continue
      const base = spec.startsWith('@/')
        ? path.join(APP, spec.slice(2))
        : path.resolve(path.dirname(file), spec)
      const resolved = resolveExisting(base, fileSet)
      if (!resolved) {
        const asset = /\.(?:css|json|md|svg|png|webp|gif|jpg|jpeg)$/.test(spec)
        const outsideApp = spec.startsWith('.') && !base.startsWith(APP + path.sep) && base !== APP
        if (!asset && !outsideApp && !isTest(rel) && !rel.endsWith('.d.ts') && !rel.startsWith('scripts/')) unresolved.push(`${rel} -> ${spec}`)
        continue
      }
      next.push(relOf.get(resolved)!)
    }
    edges.set(rel, next)
  }

  const reachable = new Set<string>()
  const queue = [...relOf.values()].filter((rel) => ENTRY.test(rel))
  for (const rel of queue) reachable.add(rel)
  for (let i = 0; i < queue.length; i++) {
    for (const next of edges.get(queue[i]) ?? []) {
      if (reachable.has(next)) continue
      reachable.add(next)
      queue.push(next)
    }
  }

  const wanted = new Set(tables)
  const exports = tableExports()
  const references = new Map<string, string[]>()
  for (const table of tables) references.set(table, [])

  for (const file of files) {
    const rel = relOf.get(file)!
    if (isTest(rel) || isDeclaration(rel) || rel.startsWith('backend/')) continue
    const text = textOf.get(file)!
    const hit = new Set<string>()
    for (const match of text.matchAll(/['"`]([a-z][\w.]*)['"`]/g)) {
      if (wanted.has(match[1])) hit.add(match[1])
    }
    const sqlNames = [...wanted].map((table) => table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
    if (sqlNames) {
      const sqlRef = new RegExp(`\\b(?:from|join|into|update)\\s+"?(${sqlNames})"?\\b`, 'gi')
      for (const match of text.matchAll(sqlRef)) {
        const name = match[1].toLowerCase()
        if (wanted.has(name)) hit.add(name)
      }
    }
    if (/\.(?:ts|tsx)$/.test(file)) {
      const imported = importedSchemaNames(text)
      if (imported === 'namespace') {
        for (const [name, table] of exports) {
          if (!wanted.has(table)) continue
          if (new RegExp(`\\b${name}\\b`).test(text)) hit.add(table)
        }
      } else if (imported) {
        for (const name of imported) {
          const table = exports.get(name)
          if (table && wanted.has(table)) hit.add(table)
        }
      }
    }
    for (const table of hit) references.get(table)!.push(rel)
  }
  for (const list of references.values()) list.sort()

  const djangoTables = new Set<string>()
  for (const file of files) {
    if (!file.endsWith('.py') || !relOf.get(file)!.startsWith('backend/')) continue
    if (relOf.get(file)!.includes('/migrations/')) continue
    const text = textOf.get(file)!
    for (const match of text.matchAll(/db_table\s*=\s*['"]([\w.]+)['"]/g)) {
      if (wanted.has(match[1])) djangoTables.add(match[1])
    }
  }

  const unresolvedOnReachable = unresolved.filter((item) => reachable.has(item.split(' -> ')[0])).sort()
  return {
    graphComplete: unresolvedOnReachable.length === 0,
    unresolved: unresolvedOnReachable,
    reachable,
    references,
    djangoTables,
  }
}

export function productionReferences(index: ReachIndex, table: string): readonly string[] {
  return index.references.get(table) ?? []
}

export function tableIsReachable(index: ReachIndex, table: string): boolean {
  return productionReferences(index, table).some((rel) => index.reachable.has(rel))
}
