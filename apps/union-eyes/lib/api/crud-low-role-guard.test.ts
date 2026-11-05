import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pgTable, text, uuid } from 'drizzle-orm/pg-core'

const getRole = vi.fn()
vi.mock('@/lib/organization-utils', () => ({ getUserRoleInOrganization: (...a: unknown[]) => getRole(...a) }))

import { lowRoleModeFor, resolveLowRoleScope } from './crud-low-role-guard'

const textOwned = pgTable('t_owned', { id: uuid('id').primaryKey(), userId: text('user_id'), email: text('email') })
const uuidOwned = pgTable('t_uuid', { id: uuid('id').primaryKey(), memberId: uuid('member_id') })
const personalNoOwner = pgTable('t_personal', { id: uuid('id').primaryKey(), email: text('email'), phone: text('phone') })
const reference = pgTable('t_ref', { id: uuid('id').primaryKey(), label: text('label') })

describe('crud low-role guard', () => {
  beforeEach(() => getRole.mockReset())

  it('classifies tables', () => {
    expect(lowRoleModeFor(textOwned, false).kind).toBe('own')
    expect(lowRoleModeFor(uuidOwned, false).kind).toBe('own')
    expect(lowRoleModeFor(personalNoOwner, false).kind).toBe('deny')
    expect(lowRoleModeFor(reference, false).kind).toBe('open')
    expect(lowRoleModeFor(personalNoOwner, true).kind).toBe('open')
  })

  it('restricts a member to their own rows and forces the owner on create', async () => {
    getRole.mockResolvedValue('member')
    const scope = await resolveLowRoleScope(lowRoleModeFor(textOwned, false), 'member-1', 'org-1')
    expect(scope.condition).toBeDefined()
    expect(scope.forcedOwner).toEqual({ name: 'userId', value: 'member-1' })
  })

  it('refuses personal tables with no owner column to members', async () => {
    getRole.mockResolvedValue('member')
    await expect(resolveLowRoleScope(lowRoleModeFor(personalNoOwner, false), 'member-1', 'org-1')).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('fails closed for unresolved roles and missing organization', async () => {
    getRole.mockResolvedValue(null)
    await expect(resolveLowRoleScope(lowRoleModeFor(personalNoOwner, false), 'u', 'org-1')).rejects.toBeDefined()
    getRole.mockResolvedValue('admin')
    await expect(resolveLowRoleScope(lowRoleModeFor(personalNoOwner, false), 'u', null)).rejects.toBeDefined()
  })

  it('refuses a uuid owner column when the identity is not a uuid', async () => {
    getRole.mockResolvedValue('member')
    await expect(resolveLowRoleScope(lowRoleModeFor(uuidOwned, false), 'not-a-uuid', 'org-1')).rejects.toBeDefined()
    const ok = await resolveLowRoleScope(lowRoleModeFor(uuidOwned, false), '11111111-1111-4111-8111-111111111111', 'org-1')
    expect(ok.condition).toBeDefined()
  })

  it('leaves staff and open tables untouched', async () => {
    getRole.mockResolvedValue('steward')
    expect(await resolveLowRoleScope(lowRoleModeFor(personalNoOwner, false), 's', 'org-1')).toEqual({})
    getRole.mockResolvedValue('member')
    expect(await resolveLowRoleScope(lowRoleModeFor(reference, false), 'm', 'org-1')).toEqual({})
    expect(getRole).toHaveBeenCalledTimes(1)
  })
})
