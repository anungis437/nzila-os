import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { collectCriticalRouteInventory, isMutationRoute, rel } from './_qa-route-inventory'

describe('UE QA - RBAC reality and route guard enforcement', () => {
  it('all API routes declare an auth guard path', () => {
    const routes = collectCriticalRouteInventory()
    expect(routes.length).toBeGreaterThan(0)

    const missing = routes.filter((r) => !r.hasAuthWrapper).map((r) => rel(r.filePath))
    expect(missing, `Missing auth guard wrappers: ${missing.join(', ')}`).toEqual([])
  })

  it('all mutation routes enforce org scoping behavior', () => {
    const routes = collectCriticalRouteInventory()
    const missing = routes
      .filter((r) => isMutationRoute(r))
      .filter((r) => !r.hasOrgScoped)
      .map((r) => rel(r.filePath))

    expect(missing, `Mutation routes without org scope guard: ${missing.join(', ')}`).toEqual([])
  })

  it('RBAC reality map must not contain UNKNOWN', () => {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
    const filePath = path.join(repoRoot, 'docs', 'union-eyes', 'qa', 'rbac-reality-map.md')
    const content = fs.readFileSync(filePath, 'utf8')
    const unknownCount = (content.match(/\bUNKNOWN\b/g) ?? []).length
    expect(unknownCount).toBe(0)
  })
})
