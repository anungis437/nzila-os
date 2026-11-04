import { beforeEach, describe, expect, it, vi } from 'vitest'

const ORG_A = '11111111-1111-4111-8111-111111111111'
const ORG_B = '22222222-2222-4222-8222-222222222222'
const UNIT = '55555555-5555-4555-8555-555555555555'
const scope = {
  ok: true as const,
  userId: 'user-admin-a',
  organizationId: ORG_A,
  capability: 'administer' as const,
  discloseCompensation: false,
}

const mocks = vi.hoisted(() => ({
  queue: [] as unknown[],
  orgs: [] as Array<string | undefined>,
  outcomes: [] as string[],
  sets: [] as unknown[],
  inserted: [] as unknown[],
  loggerError: vi.fn(),
}))

function makeChain() {
  const chain: Record<string, unknown> = {}
  for (const method of ['from', 'where', 'orderBy', 'limit', 'offset', 'returning', '$dynamic']) {
    chain[method] = () => chain
  }
  chain.values = (value: unknown) => {
    mocks.inserted.push(value)
    return chain
  }
  chain.set = (value: unknown) => {
    mocks.sets.push(value)
    return chain
  }
  chain.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => {
    const value = mocks.queue.length ? mocks.queue.shift() : []
    if (value instanceof Error) return Promise.reject(value).then(resolve, reject)
    return Promise.resolve(value).then(resolve, reject)
  }
  return chain
}

function makeTx() {
  return {
    select: () => makeChain(),
    insert: () => makeChain(),
    update: () => makeChain(),
    delete: () => makeChain(),
  }
}

vi.mock('server-only', () => ({}))
vi.mock('@/lib/member-employment/authorize-employment-access', async () => {
  const actual = await vi.importActual<typeof import('@/lib/member-employment/authorize-employment-access')>(
    '@/lib/member-employment/authorize-employment-access',
  )
  return { ...actual, assertRegisteredEmploymentGrant: () => {} }
})
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (contextOrOp: unknown, maybeOp?: unknown) => {
    const hasContext = typeof contextOrOp !== 'function'
    const operation = (hasContext ? maybeOp : contextOrOp) as (tx: unknown) => Promise<unknown>
    const organizationId = hasContext
      ? (contextOrOp as { organizationId?: string }).organizationId
      : undefined
    mocks.orgs.push(organizationId)
    try {
      const result = await operation(makeTx())
      mocks.outcomes.push('commit')
      return result
    } catch (error) {
      mocks.outcomes.push('rollback')
      throw error
    }
  },
}))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: mocks.loggerError, debug: vi.fn() },
}))

import { EmploymentBoundaryError } from '../member-employment-queries'
import * as q from '../member-employment-queries'

function push(...rows: unknown[]) {
  mocks.queue.push(...rows)
}

beforeEach(() => {
  vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '0')
  mocks.queue = []
  mocks.orgs = []
  mocks.outcomes = []
  mocks.sets = []
  mocks.inserted = []
  vi.clearAllMocks()
})

describe('job classification query boundary', () => {
  it('exports only the queries the mounted screen uses', () => {
    expect(Object.keys(q).sort()).toEqual([
      'EmploymentBoundaryError',
      'createJobClassification',
      'getJobClassificationsByOrganization',
      'updateJobClassification',
    ])
  })

  it('creates inside the authorized organization and commits the audit with the row', async () => {
    push([{ id: 'jc1', organizationId: ORG_A, jobCode: 'ELEC-J01' }])
    push([])
    const row = await q.createJobClassification(scope, { organizationId: ORG_A, jobTitle: 'Electrician', jobCode: 'ELEC-J01' } as never)

    expect(row).toMatchObject({ id: 'jc1' })
    expect(mocks.orgs).toEqual([ORG_A])
    expect(mocks.outcomes).toEqual(['commit'])
    expect(mocks.inserted[0]).toMatchObject({ organizationId: ORG_A, createdBy: 'user-admin-a', jobCode: 'ELEC-J01' })
  })

  it('stores the authorized organization even when the payload names none', async () => {
    push([{ id: 'jc1' }])
    push([])
    await q.createJobClassification(scope, { jobTitle: 'Electrician', jobCode: 'ELEC-J01' } as never)

    expect(mocks.inserted[0]).toMatchObject({ organizationId: ORG_A })
  })

  it('rolls back when the audit insert fails, and tells the caller nothing the driver said', async () => {
    push([{ id: 'jc1' }])
    push(new Error('legacy_audit_down'))

    await expect(q.createJobClassification(scope, { organizationId: ORG_A, jobCode: 'ELEC-J01' } as never)).rejects.toThrow(
      'Failed to access member employment',
    )
    expect(mocks.outcomes).toEqual(['rollback'])
    expect(JSON.stringify(mocks.loggerError.mock.calls)).not.toContain('legacy_audit_down')
  })

  it('denies a bargaining unit of another organization and stores nothing', async () => {
    push([])

    await expect(
      q.createJobClassification(scope, { organizationId: ORG_A, jobCode: 'ELEC-J01', bargainingUnitId: UNIT } as never),
    ).rejects.toThrow('Forbidden')
    expect(mocks.inserted).toEqual([])
    expect(mocks.outcomes).toEqual(['rollback'])
  })

  it('does not open a transaction for a forged organization id', async () => {
    await expect(q.createJobClassification(scope, { organizationId: ORG_B, jobCode: 'X' } as never)).rejects.toThrow('Forbidden')
    await expect(q.updateJobClassification(scope, 'jc1', { organizationId: ORG_B })).rejects.toThrow('Forbidden')
    expect(mocks.orgs).toEqual([])
  })

  it('lists the classifications of the authorized organization', async () => {
    push([{ id: 'jc1' }, { id: 'jc2' }])

    expect(await q.getJobClassificationsByOrganization(scope)).toEqual([{ id: 'jc1' }, { id: 'jc2' }])
    expect(await q.getJobClassificationsByOrganization(scope, false)).toEqual([])
    expect(mocks.orgs).toEqual([ORG_A, ORG_A])
  })

  it('reports a failed read instead of an empty list', async () => {
    push(new Error('permission denied for table job_classifications'))

    await expect(q.getJobClassificationsByOrganization(scope)).rejects.toThrow('Failed to access member employment')
    expect(JSON.stringify(mocks.loggerError.mock.calls)).not.toContain('permission denied')
  })

  it('fails an update that matches no classification of the organization', async () => {
    push([])

    await expect(q.updateJobClassification(scope, 'jc1', { jobTitle: 'Lead' })).rejects.toBeInstanceOf(EmploymentBoundaryError)
    expect(mocks.outcomes).toEqual(['rollback'])
  })

  it('fails when a concurrent change leaves the update with no row', async () => {
    push([{ id: 'jc1', organizationId: ORG_A }])
    push([])

    await expect(q.updateJobClassification(scope, 'jc1', { jobTitle: 'Lead' })).rejects.toThrow('Job classification not found')
    expect(mocks.outcomes).toEqual(['rollback'])
  })

  it('never lets an update change the organization, the id or the creator', async () => {
    push([{ id: 'jc1', organizationId: ORG_A }])
    push([{ id: 'jc1', organizationId: ORG_A, jobTitle: 'Lead' }])
    push([])
    await q.updateJobClassification(scope, 'jc1', {
      organizationId: ORG_A,
      id: 'forged',
      createdBy: 'forged',
      jobTitle: 'Lead',
    } as never)

    const patch = mocks.sets.at(-1) as Record<string, unknown>
    expect(patch).toMatchObject({ jobTitle: 'Lead' })
    expect(patch).not.toHaveProperty('organizationId')
    expect(patch).not.toHaveProperty('id')
    expect(patch).not.toHaveProperty('createdBy')
    expect(mocks.outcomes).toEqual(['commit'])
  })

  it('denies a classification move to another organization', async () => {
    await expect(q.updateJobClassification(scope, 'jc1', { organizationId: ORG_B })).rejects.toThrow('Forbidden')
    expect(mocks.orgs).toEqual([])
  })
})
