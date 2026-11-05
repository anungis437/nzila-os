/**
 * The orphan census (UE-CONV-H-027): files nothing reaches. See lib/orphan-census/graph.ts for what counts as reached.
 *
 * A screen, control, e-mail template or server action in the UI scope that no route reaches is removed, never kept "in case": it is a surface that looks like the product in
 * the repository and in the evidence and cannot be used. A `lib` module that nothing reaches (not a route, not a script, not the database) is counted against a ceiling that can
 * only fall. Read-only: it reads source files and needs no database.
 *
 * Usage (from apps/union-eyes):
 *   npx tsx scripts/runtime/orphan-census.ts [--write=<json>] [--strict] [--quiet]
 */
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { findOrphans, type OrphanReport } from '../lib/orphan-census/graph'

export const APP_ROOT = path.resolve(__dirname, '..', '..')

/** A UI-scope file that no route reaches and that must stay, with why. The reason is the proof a reader needs; the list is meant to be empty. */
export const ACCEPTED_UI: Readonly<Record<string, string>> = {}

export function runCensus(root: string = APP_ROOT): OrphanReport {
  const report = findOrphans(root)
  return { ...report, unreachableUi: report.unreachableUi.filter((file) => !(file in ACCEPTED_UI)) }
}

function main(): void {
  const args = process.argv.slice(2)
  const option = (name: string): string | undefined => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
  const report = runCensus()
  if (option('write')) writeFileSync(option('write')!, `${JSON.stringify(report, null, 2)}\n`)
  if (!args.includes('--quiet')) {
    console.log(`${report.files} source files, ${report.unreachableUi.length} UI-scope files no route reaches, ${report.deadLib.length} lib modules nothing reaches, ${report.dynamic.length} files with a dynamic load`)
    for (const file of report.unreachableUi) console.log(`  UI   ${file}`)
    for (const file of report.deadLib) console.log(`  LIB  ${file}`)
  }
  if (args.includes('--strict') && report.unreachableUi.length + report.deadLib.length > 0) process.exit(1)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) main()
