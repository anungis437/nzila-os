/**
 * The fake-content census (UE-CONV-H-021): figures a screen states that nothing measured and mailboxes it names that the product does not own, in every UI file (see lib/frontend-census/fake-content.ts for what
 * counts). A finding is fixed by showing what the data says (or that there is none: components/system/capability-unavailable.tsx), not by changing the number.
 * Text that is true as written (a scale label, a statutory deadline) is not a finding; anything else that must stay is accepted by name, with the reason, in
 * ACCEPTED below. Read-only: it reads source files and needs no database.
 *
 * Usage (from apps/union-eyes):
 *   npx tsx scripts/runtime/fake-content-census.ts [--write=<json>] [--markdown=<md>] [--strict] [--quiet]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { findFakeContent, type FakeKind } from '../lib/frontend-census/fake-content'
import { APP_ROOT, sourceFiles } from './frontend-api-census'

/** Text a UI file states that matches a rule and is true as written, with why. */
export const ACCEPTED: ReadonlyArray<{ file: string; text: string; reason: string }> = []

export interface FakeSite {
  file: string
  line: number
  kind: FakeKind
  text: string
}

export interface FakeReport {
  files: number
  accepted: number
  findings: FakeSite[]
}

export function runCensus(root: string = APP_ROOT): FakeReport {
  const files = sourceFiles(root).filter((file) => /^(?:app|components|contexts)\//.test(file) || /^lib\/.*\.tsx$/.test(file))
  const findings: FakeSite[] = []
  let accepted = 0
  for (const file of files) {
    for (const found of findFakeContent(file, readFileSync(path.join(root, file), 'utf8'))) {
      if (ACCEPTED.some((entry) => entry.file === file && entry.text === found.text)) accepted += 1
      else findings.push({ file, ...found })
    }
  }
  return { files: files.length, accepted, findings }
}

export function toMarkdown(report: FakeReport): string {
  const lines = ['# Fake-content census (UE-CONV-H-021)', '', `${report.files} UI files read; ${report.findings.length} figures no one measured, ${report.accepted} accepted as true as written.`, '']
  for (const kind of ['LITERAL_METRIC', 'LITERAL_PROGRESS', 'SAMPLE_DATA', 'INVENTED_ADDRESS'] as const) {
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
    console.log(`${report.files} UI files, ${report.findings.length} figures no one measured (${report.accepted} accepted)`)
    for (const finding of report.findings) console.log(`  ${finding.kind.padEnd(16)} ${finding.file}:${finding.line}  ${finding.text}`)
  }
  if (args.includes('--strict') && report.findings.length > 0) process.exit(1)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) main()
