import { beforeEach, describe, expect, it, vi } from 'vitest'

const ORG = '11111111-1111-4111-8111-111111111111'
const grant = {
  ok: true as const,
  userId: 'user-admin-a',
  organizationId: ORG,
  capability: 'administer' as const,
  discloseCompensation: false,
}

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  revalidatePath: vi.fn(),
  loggerError: vi.fn(),
  q: {
    createJobClassification: vi.fn(),
    getJobClassificationsByOrganization: vi.fn(),
    updateJobClassification: vi.fn(),
  },
}))

vi.mock('@/lib/member-employment/authorize-employment-access', () => ({
  authorizeEmploymentAccess: mocks.authorize,
}))
vi.mock('@/db/queries/member-employment-queries', () => ({
  ...mocks.q,
  EmploymentBoundaryError: class EmploymentBoundaryError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'EmploymentBoundaryError'
    }
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/logger', () => ({
  logger: { error: mocks.loggerError, warn: vi.fn(), info: vi.fn() },
}))

import * as actions from '../member-employment-actions'

const CLASSIFICATION = { jobTitle: 'Electrician', jobCode: 'ELEC-J01' }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.authorize.mockResolvedValue(grant)
  for (const fn of Object.values(mocks.q)) fn.mockResolvedValue({ id: 'row' })
  mocks.q.getJobClassificationsByOrganization.mockResolvedValue([{ id: 'row' }])
})

describe('job classification actions', () => {
  it('exports exactly the actions the mounted screen calls', () => {
    expect(Object.keys(actions).sort()).toEqual([
      'createJobClassificationAction',
      'getJobClassificationsByOrganizationAction',
      'updateJobClassificationAction',
    ])
  })

  it('denies unauthenticated and unauthorized calls before a query', async () => {
    mocks.authorize.mockResolvedValue({ ok: false, message: 'Unauthorized' })
    const unauthenticated = await actions.createJobClassificationAction({ organizationId: ORG, ...CLASSIFICATION } as never)
    expect(unauthenticated).toEqual({ isSuccess: false, message: 'Unauthorized' })

    mocks.authorize.mockResolvedValue({ ok: false, message: 'Forbidden' })
    expect(await actions.getJobClassificationsByOrganizationAction(ORG)).toEqual({ isSuccess: false, message: 'Forbidden' })
    expect(await actions.updateJobClassificationAction('c1', { organizationId: ORG } as never)).toEqual({
      isSuccess: false,
      message: 'Forbidden',
    })
    expect(mocks.q.createJobClassification).not.toHaveBeenCalled()
    expect(mocks.q.getJobClassificationsByOrganization).not.toHaveBeenCalled()
    expect(mocks.q.updateJobClassification).not.toHaveBeenCalled()
  })

  it('passes the authorized principal and organization into a permitted write', async () => {
    const result = await actions.createJobClassificationAction({ organizationId: ORG, ...CLASSIFICATION } as never)

    expect(result).toMatchObject({ isSuccess: true, data: { id: 'row' } })
    expect(mocks.authorize).toHaveBeenCalledWith(ORG, 'administer')
    expect(mocks.q.createJobClassification).toHaveBeenCalledWith(grant, expect.objectContaining({ organizationId: ORG }))

    await actions.updateJobClassificationAction('c1', { organizationId: ORG, jobTitle: 'Lead' } as never)
    expect(mocks.q.updateJobClassification).toHaveBeenCalledWith(grant, 'c1', expect.objectContaining({ jobTitle: 'Lead' }))
  })

  it('lists the classifications of the authorized organization, active ones by default', async () => {
    expect(await actions.getJobClassificationsByOrganizationAction(ORG)).toMatchObject({ isSuccess: true, data: [{ id: 'row' }] })
    expect(mocks.q.getJobClassificationsByOrganization).toHaveBeenCalledWith(grant, true)

    await actions.getJobClassificationsByOrganizationAction(ORG, false)
    expect(mocks.q.getJobClassificationsByOrganization).toHaveBeenLastCalledWith(grant, false)
  })

  it('reports a failed read as a failure, never as an empty list', async () => {
    mocks.q.getJobClassificationsByOrganization.mockRejectedValue(new Error('permission denied for table job_classifications'))

    const result = await actions.getJobClassificationsByOrganizationAction(ORG)

    expect(result).toEqual({ isSuccess: false, message: 'Failed to retrieve job classifications' })
    expect(result).not.toHaveProperty('data')
  })

  it('shows the boundary error of the query layer and nothing a driver said', async () => {
    const { EmploymentBoundaryError } = await import('@/db/queries/member-employment-queries')
    mocks.q.updateJobClassification.mockRejectedValueOnce(new EmploymentBoundaryError('Job classification not found'))
    expect(await actions.updateJobClassificationAction('c1', { organizationId: ORG } as never)).toEqual({
      isSuccess: false,
      message: 'Job classification not found',
    })

    mocks.q.createJobClassification.mockRejectedValueOnce(new Error('Failed query: insert into "job_classifications" params: ELEC-J01'))
    const created = await actions.createJobClassificationAction({ organizationId: ORG, ...CLASSIFICATION } as never)
    expect(created).toEqual({ isSuccess: false, message: 'Failed to create job classification' })
    expect(JSON.stringify(mocks.loggerError.mock.calls)).not.toContain('ELEC-J01')
  })

  it('does not revalidate a path: the screen fetches its list on demand', async () => {
    await actions.createJobClassificationAction({ organizationId: ORG, ...CLASSIFICATION } as never)
    await actions.updateJobClassificationAction('c1', { organizationId: ORG } as never)

    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })
})
