import { describe, expect, it } from 'vitest'
import { assuranceDashboardSchema } from './types'

const score = { score: 90, grade: 'A' }
const dashboard = { orgId: 'org-1', generatedAt: '2026-11-02T12:00:00.000Z', compliance: score, security: score, ops: score, cost: score, integrationReliability: score, overallScore: 90, overallGrade: 'A' }

describe('Zod 4 assurance dashboard inputs', () => {
  it('preserves valid org-scoped score projections', () => {
    expect(assuranceDashboardSchema.parse(dashboard).orgId).toBe('org-1')
  })
  it('rejects malformed timestamps and nonnumeric score payloads', () => {
    expect(assuranceDashboardSchema.safeParse({ ...dashboard, generatedAt: 'later' }).success).toBe(false)
    expect(assuranceDashboardSchema.safeParse({ ...dashboard, compliance: { score: '90', grade: 'A' } }).success).toBe(false)
  })
})
