import { describe, it, expect, vi } from 'vitest'

// Mock server-only to prevent module resolution failure in test env
vi.mock('server-only', () => ({}))

// Mock DB schema
vi.mock('@nzila/db/schema', () => ({
  governedPolicies: { id: 'id', lifecycleStatus: 'lifecycleStatus', policyFamilyId: 'policyFamilyId' },
  policyGovernanceEvents: {},
}))

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
  and: vi.fn((...args: unknown[]) => args),
  desc: vi.fn((col: unknown) => col),
  asc: vi.fn((col: unknown) => col),
  or: vi.fn((...args: unknown[]) => args),
  inArray: vi.fn((col: unknown, vals: unknown) => ({ col, vals })),
  sql: vi.fn(),
}))

// Mock os-core logger
vi.mock('@nzila/os-core', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// Mock governance events service to avoid circular mocking
vi.mock('../policy-governance-events-service', () => ({
  recordGovernanceEvent: vi.fn().mockResolvedValue({}),
  queryGovernanceEvents: vi.fn().mockResolvedValue({ events: [], total: 0 }),
}))

// Mock policy-integrity
vi.mock('../policy-integrity', async (importOriginal) => {
  const original = await importOriginal<typeof import('../policy-integrity')>()
  return {
    ...original,
    assertIntegrityOrThrow: vi.fn(),
  }
})

// Build a minimal chainable drizzle mock
function buildDbMock(returnRows: unknown[] = []) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(returnRows),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(returnRows).then(resolve),
  }
  return chain
}

import { createPolicyDraft } from '../governed-policy-service'

const BASE_INPUT = {
  policyFamilyId: 'fam-001',
  semver: '1.0.0',
  name: 'Grievance Handling Policy',
  domain: 'governance',
  authorId: 'user-1',
  authorRole: 'admin',
  governanceRationale: 'Required by constitution.',
  riskClassification: 'medium' as const,
  workflowBindings: ['wf-grievance'],
  operationalScope: {},
}

describe('governed-policy-service', () => {
  describe('createPolicyDraft', () => {
    it('returns the created policy row', async () => {
      const expectedRow = { id: 'pol-1', ...BASE_INPUT, lifecycleStatus: 'draft' }
      const db = buildDbMock([expectedRow])

      const result = await createPolicyDraft(BASE_INPUT, 'user-1', db as never)
      expect(result).toMatchObject({ id: 'pol-1', lifecycleStatus: 'draft' })
    })

    it('calls insert on the db', async () => {
      const expectedRow = { id: 'pol-1', ...BASE_INPUT, lifecycleStatus: 'draft' }
      const db = buildDbMock([expectedRow])

      await createPolicyDraft(BASE_INPUT, 'user-1', db as never)
      expect(db.insert).toHaveBeenCalled()
    })
  })

  describe('getPolicyById', () => {
    it('returns null when no rows returned', async () => {
      const db = buildDbMock([])
      const { getPolicyById } = await import('../governed-policy-service')
      const result = await getPolicyById('nonexistent', db as never)
      expect(result).toBeNull()
    })

    it('returns the first row when found', async () => {
      const row = { id: 'pol-1', name: 'Test', lifecycleStatus: 'active' }
      const db = buildDbMock([row])
      const { getPolicyById } = await import('../governed-policy-service')
      const result = await getPolicyById('pol-1', db as never)
      expect(result).toMatchObject({ id: 'pol-1' })
    })
  })
})
