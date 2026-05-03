import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  QA_ROUTE_INVENTORY,
  collectCriticalRouteInventory,
  getMissingPilotCriticalMetadata,
  getQaMetadataForFile,
  isMutationRoute,
  rel,
} from './_qa-route-inventory'

describe('UE QA - RBAC reality and route guard enforcement', () => {
  it('all pilot-critical routes declare an auth guard path', () => {
    const routes = collectCriticalRouteInventory()
    expect(routes.length).toBeGreaterThan(0)

    const missing = routes.filter((route) => !route.hasAuthWrapper).map((route) => rel(route.filePath))
    expect(missing, `Missing auth guard wrappers: ${missing.join(', ')}`).toEqual([])
  })

  it('all pilot-critical mutation routes enforce org scoping behavior', () => {
    const routes = collectCriticalRouteInventory()
    const missing = routes
      .filter((route) => isMutationRoute(route))
      .filter((route) => !route.hasOrgScoped)
      .map((route) => rel(route.filePath))

    expect(missing, `Mutation routes without org scope guard: ${missing.join(', ')}`).toEqual([])
  })

  it('critical route inventory metadata is complete for pilot-critical endpoints', () => {
    const missing = getMissingPilotCriticalMetadata()
    expect(missing, `Pilot-critical routes missing QA metadata: ${missing.join(', ')}`).toEqual([])
  })

  it('inventory entries include explicit authorization expectations per test persona', () => {
    const requiredPersonas = [
      'member',
      'steward',
      'admin',
      'auditor',
      'externalUxTester',
      'unauthenticated',
    ]

    const incomplete = QA_ROUTE_INVENTORY.filter((entry) =>
      requiredPersonas.some((persona) => !entry.expectedAuthorizationByPersona[persona]),
    ).map((entry) => `${entry.routeFile}:${entry.method}`)

    expect(incomplete, `Inventory items missing persona auth expectation: ${incomplete.join(', ')}`).toEqual(
      [],
    )
  })

  it('all critical paths in inventory map to concrete route files', () => {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

    const missing = QA_ROUTE_INVENTORY.map((entry) => entry.routeFile).filter((routeFile) => {
      const absolutePath = path.join(repoRoot, routeFile)
      return !fs.existsSync(absolutePath)
    })

    expect(missing, `Inventory points to missing route files: ${missing.join(', ')}`).toEqual([])
  })

  it('RBAC reality map must not contain UNKNOWN on critical paths', () => {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
    const filePath = path.join(repoRoot, 'docs', 'union-eyes', 'qa', 'rbac-reality-map.md')
    const content = fs.readFileSync(filePath, 'utf8')
    const unknownCount = (content.match(/\bUNKNOWN\b/g) ?? []).length
    expect(unknownCount).toBe(0)
  })

  it('critical route files have corresponding inventory entries', () => {
    const missing = collectCriticalRouteInventory()
      .filter((route) => getQaMetadataForFile(route.filePath).length === 0)
      .map((route) => rel(route.filePath))

    expect(missing, `Critical routes missing inventory entry: ${missing.join(', ')}`).toEqual([])
  })
})
