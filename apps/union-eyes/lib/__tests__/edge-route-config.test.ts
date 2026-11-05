/**
 * The edge's route lists against the routes that exist (UE-CONV-H-018).
 *
 * The proxy decides, from path lists, which API paths are public, which are cron and which provider callbacks escape the API rate limit. A list that names a path
 * no route serves is configuration for nothing (and, for a provider callback, leaves the real route inside the rate limit); a route that is a signed callback and
 * is not listed is rate limited like any other request. Each list is held against the route-coverage manifest (docs/union-eyes/convergence/register/
 * ue-route-coverage-manifest.json), which records every route file, its methods and its guard class.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { isGuardExempt } from '../rate-limit/proxy-api-guard'
import { CRON_API_ROUTES, PUBLIC_API_ROUTES, SIGNED_CALLBACK_ROUTES, isCronRoute, isPublicRoute } from '../public-routes'

interface ManifestRoute {
  route: string
  methods: string[]
  guard: string
}

const manifest = JSON.parse(
  readFileSync(path.resolve(__dirname, '..', '..', '..', '..', 'docs', 'union-eyes', 'convergence', 'register', 'ue-route-coverage-manifest.json'), 'utf8'),
) as { routes: ManifestRoute[] }

/** The URL a route file serves, with its dynamic segments left as written: `members/[id]/route.ts` is `/api/members/[id]`. */
const urlOf = (route: string): string => `/api/${route.replace(/(^|\/)route\.ts$/, '')}`.replace(/\/$/, '')
const urls = manifest.routes.map((entry) => urlOf(entry.route))

/** Whether a route file could serve the path: an exact path (a dynamic segment matches any one), or, for a prefix entry, anything beneath it. */
const served = (entry: string): boolean => {
  const prefix = entry.endsWith('/')
  const wanted = entry.replace(/\/$/, '').split('/')
  return urls.some((url) => {
    const segments = url.split('/')
    const matches = (candidate: string[]) => wanted.every((segment, i) => candidate[i] === segment || /^\[.+\]$/.test(candidate[i] ?? ''))
    return prefix ? segments.length >= wanted.length && matches(segments) : segments.length === wanted.length && matches(segments)
  })
}

describe('the public-route list', () => {
  it('names only paths that a route serves', () => {
    const unserved = [...PUBLIC_API_ROUTES].filter((entry) => !served(entry))
    expect(unserved).toEqual([])
  })
})

describe('provider callbacks', () => {
  const signed = manifest.routes.filter((entry) => entry.guard === 'WEBHOOK_SIGNATURE').map((entry) => urlOf(entry.route))

  it('are exactly the routes whose guard is a provider signature', () => {
    expect([...SIGNED_CALLBACK_ROUTES].sort()).toEqual(signed.sort())
  })

  it('are public at the edge and outside the API rate limit, each of them', () => {
    for (const callback of SIGNED_CALLBACK_ROUTES) {
      expect(isPublicRoute(callback), callback).toBe(true)
      expect(isGuardExempt(callback, 'POST'), callback).toBe(true)
    }
  })
})

describe('the cron list', () => {
  it('names only paths that a route serves, each one a route whose own guard is the cron secret or a role', () => {
    for (const cron of CRON_API_ROUTES) {
      expect(served(cron), cron).toBe(true)
      expect(isCronRoute(cron), cron).toBe(true)
      expect(isGuardExempt(cron, 'POST'), cron).toBe(true)
    }
  })
})
