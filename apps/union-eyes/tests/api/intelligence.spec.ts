import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { collectCriticalRouteInventory, rel } from './_qa-route-inventory'

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
})
