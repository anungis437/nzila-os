import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

describe('Gate 0 batch B103: organization selection is audited before it takes effect', () => {
  it('records the selection before the session is rebound or the preference is set', () => {
    const canonical = src('lib/auth/canonical-organization-selection.ts')
    expect(canonical.indexOf('await recordOrganizationSelection(')).toBeGreaterThan(-1)
    expect(canonical.indexOf('await recordOrganizationSelection(')).toBeLessThan(canonical.indexOf('await rebindSessionOrganization('))
  })

  it('records the legacy selection, names a platform administrator, and refuses when the record cannot be written', () => {
    const route = src('app/api/organizations/switch/route.ts')
    expect(route).toContain("isAdmin ? 'platform_administrator' : 'membership'")
    expect(route.indexOf('recordOrganizationSelection({')).toBeLessThan(route.indexOf('success: true'))
    expect(route).toContain('status: 503')
  })

  it('writes the record through the atomic audit, attributed to the selected organization and the actor', () => {
    const helper = src('lib/auth/organization-selection-audit.ts')
    expect(helper).toContain('persistAtomicAudit(')
    expect(helper).toContain("action: 'organization.select'")
  })
})
