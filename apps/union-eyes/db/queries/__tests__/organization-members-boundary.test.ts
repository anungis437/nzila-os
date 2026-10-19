import { beforeEach, describe, expect, it, vi } from 'vitest'

const ORG_A = 'org-a'
const ORG_B = 'org-b'
const ADMIN = 'user-admin-a'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  userHasOrganizationAccess: vi.fn(),
  getUserRole: vi.fn(),
  auditLog: vi.fn(),
  inserts: [] as Array<Record<string, unknown>>,
  updates: [] as Array<Record<string, unknown>>,
  orgs: [] as string[],
  outcomes: [] as string[],
  audits: [] as Array<Record<string, unknown>>,
  auditFails: false,
  selectQueue: [] as unknown[],
}))

function selectChain() {
  const chain: Record<string, unknown> = {}
  for (const method of ['from', 'where', 'orderBy', 'limit', 'for']) chain[method] = () => chain
  chain.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => {
    const value = mocks.selectQueue.length ? mocks.selectQueue.shift() : []
    return Promise.resolve(value).then(resolve, reject)
  }
  return chain
}

function makeTx() {
  return {
    execute: async () => undefined,
    select: () => selectChain(),
    insert: () => ({
      values: (row: Record<string, unknown>) => ({
        returning: async () => {
          mocks.inserts.push(row)
          return [{ id: 'created', ...row }]
        },
      }),
    }),
    update: () => ({
      set: (patch: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => {
            mocks.updates.push(patch)
            return [{ id: 'updated', ...patch }]
          },
        }),
      }),
    }),
    delete: () => {
      throw new Error('hard delete')
    },
  }
}

vi.mock('server-only', () => ({}))
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: mocks.auth }))
vi.mock('@/lib/organization-utils', () => ({ userHasOrganizationAccess: mocks.userHasOrganizationAccess }))
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
    if (mocks.auditFails) throw new Error('Member audit was not persisted')
    mocks.audits.push(input)
  },
}))
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (ctxOrOp: unknown, maybeOp?: unknown) => {
    const hasContext = typeof ctxOrOp !== 'function'
    const operation = (hasContext ? maybeOp : ctxOrOp) as (tx: unknown) => Promise<unknown>
    const organizationId = hasContext ? (ctxOrOp as { organizationId?: string }).organizationId : undefined
    if (!organizationId) throw new Error('organization context required')
    mocks.orgs.push(organizationId)
    const insertMark = mocks.inserts.length
    const updateMark = mocks.updates.length
    try {
      const result = await operation(makeTx())
      mocks.outcomes.push('commit')
      return result
    } catch (error) {
      mocks.inserts.splice(insertMark)
      mocks.updates.splice(updateMark)
      mocks.outcomes.push('rollback')
      throw error
    }
  },
}))

import { authorizeMemberAccess } from '@/lib/member-integrity/authorize-member-access'
import * as q from '../organization-members-queries'

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

beforeEach(() => {
  mocks.inserts.splice(0)
  mocks.updates.splice(0)
  mocks.orgs.splice(0)
  mocks.outcomes.splice(0)
  mocks.audits.splice(0)
  mocks.selectQueue.splice(0)
  mocks.auditFails = false
  vi.clearAllMocks()
  mocks.auditLog.mockResolvedValue(undefined)
})

describe('organization member query grants', () => {
  it('rejects an unregistered grant before writing', async () => {
    const forged = { ok: true as const, userId: ADMIN, organizationId: ORG_A, capability: 'administer' as const }
    await expect(q.createMember({
      organizationId: ORG_A,
      userId: 'new-user',
      name: 'New',
      email: 'new@example.com',
      role: 'member',
    }, forged)).rejects.toThrow('Forbidden')
    expect(mocks.inserts).toEqual([])
    expect(mocks.orgs).toEqual([])
  })

  it('creates a member only for the granted organization and role', async () => {
    asPrincipal(ADMIN, ORG_A, 'admin')
    const administer = await authorizeMemberAccess(ORG_A, 'administer')
    const assign = await authorizeMemberAccess(ORG_A, 'assign_role')
    if (!administer.ok || !assign.ok) throw new Error('expected grants')

    const created = await q.createMember({
      organizationId: ORG_A,
      userId: 'new-user',
      name: 'New',
      email: 'new@example.com',
      role: 'member',
      deletedAt: new Date(),
      id: 'forged-id',
    }, administer)
    expect(created.organizationId).toBe(ORG_A)
    expect(created.role).toBe('member')
    expect(mocks.inserts[0].organizationId).toBe(ORG_A)
    expect(mocks.inserts[0].role).toBe('member')
    expect(mocks.inserts[0].id).toBeUndefined()
    expect(mocks.inserts[0].deletedAt).toBeUndefined()
    expect(mocks.audits[0]).toMatchObject({ operation: 'create', actorUserId: ADMIN })
    expect(JSON.stringify(mocks.audits)).not.toContain('new@example.com')

    await expect(q.createMember({
      organizationId: ORG_B,
      userId: 'other',
      name: 'Other',
      email: 'other@example.com',
      role: 'member',
    }, administer)).rejects.toThrow('Forbidden')
    await expect(q.createMember({
      organizationId: ORG_A,
      userId: 'steward-user',
      name: 'Steward',
      email: 'steward@example.com',
      role: 'steward',
    }, administer)).rejects.toThrow('Forbidden')
    await expect(q.addOrganizationMember({
      organizationId: ORG_A,
      userId: 'officer-user',
      role: 'officer',
      name: 'Officer',
      email: 'officer@example.com',
      grant: assign,
    })).rejects.toThrow('Forbidden')

    const assigned = await q.createMember({
      organizationId: ORG_A,
      userId: 'admin-user',
      name: 'Admin',
      email: 'admin@example.com',
      role: 'admin',
    }, assign)
    expect(assigned.role).toBe('admin')
    expect(mocks.audits.at(-1)).toMatchObject({ operation: 'role_change' })
    expect(mocks.orgs.every((org) => org === ORG_A)).toBe(true)
  })

  it('rejects protected updates and rolls back when audit fails', async () => {
    asPrincipal(ADMIN, ORG_A, 'admin')
    const administer = await authorizeMemberAccess(ORG_A, 'administer')
    if (!administer.ok) throw new Error('expected grant')
    await expect(q.updateMember(ORG_A, 'm1', { role: 'admin' }, administer)).rejects.toThrow('Forbidden')
    await expect(q.updateMember(ORG_A, 'm1', { organizationId: ORG_B }, administer)).rejects.toThrow('Forbidden')
    expect(mocks.updates).toEqual([])

    mocks.selectQueue.push([])
    mocks.selectQueue.push([{ id: 'm1', status: 'active', role: 'member', organizationId: ORG_A }])
    const updated = await q.updateMember(ORG_A, 'm1', { status: 'inactive', name: 'Hidden' }, administer)
    expect(updated?.status).toBe('inactive')
    expect(mocks.audits.at(-1)).toMatchObject({ operation: 'status_change' })
    expect(JSON.stringify(mocks.audits)).not.toContain('Hidden')

    mocks.auditFails = true
    const removal = await authorizeMemberAccess(ORG_A, 'remove_member')
    if (!removal.ok) throw new Error('expected removal grant')
    mocks.selectQueue.push([])
    mocks.selectQueue.push([{ id: 'm1', userId: 'member-user', role: 'member', status: 'active', organizationId: ORG_A }])
    await expect(q.deleteMember(ORG_A, 'm1', removal)).rejects.toThrow('Member audit was not persisted')
    expect(mocks.outcomes).toContain('rollback')
    expect(mocks.updates.filter((patch) => patch.deletedAt)).toEqual([])
  })

  it('returns an existing member without a second insert', async () => {
    asPrincipal(ADMIN, ORG_A, 'admin')
    const administer = await authorizeMemberAccess(ORG_A, 'administer')
    if (!administer.ok) throw new Error('expected grant')
    mocks.selectQueue.push([{ id: 'existing', userId: 'u1', organizationId: ORG_A }])
    const existing = await q.addOrganizationMember({
      organizationId: ORG_A,
      userId: 'u1',
      role: 'member',
      name: 'Ada',
      email: 'ada@example.com',
      grant: administer,
    })
    expect(existing).toMatchObject({ id: 'existing' })
    expect(mocks.inserts).toEqual([])
    expect(mocks.audits).toEqual([])
  })

  it('keeps removal, exemption, and status rules on the query boundary', async () => {
    asPrincipal(ADMIN, ORG_A, 'admin')
    const administer = await authorizeMemberAccess(ORG_A, 'administer')
    const removal = await authorizeMemberAccess(ORG_A, 'remove_member')
    if (!administer.ok || !removal.ok) throw new Error('expected grants')

    await expect(q.createMember({
      organizationId: ORG_A,
      userId: 'exempt-user',
      name: 'Exempt',
      email: 'exempt@example.com',
      role: 'member',
      exemptFromPerCapita: true,
      exemptionApprovedBy: 'forged-approver',
    }, administer)).rejects.toThrow('Forbidden')
    await expect(q.updateMember(ORG_A, 'm1', { exemptionReason: 'hardship' }, administer)).rejects.toThrow('Forbidden')
    await expect(q.updateMember(ORG_A, 'm1', { exemptionApprovedBy: ADMIN }, administer)).rejects.toThrow('Forbidden')
    await expect(q.deleteMember(ORG_A, 'm1', administer)).rejects.toThrow('Forbidden')
    expect(mocks.inserts).toEqual([])
    expect(mocks.updates).toEqual([])

    mocks.selectQueue.push([])
    mocks.selectQueue.push([{ id: 'self', userId: ADMIN, role: 'member', status: 'active', organizationId: ORG_A }])
    await expect(q.deleteMember(ORG_A, 'self', removal)).rejects.toThrow('Forbidden')
    mocks.selectQueue.push([
      { id: 'only-admin', userId: 'other-admin', role: 'admin', status: 'active', deletedAt: null, organizationId: ORG_A },
      { id: 'inactive-admin', userId: 'paused-admin', role: 'admin', status: 'inactive', deletedAt: null, organizationId: ORG_A },
    ])
    mocks.selectQueue.push([{ id: 'only-admin', userId: 'other-admin', role: 'admin', status: 'active', organizationId: ORG_A }])
    await expect(q.deleteMember(ORG_A, 'only-admin', removal)).rejects.toThrow('Forbidden')
    expect(await q.deleteMember(ORG_A, 'missing', removal)).toBe(false)
    expect(mocks.updates.filter((patch) => patch.deletedAt)).toEqual([])

    mocks.selectQueue.push([])
    mocks.selectQueue.push([])
    expect(await q.updateMember(ORG_A, 'missing', { status: 'inactive' }, administer)).toBeUndefined()
    mocks.selectQueue.push([])
    mocks.selectQueue.push([{ id: 'm1', status: 'inactive', role: 'member', organizationId: ORG_A }])
    await expect(q.updateMember(ORG_A, 'm1', { status: 'on-leave' }, administer)).rejects.toThrow('Forbidden')
    expect(mocks.updates).toEqual([])
  })

  it('requires removal authority before deactivating an active administrator', async () => {
    const roster = [
      { id: 'admin-a', userId: 'admin-a-user', role: 'admin', status: 'active', deletedAt: null, organizationId: ORG_A },
      { id: 'admin-b', userId: 'admin-b-user', role: 'admin', status: 'active', deletedAt: null, organizationId: ORG_A },
    ]
    asPrincipal('user-officer-a', ORG_A, 'officer')
    const officer = await authorizeMemberAccess(ORG_A, 'administer')
    if (!officer.ok) throw new Error('expected grant')

    mocks.selectQueue.push(roster)
    mocks.selectQueue.push([{ id: 'admin-a', status: 'active', role: 'admin', organizationId: ORG_A }])
    await expect(q.updateMember(ORG_A, 'admin-a', { status: 'inactive' }, officer)).rejects.toThrow('Forbidden')
    mocks.selectQueue.push(roster)
    mocks.selectQueue.push([{ id: 'admin-b', status: 'active', role: 'admin', organizationId: ORG_A }])
    await expect(q.updateMember(ORG_A, 'admin-b', { status: 'on-leave' }, officer)).rejects.toThrow('Forbidden')
    expect(mocks.updates).toEqual([])
    expect(mocks.audits).toEqual([])

    mocks.selectQueue.push(roster)
    mocks.selectQueue.push([{ id: 'member-1', status: 'active', role: 'member', organizationId: ORG_A }])
    const memberUpdate = await q.updateMember(ORG_A, 'member-1', { status: 'inactive' }, officer)
    expect(memberUpdate?.status).toBe('inactive')

    asPrincipal(ADMIN, ORG_A, 'admin')
    const admin = await authorizeMemberAccess(ORG_A, 'administer')
    if (!admin.ok) throw new Error('expected grant')
    mocks.selectQueue.push(roster)
    mocks.selectQueue.push([{ id: 'admin-a', status: 'active', role: 'admin', organizationId: ORG_A }])
    const deactivated = await q.updateMember(ORG_A, 'admin-a', { status: 'inactive' }, admin)
    expect(deactivated?.status).toBe('inactive')
    expect(mocks.audits.at(-1)).toMatchObject({ operation: 'status_change', actorUserId: ADMIN })
  })
})
