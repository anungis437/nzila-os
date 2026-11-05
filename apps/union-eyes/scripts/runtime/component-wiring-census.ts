/**
 * The component-wiring census (UE-CONV-H-026): components of the frontend that look finished and are not wired in.
 *
 *   UNRENDERED_COMPONENT     a component that is declared and exported and that nothing renders. It may have a barrel export and tests, which is how it escapes a
 *                            file-level reach analysis; a person can never reach it, and its buttons answer to nothing.
 *   CALLBACK_NEVER_SUPPLIED  a control whose only job is to call an optional prop (`onClick={onSave}`) that no parent ever passes: the button is there and does nothing.
 *
 * See lib/frontend-census/component-wiring.ts for what counts and what does not. A finding is fixed by rendering the component where it belongs, by passing the callback,
 * or by removing the code, never by an empty handler; a component that must stay as written is accepted by name in ACCEPTED below, with the reason. Read-only, syntax
 * only, no database.
 *
 * Usage (from apps/union-eyes):
 *   npx tsx scripts/runtime/component-wiring-census.ts [--write=<json>] [--markdown=<md>] [--strict] [--quiet]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { resolveSpecifier } from '../lib/env-census/collect'
import { appSourceFiles } from '../lib/env-census/scope'
import { isCensusModule, judgeUnwired, readModule, unrenderedComponents, type ModuleFacts } from '../lib/frontend-census/component-wiring'
import { APP_ROOT } from './frontend-api-census'

export type WiringKind = 'UNRENDERED_COMPONENT' | 'CALLBACK_NEVER_SUPPLIED'

export interface WiringFinding {
  kind: WiringKind
  file: string
  component: string
  line: number
  detail: string
}

/** A component or control that is true as written, with why. */
export const ACCEPTED: ReadonlyArray<{ kind: WiringKind; file: string; component: string; reason: string }> = []

/** The files Next.js renders itself: a page, a layout and the other file conventions have no JSX parent. */
export const isFrameworkFile = (file: string): boolean => /(?:^|\/)(?:page|layout|loading|error|global-error|not-found|template|default|opengraph-image|twitter-image|icon|apple-icon)\.tsx$/.test(file)

export interface WiringReport {
  /** Modules read: every source file of the application that is not a test. */
  files: number
  /** Components those modules declare. */
  components: number
  /** Controls that forward only to an optional prop, whether or not a parent passes it. */
  forwarding: number
  accepted: number
  byKind: Record<WiringKind, number>
  findings: WiringFinding[]
}

export function runCensus(root: string = APP_ROOT): WiringReport {
  const known = new Set(appSourceFiles(root))
  const facts = new Map<string, ModuleFacts>()
  for (const file of known) if (isCensusModule(file)) facts.set(file, readModule(file, readFileSync(path.join(root, file), 'utf8')))
  const all: WiringFinding[] = [
    ...unrenderedComponents(facts, known, resolveSpecifier, isFrameworkFile).map((found) => ({ kind: 'UNRENDERED_COMPONENT' as const, file: found.file, component: found.component, line: found.line, detail: 'exported, and nothing renders it' })),
    ...judgeUnwired(facts, known, resolveSpecifier).map((found) => ({ kind: 'CALLBACK_NEVER_SUPPLIED' as const, file: found.file, component: found.component, line: found.line, detail: `never gets ${found.prop}: ${found.text}` })),
  ]
  const findings = all.filter((found) => !ACCEPTED.some((entry) => entry.kind === found.kind && entry.file === found.file && entry.component === found.component))
  let components = 0
  let forwarding = 0
  for (const fileFacts of facts.values()) {
    components += fileFacts.components.length
    forwarding += fileFacts.controls.length
  }
  const byKind: Record<WiringKind, number> = { UNRENDERED_COMPONENT: 0, CALLBACK_NEVER_SUPPLIED: 0 }
  for (const found of findings) byKind[found.kind] += 1
  return { files: facts.size, components, forwarding, accepted: all.length - findings.length, byKind, findings }
}

export function toMarkdown(report: WiringReport): string {
  const lines = ['# Component-wiring census (UE-CONV-H-026)', '', `${report.files} modules read, ${report.components} components, ${report.forwarding} controls that forward only to an optional prop; ${report.findings.length} findings (${report.accepted} accepted).`, '']
  for (const kind of ['UNRENDERED_COMPONENT', 'CALLBACK_NEVER_SUPPLIED'] as const) {
    const group = report.findings.filter((found) => found.kind === kind)
    if (!group.length) continue
    lines.push(`## ${kind}`, '')
    for (const found of group) lines.push(`- ${found.file}:${found.line}  \`${found.component}\`  ${found.detail}`)
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
    console.log(`${report.files} modules, ${report.components} components, ${report.forwarding} controls that forward only to an optional prop (${report.accepted} accepted)`)
    for (const [kind, count] of Object.entries(report.byKind)) console.log(`  ${kind.padEnd(24)} ${String(count).padStart(4)}`)
    for (const found of report.findings) console.log(`  ${found.kind.padEnd(24)} ${found.file}:${found.line}  ${found.component}  ${found.detail}`)
  }
  if (args.includes('--strict') && report.findings.length > 0) process.exit(1)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) main()
