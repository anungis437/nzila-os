/**
 * The request-body census (UE-CONV-H-025): what a screen sends to a route, judged against what the route takes.
 *
 * The frontend-to-API census proves that the URL a screen asks for is served. It cannot see that the screen then sends a body the route ignores: a button labelled "Link"
 * that sends `linkClauseId` to a route that reads `clauseId` links nothing and reports success, and a search box whose text the route never reads searches for something
 * else. This reads the JSON body of every POST, PUT and PATCH the frontend writes as an object literal (scripts/lib/frontend-census/request-body.ts), the body the route
 * file declares (scripts/lib/frontend-census/route-body.ts: a Zod object, a writable-field list, a destructuring of `request.json()`), and says where they differ.
 *
 *   KEY_IGNORED    the screen sends a key the route does not take: it is dropped, or the route refuses it, and what the person typed or chose goes nowhere.
 *   FIELD_MISSING  the route requires a key the screen never sends: every submit is a 400.
 *
 * Read-only, syntax only, no database. A body or a route the syntax cannot read is not judged, never guessed.
 *
 * Usage (from apps/union-eyes):
 *   npx tsx scripts/runtime/body-contract-census.ts [--write=<json>] [--markdown=<md>] [--strict] [--quiet]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { appSourceFiles } from '../lib/env-census/scope'
import { resolveSpecifier } from '../lib/env-census/collect'
import { extractFromSource } from '../lib/frontend-census/client-calls'
import { requestBodyOf, type RequestBody } from '../lib/frontend-census/request-body'
import { BODY_METHODS, RouteBodyReader, type BodyContract } from '../lib/frontend-census/route-body'
import { judgeCall, type RouteEntry } from '../lib/frontend-census/route-match'
import { APP_ROOT, NOT_REQUESTS, loadRoutes, sourceFiles } from './frontend-api-census'

export type BodyKind = 'KEY_IGNORED' | 'FIELD_MISSING'

export interface BodyFinding {
  kind: BodyKind
  key: string
  method: string
  pattern: string
  routes: string[]
  via: string
  sites: Array<{ file: string; line: number }>
}

export interface BodyReport {
  files: number
  calls: number
  /** Calls with a body the syntax read, a route it served and a contract the syntax read for that route: the calls that were judged. */
  judged: number
  routesWithContract: number
  byKind: Record<BodyKind, number>
  findings: BodyFinding[]
}

const DJANGO_CLIENT = /\bDJANGO_API_URL\b/
const show = (pattern: string): string => pattern.replace(/\u0001/g, '{…}')

/**
 * What differs between the body a screen sends and the contracts of the routes that can serve the call (several when a computed segment matches more than one).
 * A key is ignored when no route takes it and none is open; a key is missing when the screen's body is fully read and every route requires it.
 */
export function judgeBody(body: RequestBody, all: readonly BodyContract[]): Array<{ kind: BodyKind; key: string }> {
  const out: Array<{ kind: BodyKind; key: string }> = []
  for (const key of body.keys.keys()) {
    if (all.every((contract) => !contract.keys.has(key) && !contract.open)) out.push({ kind: 'KEY_IGNORED', key })
  }
  if (!body.open) {
    const required = [...all[0].keys].filter(([, requirement]) => requirement === 'required').map(([key]) => key)
    for (const key of required) {
      if (all.every((contract) => contract.keys.get(key) === 'required') && !body.keys.has(key)) out.push({ kind: 'FIELD_MISSING', key })
    }
  }
  return out
}

export function runCensus(root: string = APP_ROOT, routes: RouteEntry[] = loadRoutes()): BodyReport {
  const known = new Set(appSourceFiles(root))
  const reader = new RouteBodyReader({
    read: (file) => (existsSync(path.join(root, file)) ? readFileSync(path.join(root, file), 'utf8') : null),
    resolve: (from, specifier) => resolveSpecifier(from, specifier, known),
  })
  const files = sourceFiles(root)
  const grouped = new Map<string, BodyFinding>()
  const contracted = new Set<string>()
  let calls = 0
  let judged = 0

  for (const file of files) {
    if (file in NOT_REQUESTS) continue
    const text = readFileSync(path.join(root, file), 'utf8')
    if (DJANGO_CLIENT.test(text)) continue
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, /\.(tsx|jsx)$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    for (const call of extractFromSource(file, source)) {
      calls += 1
      const method = call.method
      if (!method || !(BODY_METHODS as readonly string[]).includes(method)) continue
      const body = requestBodyOf(call.node)
      if (!body) continue
      const verdict = judgeCall(call, routes)
      if (verdict.kind || verdict.routes.length === 0) continue
      const contracts = verdict.routes.map((entry) => ({ entry, contract: reader.contractsOf(`app/api/${entry.route}`).get(method) }))
      if (contracts.some(({ contract }) => !contract)) continue
      judged += 1
      for (const { entry } of contracts) contracted.add(`${entry.route} ${method}`)
      const all = contracts.map(({ contract }) => contract as BodyContract)
      for (const { kind, key } of judgeBody(body, all)) {
        const id = `${kind} ${method} ${call.pattern} ${key}`
        const finding = grouped.get(id) ?? { kind, key, method, pattern: call.pattern, routes: verdict.routes.map((entry) => entry.route), via: all[0].via, sites: [] }
        finding.sites.push({ file, line: call.line })
        grouped.set(id, finding)
      }
    }
  }
  const findings = [...grouped.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.pattern.localeCompare(b.pattern) || a.key.localeCompare(b.key))
  const byKind: Record<BodyKind, number> = { KEY_IGNORED: 0, FIELD_MISSING: 0 }
  for (const finding of findings) byKind[finding.kind] += 1
  return { files: files.length, calls, judged, routesWithContract: contracted.size, byKind, findings }
}

export function toMarkdown(report: BodyReport): string {
  const lines = [
    '# Request-body census (UE-CONV-H-025)',
    '',
    `${report.files} frontend files, ${report.calls} \`/api\` URLs, ${report.judged} POST, PUT and PATCH calls with a body and a route whose contract the syntax could read, across ${report.routesWithContract} route methods.`,
    '',
    ...Object.entries(report.byKind).map(([kind, count]) => `- ${kind}: ${count}`),
    '',
  ]
  for (const kind of ['KEY_IGNORED', 'FIELD_MISSING'] as const) {
    const group = report.findings.filter((finding) => finding.kind === kind)
    if (!group.length) continue
    lines.push(`## ${kind}`, '')
    for (const finding of group) {
      lines.push(`- \`${finding.method} ${show(finding.pattern)}\` key \`${finding.key}\` (${finding.via}) → ${finding.routes.join(', ')}`)
      for (const site of finding.sites.slice(0, 4)) lines.push(`  - ${site.file}:${site.line}`)
      if (finding.sites.length > 4) lines.push(`  - … ${finding.sites.length - 4} more`)
    }
    lines.push('')
  }
  return `${lines.join('\n')}\n`
}

function main(): void {
  const args = process.argv.slice(2)
  const option = (name: string): string | undefined => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
  const report = runCensus()
  const json = option('write')
  if (json) writeFileSync(json, `${JSON.stringify(report, null, 2)}\n`)
  const markdown = option('markdown')
  if (markdown) writeFileSync(markdown, toMarkdown(report))
  if (!args.includes('--quiet')) {
    console.log(`${report.files} files, ${report.calls} /api URLs; ${report.judged} body calls judged against ${report.routesWithContract} route methods`)
    for (const [kind, count] of Object.entries(report.byKind)) console.log(`  ${kind.padEnd(14)} ${String(count).padStart(4)}`)
    for (const finding of report.findings) console.log(`  ${finding.kind.padEnd(13)} ${finding.method} ${show(finding.pattern)}  key ${finding.key}  [${finding.sites[0].file}:${finding.sites[0].line}${finding.sites.length > 1 ? ` +${finding.sites.length - 1}` : ''}]  (${finding.via})`)
  }
  if (args.includes('--strict') && report.findings.length > 0) process.exit(1)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) main()
