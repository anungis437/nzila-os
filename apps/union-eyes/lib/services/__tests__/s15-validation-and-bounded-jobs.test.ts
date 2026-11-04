import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

describe('Gate 0 batch B71: validated input and bounded jobs', () => {
  it('parses the compliance validation body instead of casting it', () => {
    const route = src('app/api/compliance/validate/route.ts')
    expect(route).toContain('complianceValidateSchema.safeParse(')
    expect(route).toContain('z.enum(COMPLIANCE_JURISDICTIONS)')
    expect(route).toContain('z.array(z.enum(COMPLIANCE_CHECKS))')
    expect(route).toContain("'must be a valid date'")
    expect(route).toContain('.strict()')
    expect(route).not.toContain('as ComplianceRequestBody')
    expect(route).not.toContain('_complianceValidateSchema')
  })

  it('reports intake objects that are past the deletion retry limit instead of leaving them unreported', () => {
    const lifecycle = src('lib/documents/intake-lifecycle.ts')
    expect(lifecycle).toContain('export async function countAbandonedIntakeObjects')
    expect(lifecycle).toContain('abandoned: await countAbandonedIntakeObjects()')
    const cron = src('app/api/cron/document-intake-reaper/route.ts')
    expect(cron).toContain("scope: 'abandoned-objects'")
    expect(cron).toContain('jobResponse(')
  })

  it('works off the location-retention backlog in bounded runs and says when more remains', () => {
    const service = src('services/geofence-privacy-service.ts')
    expect(service).toContain('static readonly RETENTION_MAX_USERS_PER_RUN = 500')
    expect(service).toContain('.limit(cap + 1)')
    expect(service).toContain('return { trackingRecordsDeleted, eventRecordsDeleted, truncated }')
  })

  // contribution_rates is global reference data that only the system role writes (db/rls-storage-authority: SYSTEM_RUNTIME). The finance freeze that had kept
  // this method on the plain handle was lifted in round 57; the behaviour is covered in external-data/__tests__/wage-enrichment-service.test.ts.
  it('writes contribution rates as the system role, with the provider called before the write transaction opens', () => {
    const service = src('lib/services/external-data/wage-enrichment-service.ts')
    const start = service.indexOf('async syncContributionRates')
    expect(start).toBeGreaterThan(0)
    const method = service.slice(start, service.indexOf('async getBenchmarksForCBA', start))
    // The sync log is opened, the rates and their outcome are written, and a failure is recorded, each in a system transaction.
    expect(method).toContain("await withSystemContext(() => this.createSyncLog('statcan', 'api', 'running', { type: 'contributions', year }))")
    expect(method).toContain('await withSystemContext(async (tx) => {')
    expect(method).toContain('await withSystemContext(() => this.updateSyncLog(syncId, {')
    const write = method.indexOf('await withSystemContext(async (tx) => {')
    expect(method.indexOf('getEIContributionRates(')).toBeLessThan(write)
    expect(method.indexOf('getCPPContributionRates(')).toBeLessThan(write)
    // No statement of the method is on the plain handle.
    expect(method).not.toMatch(/\bdb\.(select|insert|update|delete|transaction)\(/)
  })

  it('verified: a realtime alert is addressed to the organization\'s active administrators and records no recipient when there is none', () => {
    const service = src('services/observability/realtime-alerting-service.ts')
    expect(service).toContain("ALERT_RECIPIENT_ROLES = ['admin', 'president']")
    expect(service).toContain('userId: recipient.userId')
    expect(service).toContain("errorMessage: 'No active administrator to notify'")
    expect(service).not.toContain("userId: 'system:observability-alerts'")
  })
})
