/**
 * Step 1 S1-A02 / S1-A05 / S1-A06 evidence trace (deterministic; no timestamps).
 *
 * Inputs (recorded sources only; nothing is invented):
 *   docs/union-eyes/staging/UE_V2_BASE_PRODUCT_SCOPE_RECONCILIATION.json  historical + registry capabilities and their base actions
 *   docs/union-eyes/staging/UE_V2_BASE_ACTION_COVERAGE.json                base actions C01-C22 and their API methods
 *   transitive-authority-census-v1.json                                    boundary class and route-test count per API export
 *
 * Output: for every historical capability its current trace (through the base actions it shares with registry capabilities)
 * and a derived disposition; for every REQUIRED row an evidence entry or an explicit gap; for every base action its route-level
 * authority evidence. A structural trace is labelled as such: it is not a line-by-line implementation proof.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const STAGING = path.join(ROOT, 'docs/union-eyes/staging')
const EVIDENCE = path.join(STAGING, 'evidence/ue-v2-step1-qualification-20261117')
export const TRACE_FILE = path.join(EVIDENCE, 's1-a02-a05-a06-evidence-trace-v1.json')

type Row = { id: string; title?: string; scope: string; historicalSourceState?: string; sourceState?: string; baseActionIds?: string[] }
const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'))

/**
 * Browser journeys of the V2 component qualification (four EN/FR desktop/mobile profiles) that exercise a base action,
 * by required check name in scripts/bootstrap-v2/browser-acceptance.ts.
 */
const V2_BROWSER_CHECKS: Readonly<Record<string, readonly string[]>> = {
  C08: ['member-intake-labels-and-create', 'staff-case-read'],
  C12: ['member-case-list-reopen', 'member-deadline-read-only', 'other-member-case-denial', 'foreign-tenant-case-denial'],
  C21: ['staff-deadline-create-reschedule-complete-cancel', 'member-deadline-read-only'],
  C06: ['member-password-totp-ui', 'staff-password-totp-ui', 'logout-revocation'],
  C07: ['member-password-totp-ui'],
}

/** Kernel, native PostgreSQL and route tests that exercise a base action's authority (paths relative to apps/union-eyes). */
export const BEHAVIOURAL_TESTS: Readonly<Record<string, readonly string[]>> = {
  C06: ['lib/auth/__tests__/session-membership-revocation.pglite.test.ts', 'db/__tests__/authority-kernel-revocation.pglite.test.ts'],
  C08: ['lib/authority/__tests__/primary-handler-lifecycle.test.ts', 'app/api/__tests__/workflow-transition.route.test.ts', 'db/__tests__/grievances-routes.postgres.test.ts'],
  C09: ['lib/cases/automatic-assignment.pglite.test.ts', 'lib/cases/assignment-profiles.pglite.test.ts'],
  C10: ['lib/authority/__tests__/institutional-representation.test.ts', 'lib/authority/__tests__/kernel-governance.test.ts'],
  C11: ['db/__tests__/authority-kernel-lifecycle.pglite.test.ts', 'db/__tests__/authority-kernel-case-sources.pglite.test.ts', 'db/__tests__/election-certificate-succession.native.test.ts'],
  C12: ['lib/services/case-access-service.pglite.test.ts', 'app/api/__tests__/cases-notes.route.test.ts'],
  C14: ['app/api/__tests__/cases-caseId-export.route.test.ts', 'lib/authority/__tests__/primary-handler-ceiling.test.ts', 'lib/authority/__tests__/primary-handler-lifecycle.test.ts', 'db/__tests__/authority-physical-guards.native.test.ts', 'db/__tests__/case-primary-domain-guards.native.test.ts'],
  C22: ['db/__tests__/authority-kernel-revocation.pglite.test.ts', 'scripts/bootstrap-v2/auth-invite-concurrency.native.test.ts'],
}

export function buildTrace() {
  const rec = read(path.join(STAGING, 'UE_V2_BASE_PRODUCT_SCOPE_RECONCILIATION.json'))
  const ledger = read(path.join(STAGING, 'UE_V2_BASE_ACTION_COVERAGE.json'))
  const census = read(path.join(EVIDENCE, 'transitive-authority-census-v1.json'))
  const historical: Row[] = rec.historicalCapabilities
  const registry: Row[] = rec.registryCapabilities
  const live = new Set(['REAL', 'LIMITED'])

  const actionRoutes = new Map<string, { method: string; route: string }[]>()
  for (const a of ledger.actions as { id: string; apiMethods: string[] | null }[])
    // The ledger writes route parameters as {name}; the App Router (and the census) as [name].
    actionRoutes.set(a.id, (a.apiMethods ?? []).map((m) => {
      const [method, route] = m.split(' ')
      return { method, route: route.replace(/\{([^}]+)\}/g, '[$1]') }
    }))
  const censusByKey = new Map<string, { class: string; testFiles: number }>()
  for (const r of census.rows as { method: string; route: string; class: string; testFiles: number }[]) censusByKey.set(`${r.method} ${r.route}`, r)

  const historicalTrace = historical.map((h) => {
    const actions = [...(h.baseActionIds ?? [])].sort()
    const sharing = registry.filter((r) => (r.baseActionIds ?? []).some((a) => actions.includes(a)))
    const liveIds = sharing.filter((r) => live.has(r.sourceState ?? '')).map((r) => r.id).sort()
    const allIds = sharing.map((r) => r.id).sort()
    const strength = liveIds.length ? 'TRACED_TO_LIVE_REGISTRY' : allIds.length ? 'TRACED_TO_UNIMPLEMENTED_REGISTRY' : 'NO_CURRENT_TRACE'
    let disposition: string
    if (h.scope === 'EXCLUDED') disposition = 'EXCLUDED'
    else if (h.scope === 'DEFERRED') disposition = 'DEFERRED'
    else if (h.scope === 'CONDITIONAL') disposition = 'CONDITIONAL'
    else if (h.historicalSourceState === 'NOT_IMPLEMENTED' && liveIds.length) disposition = 'REQUIRED_SUPERSEDED_BY_CURRENT_REGISTRY'
    else if (liveIds.length) disposition = 'REQUIRED_TRACED_TO_LIVE_IMPLEMENTATION'
    else disposition = 'REQUIRED_IMPLEMENTATION_GAP'
    return { id: h.id, scope: h.scope, historicalSourceState: h.historicalSourceState ?? null, baseActionIds: actions,
      traceMethod: 'SHARED_BASE_ACTION', traceStrength: strength, liveRegistryIds: liveIds, registryIds: allIds, disposition }
  })

  const actionEvidence = (ledger.actions as { id: string; action: string }[]).map((a) => {
    const routes = (actionRoutes.get(a.id) ?? []).map(({ method, route }) => {
      const c = censusByKey.get(`${method} ${route}`)
      return { method, route, boundary: c?.class ?? (method === 'GET' ? 'READ_NOT_IN_MUTATION_CENSUS' : 'NOT_FOUND'), routeTestFiles: c?.testFiles ?? null }
    })
    const browser = [...(V2_BROWSER_CHECKS[a.id] ?? [])]
    const behavioural = [...(BEHAVIOURAL_TESTS[a.id] ?? [])]
    const routeMutations = routes.filter((r) => r.boundary !== 'READ_NOT_IN_MUTATION_CENSUS')
    const gaps: string[] = []
    if (!routes.length) gaps.push('No API method is recorded for this action in the ledger; route-level authority evidence cannot be derived.')
    for (const r of routeMutations) if (!r.routeTestFiles) gaps.push(`${r.method} ${r.route} has no route test file importing it.`)
    if (!browser.length && !behavioural.length) gaps.push('Neither a V2 browser journey nor a kernel/native/route behavioural test is linked to this action.')
    return { id: a.id, action: a.action, routes, v2BrowserChecks: browser, behaviouralTests: behavioural, gaps }
  })

  const requiredEvidence = (inventory: string, rows: Row[], liveField: 'sourceState' | 'historicalSourceState') =>
    rows.filter((r) => r.scope === 'REQUIRED').map((r) => {
      const actions = [...(r.baseActionIds ?? [])].sort()
      const evidence = actionEvidence.filter((a) => actions.includes(a.id) && (a.v2BrowserChecks.length || a.behaviouralTests.length || a.routes.some((x) => x.routeTestFiles)))
        .map((a) => ({ baseActionId: a.id, v2BrowserChecks: a.v2BrowserChecks, behaviouralTests: a.behaviouralTests,
          testedRoutes: a.routes.filter((x) => x.routeTestFiles).map((x) => `${x.method} ${x.route}`) }))
      return { inventory, id: r.id, state: r[liveField] ?? null, evidence,
        evidenceGap: evidence.length ? null : 'No tested route, behavioural test or V2 browser journey is linked through its base actions.' }
    })
  const required = [...requiredEvidence('historicalCapabilities', historical, 'historicalSourceState'),
    ...requiredEvidence('registryCapabilities', registry, 'sourceState')]

  const count = <T,>(xs: T[], key: (x: T) => string) => Object.fromEntries(Object.entries(xs.reduce<Record<string, number>>((m, x) => { const k = key(x); m[k] = (m[k] ?? 0) + 1; return m }, {})).sort())
  return {
    schemaVersion: 1, obligations: ['S1-A02', 'S1-A05', 'S1-A06'],
    method: 'Structural trace through recorded base-action links; route boundaries from the S1-A03 census; browser coverage from the V2 required checks. Not a line-by-line implementation proof.',
    summary: {
      historicalByDisposition: count(historicalTrace, (h) => h.disposition),
      historicalByTraceStrength: count(historicalTrace, (h) => h.traceStrength),
      requiredWithEvidence: required.filter((r) => r.evidenceGap === null).length,
      requiredWithEvidenceGap: required.filter((r) => r.evidenceGap !== null).length,
      actionsWithGaps: actionEvidence.filter((a) => a.gaps.length).map((a) => a.id),
    },
    historicalTrace, actionEvidence, requiredEvidence: required,
  }
}

export const renderTrace = () => JSON.stringify(buildTrace(), null, 2) + '\n'
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const text = renderTrace()
  if (process.argv.includes('--check')) { if (readFileSync(TRACE_FILE, 'utf8') !== text) { console.error('evidence trace is stale'); process.exit(1) } }
  else writeFileSync(TRACE_FILE, text)
  console.log(JSON.stringify(JSON.parse(text).summary, null, 1))
}
