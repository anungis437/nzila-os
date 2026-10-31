import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('S6 verified and small fixes', () => {
  it('counts a completion as a registration marked completed, not as attendance (DEF-0B6-EDU-CONTENT-COMPLETIONS-COUNT-ATTENDED)', () => {
    for (const route of ['app/api/content/training/route.ts', 'app/api/content/stats/route.ts']) {
      const source = read(route)
      expect(source, route).toContain('cr.completed IS TRUE')
      expect(source, route).not.toContain('cr.attended IS TRUE')
    }
  })

  it('records every AI model invocation through the audited operation wrapper (DEF-0B2-AI-INVOCATION-NOT-AUDITED, verified existing implementation)', () => {
    for (const route of ['classify', 'summarize', 'match-precedents', 'search']) {
      const source = read(`app/api/ai/${route}/route.ts`)
      expect(source, route).toContain('performAuditedOperation({')
      expect(source, route).toContain('operationAuditResponse(error)')
    }
  })

  it('does not write from a consent check: expiry is a read (DEF-0B8-JUR-LOCATION-CONSENT-GET-EXPIRES-THE-CONSENT-AS-A-SIDE-EFFECT)', () => {
    const service = read('services/geofence-privacy-service.ts')
    expect(service).not.toContain('this.expireConsent')
    const check = service.slice(service.indexOf('static async hasValidConsent'), service.indexOf('static async trackLocation'))
    expect(check).not.toContain('.update(')
    expect(check).toContain('return false')
  })

  it('shows a private report definition to its author only (DEF-0B7-EXP-REPORT-DEFINITIONS-READABLE-AT-MEMBER-FLOOR)', () => {
    for (const route of ['app/api/reports/route.ts', 'app/api/reports/[id]/route.ts']) {
      const source = read(route)
      expect(source, route).toContain("readRole: 'steward'")
      expect(source, route).toContain('or(eq(reports.isPublic, true), eq(reports.createdBy, userId))')
    }
    const factory = read('lib/api/crud-factory.ts')
    expect(factory.match(/opts\.readConditionFor\?\.\(/g)).toHaveLength(2)
  })

  it('answers 501 for the support figures and the security-event writer that never existed as described (verified existing implementation and new)', () => {
    for (const route of ['app/api/support/metrics/route.ts', 'app/api/support/sla/route.ts', 'app/api/security/events/route.ts']) {
      const source = read(route)
      expect(source, route).toContain('ApiError.notImplemented')
      expect(source, route).not.toContain('crudRoutes')
    }
  })

  it('does not invent a department or position for a member, and does not log or branch on e-mail addresses in the organizations list (verified existing implementation)', () => {
    for (const route of ['app/api/organization/members/route.ts', 'app/api/organization/members/search/route.ts']) {
      const source = read(route)
      expect(source, route).not.toContain('Union Member')
      expect(source, route).not.toContain("'Administration'")
    }
    const orgs = read('app/api/organizations/route.ts')
    expect(orgs).not.toContain('PLATFORM_ADMIN_USER_IDS')
    expect(orgs).not.toContain('userEmail')
  })

  it('records the real span of what a retention run deleted, not the run time', () => {
    const service = read('services/geofence-privacy-service.ts')
    expect(service).toContain('oldestRecordDate: oldest ?? now')
    expect(service).toContain('newestRecordDate: newest ?? now')
    expect(service).toContain('at: locationTracking.recordedAt')
    expect(service).toContain('at: geofenceEvents.eventTime')
  })
})
