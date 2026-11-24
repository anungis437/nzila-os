/**
 * Tests for the admin org-auth-policy validator.
 *
 * Focus is the pure validation surface (bad input → useful error) rather
 * than the DB upsert path, which is exercised indirectly via the route
 * + service integration.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSelect, mockInsert, mockUpdate } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
}))

vi.mock('@nzila/db/client', () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  },
}))
vi.mock('../auth-db', () => ({
  authDb: { select: mockSelect, insert: mockInsert, update: mockUpdate },
  withTenantAuthContext: (_user: string, _org: string, work: () => Promise<unknown>) => work(),
  withAuthSavepoint: (work: () => Promise<unknown>) => work(),
  insertAuthRow: vi.fn(),
}))

vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm')
  return { ...actual, relations: vi.fn(() => ({})) }
})

vi.mock('@nzila/db/schema', () => ({
  authOrgPolicies: {
    organizationId: 'organizationId',
    allowLocalAuth: 'allowLocalAuth',
    mfaRequiredForRoles: 'mfaRequiredForRoles',
    allowedEmailDomains: 'allowedEmailDomains',
  },
  authAuditLog: {},
}))

vi.mock('./service', () => ({
  getOrgAuthPolicy: vi.fn().mockResolvedValue({
    organizationId: 'org1',
    allowLocalAuth: true,
    allowMagicLink: true,
    allowSso: true,
    requireSso: false,
    requireInvite: false,
    passwordResetAllowed: true,
    allowedEmailDomains: [],
    mfaRequiredForRoles: [],
  }),
}))

import { updateOrgAuthPolicy } from './admin'
import { getOrgAuthPolicy } from './service'

describe('updateOrgAuthPolicy — validation', () => {
  beforeEach(() => {
    mockSelect.mockReset()
    mockInsert.mockReset()
    mockUpdate.mockReset()
  })

  it('rejects requireSso=true while allowSso=false', async () => {
    const r = await updateOrgAuthPolicy({
      organizationId: 'org1',
      actorUserId: 'actor1',
      patch: { requireSso: true, allowSso: false },
    })
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/require SSO/i)
  })

  it('rejects invalid email domain characters', async () => {
    const r = await updateOrgAuthPolicy({
      organizationId: 'org1',
      actorUserId: 'actor1',
      patch: { allowedEmailDomains: ['bad@!domain'] },
    })
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/Invalid email domain/i)
  })

  it('rejects unknown roles in mfaRequiredForRoles', async () => {
    const r = await updateOrgAuthPolicy({
      organizationId: 'org1',
      actorUserId: 'actor1',
      patch: { mfaRequiredForRoles: ['ceo'] },
    })
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/Invalid role: ceo/)
  })

  it('accepts a valid patch — no upsert path checked here, just non-error', async () => {
    // select returns "row exists" so we take the update branch
    const fromChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      for: vi.fn().mockResolvedValue([{ organizationId: 'org1' }]),
    }
    mockSelect.mockReturnValueOnce(fromChain)
    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    }
    mockUpdate.mockReturnValueOnce(updateChain)
    mockInsert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    })

    const r = await updateOrgAuthPolicy({
      organizationId: 'org1',
      actorUserId: 'actor1',
      patch: {
        allowLocalAuth: false,
        mfaRequiredForRoles: ['admin', 'platform_admin'],
        allowedEmailDomains: ['example.com'],
      },
    })
    expect(r.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalledTimes(1)
  })

  it('fails the update when the audit record cannot be written, so the change rolls back', async () => {
    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      for: vi.fn().mockResolvedValue([{ organizationId: 'org1' }]),
    })
    mockUpdate.mockReturnValueOnce({ set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(undefined) })
    mockInsert.mockReturnValue({ values: vi.fn().mockRejectedValue(new Error('audit down')) })

    await expect(
      updateOrgAuthPolicy({ organizationId: 'org1', actorUserId: 'actor1', patch: { allowLocalAuth: false } }),
    ).rejects.toThrow('audit down')
  })

  const row = (locked = vi.fn().mockResolvedValue([{ organizationId: 'org1' }])) => ({
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    for: locked,
  })
  const stored = {
    organizationId: 'org1', allowLocalAuth: true, allowMagicLink: true, allowSso: true, requireSso: false, requireInvite: false,
    passwordResetAllowed: true, allowedEmailDomains: ['example.com'], mfaRequiredForRoles: ['admin'],
  }
  const expected = { ...stored } as Omit<typeof stored, 'organizationId'> & { organizationId?: string }
  delete expected.organizationId

  it('locks the policy row for update before it reads the policy it compares, audits and writes', async () => {
    const locked = vi.fn().mockResolvedValue([{ organizationId: 'org1' }])
    mockSelect.mockReturnValueOnce(row(locked))
    mockUpdate.mockReturnValueOnce({ set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(undefined) })
    mockInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) })
    await updateOrgAuthPolicy({ organizationId: 'org1', actorUserId: 'actor1', patch: { allowLocalAuth: false } })
    expect(locked).toHaveBeenCalledWith('update')
  })

  it('writes nothing and reports a conflict when the stored policy is no longer the one the caller read', async () => {
    vi.mocked(getOrgAuthPolicy).mockResolvedValueOnce({ ...stored, allowMagicLink: false })
    mockSelect.mockReturnValueOnce(row())
    const r = await updateOrgAuthPolicy({ organizationId: 'org1', actorUserId: 'actor1', patch: { allowLocalAuth: false }, expected })
    expect(r).toMatchObject({ success: false, conflict: true })
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it.each([
    ['a changed domain list', { allowedEmailDomains: ['other.org'] }],
    ['a changed role list', { mfaRequiredForRoles: [] }],
    ['a changed flag', { requireInvite: true }],
  ])('treats %s as a conflict', async (_name, change) => {
    vi.mocked(getOrgAuthPolicy).mockResolvedValueOnce({ ...stored, ...change })
    mockSelect.mockReturnValueOnce(row())
    const r = await updateOrgAuthPolicy({ organizationId: 'org1', actorUserId: 'actor1', patch: { allowLocalAuth: false }, expected })
    expect(r.conflict).toBe(true)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('applies the update when the stored policy still matches what the caller read, ignoring list order and domain case', async () => {
    vi.mocked(getOrgAuthPolicy)
      .mockResolvedValueOnce({ ...stored, allowedEmailDomains: ['Example.com'], mfaRequiredForRoles: ['admin'] })
      .mockResolvedValueOnce({ ...stored, allowLocalAuth: false })
    mockSelect.mockReturnValueOnce(row())
    const set = vi.fn().mockReturnThis()
    mockUpdate.mockReturnValueOnce({ set, where: vi.fn().mockResolvedValue(undefined) })
    mockInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) })
    const r = await updateOrgAuthPolicy({ organizationId: 'org1', actorUserId: 'actor1', patch: { allowLocalAuth: false }, expected })
    expect(r).toMatchObject({ success: true, policy: { allowLocalAuth: false } })
    expect(mockUpdate).toHaveBeenCalledTimes(1)
  })

  it('rejects a patch that requires SSO when the stored policy has SSO disabled', async () => {
    vi.mocked(getOrgAuthPolicy).mockResolvedValueOnce({ ...stored, allowSso: false })
    mockSelect.mockReturnValueOnce(row())
    const r = await updateOrgAuthPolicy({ organizationId: 'org1', actorUserId: 'actor1', patch: { requireSso: true } })
    expect(r).toMatchObject({ success: false, error: expect.stringMatching(/require SSO/i) })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('stores domains lower-case, trimmed and without duplicates, and roles without duplicates', async () => {
    vi.mocked(getOrgAuthPolicy).mockResolvedValue({ ...stored })
    mockSelect.mockReturnValueOnce(row())
    const set = vi.fn().mockReturnThis()
    mockUpdate.mockReturnValueOnce({ set, where: vi.fn().mockResolvedValue(undefined) })
    mockInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) })
    await updateOrgAuthPolicy({
      organizationId: 'org1', actorUserId: 'actor1',
      patch: { allowedEmailDomains: ['Example.COM', 'example.com', ' other.org'.trim()], mfaRequiredForRoles: ['admin', 'admin'] },
    })
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ allowedEmailDomains: ['example.com', 'other.org'], mfaRequiredForRoles: ['admin'] }))
  })
})
