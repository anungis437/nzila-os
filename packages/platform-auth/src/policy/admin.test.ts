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
      limit: vi.fn().mockResolvedValue([{ organizationId: 'org1' }]),
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
})
