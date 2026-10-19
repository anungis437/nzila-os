import { beforeEach, describe, expect, it, vi } from 'vitest'

const ORG_A = 'org-a'
const ORG_B = 'org-b'
const ADMIN = 'user-admin-a'
const OFFICER = 'user-officer-a'
const MEMBER_USER = 'user-member-a'

const mocks = vi.hoisted(() => {
  const state = {
    rows: [] as Array<Record<string, unknown>>,
    orgs: [] as string[],
    outcomes: [] as string[],
    audits: [] as Array<Record<string, unknown>>,
    auditFails: false,
    failUpdateId: null as string | null,
    hardDeletes: 0,
  }
  const auth = vi.fn()
  const userHasOrganizationAccess = vi.fn()
  const getUserRole = vi.fn()
  const auditLog = vi.fn()

  function matches(cond: { _type?: string; parts?: unknown[]; col?: string; val?: unknown } | undefined, row: Record<string, unknown>): boolean {
    if (!cond) return true
    if (cond._type === 'and') return (cond.parts ?? []).every((part) => matches(part as typeof cond, row))
    if (cond._type === 'or') return (cond.parts ?? []).some((part) => matches(part as typeof cond, row))
    if (cond._type === 'eq') return row[cond.col ?? ''] === cond.val
    if (cond._type === 'inArray') return Array.isArray(cond.val) && cond.val.includes(row[cond.col ?? ''])
    if (cond._type === 'isNullDeleted') return row.deletedAt == null
    if (cond._type === 'like') {
      const raw = String(cond.val ?? '')
      const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*')
      return new RegExp(`^${escaped}$`, 'i').test(String(row[cond.col ?? ''] ?? ''))
    }
    return false
  }

  function select(shape?: { count?: unknown }) {
    const counting = Boolean(shape && Object.prototype.hasOwnProperty.call(shape, 'count'))
    let filtered = state.rows
    const chain = {
      from() { return chain },
      where(cond: unknown) {
        filtered = state.rows.filter((row) => matches(cond as Parameters<typeof matches>[0], row))
        if (counting) return Promise.resolve([{ count: filtered.length }])
        return chain
      },
      orderBy() { return chain },
      limit() { return chain },
      offset() { return Promise.resolve(filtered.map((row) => ({ ...row }))) },
      then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) {
        return Promise.resolve(filtered.map((row) => ({ ...row }))).then(resolve, reject)
      },
    }
    return chain
  }

  const db = {
    query: {
      organizationMembers: {
        findFirst: async ({ where }: { where: unknown }) =>
          state.rows.find((row) => matches(where as Parameters<typeof matches>[0], row)),
      },
    },
    select,
    insert() {
      return {
        values(data: Record<string, unknown>) {
          return {
            returning: async () => {
              const row = { id: data.id ?? `m-${state.rows.length + 1}`, status: 'active', deletedAt: null, ...data }
              state.rows.push(row)
              return [{ ...row }]
            },
          }
        },
      }
    },
    update() {
      return {
        set(patch: Record<string, unknown>) {
          return {
            where(cond: unknown) {
              return {
                returning: async () => {
                  const matched = state.rows.filter((row) => matches(cond as Parameters<typeof matches>[0], row))
                  if (state.failUpdateId && matched.some((row) => row.id === state.failUpdateId)) return []
                  for (const row of matched) Object.assign(row, patch)
                  return matched.map((row) => ({ ...row }))
                },
              }
            },
          }
        },
      }
    },
    delete() {
      state.hardDeletes += 1
      throw new Error('hard delete')
    },
  }

  return { state, db, auth, userHasOrganizationAccess, getUserRole, auditLog }
})

vi.mock('@/db/db', () => ({ db: mocks.db }))
vi.mock('@/db/schema', () => ({
  organizationMembers: {
    id: 'id',
    userId: 'userId',
    organizationId: 'organizationId',
    membershipNumber: 'membershipNumber',
    name: 'name',
    email: 'email',
    phone: 'phone',
    status: 'status',
    role: 'role',
    department: 'department',
    position: 'position',
    hireDate: 'hireDate',
    unionJoinDate: 'unionJoinDate',
    deletedAt: 'deletedAt',
    createdAt: 'createdAt',
  },
}))
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    eq: (col: string, val: unknown) => ({ _type: 'eq', col, val }),
    and: (...parts: unknown[]) => ({ _type: 'and', parts }),
    or: (...parts: unknown[]) => ({ _type: 'or', parts }),
    gte: (col: string, val: unknown) => ({ _type: 'gte', col, val }),
    lte: (col: string, val: unknown) => ({ _type: 'lte', col, val }),
    desc: (col: string) => col,
    asc: (col: string) => col,
    like: (col: string, val: unknown) => ({ _type: 'like', col, val }),
    sql: Object.assign(() => ({ _type: 'isNullDeleted' }), { raw: () => ({ _type: 'isNullDeleted' }) }),
    inArray: (col: string, val: unknown) => ({ _type: 'inArray', col, val }),
    count: () => 'count',
  }
})
vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (ctxOrOp: unknown, maybeOp?: unknown) => {
    const hasContext = typeof ctxOrOp !== 'function'
    const operation = (hasContext ? maybeOp : ctxOrOp) as (tx: unknown) => Promise<unknown>
    const organizationId = hasContext ? (ctxOrOp as { organizationId?: string }).organizationId : undefined
    if (!organizationId) throw new Error('organization context required')
    mocks.state.orgs.push(organizationId)
    const snapshot = mocks.state.rows.map((row) => ({ ...row }))
    try {
      const result = await operation(mocks.db)
      mocks.state.outcomes.push('commit')
      return result
    } catch (error) {
      mocks.state.rows.splice(0, mocks.state.rows.length, ...snapshot)
      mocks.state.outcomes.push('rollback')
      throw error
    }
  },
}))
vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: mocks.auth }))
vi.mock('@/lib/organization-utils', () => ({
  userHasOrganizationAccess: mocks.userHasOrganizationAccess,
}))
vi.mock('@/lib/api-auth-guard', () => ({
  getUserRole: mocks.getUserRole,
  normalizeRole: (role: string) => (role === 'super_admin' ? 'admin' : role),
  PLATFORM_ELEVATED_ROLES: ['system_admin', 'app_owner', 'national_officer'],
}))
vi.mock('@/lib/audit-logger', () => ({
  auditLog: mocks.auditLog,
  AuditEventType: { AUTHORITY_VIOLATION: 'authority.violation' },
  AuditSeverity: { HIGH: 'error' },
}))
vi.mock('@/lib/member-integrity/durable-member-audit', () => ({
  persistDurableMemberAudit: async (_tx: unknown, input: Record<string, unknown>) => {
    if (mocks.state.auditFails) throw new Error('Member audit was not persisted')
    mocks.state.audits.push(input)
  },
}))

import {
  bulkUpdateMemberRole,
  bulkUpdateMemberStatus,
  createMember,
  deleteMember,
  getMemberById,
  listMembers,
  mergeMembers,
  permanentlyDeleteMember,
  readOwnMemberStatus,
  searchMembers,
  updateMember,
} from '@/lib/services/member-service'
import { rolePermitsMemberAdmin, rolePermitsMemberRemoval, rolePermitsMemberRoleAdmin } from '../authorize-member-access'
import { hasPermission, Permission, UserRole } from '@/lib/auth/roles'

function asPrincipal(userId: string, organizationId: string, role: string) {
  mocks.auth.mockResolvedValue({ userId })
  mocks.userHasOrganizationAccess.mockImplementation(async (candidate: string, org: string) => {
    return candidate === userId && org === organizationId
  })
  mocks.getUserRole.mockImplementation(async (candidate: string, org: string) => {
    if (candidate !== userId || org !== organizationId) return null
    return role
  })
}

function seed(partial: Record<string, unknown>) {
  const row = {
    id: 'm1',
    userId: 'member-user',
    organizationId: ORG_A,
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '555-0100',
    role: 'member',
    status: 'active',
    deletedAt: null,
    membershipNumber: 'MEM-1',
    department: 'Field',
    ...partial,
  }
  mocks.state.rows.push(row)
  return row
}

beforeEach(() => {
  mocks.state.rows.splice(0)
  mocks.state.orgs.splice(0)
  mocks.state.outcomes.splice(0)
  mocks.state.audits.splice(0)
  mocks.state.auditFails = false
  mocks.state.failUpdateId = null
  mocks.state.hardDeletes = 0
  vi.clearAllMocks()
  mocks.auditLog.mockResolvedValue(undefined)
})

describe('member role policy', () => {
  it('denies platform roles and the legacy super_admin alias', () => {
    expect(rolePermitsMemberAdmin('admin')).toBe(true)
    expect(rolePermitsMemberAdmin('president')).toBe(true)
    expect(rolePermitsMemberAdmin('officer')).toBe(true)
    expect(rolePermitsMemberAdmin('member')).toBe(false)
    expect(rolePermitsMemberAdmin('super_admin')).toBe(false)
    expect(rolePermitsMemberAdmin('system_admin')).toBe(false)
    expect(rolePermitsMemberRoleAdmin('admin')).toBe(true)
    expect(rolePermitsMemberRoleAdmin('officer')).toBe(false)
    expect(rolePermitsMemberRoleAdmin('super_admin')).toBe(false)
  })

  it('follows DELETE_MEMBER and withholds removal from other administer roles', () => {
    const denied = [
      UserRole.OFFICER,
      UserRole.UNION_REP,
      UserRole.PRESIDENT,
      UserRole.VICE_PRESIDENT,
      UserRole.SECRETARY_TREASURER,
    ]
    for (const role of denied) {
      expect(hasPermission(role, Permission.DELETE_MEMBER)).toBe(false)
      expect(rolePermitsMemberRemoval(role)).toBe(false)
    }
    expect(hasPermission(UserRole.ADMIN, Permission.DELETE_MEMBER)).toBe(true)
    expect(rolePermitsMemberRemoval('admin')).toBe(true)
    expect(hasPermission(UserRole.SYSTEM_ADMIN, Permission.DELETE_MEMBER)).toBe(true)
    expect(rolePermitsMemberRemoval('system_admin')).toBe(false)
  })
})

describe('member administration boundary', () => {
  it('onboards and searches inside the authorized organization', async () => {
    asPrincipal(ADMIN, ORG_A, 'admin')
    seed({ id: 'existing', userId: 'other-user', name: 'Existing', email: 'existing@example.com' })
    const created = await createMember({
      organizationId: ORG_A,
      userId: 'new-user',
      name: 'New Member',
      email: 'new@example.com',
      role: 'member',
    })
    expect(created.organizationId).toBe(ORG_A)
    expect(created.role).toBe('member')
    expect(created.deletedAt).toBeNull()
    const found = await searchMembers(ORG_A, 'New')
    expect(found.members.map((member) => member.id)).toEqual([created.id])
    expect(found.total).toBe(1)
    expect(mocks.state.audits[0]).toMatchObject({ operation: 'create', organizationId: ORG_A })
    expect(JSON.stringify(mocks.state.audits)).not.toContain('new@example.com')
    expect(JSON.stringify(mocks.state.audits)).not.toContain('New Member')
  })

  it('keeps organization A from reading or listing organization B', async () => {
    asPrincipal(ADMIN, ORG_A, 'admin')
    seed({ id: 'a-member', name: 'Shared Name' })
    seed({ id: 'b-member', organizationId: ORG_B, userId: 'b-user', name: 'Shared Name', email: 'b@example.com' })
    expect(await getMemberById(ORG_A, 'b-member')).toBeNull()
    const listed = await listMembers(ORG_A, { searchQuery: 'Shared' })
    expect(listed.members.map((member) => member.id)).toEqual(['a-member'])
    await expect(getMemberById(ORG_B, 'b-member')).rejects.toThrow('Forbidden')
    await expect(listMembers(ORG_A, { organizationId: ORG_B })).rejects.toThrow('Forbidden')
    expect(mocks.state.orgs.every((org) => org === ORG_A)).toBe(true)
  })

  it('denies an unauthenticated caller and a forged organization', async () => {
    mocks.auth.mockResolvedValue({ userId: null })
    await expect(getMemberById(ORG_A, 'm1')).rejects.toThrow('Unauthorized')
    asPrincipal(ADMIN, ORG_A, 'admin')
    await expect(getMemberById('   ', 'm1')).rejects.toThrow('Forbidden')
    expect(mocks.state.orgs).toEqual([])
  })

  it('denies role escalation by an officer, a member, and a platform role', async () => {
    asPrincipal(OFFICER, ORG_A, 'officer')
    seed({ id: 'm-role', userId: 'role-user' })
    await expect(createMember({
      organizationId: ORG_A,
      userId: 'steward-user',
      name: 'Steward',
      email: 'steward@example.com',
      role: 'steward',
    })).rejects.toThrow('Forbidden')
    await expect(bulkUpdateMemberRole(ORG_A, ['m-role'], 'admin')).rejects.toThrow('Forbidden')
    await expect(bulkUpdateMemberRole(ORG_A, ['m-role'], 'system_admin')).rejects.toThrow('Forbidden')
    expect(mocks.state.rows.find((row) => row.id === 'm-role')?.role).toBe('member')

    asPrincipal(MEMBER_USER, ORG_A, 'member')
    await expect(updateMember(ORG_A, 'm-role', { name: 'Changed' })).rejects.toThrow('Forbidden')

    asPrincipal(ADMIN, ORG_A, 'super_admin')
    await expect(getMemberById(ORG_A, 'm-role')).rejects.toThrow('Forbidden')
    asPrincipal(ADMIN, ORG_A, 'system_admin')
    await expect(getMemberById(ORG_A, 'm-role')).rejects.toThrow('Forbidden')
  })

  it('rejects protected identity, ownership, and role fields on update', async () => {
    asPrincipal(ADMIN, ORG_A, 'admin')
    seed({ id: 'm-protected', userId: 'protected-user' })
    await expect(updateMember(ORG_A, 'm-protected', { role: 'admin' })).rejects.toThrow('Forbidden')
    await expect(updateMember(ORG_A, 'm-protected', { organizationId: ORG_B })).rejects.toThrow('Forbidden')
    await expect(updateMember(ORG_A, 'm-protected', { userId: 'other-user' })).rejects.toThrow('Forbidden')
    await expect(updateMember(ORG_A, 'm-protected', { deletedAt: new Date() })).rejects.toThrow('Forbidden')
    const row = mocks.state.rows.find((item) => item.id === 'm-protected')
    expect(row).toMatchObject({ role: 'member', organizationId: ORG_A, userId: 'protected-user', deletedAt: null })
    expect(mocks.state.audits).toEqual([])
  })

  it('rolls back a cross-tenant bulk status update', async () => {
    asPrincipal(ADMIN, ORG_A, 'admin')
    seed({ id: 'a1', status: 'active' })
    seed({ id: 'b1', organizationId: ORG_B, userId: 'b-user', status: 'active' })
    await expect(bulkUpdateMemberStatus(ORG_A, ['a1', 'b1'], 'inactive')).rejects.toThrow('Forbidden')
    expect(mocks.state.rows.find((row) => row.id === 'a1')?.status).toBe('active')
    expect(mocks.state.rows.find((row) => row.id === 'b1')?.status).toBe('active')
    expect(mocks.state.outcomes).toEqual(['rollback'])
    expect(mocks.state.audits).toEqual([])
  })

  it('soft-deletes and retains the row', async () => {
    asPrincipal(ADMIN, ORG_A, 'admin')
    seed({ id: 'm-soft' })
    expect(await deleteMember(ORG_A, 'm-soft')).toBe(true)
    expect(mocks.state.rows).toHaveLength(1)
    expect(mocks.state.rows[0].deletedAt).toBeInstanceOf(Date)
    expect(await getMemberById(ORG_A, 'm-soft')).toBeNull()
    expect(mocks.state.audits.map((audit) => audit.operation)).toEqual(['soft_delete'])
    expect(mocks.state.hardDeletes).toBe(0)
  })

  it('refuses hard deletion for an administrator', async () => {
    asPrincipal(ADMIN, ORG_A, 'admin')
    seed({ id: 'm-keep' })
    await expect(permanentlyDeleteMember(ORG_A, 'm-keep')).rejects.toThrow('retained')
    expect(mocks.state.rows).toHaveLength(1)
    expect(mocks.state.hardDeletes).toBe(0)
    expect(mocks.state.audits).toEqual([])
  })

  it('detects a duplicate and rolls a merge back when the duplicate update misses', async () => {
    asPrincipal(ADMIN, ORG_A, 'admin')
    seed({ id: 'primary', userId: 'primary-user', name: 'Primary', membershipNumber: 'MEM-P' })
    seed({ id: 'duplicate', userId: 'duplicate-user', name: 'Duplicate', membershipNumber: 'MEM-D' })
    await expect(createMember({
      organizationId: ORG_A,
      userId: 'primary-user',
      name: 'Again',
      email: 'again@example.com',
      membershipNumber: 'MEM-NEW',
    })).rejects.toThrow('Member already exists')
    expect(mocks.state.rows).toHaveLength(2)

    mocks.state.failUpdateId = 'duplicate'
    await expect(mergeMembers(ORG_A, 'primary', 'duplicate', 'duplicate')).rejects.toThrow('not found')
    expect(mocks.state.rows.find((row) => row.id === 'primary')?.name).toBe('Primary')
    expect(mocks.state.rows.find((row) => row.id === 'duplicate')?.deletedAt).toBeNull()
    expect(mocks.state.outcomes).toContain('rollback')
    expect(mocks.state.audits).toEqual([])
  })

  it('rolls the merge back when the durable audit fails', async () => {
    asPrincipal(ADMIN, ORG_A, 'admin')
    seed({ id: 'primary', userId: 'primary-user', name: 'Primary' })
    seed({ id: 'duplicate', userId: 'duplicate-user', name: 'Duplicate', email: 'dup@example.com' })
    mocks.state.auditFails = true
    await expect(mergeMembers(ORG_A, 'primary', 'duplicate', 'duplicate')).rejects.toThrow('Failed to merge members')
    expect(mocks.state.rows.find((row) => row.id === 'primary')?.name).toBe('Primary')
    expect(mocks.state.rows.find((row) => row.id === 'duplicate')?.deletedAt).toBeNull()
    expect(mocks.state.outcomes).toEqual(['rollback'])
  })

  it('returns null for a missing member and an empty bulk request', async () => {
    asPrincipal(ADMIN, ORG_A, 'admin')
    expect(await updateMember(ORG_A, 'missing', { name: 'Nope' })).toBeNull()
    expect(await deleteMember(ORG_A, 'missing')).toBe(false)
    expect(await bulkUpdateMemberStatus(ORG_A, [], 'inactive')).toEqual({ success: true, processed: 0, failed: 0 })
    await expect(mergeMembers(ORG_A, 'same', 'same', 'primary')).rejects.toThrow('Forbidden')
    expect(mocks.state.audits).toEqual([])
  })

  it('denies removal to every administer role that lacks DELETE_MEMBER', async () => {
    seed({ id: 'm-keep', userId: 'member-user' })
    seed({ id: 'm-dup', userId: 'dup-user' })
    for (const role of ['officer', 'union_rep', 'president', 'vice_president', 'secretary_treasurer']) {
      asPrincipal(OFFICER, ORG_A, role)
      await expect(deleteMember(ORG_A, 'm-keep')).rejects.toThrow('Forbidden')
      await expect(mergeMembers(ORG_A, 'm-keep', 'm-dup', 'primary')).rejects.toThrow('Forbidden')
    }
    expect(mocks.state.rows[0].deletedAt).toBeNull()
    expect(mocks.state.audits).toEqual([])
    expect(mocks.state.hardDeletes).toBe(0)
  })

  it('denies self-removal and removal of the final administrator', async () => {
    asPrincipal(ADMIN, ORG_A, 'admin')
    seed({ id: 'self', userId: ADMIN, role: 'member' })
    await expect(deleteMember(ORG_A, 'self')).rejects.toThrow('Forbidden')
    expect(mocks.state.rows.find((row) => row.id === 'self')?.deletedAt).toBeNull()

    seed({ id: 'only-admin', userId: 'other-admin', role: 'admin' })
    await expect(deleteMember(ORG_A, 'only-admin')).rejects.toThrow('Forbidden')
    expect(mocks.state.rows.find((row) => row.id === 'only-admin')?.deletedAt).toBeNull()

    seed({ id: 'second-admin', userId: 'second-admin', role: 'admin' })
    expect(await deleteMember(ORG_A, 'only-admin')).toBe(true)
    expect(mocks.state.rows.find((row) => row.id === 'only-admin')?.deletedAt).toBeInstanceOf(Date)
    expect(mocks.state.rows.find((row) => row.id === 'second-admin')?.deletedAt).toBeNull()
    expect(mocks.state.outcomes).toContain('rollback')
  })

  it('does not remove a member that belongs to another organization', async () => {
    asPrincipal(ADMIN, ORG_A, 'admin')
    seed({ id: 'foreign', organizationId: ORG_B, userId: 'foreign-user' })
    expect(await deleteMember(ORG_A, 'foreign')).toBe(false)
    expect(mocks.state.rows.find((row) => row.id === 'foreign')?.deletedAt).toBeNull()
    expect(mocks.state.audits).toEqual([])
  })

  it('rolls a soft delete back when the durable audit fails', async () => {
    asPrincipal(ADMIN, ORG_A, 'admin')
    seed({ id: 'm-audit', userId: 'member-user' })
    mocks.state.auditFails = true
    await expect(deleteMember(ORG_A, 'm-audit')).rejects.toThrow('Failed to delete member')
    expect(mocks.state.rows.find((row) => row.id === 'm-audit')?.deletedAt).toBeNull()
    expect(mocks.state.outcomes).toEqual(['rollback'])
    expect(mocks.state.audits).toEqual([])
  })

  it('rejects financial exemption writes on create, update, and duplicate suppression', async () => {
    asPrincipal(ADMIN, ORG_A, 'admin')
    seed({ id: 'primary', userId: 'primary-user', name: 'Primary', status: 'active' })
    seed({
      id: 'duplicate',
      userId: 'duplicate-user',
      name: 'Duplicate',
      status: 'active',
      exemptFromPerCapita: true,
      exemptionReason: 'forged',
      exemptionApprovedBy: 'forged-approver',
    })
    await expect(createMember({
      organizationId: ORG_A,
      userId: 'exempt-user',
      name: 'Exempt',
      email: 'exempt@example.com',
      role: 'member',
      exemptFromPerCapita: true,
      exemptionApprovedBy: 'forged-approver',
    })).rejects.toThrow('Forbidden')
    await expect(updateMember(ORG_A, 'primary', { exemptFromPerCapita: false })).rejects.toThrow('Forbidden')
    await expect(updateMember(ORG_A, 'primary', { exemptionReason: 'hardship' })).rejects.toThrow('Forbidden')
    await expect(updateMember(ORG_A, 'primary', { exemptionApprovedBy: ADMIN })).rejects.toThrow('Forbidden')

    const merged = await mergeMembers(ORG_A, 'primary', 'duplicate', 'duplicate')
    expect(merged.name).toBe('Duplicate')
    expect(merged.exemptFromPerCapita).toBeUndefined()
    expect(merged.exemptionApprovedBy).toBeUndefined()
    expect(mocks.state.rows.find((row) => row.id === 'primary')).toMatchObject({
      name: 'Duplicate',
      status: 'active',
    })
    expect(mocks.state.rows.find((row) => row.id === 'primary')?.exemptFromPerCapita).toBeUndefined()
    expect(mocks.state.rows.find((row) => row.id === 'primary')?.exemptionApprovedBy).toBeUndefined()
    expect(mocks.state.rows.find((row) => row.id === 'duplicate')?.deletedAt).toBeInstanceOf(Date)
    expect(mocks.state.rows.filter((row) => row.userId === 'exempt-user')).toEqual([])
  })

  it('rejects invalid, duplicate, stale, and unsupported bulk status changes atomically', async () => {
    asPrincipal(ADMIN, ORG_A, 'admin')
    seed({ id: 'live', status: 'active' })
    seed({ id: 'left', status: 'inactive' })
    seed({ id: 'gone', status: 'active', deletedAt: new Date() })
    seed({ id: 'foreign', organizationId: ORG_B, userId: 'foreign-user', status: 'active' })

    await expect(bulkUpdateMemberStatus(ORG_A, ['live'], 'suspended')).rejects.toThrow('Forbidden')
    await expect(bulkUpdateMemberStatus(ORG_A, ['live', 'live'], 'inactive')).rejects.toThrow('Forbidden')
    await expect(bulkUpdateMemberStatus(ORG_A, ['gone'], 'inactive')).rejects.toThrow('Forbidden')
    await expect(bulkUpdateMemberStatus(ORG_A, ['left'], 'on-leave')).rejects.toThrow('Forbidden')
    await expect(bulkUpdateMemberStatus(ORG_A, ['live', 'foreign'], 'inactive')).rejects.toThrow('Forbidden')

    expect(mocks.state.rows.find((row) => row.id === 'live')?.status).toBe('active')
    expect(mocks.state.rows.find((row) => row.id === 'left')?.status).toBe('inactive')
    expect(mocks.state.rows.find((row) => row.id === 'foreign')?.status).toBe('active')
    expect(mocks.state.audits).toEqual([])
    expect(mocks.state.outcomes).toContain('rollback')

    mocks.state.auditFails = true
    const failed = await bulkUpdateMemberStatus(ORG_A, ['live'], 'inactive')
    expect(failed.success).toBe(false)
    expect(mocks.state.rows.find((row) => row.id === 'live')?.status).toBe('active')
    expect(mocks.state.outcomes.filter((outcome) => outcome === 'rollback').length).toBeGreaterThan(1)
  })

  it('lets a session read only its own active membership', async () => {
    asPrincipal(MEMBER_USER, ORG_A, 'member')
    seed({ id: 'self', userId: MEMBER_USER, status: 'active' })
    seed({ id: 'other', userId: 'someone-else', organizationId: ORG_B })
    expect(await readOwnMemberStatus(MEMBER_USER, ORG_A)).toBe(true)
    expect(await readOwnMemberStatus('someone-else', ORG_A)).toBe(false)
    expect(await readOwnMemberStatus(MEMBER_USER, ORG_B)).toBe(false)
    mocks.state.rows[0].status = 'inactive'
    expect(await readOwnMemberStatus(MEMBER_USER, ORG_A)).toBe(false)
  })
})
