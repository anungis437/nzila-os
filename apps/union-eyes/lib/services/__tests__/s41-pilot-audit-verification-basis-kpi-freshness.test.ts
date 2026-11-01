import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

describe('Gate 0 batch B97: pilot write audit, verification basis and KPI freshness', () => {
  it('commits a declared audit row with the locked pilot write', () => {
    const helper = src('lib/pilot/pilot-mutation.ts')
    expect(helper.indexOf('.update(pilotApplications)')).toBeLessThan(helper.indexOf('persistAtomicAudit(tx'))
    for (const [file, action] of [
      ['artifacts', 'pilot.artifact_version.add'],
      ['intelligence', 'pilot.intelligence.add'],
      ['reference-profile', 'pilot.reference_profile.snapshot'],
    ]) {
      expect(src(`app/api/pilot/apply/[id]/${file}/route.ts`)).toContain(`audit: { action: '${action}' }`)
    }
  })

  it('requires and records the basis of an organization verification', () => {
    expect(src('app/api/pilot/apply/[id]/verify-organization/route.ts')).toContain('basis: z.string().trim().min(20).max(1000)')
    const ownership = src('lib/pilot/pilot-ownership.ts')
    expect(ownership).toContain('...(basis ? { basis } : {})')
  })

  it('does not judge a KPI target against a metric row from a long-past period', () => {
    const route = src('app/api/targets/summary/route.ts')
    expect(route).toContain('const MAX_METRIC_AGE_DAYS = 120')
    expect(route).toContain("valueBasis: 'latest_metric_row_of_the_metric_type'")
    expect(route).toContain('stale: Boolean(latestMetric) && !fresh')
  })
})
