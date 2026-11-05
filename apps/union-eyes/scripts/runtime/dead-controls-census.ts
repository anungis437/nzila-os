/**
 * The dead-controls census (UE-CONV-H-025): controls a screen offers that do nothing, in every UI file (see lib/frontend-census/dead-controls.ts for what counts).
 * A finding is fixed by making the control do what it says (a handler that reaches a route, a link to a page that exists) or by removing it, with a
 * `CapabilityUnavailable` notice where the feature is not there (components/system/capability-unavailable.tsx); never by giving it an empty handler. A control that must stay
 * as written is accepted by name in ACCEPTED below, with the reason. Read-only: it reads source files and needs no database.
 *
 * Usage (from apps/union-eyes):
 *   npx tsx scripts/runtime/dead-controls-census.ts [--write=<json>] [--markdown=<md>] [--strict] [--quiet]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { findDeadControls, type DeadControlKind } from '../lib/frontend-census/dead-controls'
import { APP_ROOT, sourceFiles } from './frontend-api-census'

/** A control that is true as written, with why. Matched by file and by the start of the control's text. */
export const ACCEPTED: ReadonlyArray<{ file: string; text: string; reason: string }> = [
  {
    file: 'components/gdpr/cookie-consent-banner.tsx',
    text: 'onOpenChange=() => {}',
    reason:
      'The consent dialog cannot be dismissed on purpose: it has no close button, Escape and a click outside are prevented, and it closes only through the accept, reject and save buttons, each of which records the decision.',
  },
]

export interface DeadControlSite {
  file: string
  line: number
  kind: DeadControlKind
  text: string
}

export interface DeadControlReport {
  files: number
  accepted: number
  findings: DeadControlSite[]
}

export function runCensus(root: string = APP_ROOT): DeadControlReport {
  const files = sourceFiles(root).filter((file) => /^(?:app|components|contexts)\//.test(file))
  const findings: DeadControlSite[] = []
  let accepted = 0
  for (const file of files) {
    for (const found of findDeadControls(file, readFileSync(path.join(root, file), 'utf8'))) {
      if (ACCEPTED.some((entry) => entry.file === file && found.text.startsWith(entry.text))) accepted += 1
      else findings.push({ file, ...found })
    }
  }
  return { files: files.length, accepted, findings }
}

export function countByKind(findings: DeadControlSite[]): Record<DeadControlKind, number> {
  const counts: Record<DeadControlKind, number> = { NO_HANDLER: 0, EMPTY_HANDLER: 0, FEEDBACK_ONLY_HANDLER: 0, DEAD_LINK: 0 }
  for (const finding of findings) counts[finding.kind] += 1
  return counts
}

export function toMarkdown(report: DeadControlReport): string {
  const lines = ['# Dead-controls census (UE-CONV-H-025)', '', `${report.files} UI files read; ${report.findings.length} controls that do nothing, ${report.accepted} accepted as true as written.`, '']
  for (const kind of ['NO_HANDLER', 'EMPTY_HANDLER', 'FEEDBACK_ONLY_HANDLER', 'DEAD_LINK'] as const) {
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
    console.log(`${report.files} UI files, ${report.findings.length} controls that do nothing (${report.accepted} accepted)`)
    for (const finding of report.findings) console.log(`  ${finding.kind.padEnd(22)} ${finding.file}:${finding.line}  ${finding.text}`)
  }
  if (args.includes('--strict') && report.findings.length > 0) process.exit(1)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) main()
