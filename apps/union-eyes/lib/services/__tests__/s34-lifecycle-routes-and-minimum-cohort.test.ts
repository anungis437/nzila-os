import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

describe('Gate 0 batch B90: lifecycle routes and the minimum cohort for satisfaction figures', () => {
  it('sets health-safety close dates only through audited, status-conditional transitions', () => {
    const incident = src('app/api/health-safety/incidents/[id]/close/route.ts')
    expect(incident).toContain("inArray(workplaceIncidents.status, ['reported', 'investigating'])")
    expect(incident).toContain('closedDate: sql`now()`')
    expect(incident.indexOf('.returning(')).toBeLessThan(incident.indexOf("action: 'incident.close'"))
    const hazard = src('app/api/health-safety/hazards/[id]/transition/route.ts')
    expect(hazard).toContain('resolutionDate: sql`coalesce(')
    expect(hazard).toContain("action: `hazard.${body.action}`")
    // The generic PATCH still cannot set a status or a date.
    expect(src('app/api/health-safety/incidents/[id]/route.ts')).toContain("blockedPatchFields: ['status', 'closedDate'")
  })

  it('returns no satisfaction figure below the minimum number of completed responses', () => {
    const service = src('lib/services/satisfaction-service.ts')
    expect(service).toContain('export const MIN_RESPONSES_FOR_AVERAGES = 5')
    expect(service).toContain('metrics.totalSurveys < MIN_RESPONSES_FOR_AVERAGES')
    expect(service).toContain('suppressed: true')
  })

  it('gives the SSO provider a change, disable, rotate and delete route that audits without credentials', () => {
    const route = src('app/api/enterprise/sso/providers/[id]/route.ts')
    expect(route).toContain('export const PATCH')
    expect(route).toContain('export const DELETE')
    expect(route).toContain("'sso.provider.rotate_secret'")
    expect(route).toContain('encryptSecret(validated.oidcClientSecret)')
    expect(route).toContain('AUTH_TENANT_ASSIGNABLE_ROLES')
    const manifest = src('db/rls-storage-authority/reference-latent.ts')
    const entry = manifest.slice(manifest.indexOf('table: "sso_providers"'), manifest.indexOf('table: "sso_sessions"'))
    expect(entry).toContain('requiredRuntimePrivileges: ["SELECT", "INSERT", "UPDATE", "DELETE"]')
  })
})
