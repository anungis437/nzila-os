import { describe, expect, it } from 'vitest'
import { evaluateStrictCoverageFailures } from '../coverage-gate'

describe('decision coverage strict gating', () => {
  it('passes when all strict criteria are satisfied', () => {
    const failures = evaluateStrictCoverageFailures({
      score: 100,
      missingRouteRegistrationsCount: 0,
      missingRouteFilesCount: 0,
      criticalWithoutRouteMappingCount: 0,
      blockWithoutProofCount: 0,
    })

    expect(failures).toEqual([])
  })

  it('fails when score or mandatory constraints are violated', () => {
    const failures = evaluateStrictCoverageFailures({
      score: 90,
      missingRouteRegistrationsCount: 1,
      missingRouteFilesCount: 0,
      criticalWithoutRouteMappingCount: 1,
      blockWithoutProofCount: 1,
    })

    expect(failures.length).toBeGreaterThan(0)
    expect(failures).toContain('Critical route missing registered decision mapping')
    expect(failures).toContain('Registered block-level decision has no critical route mapping')
    expect(failures).toContain('Block-level decision missing proofRequired=true')
    expect(failures.some((failure) => failure.startsWith('Decision coverage score below threshold'))).toBe(true)
  })
})
