import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const APP_ROOT = resolve(__dirname, '..', '..', '..')

function productionFiles(fragment: string): string[] {
  const matches: string[] = []
  function scan(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = join(dir, entry.name)
      const name = relative(APP_ROOT, file).split(sep).join('/')
      if (name.includes('__tests__') || name.includes('.test.') || name.includes('.spec.')) continue
      if (entry.isDirectory()) scan(file)
      else if (entry.isFile() && readFileSync(file).includes(fragment)) matches.push(name)
    }
  }
  for (const dir of ['app', 'lib', 'actions', 'services', 'db']) scan(resolve(APP_ROOT, dir))
  return matches.sort()
}

describe('organization member query importers', () => {
  it('limits production imports to the role lookup', () => {
    const importers = productionFiles('organization-members-queries')
    expect(importers).toEqual(['lib/role-middleware.ts'])
    const source = readFileSync(resolve(APP_ROOT, 'lib/role-middleware.ts'), 'utf8')
    expect(source).toMatch(/import \{ getMemberByUserId \} from "@\/db\/queries\/organization-members-queries"/)
    expect(source).not.toMatch(/\b(createMember|updateMember|deleteMember|addOrganizationMember)\b/)
  })

  it('keeps role assignment on the tenant allow-list and the role-management grant', () => {
    const service = readFileSync(resolve(APP_ROOT, 'lib/services/member-service.ts'), 'utf8')
    const policy = readFileSync(resolve(APP_ROOT, 'lib/member-integrity/authorize-member-access.ts'), 'utf8')
    expect(service).toMatch(/assertTenantAssignableRole/)
    expect(service).toMatch(/assign_role/)
    expect(service).toMatch(/remove_member/)
    expect(service).toMatch(/does not reassign claims, dues, history, or other linked/)
    expect(policy).toMatch(/TENANT_SELF_SERVICE_ASSIGNABLE_ROLES/)
    expect(policy).toMatch(/MEMBER_ROLE_ADMIN_ROLES = \['admin'\]/)
    expect(policy).toMatch(/Permission\.DELETE_MEMBER/)
    const writes = readFileSync(resolve(APP_ROOT, 'lib/member-integrity/member-write-policy.ts'), 'utf8')
    expect(writes).toMatch(/pg_advisory_xact_lock/)
    expect(writes).toMatch(/for\('update'\)/)
    expect(writes).toMatch(/isEffectiveAdministrator/)
    expect(writes).toMatch(/deactivatesEffectiveAdministrator/)
    expect(service).toMatch(/requireAdministratorDeactivationAuthority/)
    const queries = readFileSync(resolve(APP_ROOT, 'db/queries/organization-members-queries.ts'), 'utf8')
    expect(queries).toMatch(/deactivatesEffectiveAdministrator/)
    expect(queries).toMatch(/remove_member/)
  })
})
