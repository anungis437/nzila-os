/**
 * The deprecation registry keeps its promises (UE-CONV-H-018).
 *
 * DEPRECATED_ROUTE_MAP is guidance: "this path is deprecated, use that one". The deprecated paths are routes that were removed, so they are expected not to be
 * served (or to be served only as a compatibility alias). The canonical path is a promise, and it is false when no route serves it, or when the route that does
 * answers 501. Each non-wildcard canonical is held against the route-coverage manifest (docs/union-eyes/convergence/register/ue-route-coverage-manifest.json).
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { judgeCall, type RouteEntry } from '../../scripts/lib/frontend-census/route-match'
import { DEPRECATED_ROUTE_MAP } from './deprecation'

const routes = (
  JSON.parse(readFileSync(path.resolve(__dirname, '..', '..', '..', '..', 'docs', 'union-eyes', 'convergence', 'register', 'ue-route-coverage-manifest.json'), 'utf8')) as {
    routes: RouteEntry[]
  }
).routes

/** `[param]` in a registry path stands for any one segment. */
const verdictOf = (registryPath: string) => judgeCall({ pattern: registryPath.replace(/\[[^\]]+\]/g, '\u0001'), method: null }, routes)

describe('DEPRECATED_ROUTE_MAP', () => {
  const concrete = DEPRECATED_ROUTE_MAP.filter((entry) => !entry.deprecated.endsWith('/*'))

  it('names a canonical route that is served and answers (not 501), or says the route is REMOVED', () => {
    const broken = concrete
      .filter((entry) => entry.canonical !== 'REMOVED')
      .filter((entry) => verdictOf(entry.canonical).kind !== null)
      .map((entry) => `${entry.deprecated} -> ${entry.canonical}: ${verdictOf(entry.canonical).kind}`)
    expect(broken).toEqual([])
  })

  it('does not mark a live provider callback as deprecated', () => {
    const callbacks = routes.filter((entry) => entry.guard === 'WEBHOOK_SIGNATURE').map((entry) => `/api/${entry.route.replace(/\/route\.ts$/, '')}`)
    expect(DEPRECATED_ROUTE_MAP.filter((entry) => callbacks.includes(entry.deprecated)).map((entry) => entry.deprecated)).toEqual([])
  })

  it('lists each deprecated path once', () => {
    const paths = DEPRECATED_ROUTE_MAP.map((entry) => entry.deprecated)
    expect(new Set(paths).size).toBe(paths.length)
  })
})
