/**
 * Which route files could serve a URL the frontend asks for (UE-CONV-H-018). Pure: the route list comes from the route-coverage manifest
 * (docs/union-eyes/convergence/register/ue-route-coverage-manifest.json), the calls from client-calls.ts.
 */
import { DYNAMIC, type ClientCall } from './client-calls'

export interface RouteEntry {
  /** The route file relative to app/api, as the manifest writes it: `members/[id]/route.ts`. */
  route: string
  methods: readonly string[]
  /** The manifest's guard class; RETIRED is a route that answers 501. */
  guard: string
}

export type FindingKind = 'ROUTE_MISSING' | 'METHOD_MISSING' | 'CALLS_RETIRED'

type Segment = { kind: 'literal'; value: string } | { kind: 'param' } | { kind: 'catchall'; optional: boolean }

export function routeSegments(route: string): Segment[] {
  const path = route.replace(/(^|\/)route\.(ts|tsx|js)$/, '')
  const segments: Segment[] = []
  for (const part of path.split('/').filter(Boolean)) {
    if (/^\(.*\)$/.test(part)) continue
    if (/^\[\[\.\.\..+\]\]$/.test(part)) segments.push({ kind: 'catchall', optional: true })
    else if (/^\[\.\.\..+\]$/.test(part)) segments.push({ kind: 'catchall', optional: false })
    else if (/^\[.+\]$/.test(part)) segments.push({ kind: 'param' })
    else segments.push({ kind: 'literal', value: part })
  }
  return segments
}

/** The segments of a client URL below `/api`; a segment with any computed part in it is a wildcard. */
export function clientSegments(pattern: string): string[] {
  return pattern
    .replace(/^\/api/, '')
    .split('/')
    .filter(Boolean)
    .map((segment) => (segment.includes(DYNAMIC) ? DYNAMIC : segment))
}

function matches(client: readonly string[], route: readonly Segment[], i = 0, j = 0): boolean {
  if (j === route.length) return i === client.length
  const segment = route[j]
  if (segment.kind === 'catchall') return segment.optional || i < client.length
  if (i === client.length) return false
  if (segment.kind === 'param') return matches(client, route, i + 1, j + 1)
  return (client[i] === segment.value || client[i] === DYNAMIC) && matches(client, route, i + 1, j + 1)
}

/** How many of the client's literal segments the route names itself: the more, the more specific the route is (Next serves the static one). */
function specificity(client: readonly string[], route: readonly Segment[]): number {
  return route.reduce((total, segment, index) => total + (segment.kind === 'literal' && client[index] === segment.value ? 1 : 0), 0)
}

export interface Verdict {
  kind: FindingKind | null
  routes: RouteEntry[]
}

const IMPLICIT = new Set(['HEAD', 'OPTIONS'])

export function judgeCall(call: Pick<ClientCall, 'pattern' | 'method'> & { prefix?: boolean }, routes: readonly RouteEntry[]): Verdict {
  const client = clientSegments(call.pattern)
  if (call.prefix) {
    // A prefix names a family of routes: it is served when some route lies beneath it (a dynamic or catch-all segment of the route stands for any text).
    const beneath = routes.filter((entry) => {
      const segments = routeSegments(entry.route)
      return client.every((segment, i) => {
        const own = segments[i]
        if (!own) return false
        return own.kind !== 'literal' || segment === DYNAMIC || segment === own.value
      })
    })
    return beneath.length ? { kind: null, routes: beneath } : { kind: 'ROUTE_MISSING', routes: [] }
  }
  let candidates = routes.filter((entry) => matches(client, routeSegments(entry.route)))
  if (candidates.length === 0) return { kind: 'ROUTE_MISSING', routes: [] }

  // A fully static URL is served by the most specific route only.
  if (!client.includes(DYNAMIC) && candidates.length > 1) {
    const best = Math.max(...candidates.map((entry) => specificity(client, routeSegments(entry.route))))
    candidates = candidates.filter((entry) => specificity(client, routeSegments(entry.route)) === best)
  }

  const method = call.method && !IMPLICIT.has(call.method) ? call.method : null
  const serving = method ? candidates.filter((entry) => entry.methods.includes(method)) : candidates
  if (method && serving.length === 0) return { kind: 'METHOD_MISSING', routes: candidates }
  if (serving.every((entry) => entry.guard === 'RETIRED')) return { kind: 'CALLS_RETIRED', routes: serving }
  return { kind: null, routes: serving }
}
