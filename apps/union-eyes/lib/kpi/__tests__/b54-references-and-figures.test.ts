import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { computeKpiHealth, kpiLowerIsBetter } from '@/lib/kpi/health'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('B54 KPI health follows the direction the thresholds state (DEF-0B12-PLT-KPI-HEALTH-TREATS-A-LOWER-FIGURE-AS-WORSE-FOR-EVERY-TARGET)', () => {
  it('keeps higher-is-better behaviour for thresholds below the target', () => {
    expect(computeKpiHealth(95, 90, 70, 50)).toBe('on_track')
    expect(computeKpiHealth(65, 90, 70, 50)).toBe('at_risk')
    expect(computeKpiHealth(40, 90, 70, 50)).toBe('critical')
  })

  it('judges a lower-is-better target the other way round', () => {
    expect(kpiLowerIsBetter(5, 8, 12)).toBe(true)
    expect(computeKpiHealth(3, 5, 8, 12)).toBe('on_track')
    expect(computeKpiHealth(9, 5, 8, 12)).toBe('at_risk')
    expect(computeKpiHealth(14, 5, 8, 12)).toBe('critical')
  })

  it('reports no data for a missing or non-finite value or target', () => {
    expect(computeKpiHealth(null, 5, 8, 12)).toBe('no_data')
    expect(computeKpiHealth(Number.NaN, 5, 8, 12)).toBe('no_data')
    expect(computeKpiHealth(5, null, 8, 12)).toBe('no_data')
  })

  it('is used by the summary route', () => {
    const route = read('app/api/targets/summary/route.ts')
    expect(route).toContain('computeKpiHealth(')
    expect(route).not.toContain('function computeHealth')
  })
})

describe('B54 references and figures', () => {
  it('verifies the proposals and clause a tentative agreement names (DEF-0B3-TENTATIVE-AGREEMENT-REFERENCES-UNVERIFIED)', () => {
    const route = read('app/api/bargaining/tentative-agreements/route.ts')
    expect(route).toContain('z.array(z.guid()).max(50)')
    expect(route).toContain('eq(bargainingProposals.negotiationId, negotiationId)')
    expect(route).toContain("throw ApiError.notFound('relatedProposalIds')")
    expect(route).toContain('assertOriginalClauseOwned(tx, fields.relatedClauseId, organizationId)')
  })

  it('gives staff the organization filings on the collection, as the item route does (DEF-0B4-OHS-FILINGS-OWNER-FILTER-INCONSISTENT)', () => {
    expect(read('app/api/cnesst/filings/route.ts')).toContain('staffReadsAll: true')
  })

  it('reports unmeasured compliance rates as null, not 100 or 0 (DEF-0B6-CMP-LEADERSHIP-COMPLIANCE-DEFAULTS-TO-100, DEF-0B8-HS-UNMEASURED-VALUES-COERCED-TO-ZERO)', () => {
    const service = read('lib/services/dashboard-kpi-service.ts')
    expect(service).toContain('* 100) : null,')
    expect(service).not.toMatch(/documentedAlertCount \/ alertRows\.length\) \* 100\) : 100/)
    expect(read('app/api/health-safety/inspections/findings/route.ts')).toContain('Number(row.score_percentage) : null')
  })

  it('demotes the previous primary contact in the same transaction (DEF-0B6-EMP-CONTACT-PRIMARY-NOT-EXCLUSIVE)', () => {
    const route = read('app/api/employers/communications/contacts/route.ts')
    const demote = route.indexOf('set({ isPrimary: false')
    expect(demote).toBeGreaterThan(0)
    expect(demote).toBeLessThan(route.indexOf('.insert(employerContacts)'))
  })

  it('declares no owner column the table lacks on the preventive-withdrawal and refusal collections (DEF-0B5-OHS-OWNER-COLUMN-WORKERID-ABSENT, verified existing implementation)', () => {
    for (const route of ['app/api/cnesst/preventive-withdrawals/route.ts', 'app/api/cnesst/right-of-refusal/route.ts']) {
      expect(read(route), route).not.toContain('ownerColumn')
    }
  })

  it('verifies the calendar of a new event against the organization and the owner of a personal calendar (DEF-0B4-CALENDAR-EVENT-CALENDAR-ID-UNVERIFIED, verified existing implementation)', () => {
    const route = read('app/api/calendar/events/route.ts')
    expect(route).toContain('eq(calendars.organizationId, organizationId)')
    expect(route).toContain('calendar.isPersonal && calendar.ownerId !== userId')
  })
})
