/**
 * Step 1 S1-A03 transitive authority census.
 *
 * Every mutation-capable HTTP export (POST/PUT/PATCH/DELETE) under app/api is classified by the boundary it passes through,
 * using the per-export span scanner (scripts/lib/api-route-governance-scanner.ts) plus the mechanisms the current code uses.
 * The edge proxy does not authenticate API routes (proxy.ts: "API auth enforcement moved to route handlers"), so an export
 * with no in-handler guard is public unless the public registry names it. Deterministic output, no timestamps.
 *
 * Classes:
 *   GUARDED_SESSION        an authentication/authority mechanism in the export span (or the wrapper that defines it)
 *   SIGNED_OR_SECRET       webhook signature or cron secret verification, or a CRON_API_ROUTES path
 *   CAPABILITY_TOKEN       the request carries its own credential (invite/MFA/reset/magic-link/assessment capability)
 *   PUBLIC_INTAKE_GUARDED  public by design with guardPublicIntake abuse controls
 *   PUBLIC_REGISTRY        listed in lib/public-routes.ts PUBLIC_API_ROUTES
 *   REFUSAL_STUB           answers 501 / a refusal factory and writes nothing
 *   UNCLASSIFIED           none of the above: must be in REVIEWED_UNCLASSIFIED with a reason, or fixed
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { scanRouteFileExports, AUTH_ESTABLISHING_IDENTIFIERS } from '../lib/api-route-governance-scanner'
import { isPublicRoute, CRON_API_ROUTES } from '../../lib/public-routes'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const MUTATIONS = ['POST', 'PUT', 'PATCH', 'DELETE'] as const

const SESSION = [...AUTH_ESTABLISHING_IDENTIFIERS, 'auth()', 'requireUser(', 'withCanonicalApiContext(', 'withBearerOrgBinding(',
  'withExternalMatterResourceAuth(', 'withClaimedWorkbookAccess(', 'requireOrgAccess(', 'requirePlatformStaffAuthority(',
  'requireRewardsInstitutionalAuthority(', 'findReadableCase(', 'withCaseAuthority(', 'requireCaseAuthority(',
  'withPlatformExecutive(', 'requireSystemAdmin(', 'requireSession(', 'handleCanonicalOrganizationSwitch', 'handleIntake',
  'getCaseActor(', 'requireUserForOrganization(']
const SIGNED = ['verifyCronAuth(', 'cronSecretMatches(', 'verifyStripeSignature(', 'verifyWebhookSignature(', 'constructEvent(',
  'verifySignature(', 'timingSafeEqual(']
const CAPABILITY = ['authorizeAssessmentAccess(', 'handleVerifyMagicLink', 'handleChallenge', 'handleResetPassword',
  'handleAcceptInvite', 'handleLogin', 'handleSignup', 'handleLogout', 'handleForgotPassword', 'handleRequestMagicLink',
  'verifyUnsubscribeToken(', 'verifyTrackingToken(', 'capabilityDenialStatus(', 'hashCapabilityToken(']
const PUBLIC_INTAKE = ['guardPublicIntake(']
const REFUSAL = ['retiredFinancialRoute(', 'createdByJobsOnly(', 'recordsASendOnly(', 'notImplemented(', 'status: 501', 'statusCode: 501', "'NOT_IMPLEMENTED'"]
const WRITES = ['.insert(', '.update(', '.delete(', 'INSERT ', 'UPDATE ', 'DELETE FROM']

/** Reviewed exports that none of the classes above recognise; each needs a reason, and the list may only shrink. */
export const REVIEWED_UNCLASSIFIED: Readonly<Record<string, string>> = {
  'POST /api/icra/telemetry': 'Anonymous public assessment funnel telemetry by design: per-address rate limit (fail closed), bounded body, drops the event silently on any refusal; carries no account, session or organization authority.',
  'POST /api/ocra/telemetry': 'Alias that re-exports POST /api/icra/telemetry (same reviewed anonymous telemetry handler).',
}

export type CensusClass = 'GUARDED_SESSION' | 'SIGNED_OR_SECRET' | 'CAPABILITY_TOKEN' | 'PUBLIC_INTAKE_GUARDED' |
  'PUBLIC_REGISTRY' | 'REFUSAL_STUB' | 'UNCLASSIFIED'
export interface CensusRow { route: string; method: string; class: CensusClass; testFiles: number }

function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir).sort()) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (name === 'route.ts') out.push(full)
  }
  return out
}
const has = (text: string, ids: readonly string[]) => ids.some((id) => text.includes(id))
const routePathOf = (file: string) => '/' + path.relative(path.join(APP, 'app'), path.dirname(file)).split(path.sep).join('/')
const samplePath = (route: string) => route.replace(/\[\[?\.{0,3}([^\]]+)\]\]?/g, 'x')

/** Test files that import this route module (relative or alias import), so a refusal test can exist for it. */
/** Text of file-local functions (top-level function/const declarations) that contain a guard token, by name. */
function guardedLocalHelpers(content: string, ids: readonly string[]) {
  const decl = /^(?:export\s+)?(?:async\s+)?(?:function\s+(\w+)|const\s+(\w+)\s*=)/gm
  const starts: { name: string; index: number }[] = []
  let m: RegExpExecArray | null
  while ((m = decl.exec(content))) starts.push({ name: m[1] ?? m[2], index: m.index })
  const names = new Set<string>()
  starts.forEach((start, i) => {
    const body = content.slice(start.index, starts[i + 1]?.index ?? content.length)
    if (has(body, ids)) names.add(start.name)
  })
  return names
}
const callsAny = (span: string, names: Set<string>) => [...names].some((name) => new RegExp(`\\b${name}\\(`).test(span))

/** `export { POST } from '../x/route'` aliases are judged by the module they re-export. */
function resolveReExport(file: string, content: string, depth = 0): string {
  const target = /^export\s*\{[^}]*\}\s*from\s*'([^']+)'/m.exec(content)?.[1]
  if (!target || !target.startsWith('.') || depth > 4) return content
  const next = path.resolve(path.dirname(file), target.endsWith('.ts') ? target : `${target}.ts`)
  try { return resolveReExport(next, readFileSync(next, 'utf8'), depth + 1) } catch { return content }
}

function testIndex() {
  const tests: { text: string }[] = []
  const roots = ['app', 'lib', 'db', '__tests__', 'tests'].map((d) => path.join(APP, d))
  const visit = (dir: string) => {
    let names: string[]
    try { names = readdirSync(dir) } catch { return }
    for (const name of names.sort()) {
      const full = path.join(dir, name)
      if (name === 'node_modules' || name === '.next') continue
      if (statSync(full).isDirectory()) visit(full)
      else if (/\.test\.tsx?$/.test(name)) tests.push({ text: readFileSync(full, 'utf8') })
    }
  }
  roots.forEach(visit)
  return tests
}

export function buildCensus(): CensusRow[] {
  const tests = testIndex()
  const rows: CensusRow[] = []
  for (const file of walk(path.join(APP, 'app', 'api'))) {
    const content = resolveReExport(file, readFileSync(file, 'utf8'))
    const route = routePathOf(file)
    const routeDir = route.replace(/^\/api\//, 'api/')
    // A route module is imported as '@/app/api/<path>/route', '<...>/app/api/<path>/route' or, from app/api/__tests__,
    // '../<path>/route' (and deeper relatives). Anchor on the full path below /api so a sibling route never matches.
    const below = routeDir.replace(/^api\//, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const importPattern = new RegExp(`['"\`](?:[^'"\`]*/api/|(?:\\.\\./)+)${below}/route['"\`]`)
    const importers = tests.filter((t) => importPattern.test(t.text)).length
    for (const exp of scanRouteFileExports(content)) {
      if (!(MUTATIONS as readonly string[]).includes(exp.method)) continue
      const span = exp.span
      // A re-export (`export { POST } from` / `export const POST = factory(...)`) is judged with the defining module text it names.
      const scope = span.length < 400 ? content : span
      const sessionHelpers = guardedLocalHelpers(content, SESSION)
      let cls: CensusClass
      if (has(scope, REFUSAL) && !has(span, WRITES)) cls = 'REFUSAL_STUB'
      else if (has(scope, SESSION) || callsAny(span, sessionHelpers)) cls = 'GUARDED_SESSION'
      else if (has(scope, SIGNED) || CRON_API_ROUTES.has(route)) cls = 'SIGNED_OR_SECRET'
      else if (has(scope, CAPABILITY)) cls = 'CAPABILITY_TOKEN'
      else if (has(scope, PUBLIC_INTAKE)) cls = 'PUBLIC_INTAKE_GUARDED'
      else if (isPublicRoute(samplePath(route))) cls = 'PUBLIC_REGISTRY'
      else cls = 'UNCLASSIFIED'
      rows.push({ route, method: exp.method, class: cls, testFiles: importers })
    }
  }
  return rows.sort((a, b) => (a.route + a.method).localeCompare(b.route + b.method))
}

export function summarize(rows: CensusRow[]) {
  const byClass: Record<string, number> = {}
  for (const row of rows) byClass[row.class] = (byClass[row.class] ?? 0) + 1
  const guarded = rows.filter((r) => r.class === 'GUARDED_SESSION')
  return {
    mutationExports: rows.length,
    byClass: Object.fromEntries(Object.entries(byClass).sort()),
    guardedWithRouteTest: guarded.filter((r) => r.testFiles > 0).length,
    guardedWithoutRouteTest: guarded.filter((r) => r.testFiles === 0).length,
    unclassified: rows.filter((r) => r.class === 'UNCLASSIFIED' && !REVIEWED_UNCLASSIFIED[`${r.method} ${r.route}`]).map((r) => `${r.method} ${r.route}`),
    reviewedUnclassified: Object.keys(REVIEWED_UNCLASSIFIED).sort(),
  }
}

/** Django REST views and Celery entry points in apps/union-eyes/backend (static, deterministic). */
export function backendCensus() {
  const root = path.join(APP, 'backend')
  const files: string[] = []
  const visit = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      const full = path.join(dir, name)
      if (statSync(full).isDirectory()) { if (!['migrations', 'tests', '__pycache__', 'node_modules'].includes(name)) visit(full) }
      else if (name.endsWith('.py') && !name.startsWith('test')) files.push(full)
    }
  }
  visit(root)
  const viewBase = /^class (\w+)\(([^)]*(?:ViewSet|APIView|GenericAPIView|ListCreateAPIView|RetrieveUpdateDestroyAPIView|CreateAPIView|UpdateAPIView|DestroyAPIView|ListAPIView|RetrieveAPIView)[^)]*)\):/gm
  let views = 0
  const withoutPermissionClasses: string[] = []
  const allowAny: string[] = []
  let celeryTasks = 0
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    const rel = path.relative(root, file).split(path.sep).join('/')
    for (const m of text.matchAll(viewBase)) {
      views++
      const rest = text.slice((m.index ?? 0) + m[0].length)
      const end = rest.search(/^class /m)
      const body = end === -1 ? rest : rest.slice(0, end)
      if (!body.includes('permission_classes')) withoutPermissionClasses.push(`${rel}:${m[1]}`)
      if (body.includes('AllowAny')) allowAny.push(`${rel}:${m[1]}`)
    }
    if (rel.endsWith('tasks.py')) celeryTasks += (text.match(/@(shared_task|app\.task|celery_app\.task)/g) ?? []).length
  }
  const settings = readFileSync(path.join(root, 'config', 'settings.py'), 'utf8')
  const defaultPermission = /"DEFAULT_PERMISSION_CLASSES":\s*\[\s*"([^"]+)"/.exec(settings)?.[1] ?? null
  return { drfViews: views, drfViewsWithoutExplicitPermissionClasses: withoutPermissionClasses.sort(), drfViewsAllowAny: allowAny.sort(),
    drfDefaultPermission: defaultPermission, celeryTasks,
    celeryBoundary: 'system jobs with no external caller; reachable only through the broker; organization scoping is inside each task' }
}

export const CENSUS_FILE = path.resolve(APP, '../../docs/union-eyes/staging/evidence/ue-v2-step1-qualification-20261117/transitive-authority-census-v1.json')
export function renderCensus(rows = buildCensus()) {
  return JSON.stringify({ schemaVersion: 1, obligation: 'S1-A03', scope: 'app/api mutation exports (POST/PUT/PATCH/DELETE)',
    proxyAuthenticatesApi: false, summary: summarize(rows), backend: backendCensus(), rows }, null, 2) + '\n'
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const text = renderCensus()
  if (process.argv.includes('--check')) {
    if (readFileSync(CENSUS_FILE, 'utf8') !== text) { console.error('transitive authority census is stale'); process.exit(1) }
  } else writeFileSync(CENSUS_FILE, text)
  console.log(JSON.stringify(JSON.parse(text).summary, null, 1).slice(0, 4000))
}
