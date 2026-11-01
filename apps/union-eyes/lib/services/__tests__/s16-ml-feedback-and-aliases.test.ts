import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

describe('Gate 0 batch B72/S10: prediction feedback table, ML query disclosure and alias routes', () => {
  it('records SLA outcomes in an append-only table and never updates model_metadata from the route', () => {
    const route = src('app/api/ml/predictions/sla-breach-risk/feedback/route.ts')
    expect(route).toContain('.insert(mlPredictionFeedback)')
    expect(route).not.toContain('.update(modelMetadata)')
    expect(route).not.toContain('trainingDataQueue')
    expect(route).toContain('consumedBy: null')
    expect(src('db/rls-storage-authority/analytics-ai.ts')).toContain('table: "ml_prediction_feedback"')
  })

  it('records the ML query disclosure before the text leaves, with a digest and the caller\'s own role', () => {
    const route = src('app/api/ml/query/route.ts')
    expect(route.indexOf("action: 'ml.query.external_disclosure'")).toBeLessThan(route.indexOf('await fetch('))
    expect(route).toContain("dataClass: 'confidential'")
    expect(route).toContain('questionSha256')
    expect(route).not.toContain("userRole: 'member'")
    expect(route).not.toContain('logApiAuditEvent')
  })

  it('exports the OCI, intelligence and governance aliases without a local always-true gate', () => {
    for (const path of ['app/api/oci/intake/route.ts', 'app/api/oci/assessment/route.ts', 'app/api/oci/results/[id]/route.ts', 'app/api/oci/report/[assessmentId]/route.ts', 'app/api/intelligence/route.ts', 'app/api/governance/route.ts']) {
      const route = src(path)
      expect(route, path).not.toContain('requireOrgAccess')
      expect(route, path).toMatch(/export \{ (GET|POST)/)
    }
  })

  it('lists a hierarchy branch under the cap and says when it was cut, without a hard-coded security flag', () => {
    const route = src('app/api/organizations/hierarchy/route.ts')
    expect(route).toContain('.limit(MAX_LISTED + 1)')
    expect(route).toContain('truncated')
    expect(route).not.toContain('rls_enabled: true')
  })
})
