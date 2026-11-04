/**
 * The frontend-to-API census (UE-CONV-H-018): every `/api/...` URL the frontend builds, judged against the routes that exist.
 *
 * The code-to-database census (mismatch-census.ts) proves that the SQL the application writes is valid. This proves the other seam: that what a page, a
 * component or a hook asks for is served. A URL no route file matches is a request that can only 404; a method the matching routes do not export is a 405;
 * a route whose capability was never built answers 501 (the route-coverage manifest marks it RETIRED), so the screen that calls it only ever shows an error.
 * Read-only: it reads source files and the committed route-coverage manifest, and needs no database.
 *
 * Usage (from apps/union-eyes):
 *   npx tsx scripts/runtime/frontend-api-census.ts [--write=<json>] [--markdown=<md>] [--strict] [--quiet]
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { extractApiCalls, extractFromSource, type ClientCall } from '../lib/frontend-census/client-calls'
import { judgeCall, type FindingKind, type RouteEntry } from '../lib/frontend-census/route-match'
import { createAppProgram } from '../lib/sql-census/sites'
import { computeLiveness, declarationKeyOf } from '../lib/sql-census/liveness'

export const APP_ROOT = path.resolve(__dirname, '..', '..')
const MANIFEST = path.resolve(APP_ROOT, '..', '..', 'docs', 'union-eyes', 'convergence', 'register', 'ue-route-coverage-manifest.json')

/** Files whose `/api/...` strings are not requests to a route of this application, each with where it is judged instead. */
export const NOT_REQUESTS: Readonly<Record<string, string>> = {
  'lib/api/deprecation.ts': 'a registry of routes that were removed; its canonical targets are held by lib/api/deprecation-registry.test.ts',
}
/** A module that reads DJANGO_API_URL talks to the Django backend, whose routes are not these. */
const DJANGO_CLIENT = /\bDJANGO_API_URL\b/

// What is not the frontend: the route handlers themselves, tests, tooling, the services that run their own servers, the Python backend, the mobile client and build output. The
// directories named for the root (`public`, `docs`, `services`...) are skipped only there: `components/public` holds screens, and a screen is read wherever it lives.
const SKIP_ANYWHERE = new Set(['node_modules', '.next', '.turbo', 'coverage', '.git', '__tests__', '__mocks__'])
const SKIP_AT_ROOT = new Set(['dist', 'archive', 'backups', 'mobile', 'backend', 'services', 'e2e', 'tests', 'public', 'docs', 'scripts', '.storybook', 'nzila-scripts-book-template'])
const SKIP_FILES = /(\.test\.|\.spec\.|\.stories\.|\.d\.ts$)/
const SOURCE = /\.(ts|tsx|js|jsx|mts)$/

/** `app`: something a page or a route runs reaches it; `runs`: only a script does; `none`: nothing that runs does (dead code). */
export type Reach = 'app' | 'runs' | 'none'
const RANK: Record<Reach, number> = { app: 2, runs: 1, none: 0 }

export interface CensusSite {
  file: string
  line: number
  via: string
  reach: Reach | null
}

export interface CensusFinding {
  kind: FindingKind
  method: string | null
  pattern: string
  sites: CensusSite[]
  /** The route files that would serve the URL (empty for ROUTE_MISSING). */
  routes: string[]
  /** The best reach of its sites; null when reach was not computed. */
  reach: Reach | null
}

export interface CensusReport {
  routes: number
  retiredRoutes: number
  files: number
  calls: number
  distinctUrls: number
  byKind: Record<FindingKind, number>
  /** Distinct findings per kind whose best site is reached by a page, a route or a script (null when reach was not computed). */
  liveByKind: Record<FindingKind, number> | null
  /** Modules that read DJANGO_API_URL: their `/api/...` strings are Django routes, which this census does not judge. */
  djangoClients: string[]
  findings: CensusFinding[]
}

export function sourceFiles(root: string = APP_ROOT): string[] {
  const out: string[] = []
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name)
      const relative = path.relative(root, full).replace(/\\/g, '/')
      if (statSync(full).isDirectory()) {
        if (SKIP_ANYWHERE.has(name) || (dir === root && SKIP_AT_ROOT.has(name)) || relative === 'app/api') continue
        walk(full)
      } else if (SOURCE.test(name) && !SKIP_FILES.test(name)) out.push(relative)
    }
  }
  walk(root)
  return out.sort()
}

export function loadRoutes(): RouteEntry[] {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as { routes: Array<{ route: string; methods: string[]; guard: string; retiredMethods?: string[] }> }
  return manifest.routes.map(({ route, methods, guard, retiredMethods }) => ({ route, methods, guard, ...(retiredMethods ? { retiredMethods } : {}) }))
}

/** The calls of the frontend, each with how it is reached when `withReach` (this reads the whole program: minutes, not seconds). */
function collectCalls(root: string, files: string[], withReach: boolean, djangoClients: string[]): Array<ClientCall & { reach: Reach | null }> {
  const skip = (file: string, text: string): boolean => {
    if (file in NOT_REQUESTS) return true
    if (DJANGO_CLIENT.test(text)) {
      djangoClients.push(file)
      return true
    }
    return false
  }
  if (!withReach) {
    return files.flatMap((file) => {
      const text = readFileSync(path.join(root, file), 'utf8')
      return skip(file, text) ? [] : extractApiCalls(file, text).map((call) => ({ ...call, reach: null }))
    })
  }

  const program = createAppProgram(root)
  const liveness = computeLiveness(program, root)
  const wanted = new Set(files)
  const calls: Array<ClientCall & { reach: Reach | null }> = []
  const prefix = `${root.replace(/\\/g, '/')}/`
  for (const source of program.getSourceFiles()) {
    const name = source.fileName.replace(/\\/g, '/')
    if (!name.startsWith(prefix)) continue
    const relative = name.slice(prefix.length)
    if (!wanted.has(relative) || skip(relative, source.text)) continue
    for (const { node, ...call } of extractFromSource(relative, source)) {
      const key = declarationKeyOf(node as ts.Node, relative)
      calls.push({ ...call, reach: liveness.app.has(key) ? 'app' : liveness.live.has(key) ? 'runs' : 'none' })
    }
  }
  return calls
}

export function runCensus(root: string = APP_ROOT, routes: RouteEntry[] = loadRoutes(), withReach = false): CensusReport {
  const files = sourceFiles(root)
  const djangoClients: string[] = []
  const calls = collectCalls(root, files, withReach, djangoClients)

  const grouped = new Map<string, CensusFinding>()
  const urls = new Set<string>()
  for (const call of calls) {
    urls.add(call.pattern)
    const verdict = judgeCall(call, routes)
    if (!verdict.kind) continue
    const key = `${verdict.kind} ${call.method ?? '*'} ${call.pattern}`
    const finding = grouped.get(key) ?? { kind: verdict.kind, method: call.method, pattern: call.pattern, sites: [], routes: verdict.routes.map((entry) => entry.route), reach: null }
    finding.sites.push({ file: call.file, line: call.line, via: call.via, reach: call.reach })
    if (call.reach && (!finding.reach || RANK[call.reach] > RANK[finding.reach])) finding.reach = call.reach
    grouped.set(key, finding)
  }
  const findings = [...grouped.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.pattern.localeCompare(b.pattern))
  const byKind: Record<FindingKind, number> = { ROUTE_MISSING: 0, METHOD_MISSING: 0, CALLS_RETIRED: 0 }
  const liveByKind: Record<FindingKind, number> = { ROUTE_MISSING: 0, METHOD_MISSING: 0, CALLS_RETIRED: 0 }
  for (const finding of findings) {
    byKind[finding.kind] += 1
    if (finding.reach && finding.reach !== 'none') liveByKind[finding.kind] += 1
  }
  return {
    routes: routes.length,
    retiredRoutes: routes.filter((entry) => entry.guard === 'RETIRED').length,
    files: files.length,
    calls: calls.length,
    distinctUrls: urls.size,
    byKind,
    liveByKind: withReach ? liveByKind : null,
    djangoClients: djangoClients.sort(),
    findings,
  }
}

const show = (pattern: string): string => pattern.replace(/\u0001/g, '{…}')

export function toMarkdown(report: CensusReport): string {
  const lines = [
    '# Frontend-to-API census (UE-CONV-H-018)',
    '',
    `${report.files} frontend files, ${report.calls} \`/api\` URLs (${report.distinctUrls} distinct) judged against ${report.routes} route files (${report.retiredRoutes} of them answer 501).`,
    '',
    report.liveByKind ? '| Finding | Distinct URLs | Reached by a page, route or script |' : '| Finding | Distinct URLs |',
    report.liveByKind ? '| --- | --- | --- |' : '| --- | --- |',
    ...Object.entries(report.byKind).map(([kind, count]) => (report.liveByKind ? `| ${kind} | ${count} | ${report.liveByKind[kind as FindingKind]} |` : `| ${kind} | ${count} |`)),
    '',
  ]
  for (const kind of ['ROUTE_MISSING', 'METHOD_MISSING', 'CALLS_RETIRED'] as const) {
    const group = report.findings.filter((finding) => finding.kind === kind)
    if (!group.length) continue
    lines.push(`## ${kind}`, '')
    for (const finding of group) {
      lines.push(`- \`${finding.method ?? '*'} ${show(finding.pattern)}\`${finding.reach ? ` [${finding.reach}]` : ''}${finding.routes.length ? ` → ${finding.routes.join(', ')}` : ''}`)
      for (const site of finding.sites.slice(0, 6)) lines.push(`  - ${site.file}:${site.line} (${site.via}${site.reach ? `, ${site.reach}` : ''})`)
      if (finding.sites.length > 6) lines.push(`  - … ${finding.sites.length - 6} more`)
    }
    lines.push('')
  }
  return `${lines.join('\n')}\n`
}

function main(): void {
  const args = process.argv.slice(2)
  const option = (name: string): string | undefined => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
  const report = runCensus(APP_ROOT, loadRoutes(), args.includes('--reach'))
  const json = option('write')
  if (json) writeFileSync(json, `${JSON.stringify(report, null, 2)}\n`)
  const markdown = option('markdown')
  if (markdown) writeFileSync(markdown, toMarkdown(report))
  if (!args.includes('--quiet')) {
    console.log(`${report.files} files, ${report.calls} /api URLs (${report.distinctUrls} distinct), ${report.routes} routes (${report.retiredRoutes} retired)`)
    for (const [kind, count] of Object.entries(report.byKind)) console.log(`  ${kind.padEnd(14)} ${String(count).padStart(4)}${report.liveByKind ? `   reached: ${report.liveByKind[kind as FindingKind]}` : ''}`)
  }
  if (args.includes('--strict') && report.findings.length > 0) process.exit(1)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) main()
