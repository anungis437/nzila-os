import { describe, expect, it } from 'vitest'
import { collectCriticalRouteInventory, isMutationRoute, rel } from './_qa-route-inventory'

function isCriticalCaseMutation(pathname: string): boolean {
  return (
    pathname.includes('/workflow/') ||
    pathname.includes('/workbench/assign') ||
    pathname.includes('/admin/update-role') ||
    pathname.includes('/claims/') ||
    pathname.includes('/grievance')
  )
}

describe('UE QA - mutation proof enforcement (DecisionRecord + NAR)', () => {
  it('critical mutation routes must include DecisionRecord enforcement hooks', () => {
    const missing = collectCriticalRouteInventory()
      .filter((route) => isMutationRoute(route))
      .filter((route) => isCriticalCaseMutation(rel(route.filePath)))
      .filter((route) => !route.hasDecisionEvidenceHook)
      .map((route) => rel(route.filePath))

    expect(missing, `Critical mutations missing DecisionRecord hook: ${missing.join(', ')}`).toEqual(
      [],
    )
  })

  it('critical mutation routes must include NAR enforcement hooks', () => {
    const missing = collectCriticalRouteInventory()
      .filter((route) => isMutationRoute(route))
      .filter((route) => isCriticalCaseMutation(rel(route.filePath)))
      .filter((route) => !route.hasNarEvidenceHook)
      .map((route) => rel(route.filePath))

    expect(missing, `Critical mutations missing NAR hook: ${missing.join(', ')}`).toEqual([])
  })
})
