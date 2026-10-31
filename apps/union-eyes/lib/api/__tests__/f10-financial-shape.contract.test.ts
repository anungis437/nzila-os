import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (relative: string) => readFileSync(join(__dirname, '..', '..', '..', relative), 'utf8')

describe('F09/F10 rate limits, cancellation contract and financial record shape', () => {
  // DEF-0B10-PEN-PENSION-ROUTES-APPLY-NO-RATE-LIMIT
  it.each(['app/api/pension/plans/route.ts', 'app/api/pension/members/route.ts', 'app/api/pension/plans/[id]/route.ts'])(
    '%s limits every financial write',
    (route) => {
      const source = read(route)
      const writes = source.match(/withApi\(\s*\{[^}]*?\n\s*auth: \{ required: true, roles: PENSION_ADMIN_ROLES \}[\s\S]*?openapi:/g) ?? []
      expect(writes.length).toBeGreaterThan(0)
      for (const write of writes) expect(write).toContain('rateLimit: RATE_LIMITS.FINANCIAL_WRITE')
    },
  )

  // DEF-0B3-EXTERNAL-INVOICES-WRITE-ADVERTISED
  it('an external invoice cannot be created by hand and says so with 501', () => {
    const source = read('app/api/billing/invoices/route.ts')
    const post = source.slice(source.indexOf('export const POST ='), source.indexOf('export const GET ='))
    expect(post).toContain('ApiError.notImplemented(')
    expect(post).not.toContain('insert(')
  })

  // DEF-0B11-PRP-REDEMPTIONS-POST-IS-NAMED-FOR-INITIATION-BUT-CANCELS-AND-DISCARDS-THE-VALIDATED-BODY
  it('the redemption cancel path validates a cancellation and uses the validated id', () => {
    const source = read('app/api/rewards/redemptions/route.ts')
    const post = source.slice(source.indexOf('export const POST ='))
    expect(post).toContain('cancelRedemptionSchema')
    expect(post).not.toContain('initiateRedemptionSchema')
    expect(post).not.toContain("searchParams.get('id')")
    expect(post).toContain('validated.redemptionId')
  })

  // DEF-0B6-EMP-REMITTANCE-PACKAGE-SHAPE
  it('the remittance CSV neutralises the uploaded employee id and groups count contributing members', () => {
    const source = read('app/api/employer-execution/remittance-runs/route.ts')
    expect(source).toContain('csvCell(row.employeeExternalId)')
    expect(source).not.toContain('memberCount: items.length.toString()')
    expect(source).toContain('memberCount: item.members.toString()')
  })

  // DEF-0B11-SOC-POST-PUBLISHES-AT-ONCE-TO-EVERY-ACTIVE-ACCOUNT
  it('publishing to the connected social accounts is an officer act and is audited around the publish', () => {
    const source = read('app/api/social-media/posts/route.ts')
    expect(source).toMatch(/export const POST = withRoleAuth\('officer'/)
    expect(source).toContain('performAuditedOperation(')
  })

  // DEF-0B8-JUR-GEOFENCE-GET-STORES-MEMBER-COORDINATES-WITHOUT-A-CONSENT-CHECK
  it('a geofence entry stores a position only after the consent and configuration checks', () => {
    const source = read('services/geofence-privacy-service.ts')
    const entry = source.slice(source.indexOf('static async checkGeofenceEntry'))
    expect(entry.indexOf('hasValidConsent(')).toBeGreaterThan(0)
    expect(entry.indexOf('hasValidConsent(')).toBeLessThan(entry.indexOf('logGeofenceEvent('))
    expect(entry.indexOf('locationTrackingEnabled')).toBeLessThan(entry.indexOf('logGeofenceEvent('))
  })
})
