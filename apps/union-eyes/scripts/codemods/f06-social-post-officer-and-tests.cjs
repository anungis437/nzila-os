const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.split(a).join(b)
  }
  fs.writeFileSync(f, s)
}
edit('app/api/social-media/posts/route.ts', [
  [`export const POST = withRoleAuth('steward', async (request: NextRequest, context: BaseAuthContext) => {`,
   `// A post goes at once to every connected account of each selected platform in the organization's name, so publishing is an officer's act.
export const POST = withRoleAuth('officer', async (request: NextRequest, context: BaseAuthContext) => {`],
])
fs.writeFileSync('lib/pilot/__tests__/telemetry-scope.test.ts', `import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveTelemetryOrganization } from '../telemetry-scope'

// DEF-0B10-PIL-USAGE-TELEMETRY-ROUTES-READ-ANY-ORGANIZATION-NAMED-IN-THE-QUERY
describe('resolveTelemetryOrganization', () => {
  it('uses the caller\\'s own organization when none is named', () => {
    expect(resolveTelemetryOrganization(null, 'org-1')).toEqual({ organizationId: 'org-1' })
  })

  it('accepts a request that names the caller\\'s own organization', () => {
    expect(resolveTelemetryOrganization('org-1', 'org-1')).toEqual({ organizationId: 'org-1' })
  })

  it('refuses another organization with 403 whether or not it exists', async () => {
    const result = resolveTelemetryOrganization('org-2', 'org-1')
    expect('denied' in result).toBe(true)
    if ('denied' in result) {
      expect(result.denied.status).toBe(403)
      expect(await result.denied.json()).toEqual({ error: 'Forbidden' })
    }
  })

  it('refuses a session with no organization', () => {
    const result = resolveTelemetryOrganization('org-1', undefined)
    expect('denied' in result && result.denied.status).toBe(400)
  })

  it.each(['champions', 'friction', 'metrics', 'readiness'])('pilot/%s derives its organization through the resolver', (route) => {
    const source = readFileSync(join(__dirname, '..', '..', '..', 'app', 'api', 'pilot', route, 'route.ts'), 'utf8')
    expect(source).toContain('resolveTelemetryOrganization(')
    expect(source).not.toMatch(/const orgId = req\\.nextUrl\\.searchParams\\.get\\("organizationId"\\)/)
  })
})
`)
let t = fs.readFileSync('lib/api/__tests__/f10-financial-shape.contract.test.ts', 'utf8').replace(/\r\n/g, '\n')
t = t.replace(/\}\)\n$/, `
  // DEF-0B11-SOC-POST-PUBLISHES-AT-ONCE-TO-EVERY-ACTIVE-ACCOUNT
  it('publishing to the connected social accounts is an officer act and is audited around the publish', () => {
    const source = read('app/api/social-media/posts/route.ts')
    expect(source).toMatch(/export const POST = withRoleAuth\\('officer'/)
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
`)
fs.writeFileSync('lib/api/__tests__/f10-financial-shape.contract.test.ts', t)
console.log('ok')
