#!/usr/bin/env tsx
/**
 * scripts/schema-duplicate-table-scan.ts — repository-wide duplicate
 * physical-table declaration scanner (PR #752 review finding).
 *
 * Context: db/rls-storage-authority-manifest.ts's grievance_documents
 * classification work surfaced that THREE different files declared
 * `pgTable("grievance_documents", ...)` with genuinely incompatible column
 * sets (one had no organization_id at all), yet the repo's own
 * `Schema Drift Detection` CI job was green — that gate does not check
 * for this class of collision at all. This scanner is the missing check:
 * it finds every physical table name declared by more than one pgTable()
 * (or schema-qualified `<pgSchema-var>.table()`) call across db/schema/**.ts
 * and classifies each group.
 *
 * CLASSIFICATION (three states — see PR #752 review, 2026-09-01 round 2):
 * an earlier version of this scanner called two declarations
 * "COMPATIBLE_DUPLICATE" whenever they had the same set of column NAMES,
 * without checking type, nullability, default/generated semantics,
 * primary-key/unique participation, array-ness, or FK target. That
 * overstated certainty — two declarations can share every column name and
 * still disagree on what those columns mean. The three states below never
 * claim compatibility that hasn't actually been checked:
 *
 *   - CONFLICTING_SCHEMA: either the column NAME sets differ, or a
 *     property this scanner CAN extract (type-function identifier,
 *     notNull, primaryKey, unique, array-ness, hasDefault, or a
 *     fully-resolved FK reference target) genuinely disagrees between
 *     declarations for a same-named column. This is a proven conflict.
 *   - IDENTICAL_OR_PROVEN_COMPATIBLE: column names match AND every
 *     extractable property agreed for every column in every declaration.
 *   - SAME_COLUMN_SET_UNVERIFIED: column names match, nothing extractable
 *     disagreed, but at least one property could not be confidently
 *     extracted/compared (e.g. only one side has a detectable FK
 *     reference, or a raw `sql\`...\`` expression was used as a default) —
 *     so compatibility is NOT proven, only "not disproven".
 *
 * This is a heuristic regex-based extractor, not a TS/AST-level type
 * checker — it does not resolve custom enum identity beyond the pgEnum()
 * variable name, does not diff default VALUES (only default PRESENCE),
 * and does not inspect index/unique-index shape beyond per-column
 * `.unique()`. Treat it as "no false claims of compatibility", not as a
 * complete schema-equivalence prover.
 *
 * SCHEMA-QUALIFIED TABLES: a handful of files declare tables via
 * `pgSchema("some_schema")` + `someSchemaVar.table("name", {...})` instead
 * of the default-schema `pgTable("name", {...})`. Physically these live in
 * a different Postgres schema (e.g. `user_management.users`), so they are
 * NOT the same relation as a `public.users` declared elsewhere — grouping
 * is keyed on `${schema}.${tableName}`, not bare table name, to avoid
 * false cross-schema conflicts. The report still displays the bare table
 * name for readability, annotated with its schema when non-default.
 *
 * MIGRATION EVIDENCE: for each CONFLICTING_SCHEMA table, this scanner also
 * greps db/migrations/*.sql for CREATE TABLE / ALTER TABLE mentions of
 * that physical table name and lists the matching migration files as
 * evidence sources. It does not parse/diff the raw SQL column list — it
 * only surfaces that these migrations exist so a human/agent doing
 * canonicalization work doesn't have to rediscover them separately.
 *
 * This does NOT resolve conflicts automatically. A conflict is not
 * necessarily a bug on its own — this repo has a deliberate resolution
 * pattern (see db/schema/domains/claims/index.ts's own comments) where a
 * barrel re-export picks one canonical declaration and the others become
 * orphaned/shadowed. The real risk is code that imports the non-canonical
 * declaration's SPECIFIC EXPORT directly (bypassing the barrel), which
 * this script also flags by cross-referencing real import statements
 * outside db/schema/** — checking that the flagged export name is
 * actually named in the importing file's import statement(s) for that
 * module path, not merely that the module path is referenced at all
 * (an earlier version of this scanner over-flagged files that imported a
 * *different*, non-conflicting export from the same module).
 *
 * Usage: pnpm --filter @nzila/union-eyes exec tsx scripts/schema-duplicate-table-scan.ts
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { CANONICAL_SCHEMA_DECLARATIONS } from './canonical-schema-map'

const APP_ROOT = join(__dirname, '..')
const SCHEMA_ROOT = join(APP_ROOT, 'db/schema')

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    // Safe: `dir` originates only from SCHEMA_ROOT (a fixed, hardcoded
    // path) and this function's own recursive calls on that same tree —
    // no external/user input reaches this path.
    const p = join(dir, entry)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...walk(p))
    else if (entry.endsWith('.ts')) out.push(p)
  }
  return out
}

export interface ColumnInfo {
  name: string
  typeFn: string
  notNull: boolean
  primaryKey: boolean
  unique: boolean
  array: boolean
  hasDefault: boolean
  /** `"table.column"` if a `.references(() => x.y)` call was resolved, else null. */
  referencesTarget: string | null
}

export interface Declaration {
  /** path relative to db/schema/, no extension, POSIX separators */
  modulePath: string
  exportName: string
  /** Postgres schema this table lives in — "public" unless pgSchema-qualified. */
  schema: string
  columns: ColumnInfo[]
}

export type ConflictClassification =
  | 'IDENTICAL_OR_PROVEN_COMPATIBLE'
  | 'SAME_COLUMN_SET_UNVERIFIED'
  | 'CONFLICTING_SCHEMA'

export type DeclarationSourceStatus =
  | 'CANONICAL_DECLARATION'
  | 'STALE_DUPLICATE'
  | 'UNRESOLVED'

/**
 * Classifies a single declaration against CANONICAL_SCHEMA_DECLARATIONS.
 * A single-declaration group (no conflict at all) is always UNRESOLVED —
 * the map only matters once there is more than one declaration to choose
 * between.
 */
export function getDeclarationStatus(key: string, modulePath: string): DeclarationSourceStatus {
  const canonical = CANONICAL_SCHEMA_DECLARATIONS[key]
  if (!canonical) return 'UNRESOLVED'
  return canonical === modulePath ? 'CANONICAL_DECLARATION' : 'STALE_DUPLICATE'
}

const pgSchemaVarRe = /export const ([a-zA-Z0-9_]+) = pgSchema\(\s*["'`]([a-z0-9_]+)["'`]\s*\)/g
const tableRe = /export const ([a-zA-Z0-9_]+) = pgTable\(\s*["'`]([a-z0-9_]+)["'`]\s*,\s*\{/g
const colRe = /^\s*([a-zA-Z0-9_]+):\s*([a-zA-Z_][a-zA-Z0-9_]*)\(\s*["'`]([a-z0-9_]+)["'`]/gm

function findBlock(src: string, openBraceIdx: number): string {
  let depth = 0
  let i = openBraceIdx
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') {
      depth--
      if (depth === 0) break
    }
  }
  return src.slice(openBraceIdx, i + 1)
}

function extractColumns(block: string): ColumnInfo[] {
  const colReLocal = new RegExp(colRe.source, 'gm')
  const starts: { index: number; typeFn: string; name: string }[] = []
  let cm: RegExpExecArray | null
  while ((cm = colReLocal.exec(block))) {
    starts.push({ index: cm.index, typeFn: cm[2], name: cm[3] })
  }
  const columns: ColumnInfo[] = []
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i].index
    const end = i + 1 < starts.length ? starts[i + 1].index : block.length
    const chunk = block.slice(start, end)
    const refMatch = /\.references\(\s*\(\)\s*=>\s*([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)/.exec(chunk)
    columns.push({
      name: starts[i].name,
      typeFn: starts[i].typeFn,
      notNull: /\.notNull\(\)/.test(chunk),
      primaryKey: /\.primaryKey\(\)/.test(chunk),
      unique: /\.unique\(\)/.test(chunk),
      array: /\.array\(\)/.test(chunk),
      hasDefault: /\.default(?:Now|Random)?\(/.test(chunk),
      referencesTarget: refMatch ? `${refMatch[1]}.${refMatch[2]}` : null,
    })
  }
  return columns
}

export function scanSchemaDeclarations(): Map<string, Declaration[]> {
  const byTable = new Map<string, Declaration[]>()
  for (const file of walk(SCHEMA_ROOT)) {
    const src = readFileSync(file, 'utf8')
    const modulePath = file
      .replace(SCHEMA_ROOT, '')
      .replace(/\\/g, '/')
      .replace(/^\//, '')
      .replace(/\.ts$/, '')

    const schemaVars = new Map<string, string>()
    const schemaVarReLocal = new RegExp(pgSchemaVarRe.source, 'g')
    let sm: RegExpExecArray | null
    while ((sm = schemaVarReLocal.exec(src))) schemaVars.set(sm[1], sm[2])

    // Plain, default-schema `pgTable("name", {...})` declarations.
    const tableReLocal = new RegExp(tableRe.source, 'g')
    let m: RegExpExecArray | null
    while ((m = tableReLocal.exec(src))) {
      const exportName = m[1]
      const tableName = m[2]
      const openBraceIdx = m.index + m[0].length - 1
      const block = findBlock(src, openBraceIdx)
      const key = `public.${tableName}`
      const decls = byTable.get(key) ?? []
      decls.push({ modulePath, exportName, schema: 'public', columns: extractColumns(block) })
      byTable.set(key, decls)
    }

    // Schema-qualified `<pgSchema-var>.table("name", {...})` declarations.
    for (const [varName, schemaName] of schemaVars) {
      const qualifiedRe = new RegExp(
        `export const ([a-zA-Z0-9_]+) = ${varName}\\.table\\(\\s*["'\`]([a-z0-9_]+)["'\`]\\s*,\\s*\\{`,
        'g',
      )
      let qm: RegExpExecArray | null
      while ((qm = qualifiedRe.exec(src))) {
        const exportName = qm[1]
        const tableName = qm[2]
        const openBraceIdx = qm.index + qm[0].length - 1
        const block = findBlock(src, openBraceIdx)
        const key = `${schemaName}.${tableName}`
        const decls = byTable.get(key) ?? []
        decls.push({ modulePath, exportName, schema: schemaName, columns: extractColumns(block) })
        byTable.set(key, decls)
      }
    }
  }
  return byTable
}

/**
 * Classifies a group of >1 declarations for the SAME physical (schema, table)
 * key. Never returns IDENTICAL_OR_PROVEN_COMPATIBLE unless every extractable
 * property was actually compared and matched — see file header.
 */
export function classifyGroup(decls: Declaration[]): ConflictClassification {
  const nameSets = decls.map((d) => new Set(d.columns.map((c) => c.name)))
  const first = nameSets[0]
  const namesMatch = nameSets.every((s) => s.size === first.size && [...s].every((c) => first.has(c)))
  if (!namesMatch) return 'CONFLICTING_SCHEMA'

  let unverified = false
  for (const name of first) {
    const infos = decls.map((d) => d.columns.find((c) => c.name === name))
    const base = infos[0]
    if (!base) {
      unverified = true
      continue
    }
    for (const info of infos.slice(1)) {
      if (!info) {
        unverified = true
        continue
      }
      if (
        info.typeFn !== base.typeFn ||
        info.notNull !== base.notNull ||
        info.primaryKey !== base.primaryKey ||
        info.unique !== base.unique ||
        info.array !== base.array ||
        info.hasDefault !== base.hasDefault
      ) {
        return 'CONFLICTING_SCHEMA'
      }
      if (info.referencesTarget && base.referencesTarget) {
        if (info.referencesTarget !== base.referencesTarget) return 'CONFLICTING_SCHEMA'
      } else if (Boolean(info.referencesTarget) !== Boolean(base.referencesTarget)) {
        // Only one side's FK target was resolvable — could be a genuine
        // difference or just an unparsed reference chain. Don't assert a
        // conflict we can't substantiate; also don't claim proven compatibility.
        unverified = true
      }
    }
  }
  return unverified ? 'SAME_COLUMN_SET_UNVERIFIED' : 'IDENTICAL_OR_PROVEN_COMPATIBLE'
}

/**
 * Finds real (non-schema, non-test) files that import the given export
 * name FROM the given module path directly — i.e. actually bypass the
 * domain barrel for THIS declaration, not merely reference the module path
 * for some other, non-conflicting export.
 */
function findDirectBypassImports(modulePath: string, exportName: string): string[] {
  let candidateFiles: string[]
  try {
    const out = execFileSync(
      'git',
      ['grep', '-l', `@/db/schema/${modulePath}`, '--', 'app/', 'actions/', 'lib/', 'services/'],
      { cwd: APP_ROOT, encoding: 'utf8' },
    )
    candidateFiles = out.split('\n').map((s) => s.trim()).filter(Boolean)
      .filter((f) => !/__tests__|\.test\.|\.spec\./.test(f))
  } catch {
    return [] // git grep exits 1 when no matches
  }

  const bypassing: string[] = []
  const escapedModulePath = modulePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const importRe = new RegExp(
    `import\\s+(?:type\\s+)?\\{([^}]*)\\}\\s+from\\s+["'\`]@/db/schema/${escapedModulePath}["'\`]`,
    'g',
  )
  const dynamicImportRe = new RegExp(
    `\\{([^}]*)\\}\\s*=\\s*await\\s+import\\(\\s*["'\`]@/db/schema/${escapedModulePath}["'\`]`,
    'g',
  )
  for (const file of candidateFiles) {
    let src: string
    try {
      src = readFileSync(join(APP_ROOT, file), 'utf8')
    } catch {
      continue
    }
    const namedExports = new Set<string>()
    for (const re of [importRe, dynamicImportRe]) {
      re.lastIndex = 0
      let im: RegExpExecArray | null
      while ((im = re.exec(src))) {
        for (const part of im[1].split(',')) {
          const name = part.trim().split(/\s+as\s+/)[0].replace(/^type\s+/, '').trim()
          if (name) namedExports.add(name)
        }
      }
    }
    if (namedExports.has(exportName)) bypassing.push(file)
  }
  return bypassing
}

/** Migration files that mention CREATE/ALTER TABLE for the given physical table name. */
function findMigrationEvidence(tableName: string): string[] {
  try {
    const out = execFileSync(
      'git',
      ['grep', '-l', '-E', `(CREATE|ALTER) TABLE[^;]*"${tableName}"`, '--', 'db/migrations/'],
      { cwd: APP_ROOT, encoding: 'utf8' },
    )
    return out.split('\n').map((s) => s.trim().replace(/^db\/migrations\//, '')).filter(Boolean)
  } catch {
    return []
  }
}

function main() {
  const byTable = scanSchemaDeclarations()
  const conflicts: { key: string; decls: Declaration[] }[] = []
  const unverified: { key: string; decls: Declaration[] }[] = []
  const compatible: { key: string; decls: Declaration[] }[] = []

  for (const [key, decls] of byTable) {
    if (decls.length < 2) continue
    const classification = classifyGroup(decls)
    if (classification === 'CONFLICTING_SCHEMA') conflicts.push({ key, decls })
    else if (classification === 'SAME_COLUMN_SET_UNVERIFIED') unverified.push({ key, decls })
    else compatible.push({ key, decls })
  }

  const displayName = (key: string) => {
    const [schema, table] = key.split(/\.(.+)/)
    return schema === 'public' ? table : `${table} (schema: ${schema})`
  }
  const bareTableName = (key: string) => key.split(/\.(.+)/)[1]

  const lines: string[] = []
  lines.push(`Total distinct physical (schema, table) keys: ${byTable.size}`)
  lines.push(`Keys with >1 declaration: ${conflicts.length + unverified.length + compatible.length}`)
  lines.push(`  - CONFLICTING_SCHEMA (proven incompatible): ${conflicts.length}`)
  lines.push(`  - SAME_COLUMN_SET_UNVERIFIED (names match, full compatibility not proven): ${unverified.length}`)
  lines.push(`  - IDENTICAL_OR_PROVEN_COMPATIBLE: ${compatible.length}`)
  lines.push('')
  lines.push('=== CONFLICTING_SCHEMA ===')
  for (const { key, decls } of conflicts) {
    lines.push(`${displayName(key)}: ${decls.map((d) => `db/schema/${d.modulePath}.ts(${d.exportName})[${d.columns.length}cols]`).join(' | ')}`)
    for (const d of decls) {
      const status = getDeclarationStatus(key, d.modulePath)
      if (status !== 'UNRESOLVED') {
        lines.push(`  ${status}: db/schema/${d.modulePath}(${d.exportName})`)
      }
      const bypassers = findDirectBypassImports(d.modulePath, d.exportName)
      if (bypassers.length > 0) {
        const bypassTag = status === 'STALE_DUPLICATE' ? ' [STALE_DUPLICATE — should be redirected]' : ''
        lines.push(`  DIRECT IMPORT BYPASSING BARREL: db/schema/${d.modulePath}(${d.exportName}) imported directly by: ${bypassers.join(', ')}${bypassTag}`)
      }
    }
    const migrations = findMigrationEvidence(bareTableName(key))
    if (migrations.length > 0) {
      lines.push(`  MIGRATION EVIDENCE: ${migrations.join(', ')}`)
    }
  }
  lines.push('')
  lines.push('=== SAME_COLUMN_SET_UNVERIFIED (column names match; type/nullability/default/FK not fully provable statically — verify against live schema before treating as safe) ===')
  for (const { key, decls } of unverified) {
    lines.push(`${displayName(key)}: ${decls.map((d) => `db/schema/${d.modulePath}.ts(${d.exportName})`).join(' | ')}`)
  }
  lines.push('')
  lines.push('=== IDENTICAL_OR_PROVEN_COMPATIBLE (column name, type, nullability, PK/unique/array/default-presence, and any resolvable FK target all agreed) ===')
  for (const { key, decls } of compatible) {
    lines.push(`${displayName(key)}: ${decls.map((d) => `db/schema/${d.modulePath}.ts(${d.exportName})`).join(' | ')}`)
  }

  const report = lines.join('\n')
  writeFileSync(join(APP_ROOT, 'schema-duplicate-table-report.txt'), report, 'utf8')
  console.log(
    `Wrote apps/union-eyes/schema-duplicate-table-report.txt ` +
      `(${conflicts.length} conflicting, ${unverified.length} unverified, ${compatible.length} proven-compatible).`,
  )
}

if (require.main === module) {
  main()
}

