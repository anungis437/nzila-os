#!/usr/bin/env tsx
/**
 * scripts/schema-duplicate-table-scan.ts — repository-wide duplicate
 * physical-table declaration scanner (PR #752 review finding).
 *
 * Context: db/rls-storage-authority-manifest.ts's grievance_documents
 * classification work surfaced that THREE different files declare
 * `pgTable("grievance_documents", ...)` with genuinely incompatible column
 * sets (one has no organization_id at all), yet the repo's own
 * `Schema Drift Detection` CI job was green — that gate does not check
 * for this class of collision at all. This scanner is the missing check:
 * it finds every physical table name declared by more than one pgTable()
 * call across db/schema/**.ts and classifies the group as either a
 * COMPATIBLE_DUPLICATE (same column set, harmless but should still be
 * consolidated) or CONFLICTING_SCHEMA (different column sets for the same
 * physical relation — a genuine correctness risk, since whichever
 * declaration a given file imports determines what TypeScript believes
 * that table looks like, independent of what Postgres actually has).
 *
 * This does NOT resolve conflicts automatically. A conflict is not
 * necessarily a bug on its own — this repo has a deliberate resolution
 * pattern (see db/schema/domains/claims/index.ts's own comments) where a
 * barrel re-export picks one canonical declaration and the others become
 * orphaned/shadowed. The real risk is code that imports the non-canonical
 * declaration DIRECTLY (bypassing the barrel), which this script also
 * flags by cross-referencing against real import statements outside
 * db/schema/**.
 *
 * Usage: pnpm --filter @nzila/union-eyes exec tsx scripts/schema-duplicate-table-scan.ts
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

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

interface Declaration {
  /** path relative to db/schema/, no extension, POSIX separators */
  modulePath: string
  exportName: string
  columns: string[]
}

const tableRe = /export const ([a-zA-Z0-9_]+) = pgTable\(\s*["'`]([a-z0-9_]+)["'`]\s*,\s*\{/g
const colRe = /^\s*([a-zA-Z0-9_]+):\s*[a-zA-Z]+\(\s*["'`]([a-z0-9_]+)["'`]/gm

export function scanSchemaDeclarations(): Map<string, Declaration[]> {
  const byTable = new Map<string, Declaration[]>()
  for (const file of walk(SCHEMA_ROOT)) {
    const src = readFileSync(file, 'utf8')
    let m: RegExpExecArray | null
    const tableReLocal = new RegExp(tableRe.source, 'g')
    while ((m = tableReLocal.exec(src))) {
      const exportName = m[1]
      const tableName = m[2]
      const startIdx = m.index + m[0].length - 1
      let depth = 0
      let i = startIdx
      for (; i < src.length; i++) {
        if (src[i] === '{') depth++
        else if (src[i] === '}') {
          depth--
          if (depth === 0) break
        }
      }
      const block = src.slice(startIdx, i + 1)
      const columns: string[] = []
      let cm: RegExpExecArray | null
      const colReLocal = new RegExp(colRe.source, 'gm')
      while ((cm = colReLocal.exec(block))) columns.push(cm[2])
      const modulePath = file
        .replace(SCHEMA_ROOT, '')
        .replace(/\\/g, '/')
        .replace(/^\//, '')
        .replace(/\.ts$/, '')
      const decls = byTable.get(tableName) ?? []
      decls.push({ modulePath, exportName, columns })
      byTable.set(tableName, decls)
    }
  }
  return byTable
}

function main() {
  const byTable = scanSchemaDeclarations()
  const conflicts: { table: string; decls: Declaration[] }[] = []
  const compatible: { table: string; decls: Declaration[] }[] = []

  for (const [table, decls] of byTable) {
    if (decls.length < 2) continue
    const sets = decls.map((d) => new Set(d.columns))
    const first = sets[0]
    const allSame = sets.every((s) => s.size === first.size && [...s].every((c) => first.has(c)))
    if (allSame) compatible.push({ table, decls })
    else conflicts.push({ table, decls })
  }

  const lines: string[] = []
  lines.push(`Total distinct physical table names: ${byTable.size}`)
  lines.push(`Tables with >1 pgTable declaration: ${conflicts.length + compatible.length}`)
  lines.push(`  - COMPATIBLE_DUPLICATE (same columns): ${compatible.length}`)
  lines.push(`  - CONFLICTING_SCHEMA (different columns): ${conflicts.length}`)
  lines.push('')
  lines.push('=== CONFLICTING_SCHEMA ===')
  for (const { table, decls } of conflicts) {
    lines.push(`${table}: ${decls.map((d) => `db/schema/${d.modulePath}.ts(${d.exportName})[${d.columns.length}cols]`).join(' | ')}`)
    // Flag any real (non-schema, non-test) import that bypasses the schema
    // barrel by importing one of these modulePaths directly — this is the
    // actual live risk, not the mere existence of duplicate declarations.
    for (const d of decls) {
      try {
        const out = execFileSync(
          'git',
          ['grep', '-l', `@/db/schema/${d.modulePath}`, '--', 'app/', 'actions/', 'lib/', 'services/'],
          { cwd: APP_ROOT, encoding: 'utf8' },
        )
        const files = out.split('\n').map((s) => s.trim()).filter(Boolean)
          .filter((f) => !/__tests__|\.test\.|\.spec\./.test(f))
        if (files.length > 0) {
          lines.push(`  DIRECT IMPORT BYPASSING BARREL: db/schema/${d.modulePath} imported directly by: ${files.join(', ')}`)
        }
      } catch {
        // git grep exits 1 when no matches
      }
    }
  }
  lines.push('')
  lines.push('=== COMPATIBLE_DUPLICATE (should still be consolidated, lower priority) ===')
  for (const { table, decls } of compatible) {
    lines.push(`${table}: ${decls.map((d) => `db/schema/${d.modulePath}.ts(${d.exportName})`).join(' | ')}`)
  }

  const report = lines.join('\n')
  writeFileSync(join(APP_ROOT, 'schema-duplicate-table-report.txt'), report, 'utf8')
  console.log(`Wrote apps/union-eyes/schema-duplicate-table-report.txt (${conflicts.length} conflicting, ${compatible.length} compatible-duplicate table names).`)
}

if (require.main === module) {
  main()
}
