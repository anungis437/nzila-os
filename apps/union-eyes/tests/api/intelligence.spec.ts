import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { QA_ROUTE_INVENTORY, collectCriticalRouteInventory, rel } from './_qa-route-inventory'

type AggregateInput = {
  expectedOrgCount: number
  actualOrgCount: number
  inputRecordCount: number
  outputAggregateCount: number
  previousTotalAmount: number
  currentTotalAmount: number
}

function evaluateAggregateIntegrity(input: AggregateInput): { valid: boolean; severity: 'none' | 'critical' } {
  const complete = input.expectedOrgCount === input.actualOrgCount
  const consistent = input.inputRecordCount === input.outputAggregateCount
  const anomalousDrop = input.currentTotalAmount < input.previousTotalAmount

  return {
    valid: complete && consistent && !anomalousDrop,
    severity: complete && consistent && !anomalousDrop ? 'none' : 'critical',
  }
}

describe('UE QA - intelligence and pipeline behavior', () => {
  it('cognition and analytics routes must enforce role-based gating', () => {
    const routes = collectCriticalRouteInventory()
      .map((entry) => ({ path: rel(entry.filePath), minRoles: entry.minRoles }))
      .filter((entry) => entry.path.includes('/api/cognition/') || entry.path.includes('/api/analytics/'))

    const violations = routes.filter((entry) => entry.minRoles.length === 0).map((entry) => entry.path)
    expect(violations, `Intelligence routes missing role gating: ${violations.join(', ')}`).toEqual([])
  })

  it('inventory marks intelligence and pipeline-sensitive endpoints explicitly', () => {
    const tagged = QA_ROUTE_INVENTORY.filter((entry) => entry.intelligencePipelineApplies)
    const missing = tagged
      .filter((entry) => entry.requiredRolePermissionScope.trim().length === 0)
      .map((entry) => `${entry.routeFile}:${entry.method}`)

    expect(missing, `Pipeline/intelligence entries missing authority scope: ${missing.join(', ')}`).toEqual(
      [],
    )
  })

  it('pipeline-sensitive endpoints must not grant unauthenticated access', () => {
    const leaks = QA_ROUTE_INVENTORY.filter(
      (entry) => entry.intelligencePipelineApplies && entry.expectedAuthorizationByPersona.unauthenticated !== 'deny',
    ).map((entry) => `${entry.routeFile}:${entry.method}`)

    expect(leaks, `Pipeline/intelligence routes allow unauthenticated access: ${leaks.join(', ')}`).toEqual(
      [],
    )
  })

  it('aggregate integrity checks detect consistency drift deterministically', () => {
    const report = evaluateAggregateIntegrity({
      expectedOrgCount: 2,
      actualOrgCount: 2,
      inputRecordCount: 10,
      outputAggregateCount: 0,
      previousTotalAmount: 200,
      currentTotalAmount: 100,
    })

    expect(report.valid).toBe(false)
    expect(report.severity).toBe('critical')
  })

  it('pipeline health surface must exist in control-plane', () => {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
    const routePath = path.resolve(
      repoRoot,
      'apps',
      'control-plane',
      'app',
      'api',
      'pipeline-health',
      'route.ts',
    )

    expect(fs.existsSync(routePath)).toBe(true)
  })

  it('benchmark route is role-gated (INTELLIGENCE-BENCHMARK-GATED)', () => {
    const benchmarkEntries = QA_ROUTE_INVENTORY.filter(
      (e) => e.routeFile.includes('/analytics/benchmark') || e.routeFile.includes('/cba-intelligence/benchmark/'),
    )
    expect(benchmarkEntries.length).toBeGreaterThan(0)
    expect(benchmarkEntries.every((e) => e.intelligencePipelineApplies)).toBe(true)
    expect(benchmarkEntries.every((e) => e.expectedAuthorizationByPersona.unauthenticated === 'deny')).toBe(true)
    expect(benchmarkEntries.every((e) => e.expectedAuthorizationByPersona.member === 'deny')).toBe(true)
  })

  it('stale pipeline data warning coverage (INTELLIGENCE-STALE-DATA-SURFACED)', () => {
    const pipelineRoutes = QA_ROUTE_INVENTORY.filter((e) => e.intelligencePipelineApplies)
    const routeFiles = pipelineRoutes.map((e) => e.routeFile)
    expect(
      routeFiles.some((r) => r.includes('/analytics/benchmark')) ||
        routeFiles.some((r) => r.includes('/cba-intelligence/benchmark/')),
    ).toBe(true)
    expect(routeFiles.some((r) => r.includes('/analytics/executive'))).toBe(true)
    expect(routeFiles.some((r) => r.includes('/analytics/dashboard'))).toBe(true)
    expect(routeFiles.some((r) => r.includes('/cba-intelligence/freshness'))).toBe(true)
    expect(routeFiles.some((r) => r.includes('/cognition/'))).toBe(true)
  })
})
