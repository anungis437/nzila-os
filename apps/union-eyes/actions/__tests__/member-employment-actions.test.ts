import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { canonicalActionScope, ACTION_ORG, ACTION_ACTOR } from './fixtures/canonical-action-scope'
import { UserRole } from '@/lib/auth/roles'
import { assertRegisteredEmploymentGrant } from '@/lib/member-employment/authorize-employment-access'
vi.mock('server-only', () => ({}))
const port = vi.hoisted(() => ({ create: vi.fn(), list: vi.fn(), update: vi.fn() }))
vi.mock('@/db/queries/member-employment-queries', async (original) => ({
  ...(await original<typeof import('@/db/queries/member-employment-queries')>()),
  createJobClassification: port.create,
  getJobClassificationsByOrganization: port.list,
  updateJobClassification: port.update,
}))
// Audit sink only; membership, role and sealed grant decisions remain real.
vi.mock('@/lib/audit-logger', async (original) => ({
  ...(await original<typeof import('@/lib/audit-logger')>()),
  auditLog: vi.fn(),
}))
import * as actions from '../member-employment-actions'
const input = { organizationId: ACTION_ORG, jobTitle: 'Electrician', jobCode: 'ELEC-J01' }
beforeEach(() => {
  process.env.UE_CANONICAL_BOOTSTRAP_V2 = '1'
  vi.clearAllMocks()
  port.create.mockImplementation(async (grant) => {
    assertRegisteredEmploymentGrant(grant)
    return { id: 'classification' }
  })
  port.list.mockImplementation(async (grant) => {
    assertRegisteredEmploymentGrant(grant)
    return [{ id: 'classification' }]
  })
  port.update.mockImplementation(async (grant) => {
    assertRegisteredEmploymentGrant(grant)
    return { id: 'classification' }
  })
})
afterEach(() => {
  delete process.env.UE_CANONICAL_BOOTSTRAP_V2
})
describe('classification actions consume actual canonical organizational authority', () => {
  it('preserves the three mounted actions', () => {
    expect(Object.keys(actions).sort()).toEqual([
      'createJobClassificationAction',
      'getJobClassificationsByOrganizationAction',
      'updateJobClassificationAction',
    ])
  })
  it('passes a real sealed principal/org grant to the supported classification writer', async () => {
    const result = await canonicalActionScope(() => actions.createJobClassificationAction(input), {
      role: UserRole.ADMIN,
    })
    expect(result).toMatchObject({ isSuccess: true, data: { id: 'classification' } })
    expect(port.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: ACTION_ACTOR,
        organizationId: ACTION_ORG,
        capability: 'administer',
        discloseCompensation: false,
      }),
      input,
    )
  })
  it('retains the list filter and supported update semantics', async () => {
    await canonicalActionScope(
      () => actions.getJobClassificationsByOrganizationAction(ACTION_ORG, false),
      { role: UserRole.ADMIN },
    )
    expect(port.list).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ACTION_ORG }),
      false,
    )
    const update = { organizationId: ACTION_ORG, jobTitle: 'Lead electrician' }
    await canonicalActionScope(
      () => actions.updateJobClassificationAction('classification', update),
      { role: UserRole.ADMIN },
    )
    expect(port.update).toHaveBeenCalledWith(
      expect.objectContaining({ userId: ACTION_ACTOR }),
      'classification',
      update,
    )
  })
  it('refuses foreign organization substitution before any query', async () => {
    const foreign = '22222222-2222-4222-8222-222222222222'
    expect(
      await canonicalActionScope(
        () => actions.createJobClassificationAction({ ...input, organizationId: foreign }),
        { role: UserRole.ADMIN },
      ),
    ).toMatchObject({ isSuccess: false, message: 'Forbidden' })
    expect(port.create).not.toHaveBeenCalled()
  })
  it('does not turn an ordinary member into an employment administrator', async () => {
    expect(
      await canonicalActionScope(() =>
        actions.getJobClassificationsByOrganizationAction(ACTION_ORG),
      ),
    ).toMatchObject({ isSuccess: false, message: 'Forbidden' })
    expect(port.list).not.toHaveBeenCalled()
  })
  it('refuses expired canonical authority before effects', async () => {
    expect(
      await canonicalActionScope(() => actions.createJobClassificationAction(input), {
        role: UserRole.ADMIN,
        expiresAt: new Date(0),
      }),
    ).toMatchObject({ isSuccess: false })
    expect(port.create).not.toHaveBeenCalled()
  })
  it('reports a read outage truthfully and never returns an empty success', async () => {
    port.list.mockRejectedValueOnce(new Error('private database diagnosis'))
    expect(
      await canonicalActionScope(
        () => actions.getJobClassificationsByOrganizationAction(ACTION_ORG),
        { role: UserRole.ADMIN },
      ),
    ).toEqual({ isSuccess: false, message: 'Failed to retrieve job classifications' })
  })
})
