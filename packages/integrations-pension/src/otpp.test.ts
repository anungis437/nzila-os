import { describe, it, expect } from 'vitest'
import {
  otppMemberRecordSchema,
  otppContributionRecordSchema,
  mapOtppMember,
  mapOtppContribution,
  createOtppClient,
  type OtppMemberRecord,
  type OtppContributionRecord,
  type OtppTransport,
} from './otpp'
import * as pensionIndex from './index'

// ── Fixtures ────────────────────────────────────────────────────────────────

const memberRecord: OtppMemberRecord = {
  memberNumber: 'M-1001',
  firstName: 'Jane',
  lastName: 'Doe',
  planCode: 'OTPP-DB',
  enrolmentDate: '2010-09-01',
  status: 'A',
  creditedService: 14.5,
  pensionableSalary: 95000,
}

const contributionRecord: OtppContributionRecord = {
  memberNumber: 'M-1001',
  planCode: 'OTPP-DB',
  periodStartDate: '2025-01-01',
  periodEndDate: '2025-01-31',
  employeeContribution: 882.50,
  employerContribution: 882.50,
  pensionableEarnings: 7916.67,
  contributionType: 'regular',
}

// ── Schema tests ────────────────────────────────────────────────────────────

describe('otppMemberRecordSchema', () => {
  it('parses a valid member record', () => {
    const result = otppMemberRecordSchema.parse(memberRecord)
    expect(result.memberNumber).toBe('M-1001')
    expect(result.status).toBe('A')
  })

  it('rejects invalid status codes', () => {
    expect(() =>
      otppMemberRecordSchema.parse({ ...memberRecord, status: 'X' }),
    ).toThrow()
  })

  it('accepts null nullable fields', () => {
    const result = otppMemberRecordSchema.parse({
      ...memberRecord,
      firstName: null,
      lastName: null,
      creditedService: null,
      pensionableSalary: null,
    })
    expect(result.firstName).toBeNull()
  })
})

describe('otppContributionRecordSchema', () => {
  it('parses a valid contribution record', () => {
    const result = otppContributionRecordSchema.parse(contributionRecord)
    expect(result.employeeContribution).toBe(882.50)
  })
})

// ── Mapping tests ───────────────────────────────────────────────────────────

describe('mapOtppMember', () => {
  it('maps to PensionMember with correct fields', () => {
    const result = mapOtppMember(memberRecord, 'plan-1')
    expect(result).toEqual({
      externalId: 'M-1001',
      provider: 'OTPP',
      employeeId: 'M-1001',
      employeeName: 'Jane Doe',
      planId: 'plan-1',
      membershipNumber: 'M-1001',
      memberStatus: 'active',
      enrollmentDate: '2010-09-01',
      creditedService: 14.5,
      pensionableSalary: 95000,
    })
  })

  it.each([
    ['A', 'active'],
    ['D', 'deferred'],
    ['R', 'retired'],
    ['T', 'terminated'],
    ['S', 'suspended'],
  ] as const)('maps status %s → %s', (code, expected) => {
    const rec = { ...memberRecord, status: code }
    expect(mapOtppMember(rec, 'p').memberStatus).toBe(expected)
  })

  it('handles null name fields', () => {
    const rec = { ...memberRecord, firstName: null, lastName: null }
    expect(mapOtppMember(rec, 'p').employeeName).toBeUndefined()
  })

  it('handles partial name', () => {
    const rec = { ...memberRecord, firstName: null, lastName: 'Smith' }
    expect(mapOtppMember(rec, 'p').employeeName).toBe('Smith')
  })

  it('maps null numeric fields to undefined', () => {
    const rec = { ...memberRecord, creditedService: null, pensionableSalary: null }
    const mapped = mapOtppMember(rec, 'p')
    expect(mapped.creditedService).toBeUndefined()
    expect(mapped.pensionableSalary).toBeUndefined()
  })

  it('falls back to active for unknown status values', () => {
    const rec = { ...memberRecord, status: 'X' as unknown as OtppMemberRecord['status'] }
    expect(mapOtppMember(rec, 'p').memberStatus).toBe('active')
  })
})

describe('mapOtppContribution', () => {
  it('maps to PensionContribution', () => {
    const result = mapOtppContribution(contributionRecord)
    expect(result).toEqual({
      externalId: 'M-1001-2025-01-01',
      provider: 'OTPP',
      memberId: 'M-1001',
      planId: 'OTPP-DB',
      contributionType: 'employee_regular',
      periodStart: '2025-01-01',
      periodEnd: '2025-01-31',
      employeeAmount: 882.50,
      employerAmount: 882.50,
      pensionableEarnings: 7916.67,
      status: 'posted',
    })
  })

  it('handles null pensionableEarnings', () => {
    const rec = { ...contributionRecord, pensionableEarnings: null }
    expect(mapOtppContribution(rec).pensionableEarnings).toBeUndefined()
  })
})

// ── Client factory test ─────────────────────────────────────────────────────

describe('createOtppClient', () => {
  const transport: OtppTransport = {
    fetchMemberFile: async () => [memberRecord],
    fetchContributionFile: async () => [contributionRecord],
  }

  it('returns a client with OTPP provider', () => {
    const client = createOtppClient(transport)
    expect(client.provider).toBe('OTPP')
  })

  it('fetchPlans returns static OTPP plan metadata', async () => {
    const client = createOtppClient(transport)
    const plans = await client.fetchPlans('org1')
    expect(plans).toHaveLength(1)
    expect(plans[0]!.planName).toBe("Ontario Teachers' Pension Plan")
    expect(plans[0]!.planType).toBe('defined_benefit')
  })

  it('fetchMembers maps via transport', async () => {
    const client = createOtppClient(transport)
    const members = await client.fetchMembers('org1', 'plan-1')
    expect(members).toHaveLength(1)
    expect(members[0]!.memberStatus).toBe('active')
  })

  it('fetchContributions filters by memberId', async () => {
    const client = createOtppClient(transport)
    const contribs = await client.fetchContributions('org1', 'M-1001')
    expect(contribs).toHaveLength(1)

    const none = await client.fetchContributions('org1', 'M-9999')
    expect(none).toHaveLength(0)
  })

  it('healthCheck returns ok', async () => {
    const client = createOtppClient(transport)
    const health = await client.healthCheck()
    expect(health.ok).toBe(true)
  })

  it('fetchEstimates returns empty list', async () => {
    const client = createOtppClient(transport)
    const estimates = await client.fetchEstimates('org1', 'M-1001')
    expect(estimates).toEqual([])
  })
})

describe('barrel and schema exports', () => {
  it('exposes runtime exports via package index', () => {
    expect(pensionIndex.createOtppClient).toBe(createOtppClient)
    expect(pensionIndex.mapOtppMember).toBe(mapOtppMember)
    expect(pensionIndex.mapOtppContribution).toBe(mapOtppContribution)
    expect(pensionIndex.createCppClient).toBeTypeOf('function')
    expect(pensionIndex.mapCppContribution).toBeTypeOf('function')
    expect(pensionIndex.mapCppEstimate).toBeTypeOf('function')

    expect(pensionIndex.PensionProviderSchema.safeParse('OTPP').success).toBe(true)
    expect(pensionIndex.PlanTypeSchema.safeParse('defined_benefit').success).toBe(true)
    expect(pensionIndex.MemberStatusSchema.safeParse('active').success).toBe(true)
    expect(pensionIndex.ContributionTypeSchema.safeParse('employee_regular').success).toBe(true)
    expect(pensionIndex.MemberStatusSchema.safeParse('invalid_status').success).toBe(false)
  })
})
