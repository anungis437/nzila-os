import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveTelemetryOrganization } from '../telemetry-scope'

// DEF-0B10-PIL-USAGE-TELEMETRY-ROUTES-READ-ANY-ORGANIZATION-NAMED-IN-THE-QUERY
describe('resolveTelemetryOrganization', () => {
  it('uses the caller\'s own organization when none is named', () => {
    expect(resolveTelemetryOrganization(null, 'org-1')).toEqual({ organizationId: 'org-1' })
  })

  it('accepts a request that names the caller\'s own organization', () => {
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
    expect(source).not.toMatch(/const orgId = req\.nextUrl\.searchParams\.get\("organizationId"\)/)
  })
})
