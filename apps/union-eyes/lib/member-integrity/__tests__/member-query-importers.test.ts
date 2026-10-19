import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const APP_ROOT = resolve(__dirname, '..', '..', '..')

function productionFiles(fragment: string): string[] {
  let out = ''
  try {
    out = execFileSync('grep', ['-rl', fragment, 'app', 'lib', 'actions', 'services', 'db'], {
      cwd: APP_ROOT,
      encoding: 'utf8',
    })
  } catch (err: unknown) {
    const execErr = err as { status?: number; stdout?: string }
    if (execErr.status === 1) return []
    out = execErr.stdout ?? ''
  }
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => !file.includes('__tests__') && !file.includes('.test.') && !file.includes('.spec.'))
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
  })
})
