/**
 * The day-render census (UE-CONV-H-029): calendar days a screen reads in the reader's time zone, in every UI module (see lib/frontend-census/day-render.ts for what counts). The keys
 * that name a day come from the schema (every `date` column) and from the names themselves (a key ending in Date or Deadline), so a column added tomorrow is held to the same rule.
 * A finding is fixed by reading the value through @/lib/client/day (`recordedDay` where a screen keeps its own formatting, `formatDay` to show a day, `isDayPast` and `daysUntilDay` to
 * compare it with today); a finding that has to stay as written (the value really is an instant, and the screen means the reader's day) is accepted by name in ACCEPTED below, with
 * the reason. Read-only: it reads source files and needs no database.
 *
 * Usage (from apps/union-eyes):
 *   npx tsx scripts/runtime/day-render-census.ts [--write=<json>] [--markdown=<md>] [--strict] [--quiet]
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { findDayRenders, isUiModule, zoneFormatters, type DayRenderKind } from '../lib/frontend-census/day-render'
import { APP_ROOT, sourceFiles } from './frontend-api-census'

/**
 * A finding that is true as written, with why. Matched by file and by the start of the finding's text. Each is a value that really is an instant (a time of day was recorded), named like a
 * day, shown as the reader's own day for that moment; a stale entry (one nothing matches) fails the gate.
 */
export const ACCEPTED: ReadonlyArray<{ file: string; text: string; reason: string }> = [
  {
    file: 'app/[locale]/dashboard/committees/[id]/committee-workspace.tsx',
    text: 'm.meetingDate.toLocaleDateString(locale',
    reason: 'meeting_date is a full datetime: POST and PATCH /api/committees/{id}/meetings accept only ISO datetimes, and no screen writes it, so a meeting is an instant and its day is the reader\'s own',
  },
  {
    file: 'app/[locale]/dashboard/dispatch/page.tsx',
    text: 'new Date(req.requestedDate).toLocaleDateString()',
    reason: 'requestedDate is the moment a request was placed: POST /api/dispatch/requests accepts only an ISO datetime and stamps the current time when none is sent',
  },
  {
    file: 'components/health-safety/HazardsList.tsx',
    text: 'format(hazard.reportedDate',
    reason: 'reportedDate is the moment the hazard was reported, stamped by the database default (now), not a day somebody entered',
  },
  {
    file: 'components/health-safety/IncidentListTable.tsx',
    text: 'format(incident.incidentDate',
    reason: 'incidentDate is a full instant: the report form requires a time of day (incident-payload.ts builds the instant from the day and the time in the reporter\'s zone), so the day shown is the reader\'s own for that moment',
  },
  {
    file: 'components/leadership/employer-hotspots-table.tsx',
    text: 'new Date(emp.lastCommunicationDate).toLocaleDateString()',
    reason: 'lastCommunicationDate is the latest communication timestamp of the employer (dashboard-kpi-service sends toISOString() of the newest sent_at), an instant',
  },
  {
    file: 'components/workbench/workbench-console.tsx',
    text: 'new Date(caseItem.submittedDate).toLocaleDateString(locale)',
    reason: 'submittedDate is the moment the claim was created: the console builds it from claim.createdAt (an instant stamped by the server), not from a day somebody entered',
  },
]

/** A column named `date` is too general to name a day: a screen's own `date` is as often an instant. */
const GENERIC_KEYS = new Set(['date'])

export function schemaDayKeys(root: string = APP_ROOT): Set<string> {
  const keys = new Set<string>()
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.ts$/.test(name) && !/\.(?:test|spec|d)\.ts$/.test(name)) {
        for (const line of readFileSync(full, 'utf8').split(/\r?\n/)) {
          const match = /^\s*(\w+)\s*:\s*date\(\s*['"]/.exec(line)
          if (match && !GENERIC_KEYS.has(match[1])) keys.add(match[1])
        }
      }
    }
  }
  walk(path.join(root, 'db', 'schema'))
  return keys
}

function resolveModule(root: string, from: string, specifier: string): string | null {
  const base = specifier.startsWith('@/') ? path.join(root, specifier.slice(2)) : specifier.startsWith('.') ? path.join(root, path.dirname(from), specifier) : null
  if (!base) return null
  for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return path.relative(root, candidate).replace(/\\/g, '/')
  }
  return null
}

/** The names, in this file, of imported functions that format their first argument in the reader's zone. */
function importedFormatters(root: string, file: string, text: string, cache: Map<string, Set<string>>): Set<string> {
  const names = new Set<string>()
  if (!/\bimport\b/.test(text)) return names
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue
    const bindings = statement.importClause?.namedBindings
    if (!bindings || !ts.isNamedImports(bindings)) continue
    const target = resolveModule(root, file, statement.moduleSpecifier.text)
    if (!target) continue
    let exported = cache.get(target)
    if (!exported) {
      exported = zoneFormatters(target, readFileSync(path.join(root, target), 'utf8')).exported
      cache.set(target, exported)
    }
    for (const element of bindings.elements) if (exported.has((element.propertyName ?? element.name).text)) names.add(element.name.text)
  }
  return names
}

export interface DayRenderSite {
  file: string
  line: number
  kind: DayRenderKind
  key: string
  text: string
}

export interface DayRenderReport {
  files: number
  dayKeys: number
  accepted: number
  acceptedSites: DayRenderSite[]
  findings: DayRenderSite[]
}

export function runCensus(root: string = APP_ROOT): DayRenderReport {
  const dayKeys = schemaDayKeys(root)
  const files = sourceFiles(root).filter(isUiModule)
  const cache = new Map<string, Set<string>>()
  const findings: DayRenderSite[] = []
  const acceptedSites: DayRenderSite[] = []
  for (const file of files) {
    const text = readFileSync(path.join(root, file), 'utf8')
    for (const found of findDayRenders(file, text, { dayKeys, formatters: importedFormatters(root, file, text, cache) })) {
      const site = { file, ...found }
      if (ACCEPTED.some((entry) => entry.file === file && found.text.startsWith(entry.text))) acceptedSites.push(site)
      else findings.push(site)
    }
  }
  return { files: files.length, dayKeys: dayKeys.size, accepted: acceptedSites.length, acceptedSites, findings }
}

export function countByKind(findings: DayRenderSite[]): Record<DayRenderKind, number> {
  const counts: Record<DayRenderKind, number> = { DAY_IN_LOCAL_ZONE: 0, DAY_VIA_LOCAL_FORMATTER: 0, DAY_COMPARED_TO_NOW: 0 }
  for (const finding of findings) counts[finding.kind] += 1
  return counts
}

export function toMarkdown(report: DayRenderReport): string {
  const lines = ['# Day-render census (UE-CONV-H-029)', '', `${report.files} UI files read against ${report.dayKeys} schema day keys; ${report.findings.length} days read in the reader's zone, ${report.accepted} accepted as true as written.`, '']
  for (const kind of ['DAY_IN_LOCAL_ZONE', 'DAY_VIA_LOCAL_FORMATTER', 'DAY_COMPARED_TO_NOW'] as const) {
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
    console.log(`${report.files} UI files, ${report.dayKeys} day keys, ${report.findings.length} days read in the reader's zone (${report.accepted} accepted)`)
    for (const finding of report.findings) console.log(`  ${finding.kind.padEnd(24)} ${finding.file}:${finding.line}  [${finding.key}]  ${finding.text}`)
  }
  if (args.includes('--strict') && report.findings.length > 0) process.exit(1)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) main()
