import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import { is } from 'drizzle-orm'
import { storageAuthorityManifest } from '../../db/rls-storage-authority'
import { folder, root, type V2Plan } from './source'

/**
 * Source-derived set of Drizzle declaration files that live (non-test) application code imports
 * directly. A declaration omitted from the root barrel is still a required producer.
 */
const LIVE_ROOTS = ['app', 'lib', 'services', 'actions', 'db/queries', 'components', 'contexts']
const IMPORT = /from\s+['"](@\/db\/[^'"]+|(?:\.\.?\/)+db\/[^'"]+)['"]/g

function walk(directory: string, found: string[]) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '__tests__')
      continue
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(full, found)
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.|\.spec\.|\.d\.ts$/.test(entry.name))
      found.push(full)
  }
}

export function liveDeclarationFiles() {
  const app = path.join(root, 'apps', 'union-eyes')
  const files: string[] = []
  for (const live of LIVE_ROOTS) {
    const directory = path.join(app, ...live.split('/'))
    try {
      walk(directory, files)
    } catch {
      /* root absent */
    }
  }
  const importers = new Map<string, Set<string>>()
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    for (const match of text.matchAll(IMPORT)) {
      const specifier = match[1]
      const base = specifier.startsWith('@/')
        ? path.join(app, specifier.slice(2))
        : path.resolve(path.dirname(file), specifier)
      for (const candidate of [`${base}.ts`, path.join(base, 'index.ts')]) {
        const normalized = path.relative(root, candidate).replaceAll('\\', '/')
        if (!/\/db\/(schema|schema-[\w-]+)/.test(normalized)) continue
        if (!importers.has(normalized)) importers.set(normalized, new Set())
        importers.get(normalized)!.add(path.relative(root, file).replaceAll('\\', '/'))
      }
    }
  }
  return importers
}

export function summarizeLiveDeclarations(plan: V2Plan) {
  const load = createRequire(import.meta.url)
  const index: Record<string, unknown> = load(
    path.join(root, 'apps', 'union-eyes', 'db', 'schema', 'index.ts'),
  )
  const exported = new Set(
    Object.values(index)
      .filter((value) => is(value, PgTable))
      .map((value) => getTableConfig(value as PgTable).name),
  )
  const inPlan = new Map(
    plan.tables.map((table) => [table.name, new Set(table.columns.map((c) => c.name))]),
  )
  const rows: {
    table: string
    file: string
    importers: number
    inBarrel: boolean
    inPlan: boolean
    authority: string
    missingColumns: string[]
  }[] = []
  for (const [file, importerSet] of liveDeclarationFiles()) {
    let declarations: Record<string, unknown>
    try {
      declarations = load(path.join(root, ...file.split('/')))
    } catch {
      continue
    }
    for (const value of Object.values(declarations)) {
      if (!is(value, PgTable)) continue
      const config = getTableConfig(value as PgTable)
      if ((config.schema ?? 'public') !== 'public') continue
      const columns = inPlan.get(config.name)
      rows.push({
        table: config.name,
        file,
        importers: importerSet.size,
        inBarrel: exported.has(config.name),
        inPlan: Boolean(columns),
        authority:
          storageAuthorityManifest.find((entry) => entry.table === config.name)?.classification ??
          'NONE',
        missingColumns: columns
          ? config.columns.map((column) => column.name).filter((name) => !columns.has(name))
          : [],
      })
    }
  }
  return rows
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const plan: V2Plan = JSON.parse(
    readFileSync(path.join(folder, 'UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json'), 'utf8'),
  )
  const rows = summarizeLiveDeclarations(plan)
  const unique = new Map(rows.map((row) => [row.table, row]))
  const outside = [...unique.values()].filter((row) => !row.inBarrel)
  process.stdout.write(
    `${JSON.stringify({
      liveTables: unique.size,
      outsideBarrel: outside.length,
      outsideBarrelAbsentInPlan: outside.filter((row) => !row.inPlan).length,
      outsideBarrelWithMissingColumns: outside.filter((row) => row.missingColumns.length).length,
      outside,
    })}\n`,
  )
}
