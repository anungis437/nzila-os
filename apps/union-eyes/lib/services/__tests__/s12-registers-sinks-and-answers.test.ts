import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

describe('Gate 0 batch B68: registers, sinks and honest answers', () => {
  it('exposes the federation register read-only instead of configuring writes the governance table refuses', () => {
    for (const path of ['app/api/federations/route.ts', 'app/api/federations/[id]/route.ts']) {
      const route = src(path)
      expect(route, path).toContain('export { GET };')
      expect(route, path).not.toMatch(/writeRole|export \{[^}]*(POST|PATCH|DELETE)/)
    }
  })

  it('evaluates the documented `organization` flag type as it does `tenant`', () => {
    const evaluator = src('lib/services/feature-flags.ts')
    expect(evaluator).toMatch(/case 'organization':\n\s+case 'tenant':\n\s+return evaluateOrgFlag/)
  })

  it('answers the platform organization only when its row exists', () => {
    const route = src('app/api/organizations/platform-id/route.ts')
    expect(route).toContain('.from(organizations)')
    expect(route).toContain('is not provisioned')
    expect(route).toContain('platformOrgId: row.id')
  })

  it('requires an explicit years-of-service threshold and says the list is not an eligibility determination', () => {
    const route = src('app/api/pension/retirement-eligibility/route.ts')
    expect(route).not.toContain('.default(25)')
    expect(route).toContain('YEARS_OF_SERVICE_FILTER_NOT_AN_ELIGIBILITY_DETERMINATION')
  })

  it('emits ICRA events as log records and no longer inserts into a table nothing defines', () => {
    const sink = src('lib/icra/observability.ts')
    expect(sink).toContain("logger.info('icra.event'")
    expect(sink).not.toContain('INSERT INTO icra_events')
    expect(sink).not.toContain('buildInsertSql')
  })

  it('does not turn a committed SLA feedback into an error when its pilot event cannot be written', () => {
    expect(src('app/api/ml/predictions/sla-breach-risk/feedback/route.ts')).toContain("sla feedback pilot event was not recorded")
  })

  it('verified: the realtime sweep dedupes per organization, signal and hour and the steward and organization-facade routes are explicit', () => {
    expect(src('services/observability/realtime-alerting-service.ts')).toContain('alertDedupeKey')
    expect(src('app/api/stewards/route.ts')).toContain('export const GET')
    expect(src('app/api/stewards/route.ts')).not.toContain('export const POST')
    for (const path of ['app/api/organizations/[id]/access-logs/route.ts', 'app/api/organizations/[id]/sharing-settings/route.ts']) {
      expect(src(path), path).toContain('status: 501')
      expect(src(path), path).not.toContain('crudRoutes')
    }
  })
})
