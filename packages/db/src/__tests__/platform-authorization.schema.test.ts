import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'
import {
  platformApplicationPermissionGrants,
  platformIdentityBindings,
  platformOrganizationMemberships,
} from '../schema/platform-authorization'

describe('platform authorization schema', () => {
  it('stores canonical provider bindings independently of platform user ids', () => {
    const config = getTableConfig(platformIdentityBindings)
    expect(config.name).toBe('platform_identity_bindings')
    expect(
      config.indexes.some((item) => item.config.name === 'platform_identity_provider_subject_uidx'),
    ).toBe(true)
    expect(config.foreignKeys).toHaveLength(1)
    expect(config.checks.map((item) => item.name)).toContain('platform_identity_state_ck')
  })

  it('models active, invited, suspended, and revoked organization membership states', () => {
    const config = getTableConfig(platformOrganizationMemberships)
    expect(config.name).toBe('platform_organization_memberships')
    expect(config.foreignKeys).toHaveLength(2)
    expect(config.checks.map((item) => item.name)).toContain(
      'platform_org_membership_effective_period_ck',
    )
  })

  it('binds application grants to a same-organization membership and scoped permission', () => {
    const config = getTableConfig(platformApplicationPermissionGrants)
    expect(config.name).toBe('platform_application_permission_grants')
    expect(config.foreignKeys).toHaveLength(1)
    expect(config.checks.map((item) => item.name)).toContain('platform_permission_app_scope_ck')
    expect(config.checks.map((item) => item.name)).toContain(
      'platform_permission_effective_period_ck',
    )
  })

  it('provides an additive, forward-only migration without legacy rewrites', () => {
    const migration = readFileSync(
      fileURLToPath(
        new URL('../../drizzle/0041_platform_authorization_authority.sql', import.meta.url),
      ),
      'utf8',
    )
    expect(migration).toContain('CREATE TABLE "platform_identity_bindings"')
    expect(migration).toContain('CREATE TABLE "platform_organization_memberships"')
    expect(migration).toContain('CREATE TABLE "platform_application_permission_grants"')
    expect(migration).toContain(
      "CHECK (\"state\" IN ('active', 'invited', 'suspended', 'revoked'))",
    )
    expect(migration).toContain('FOREIGN KEY ("membership_id", "organization_id")')
    expect(migration).toContain('WHERE "state" = \'active\';')
    expect(migration).not.toMatch(/\b(?:DROP|UPDATE|DELETE FROM|TRUNCATE)\b/i)
  })
})
