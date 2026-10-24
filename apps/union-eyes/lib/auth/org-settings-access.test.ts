import { describe, expect, it } from 'vitest'
import { canManageOrganizationSettings } from './org-settings-access'

describe('canManageOrganizationSettings', () => {
  it.each(['admin', 'system_admin', 'app_owner', 'support_agent', 'platform_lead'])('allows %s', (role) => {
    expect(canManageOrganizationSettings(role)).toBe(true)
  })

  it.each([
    'member', 'steward', 'chief_steward', 'officer', 'president', 'vice_president',
    'secretary_treasurer', 'clerk', 'bargaining_committee', 'health_safety_rep', 'guest',
  ])('denies %s', (role) => {
    expect(canManageOrganizationSettings(role)).toBe(false)
  })

  it('denies unknown, empty and missing roles', () => {
    expect(canManageOrganizationSettings('totally_unknown')).toBe(false)
    expect(canManageOrganizationSettings('')).toBe(false)
    expect(canManageOrganizationSettings(null)).toBe(false)
    expect(canManageOrganizationSettings(undefined)).toBe(false)
  })
})
