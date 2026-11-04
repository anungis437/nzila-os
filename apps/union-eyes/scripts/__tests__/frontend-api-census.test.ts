/**
 * The frontend-to-API census (UE-CONV-H-018): what the frontend asks for is served.
 *
 * Two parts. The first pins how a URL is read out of source and matched to a route file (client-calls.ts, route-match.ts). The second runs the census over the real
 * tree and the committed route-coverage manifest, and holds each finding class at or below a ceiling that can only fall: a screen that calls a route nobody wrote
 * (404), a method the route does not export (405), or a route that answers 501 looks finished and fails when used. Closing findings means lowering a ceiling;
 * a new call to a missing route fails here.
 */
import { describe, expect, it } from 'vitest'
import { DYNAMIC, extractApiCalls } from '../lib/frontend-census/client-calls'
import { judgeCall, routeSegments, type RouteEntry } from '../lib/frontend-census/route-match'
import { APP_ROOT, loadRoutes, runCensus } from '../runtime/frontend-api-census'

const calls = (source: string, file = 'components/example.tsx') => extractApiCalls(file, source).map(({ pattern, method, via }) => ({ pattern, method, via }))

describe('reading a URL out of source', () => {
  it('reads a literal passed to fetch, with the method the options give', () => {
    expect(calls(`fetch('/api/members'); fetch('/api/members', { method: 'POST' }); fetch('/api/members/1', { method: 'delete' })`)).toEqual([
      { pattern: '/api/members', method: 'GET', via: 'fetch' },
      { pattern: '/api/members', method: 'POST', via: 'fetch' },
      { pattern: '/api/members/1', method: 'DELETE', via: 'fetch' },
    ])
  })

  it('turns every computed part into a wildcard, and drops a query string a helper appended', () => {
    expect(calls('fetch(`/api/orgs/${orgId}/members/${id}?x=1`); fetch(`/api/members${query}`); fetch("/api/cases/" + caseId + "/notes")')).toEqual([
      { pattern: `/api/orgs/${DYNAMIC}/members/${DYNAMIC}`, method: 'GET', via: 'fetch' },
      { pattern: '/api/members', method: 'GET', via: 'fetch' },
      { pattern: `/api/cases/${DYNAMIC}/notes`, method: 'GET', via: 'fetch' },
    ])
  })

  it('reads an axios-style verb, a data hook, a link and a form', () => {
    expect(
      calls(
        `api.post('/api/claims', body); useSWR('/api/claims'); const a = <a href="/api/export/claims">x</a>; const f = <form action="/api/consent" method="post" />`,
      ),
    ).toEqual([
      { pattern: '/api/claims', method: 'POST', via: 'verb' },
      { pattern: '/api/claims', method: 'GET', via: 'swr' },
      { pattern: '/api/export/claims', method: 'GET', via: 'href' },
      { pattern: '/api/consent', method: 'POST', via: 'form' },
    ])
  })

  it('does not know the method of a URL it only holds, and ignores what is not a request', () => {
    expect(calls(`const url = '/api/members'; import x from '/api/not-a-module'; const glob = '/api/*'; const text = 'about /api/members'; const root = '/api'`)).toEqual([
      { pattern: '/api/members', method: null, via: 'value' },
    ])
  })
})

describe('matching a URL to the route files', () => {
  const routes: RouteEntry[] = [
    { route: 'members/route.ts', methods: ['GET', 'POST'], guard: 'WITH_API' },
    { route: 'members/[id]/route.ts', methods: ['GET', 'PATCH', 'DELETE'], guard: 'CRUD_FACTORY' },
    { route: 'members/export/route.ts', methods: ['GET'], guard: 'RETIRED' },
    { route: 'pension/trustees/route.ts', methods: ['GET', 'POST'], guard: 'WITH_API', retiredMethods: ['POST'] },
    { route: 'docs/[...path]/route.ts', methods: ['GET'], guard: 'WITH_API' },
    { route: 'route.ts', methods: ['GET'], guard: 'WITH_API' },
  ]
  const judge = (pattern: string, method: string | null) => judgeCall({ pattern, method }, routes).kind

  it('reads the segments of a route file, with its dynamic and catch-all parts', () => {
    expect(routeSegments('members/[id]/route.ts')).toEqual([{ kind: 'literal', value: 'members' }, { kind: 'param' }])
    expect(routeSegments('docs/[...path]/route.ts')).toEqual([{ kind: 'literal', value: 'docs' }, { kind: 'catchall', optional: false }])
    expect(routeSegments('route.ts')).toEqual([])
  })

  it('finds no finding for a URL a route serves with the method asked', () => {
    expect(judge('/api/members', 'GET')).toBeNull()
    expect(judge(`/api/members/${DYNAMIC}`, 'DELETE')).toBeNull()
    expect(judge('/api/members/42', null)).toBeNull()
    expect(judge('/api/docs/a/b/c', 'GET')).toBeNull()
  })

  it('says ROUTE_MISSING when no route file matches', () => {
    expect(judge('/api/bargaining-units', 'GET')).toBe('ROUTE_MISSING')
    expect(judge('/api/members/1/notes', 'GET')).toBe('ROUTE_MISSING')
  })

  it('says METHOD_MISSING when the matching routes do not export the method', () => {
    expect(judge('/api/members', 'DELETE')).toBe('METHOD_MISSING')
    expect(judge('/api/members/1', 'PUT')).toBe('METHOD_MISSING')
  })

  it('says CALLS_RETIRED when the route that serves it answers 501, and serves a static URL by its most specific route', () => {
    expect(judge('/api/members/export', 'GET')).toBe('CALLS_RETIRED')
    // The same segment, computed, could be a member id: a live route may serve it, so it is not called retired.
    expect(judge(`/api/members/${DYNAMIC}`, 'GET')).toBeNull()
  })

  it('judges a file that serves live methods beside retired ones by the method asked', () => {
    expect(judge('/api/pension/trustees', 'GET')).toBeNull()
    expect(judge('/api/pension/trustees', 'POST')).toBe('CALLS_RETIRED')
    // Without a method, one of them is live.
    expect(judge('/api/pension/trustees', null)).toBeNull()
  })
})

describe('which routes serve a URL with a computed segment', () => {
  const routes: RouteEntry[] = [
    { route: 'claims/[id]/route.ts', methods: ['GET', 'PATCH'], guard: 'WITH_API' },
    { route: 'claims/bulk/route.ts', methods: ['GET', 'POST'], guard: 'WITH_API' },
    { route: 'ocra/start/route.ts', methods: ['POST'], guard: 'WITH_API' },
    { route: 'ocra/submit/route.ts', methods: ['POST'], guard: 'WITH_API' },
    { route: 'clauses/[id]/route.ts', methods: ['GET'], guard: 'RETIRED' },
    { route: 'clauses/search/route.ts', methods: ['GET'], guard: 'WITH_API' },
  ]
  const served = (pattern: string, method: string | null) => judgeCall({ pattern, method }, routes).routes.map((entry) => entry.route)

  it('serves a computed identifier by the dynamic route, not by its literal sibling', () => {
    // `claims/${id}` is the case that id names; it is `claims/bulk` only when the id is the word "bulk".
    expect(served(`/api/claims/${DYNAMIC}`, 'GET')).toEqual(['claims/[id]/route.ts'])
    expect(served(`/api/claims/${DYNAMIC}`, 'PATCH')).toEqual(['claims/[id]/route.ts'])
  })

  it('keeps the literal sibling when nothing dynamic serves the method', () => {
    expect(served(`/api/claims/${DYNAMIC}`, 'POST')).toEqual(['claims/bulk/route.ts'])
  })

  it('serves a static URL by the literal route, as before', () => {
    expect(served('/api/claims/bulk', 'GET')).toEqual(['claims/bulk/route.ts'])
  })

  it('keeps every literal route when there is no dynamic route to prefer', () => {
    expect(served(`/api/ocra/${DYNAMIC}`, 'POST')).toEqual(['ocra/start/route.ts', 'ocra/submit/route.ts'])
  })

  it('calls a computed identifier retired when the dynamic route that serves it is, whatever its live sibling does', () => {
    expect(judgeCall({ pattern: `/api/clauses/${DYNAMIC}`, method: 'GET' }, routes).kind).toBe('CALLS_RETIRED')
  })
})

// What the frontend asks for that nothing serves. The ceilings are the end: zero.
const CEILING = { ROUTE_MISSING: 0, METHOD_MISSING: 0, CALLS_RETIRED: 0 } as const

describe('the frontend against the routes that exist', () => {
  it('holds every finding class at or below its ceiling', () => {
    const report = runCensus(APP_ROOT, loadRoutes(), false)
    expect(report.files).toBeGreaterThan(1000)
    expect(report.calls).toBeGreaterThan(400)
    const over = (Object.keys(CEILING) as Array<keyof typeof CEILING>)
      .filter((kind) => report.byKind[kind] > CEILING[kind])
      .map((kind) => `${kind}: ${report.byKind[kind]} > ${CEILING[kind]}\n${report.findings.filter((f) => f.kind === kind).map((f) => `  ${f.method ?? '*'} ${f.pattern.replace(/\u0001/g, '{}')}  ${f.sites[0].file}:${f.sites[0].line}`).join('\n')}`)
    expect(over).toEqual([])
  }, 180_000)
})
