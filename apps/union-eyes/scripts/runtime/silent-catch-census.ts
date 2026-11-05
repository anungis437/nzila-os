/**
 * The silent-catch census (UE-CONV-H-026): errors a screen swallows, in every UI file (see lib/frontend-census/silent-catch.ts for what counts). A finding is fixed by telling the
 * person (an error state with the server's message, a toast through @/components/ui/use-toast, a retry), or, when the failure really is expected and harmless, by saying so in a
 * comment inside the catch that explains why; never by leaving it empty. A catch that must stay as written is accepted by name in ACCEPTED below, with the reason. Read-only:
 * it reads source files and needs no database.
 *
 * Usage (from apps/union-eyes):
 *   npx tsx scripts/runtime/silent-catch-census.ts [--write=<json>] [--markdown=<md>] [--strict] [--quiet]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { findSilentCatches, type SilentCatchKind } from '../lib/frontend-census/silent-catch'
import { APP_ROOT, sourceFiles } from './frontend-api-census'

/** A catch that is true as written, with why. Matched by file and by the start of the catch's text. */
export const ACCEPTED: ReadonlyArray<{ file: string; text: string; reason: string }> = []

export interface SilentCatchSite {
  file: string
  line: number
  kind: SilentCatchKind
  text: string
}

export interface SilentCatchReport {
  files: number
  accepted: number
  findings: SilentCatchSite[]
}

export function runCensus(root: string = APP_ROOT): SilentCatchReport {
  const files = sourceFiles(root).filter((file) => /^(?:app|components|contexts)\//.test(file))
  const findings: SilentCatchSite[] = []
  let accepted = 0
  for (const file of files) {
    for (const found of findSilentCatches(file, readFileSync(path.join(root, file), 'utf8'))) {
      if (ACCEPTED.some((entry) => entry.file === file && found.text.startsWith(entry.text))) accepted += 1
      else findings.push({ file, ...found })
    }
  }
  return { files: files.length, accepted, findings }
}

export function countByKind(findings: SilentCatchSite[]): Record<SilentCatchKind, number> {
  const counts: Record<SilentCatchKind, number> = { EMPTY_CATCH: 0, EMPTY_PROMISE_CATCH: 0 }
  for (const finding of findings) counts[finding.kind] += 1
  return counts
}

export function toMarkdown(report: SilentCatchReport): string {
  const lines = ['# Silent-catch census (UE-CONV-H-026)', '', `${report.files} UI files read; ${report.findings.length} swallowed errors, ${report.accepted} accepted as true as written.`, '']
  for (const kind of ['EMPTY_CATCH', 'EMPTY_PROMISE_CATCH'] as const) {
    const group = report.findings.filter((finding) => finding.kind === kind)
    if (!group.length) continue
    lines.push(`## ${kind}`, '')
    for (const finding of group) lines.push(`- ${finding.file}:${finding.line}  \`${finding.text}\``)
    lines.push('')
  }
  return `${lines.join('\n')}\n`
}

function main(): void {
  const args = process.argv.slice(2)
  const option = (name: string): string | undefined => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
  const report = runCensus()
  if (option('write')) writeFileSync(option('write')!, `${JSON.stringify(report, null, 2)}\n`)
  if (option('markdown')) writeFileSync(option('markdown')!, toMarkdown(report))
  if (!args.includes('--quiet')) {
    console.log(`${report.files} UI files, ${report.findings.length} swallowed errors (${report.accepted} accepted)`)
    for (const finding of report.findings) console.log(`  ${finding.kind.padEnd(20)} ${finding.file}:${finding.line}  ${finding.text}`)
  }
  if (args.includes('--strict') && report.findings.length > 0) process.exit(1)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) main()
