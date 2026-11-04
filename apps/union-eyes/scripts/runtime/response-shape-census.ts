/**
 * The response-shape census (UE-CONV-H-027): what a screen reads out of an answer, judged against what the route answers with.
 *
 * The frontend-to-API census proves the URL a screen asks for is served, and the request-body census that what it sends is what the route takes. Neither sees the way back:
 * a route that answers `{ success, data: { items } }` and a screen that reads `json.items` get on without an error and show an empty list. This reads, for every request the
 * frontend makes, the keys the screen reads from the answer (scripts/lib/frontend-census/response-reads.ts) and the shape of the answer the route file gives
 * (scripts/lib/frontend-census/route-response.ts: the `withApi` envelope, `NextResponse.json`, `standardSuccessResponse`, the CRUD factory), and says where they differ.
 *
 *   ROOT_KEY_NOT_RETURNED   the screen reads a key at the top of the answer that no success answer of the route has.
 *   DATA_KEY_NOT_RETURNED   the screen reads a key under `data` that the handler's returned object does not have.
 *   KEY_NOT_RETURNED_EITHER the screen wrote alternatives at both levels (`json.data?.id ?? json.id`) and neither exists.
 *   FAILURE_MESSAGE_BY_HAND the screen reads `error` or `message` off the body of a failed answer itself. Depending on the route that is a string (`{ error: 'text' }`), a code
 *                           (`{ error: 'VALIDATION_ERROR', message: 'text' }`), an object (`{ error: { code, message } }`) or absent (`{ code, message }`, the framework's own), so the screen
 *                           shows nothing, a code, or "[object Object]". The message is taken with `apiErrorMessage(body, fallback)` or `readApiError(response, fallback)` (lib/client/api-envelope.ts).
 *   DECLARED_KEY_NOT_RETURNED the screen declares the type of the answer (`useQuery<Rows>`, `(await res.json()) as Row[]`, a typed state) with a key the route's answer does not have, a list
 *                           where the route answers an object, or an object where it answers a list. A screen reads what it declares, so the field shows empty and the type checker says nothing:
 *                           the route's side is the type checker's too (scripts/lib/frontend-census/type-shapes.ts), which is how a service result whose keys are not in the handler is read.
 *
 * A read written as alternatives is satisfied by any of them. An answer the syntax cannot read (a service result no type says, a spread), a route that is not read, an error branch, and the
 * `error` / `message` keys of a failed answer are not judged against the route's success answer. Read-only, no database.
 *
 * Usage (from apps/union-eyes):
 *   npx tsx scripts/runtime/response-shape-census.ts [--write=<json>] [--markdown=<md>] [--strict] [--quiet]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { appSourceFiles } from '../lib/env-census/scope'
import { resolveSpecifier } from '../lib/env-census/collect'
import { extractFromSource } from '../lib/frontend-census/client-calls'
import { AS_LIST, AS_RECORD, readsOfRequest, type DeclaredAnswer, type Level, type ReadKey, type ResponseRead, type SourceLoader } from '../lib/frontend-census/response-reads'
import { RouteResponseReader, type ObjectShape, type Shape, type TypeOracle } from '../lib/frontend-census/route-response'
import { TypeShapes } from '../lib/frontend-census/type-shapes'
import { judgeCall, type RouteEntry } from '../lib/frontend-census/route-match'
import { APP_ROOT, NOT_REQUESTS, loadRoutes, sourceFiles } from './frontend-api-census'

export type ResponseKind = 'ROOT_KEY_NOT_RETURNED' | 'DATA_KEY_NOT_RETURNED' | 'KEY_NOT_RETURNED_EITHER' | 'FAILURE_MESSAGE_BY_HAND' | 'DECLARED_KEY_NOT_RETURNED'

export interface ResponseFinding {
  kind: ResponseKind
  /** The keys that were read as alternatives (one for a plain read). */
  keys: string[]
  method: string
  pattern: string
  routes: string[]
  sites: Array<{ file: string; line: number; text: string }>
}

export interface ResponseReport {
  files: number
  calls: number
  /** Requests with a route whose answer the syntax read, and at least one read of the answer. */
  judgedCalls: number
  /** Reads of an answer the syntax could place against the route's shape. */
  judgedReads: number
  /** Why the other requests were not judged: no route matched, the route's answer is not readable, the screen's reads are not followable (by how the URL is used). */
  notJudged: { noRoute: number; unreadableRoute: number; noReads: number; noReadsByVia: Record<string, number> }
  byKind: Record<ResponseKind, number>
  findings: ResponseFinding[]
  /** Each request that was judged, with how many reads and declared names of its answer were placed against the route: what the census is looking at. */
  judged: Array<{ file: string; line: number; method: string; pattern: string; reads: number; declared: number }>
}

const DJANGO_CLIENT = /\bDJANGO_API_URL\b/
const show = (pattern: string): string => pattern.replace(/\u0001/g, '{…}')
/** The vocabulary of a failed answer: read on a success path it is defensive, and an answer that succeeded does not have it. */
const FAILURE_KEYS = new Set(['error', 'errors', 'message', 'code', 'details', 'statusCode', 'status', 'traceId'])
/** What a screen takes out of a failed answer with apiErrorMessage; reading either itself is a finding. */
const BY_HAND_KEYS = new Set(['error', 'message'])

type Verdict = 'present' | 'absent' | 'unknown'

/** The shape at a level of an answer: `root` is the answer, `data` what the handler returned, `data.data` the `data` of that. Unknown when the syntax cannot say, absent when a step is not there. */
function shapeAt(shape: Shape, level: string): Shape | 'unknown' | 'absent' {
  let target: Shape = shape
  for (const step of level === 'root' ? [] : level.split('.')) {
    if (!target) return 'unknown'
    if (target.kind === 'array') return 'absent'
    if (!target.keys.has(step)) return target.open ? 'unknown' : 'absent'
    target = target.keys.get(step) ?? null
  }
  return target
}

/** Whether one key is in the part of the answer the level names: present, absent for sure, or not known. */
function check(shapes: Shape[], { level, key }: ReadKey): Verdict {
  let sawAbsent = false
  for (const shape of shapes) {
    const target = shapeAt(shape, level)
    if (target === 'unknown') return 'unknown'
    if (target === 'absent') {
      sawAbsent = true
      continue
    }
    if (!target) return 'unknown'
    if (key === AS_LIST) {
      // A list is expected: an array has one, a closed object has not; an unreadable value may be either.
      if (target.kind === 'array') return 'present'
      if (target.open) return 'unknown'
      sawAbsent = true
      continue
    }
    if (key === AS_RECORD) {
      // A record is expected: an object is one, a list is not.
      if (target.kind === 'object') return 'present'
      sawAbsent = true
      continue
    }
    if (target.kind === 'array') {
      sawAbsent = true
      continue
    }
    const object: ObjectShape = target
    if (object.keys.has(key)) return 'present'
    if (object.open) return 'unknown'
    sawAbsent = true
  }
  return sawAbsent ? 'absent' : 'unknown'
}

/** One read against the shapes the request's routes can answer with: a finding's kind, or null when it is satisfied or cannot be told. */
export function judgeRead(read: ResponseRead, shapes: Shape[]): ResponseKind | null {
  const alternatives = read.alternatives.filter(({ level, key }) => !(level === 'root' && FAILURE_KEYS.has(key)) && !(level === 'data' && FAILURE_KEYS.has(key)))
  if (alternatives.length === 0 || shapes.length === 0) return null
  let absent = 0
  for (const alternative of alternatives) {
    const verdict = check(shapes, alternative)
    if (verdict === 'present' || verdict === 'unknown') return null
    absent += 1
  }
  if (absent !== alternatives.length) return null
  const levels = new Set(alternatives.map((alternative) => alternative.level))
  return levels.size > 1 ? 'KEY_NOT_RETURNED_EITHER' : levels.has('root') ? 'ROOT_KEY_NOT_RETURNED' : 'DATA_KEY_NOT_RETURNED'
}

export interface DeclaredGap {
  /** Where in the answer the declared value is: `root`, `data`, `data.items[]`. */
  path: string
  /** The key the screen declares that the route's answer does not have, or AS_LIST / AS_RECORD when what the screen declares is a list (or an object) where the route answers the other. */
  key: string
}

/**
 * Where what a screen declares of the answer is more than the route answers with: a key it names that the closed object the route answers with does not have, a list declared where the
 * route answers an object, an object declared where it answers a list. `server` is the shape at the level the declared name stands for. What either side cannot say (a leaf, an unknown, an open
 * object) is not judged, and the vocabulary of a failed answer is not either: a screen declares `error?: string` on the type it gives the answer of a success.
 */
export function declaredGaps(declared: Shape, server: Shape, at: string, out: DeclaredGap[] = []): DeclaredGap[] {
  if (!declared || !server) return out
  if (declared.kind === 'array') {
    if (server.kind === 'object') {
      if (!server.open) out.push({ path: at, key: AS_LIST })
      return out
    }
    return declaredGaps(declared.element, server.element, `${at}[]`, out)
  }
  if (declared.keys.size === 0) return out
  if (server.kind === 'array') {
    out.push({ path: at, key: AS_RECORD })
    return out
  }
  for (const [key, child] of declared.keys) {
    if ((at === 'root' || at === 'data') && FAILURE_KEYS.has(key)) continue
    const answered = server.keys.get(key)
    if (answered === undefined) {
      if (!server.open) out.push({ path: at, key })
      continue
    }
    declaredGaps(child, answered, at === 'root' ? key : `${at}.${key}`, out)
  }
  return out
}

/** The gaps of what a name declares, against every route the request can reach: only a gap that every one of them has is one. A level the routes do not all say is not judged. */
export function gapsAgainst(declared: Shape, shapes: Shape[], levels: Level[]): DeclaredGap[] {
  if (!declared || levels.length !== 1 || shapes.length === 0) return []
  let common: DeclaredGap[] | null = null
  for (const shape of shapes) {
    const target = shapeAt(shape, levels[0])
    if (target === 'unknown' || target === 'absent' || !target) return []
    const gaps = declaredGaps(declared, target, levels[0])
    common = common ? common.filter((gap) => gaps.some((other) => other.path === gap.path && other.key === gap.key)) : gaps
  }
  return common ?? []
}

/** A gap as a screen's author reads it. */
export function describeGap(gap: DeclaredGap): string {
  if (gap.key === AS_LIST) return `${gap.path} declared as a list`
  if (gap.key === AS_RECORD) return `${gap.path} declared as an object`
  return gap.path === 'root' ? gap.key : `${gap.path}.${gap.key}`
}

/** Reads the source of an application file the way the rest of the census does, once, for the functions an answer is handed to. */
export function sourceLoader(root: string, known: Set<string>): SourceLoader {
  const sources = new Map<string, ts.SourceFile | null>()
  return {
    load: (from, specifier) => {
      const file = resolveSpecifier(from, specifier, known)
      if (!file) return null
      if (!sources.has(file)) {
        const absolute = path.join(root, file)
        sources.set(file, existsSync(absolute) ? ts.createSourceFile(file, readFileSync(absolute, 'utf8'), ts.ScriptTarget.Latest, true, /\.(tsx|jsx)$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS) : null)
      }
      return sources.get(file) ?? null
    },
  }
}

export function runCensus(root: string = APP_ROOT, routes: RouteEntry[] = loadRoutes(), types: TypeOracle | null = TypeShapes.forProject(root)): ResponseReport {
  const known = new Set(appSourceFiles(root))
  const loader = sourceLoader(root, known)
  const reader = new RouteResponseReader({
    read: (file) => (existsSync(path.join(root, file)) ? readFileSync(path.join(root, file), 'utf8') : null),
    resolve: (from, specifier) => resolveSpecifier(from, specifier, known),
  }, types ?? undefined)
  const files = sourceFiles(root)
  const grouped = new Map<string, ResponseFinding>()
  const judged: ResponseReport['judged'] = []
  let calls = 0
  let judgedCalls = 0
  let judgedReads = 0
  const notJudged: ResponseReport['notJudged'] = { noRoute: 0, unreadableRoute: 0, noReads: 0, noReadsByVia: {} }

  for (const file of files) {
    if (file in NOT_REQUESTS) continue
    const text = readFileSync(path.join(root, file), 'utf8')
    if (DJANGO_CLIENT.test(text)) continue
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, /\.(tsx|jsx)$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    for (const call of extractFromSource(file, source)) {
      calls += 1
      const method = call.method
      if (!method) continue
      const verdict = judgeCall(call, routes)
      // The message of a failed answer is taken with apiErrorMessage / readApiError, whatever the route answers: what its failures hold is not one shape.
      // What the screen reads only where the answer is a failure (`res.status === 409 && data.tierId`) is not a key of a success answer either.
      const failureKeys = new Set<string>()
      for (const read of readsOfRequest(call.node, loader, true)) {
        for (const alternative of read.alternatives) failureKeys.add(`${alternative.level}|${alternative.key}`)
        const direct = read.alternatives.filter((alternative) => alternative.level === 'root' && BY_HAND_KEYS.has(alternative.key))
        if (direct.length === 0) continue
        const keys = direct.map((alternative) => alternative.key)
        const id = `FAILURE_MESSAGE_BY_HAND ${method} ${call.pattern} ${[...keys].sort().join('|')}`
        const finding: ResponseFinding = grouped.get(id) ?? { kind: 'FAILURE_MESSAGE_BY_HAND', keys, method, pattern: call.pattern, routes: verdict.routes.map((entry) => entry.route), sites: [] }
        if (!finding.sites.some((site) => site.file === read.file && site.line === read.line)) finding.sites.push({ file: read.file, line: read.line, text: read.text })
        grouped.set(id, finding)
      }
      if (verdict.kind || verdict.routes.length === 0) {
        notJudged.noRoute += 1
        continue
      }
      const shapes: Shape[] = []
      let readable = true
      for (const entry of verdict.routes) {
        const shape = reader.shapesOf(`app/api/${entry.route}`).get(method)
        if (!shape) readable = false
        else shapes.push(shape)
      }
      if (!readable) {
        notJudged.unreadableRoute += 1
        continue
      }
      const declared: DeclaredAnswer[] = []
      const reads = readsOfRequest(call.node, loader, false, declared)
      const declarations = types ? declared : []
      if (reads.length === 0 && declarations.length === 0) {
        notJudged.noReads += 1
        notJudged.noReadsByVia[call.via] = (notJudged.noReadsByVia[call.via] ?? 0) + 1
        continue
      }
      judgedCalls += 1
      judged.push({ file, line: call.line, method, pattern: call.pattern, reads: reads.length, declared: declarations.length })
      for (const read of reads) {
        judgedReads += 1
        const kind = judgeRead(read, shapes)
        if (!kind) continue
        const keys = read.alternatives.map((alternative) => alternative.key)
        const id = `${kind} ${method} ${call.pattern} ${[...keys].sort().join('|')}`
        const finding = grouped.get(id) ?? { kind, keys, method, pattern: call.pattern, routes: verdict.routes.map((entry) => entry.route), sites: [] }
        finding.sites.push({ file: read.file, line: read.line, text: read.text })
        grouped.set(id, finding)
      }
      // What the screen declares of the answer, judged against what the route answers with: the same gap found from two names is one finding.
      for (const answer of declarations) {
        for (const gap of gapsAgainst(types!.shapeOfNode(answer.node), shapes, answer.levels)) {
          if (failureKeys.has(`${gap.path}|${gap.key}`)) continue
          const described = describeGap(gap)
          const id = `DECLARED_KEY_NOT_RETURNED ${method} ${call.pattern} ${described}`
          const finding: ResponseFinding = grouped.get(id) ?? { kind: 'DECLARED_KEY_NOT_RETURNED', keys: [described], method, pattern: call.pattern, routes: verdict.routes.map((entry) => entry.route), sites: [] }
          if (!finding.sites.some((site) => site.file === answer.file && site.line === answer.line)) finding.sites.push({ file: answer.file, line: answer.line, text: answer.text })
          grouped.set(id, finding)
        }
      }
    }
  }
  const findings = [...grouped.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.pattern.localeCompare(b.pattern) || a.keys.join().localeCompare(b.keys.join()))
  const byKind: Record<ResponseKind, number> = { ROOT_KEY_NOT_RETURNED: 0, DATA_KEY_NOT_RETURNED: 0, KEY_NOT_RETURNED_EITHER: 0, FAILURE_MESSAGE_BY_HAND: 0, DECLARED_KEY_NOT_RETURNED: 0 }
  for (const finding of findings) byKind[finding.kind] += 1
  return { files: files.length, calls, judgedCalls, judgedReads, notJudged, byKind, findings, judged }
}

export function toMarkdown(report: ResponseReport): string {
  const lines = [
    '# Response-shape census (UE-CONV-H-027)',
    '',
    `${report.files} frontend files, ${report.calls} \`/api\` URLs, ${report.judgedCalls} requests whose answer could be read, ${report.judgedReads} reads placed against it.`,
    '',
    ...Object.entries(report.byKind).map(([kind, count]) => `- ${kind}: ${count}`),
    '',
  ]
  for (const kind of ['ROOT_KEY_NOT_RETURNED', 'DATA_KEY_NOT_RETURNED', 'KEY_NOT_RETURNED_EITHER', 'FAILURE_MESSAGE_BY_HAND', 'DECLARED_KEY_NOT_RETURNED'] as const) {
    const group = report.findings.filter((finding) => finding.kind === kind)
    if (!group.length) continue
    lines.push(`## ${kind}`, '')
    for (const finding of group) {
      lines.push(`- \`${finding.method} ${show(finding.pattern)}\` ${kind === 'DECLARED_KEY_NOT_RETURNED' ? 'declares' : 'reads'} \`${finding.keys.join(' | ')}\`${finding.routes.length ? ` → ${finding.routes.join(', ')}` : ''}`)
      for (const site of finding.sites.slice(0, 4)) lines.push(`  - ${site.file}:${site.line}  \`${site.text}\``)
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
  if (option('write')) writeFileSync(option('write')!, `${JSON.stringify(report, null, 2)}\n`)
  if (option('markdown')) writeFileSync(option('markdown')!, toMarkdown(report))
  if (!args.includes('--quiet')) {
    console.log(`${report.files} files, ${report.calls} /api URLs; ${report.judgedCalls} requests judged, ${report.judgedReads} reads placed; not judged: ${report.notJudged.noRoute} no route, ${report.notJudged.unreadableRoute} answer not readable, ${report.notJudged.noReads} reads not followable`)
    for (const [kind, count] of Object.entries(report.byKind)) console.log(`  ${kind.padEnd(26)} ${String(count).padStart(4)}`)
    for (const finding of report.findings) {
      console.log(`  ${finding.kind.padEnd(26)} ${finding.method} ${show(finding.pattern)}  ${finding.kind === 'DECLARED_KEY_NOT_RETURNED' ? 'declares' : 'reads'} ${finding.keys.join(' | ')}  [${finding.sites[0].file}:${finding.sites[0].line}${finding.sites.length > 1 ? ` +${finding.sites.length - 1}` : ''}]  → ${finding.routes.join(', ')}`)
    }
  }
  if (args.includes('--strict') && report.findings.length > 0) process.exit(1)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) main()
