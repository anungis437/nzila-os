import { describe, expect, it } from 'vitest'
import {
  QA_ROUTE_INVENTORY,
  collectCriticalRouteInventory,
  getQaMetadataForFile,
  isMutationRoute,
  rel,
} from './_qa-route-inventory'

function isCriticalCaseMutation(pathname: string): boolean {
  return (
    pathname.includes('/workflow/') ||
    pathname.includes('/workbench/assign') ||
    pathname.includes('/admin/update-role') ||
    pathname.includes('/claims/') ||
    pathname.includes('/upload/') ||
    pathname.includes('/exports/')
  )
}

describe('UE QA - route-specific mutation proof and audit enforcement', () => {
  it('critical mutation routes include DecisionRecord enforcement hooks or delegated proof path', () => {
    const missing = collectCriticalRouteInventory()
      .filter((route) => isMutationRoute(route))
      .filter((route) => isCriticalCaseMutation(rel(route.filePath)))
      .filter((route) => {
        const metadata = getQaMetadataForFile(route.filePath)
        const hasDelegated = metadata.some((entry) => entry.expectedDecisionRecordBehavior === 'delegated')
        return !route.hasDecisionEvidenceHook && !hasDelegated
      })
      .map((route) => rel(route.filePath))

    expect(missing, `Critical mutations missing DecisionRecord hook/delegation: ${missing.join(', ')}`).toEqual(
      [],
    )
  })

  it('critical mutation routes include NAR enforcement hooks or delegated proof path', () => {
    const missing = collectCriticalRouteInventory()
      .filter((route) => isMutationRoute(route))
      .filter((route) => isCriticalCaseMutation(rel(route.filePath)))
      .filter((route) => {
        const metadata = getQaMetadataForFile(route.filePath)
        const hasDelegated = metadata.some((entry) => entry.expectedNarBehavior === 'delegated')
        return !route.hasNarEvidenceHook && !hasDelegated
      })
      .map((route) => rel(route.filePath))

    expect(missing, `Critical mutations missing NAR hook/delegation: ${missing.join(', ')}`).toEqual([])
  })

  it('audit export routes enforce role and org constraints by persona', () => {
    const exportRoutes = QA_ROUTE_INVENTORY.filter((entry) => entry.auditExportApplies)

    const violations = exportRoutes
      .filter((entry) => entry.expectedAuthorizationByPersona.externalUxTester !== 'deny')
      .map((entry) => `${entry.routeFile}:${entry.method}`)

    expect(violations, `External tester should not receive export audit capability: ${violations.join(', ')}`).toEqual(
      [],
    )
  })

  it('auditor/read-only users cannot execute mutation routes', () => {
    const violations = QA_ROUTE_INVENTORY.filter(
      (entry) =>
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(entry.method) &&
        entry.expectedAuthorizationByPersona.auditor !== 'deny',
    ).map((entry) => `${entry.routeFile}:${entry.method}`)

    expect(violations, `Auditor is incorrectly allowed to mutate: ${violations.join(', ')}`).toEqual([])
  })

  it('pilot-critical mutation stories always define decision and NAR expectations', () => {
    const incomplete = QA_ROUTE_INVENTORY.filter(
      (entry) =>
        entry.readinessCategory !== 'ux_ready' &&
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(entry.method) &&
        (entry.expectedDecisionRecordBehavior === 'not_required' || entry.expectedNarBehavior === 'not_required'),
    ).map((entry) => `${entry.routeFile}:${entry.method}`)

    expect(incomplete, `Pilot/prod mutation routes missing proof expectation: ${incomplete.join(', ')}`).toEqual(
      [],
    )
  })

  it('upload route has delegated proof path (MEMBER-UPLOAD-DOCUMENT)', () => {
    const uploadEntries = QA_ROUTE_INVENTORY.filter((e) => e.routeFile === 'app/api/upload/route.ts')
    expect(uploadEntries.length).toBeGreaterThan(0)
    const hasDelegated = uploadEntries.some(
      (e) => e.expectedDecisionRecordBehavior === 'delegated' || e.expectedNarBehavior === 'delegated',
    )
    expect(hasDelegated).toBe(true)
  })

  it('evidence route restricts external tester access (MEMBER-VIEW-ALLOWED-DOCUMENT)', () => {
    const evidenceEntries = QA_ROUTE_INVENTORY.filter((e) => e.routeFile.includes('/evidence/'))
    expect(evidenceEntries.length).toBeGreaterThan(0)
    const violations = evidenceEntries.filter((e) => e.expectedAuthorizationByPersona.externalUxTester !== 'deny')
    expect(violations.map((e) => `${e.routeFile}:${e.method}`)).toEqual([])
  })

  it('auditor denied write access to wrong-org audit trail (AUDITOR-CANNOT-ACCESS-WRONG-ORG)', () => {
    const exportsEntries = QA_ROUTE_INVENTORY.filter((e) => e.routeFile.includes('/exports/'))
    expect(exportsEntries.length).toBeGreaterThan(0)
    const readEntries = exportsEntries.filter((e) => e.method === 'GET')
    expect(readEntries.every((e) => e.expectedAuthorizationByPersona.member === 'deny')).toBe(true)
    expect(readEntries.every((e) => e.expectedAuthorizationByPersona.externalUxTester === 'deny')).toBe(true)
  })
})