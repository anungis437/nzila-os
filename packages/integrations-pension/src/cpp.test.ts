import { describe, it, expect } from 'vitest'
import {
  cppContributionRecordSchema,
  cppEstimateSchema,
  mapCppContribution,
  mapCppEstimate,
  createCppClient,
  type CppContributionRecord,
  type CppEstimate,
  type CppTransport,
} from './cpp'

// ── Fixtures ────────────────────────────────────────────────────────────────

const contributionRecord: CppContributionRecord = {
  sin: '123-456-789',
  employeeName: 'John Doe',
  year: 2025,
  month: 3,
  employeeContribution: 340.75,
  employerContribution: 340.75,
  pensionableEarnings: 5726.89,
  maxPensionableEarnings: 71300,
  basicExemption: 3500,
}

const estimate: CppEstimate = {
  sin: '123-456-789',
  estimateDate: '2025-04-01',
  retirementAge: 65,
  monthlyAmount: 1364.60,
  startDate: '2055-04-01',
}

// ── Schema tests ────────────────────────────────────────────────────────────

describe('cppContributionRecordSchema', () => {
  it('parses a valid contribution record', () => {
    const result = cppContributionRecordSchema.parse(contributionRecord)
    expect(result.sin).toBe('123-456-789')
    expect(result.year).toBe(2025)
    expect(result.month).toBe(3)
  })

  it('accepts null employeeName', () => {
    const result = cppContributionRecordSchema.parse({
      ...contributionRecord,
      employeeName: null,
    })
    expect(result.employeeName).toBeNull()
  })
})

describe('cppEstimateSchema', () => {
  it('parses a valid estimate', () => {
    const result = cppEstimateSchema.parse(estimate)
    expect(result.monthlyAmount).toBe(1364.60)
    expect(result.retirementAge).toBe(65)
  })
})

// ── Mapping tests ───────────────────────────────────────────────────────────

describe('mapCppContribution', () => {
  it('maps to PensionContribution with correct fields', () => {
    const result = mapCppContribution(contributionRecord)
    expect(result).toEqual({
      externalId: 'CPP-123-456-789-2025-03',
      provider: 'CPP_QPP',
      memberId: '123-456-789',
      planId: 'CPP',
      contributionType: 'employee_regular',
      periodStart: '2025-03-01',
      periodEnd: '2025-03-28',
      employeeAmount: 340.75,
      employerAmount: 340.75,
      pensionableEarnings: 5726.89,
      status: 'posted',
    })
  })

  it('zero-pads single-digit months', () => {
    const jan = { ...contributionRecord, month: 1 }
    const result = mapCppContribution(jan)
    expect(result.externalId).toBe('CPP-123-456-789-2025-01')
    expect(result.periodStart).toBe('2025-01-01')
  })

  it('does not pad two-digit months', () => {
    const dec = { ...contributionRecord, month: 12 }
    const result = mapCppContribution(dec)
    expect(result.periodStart).toBe('2025-12-01')
  })
})

describe('mapCppEstimate', () => {
  it('maps to PensionEstimate with correct fields', () => {
    const result = mapCppEstimate(estimate)
    expect(result).toEqual({
      externalId: 'CPP-EST-123-456-789-2025-04-01',
      provider: 'CPP_QPP',
      memberId: '123-456-789',
      planId: 'CPP',
      estimateDate: '2025-04-01',
      retirementAge: 65,
      monthlyPension: 1364.60,
      annualPension: 1364.60 * 12,
    })
  })

  it('computes annualPension as monthlyAmount × 12', () => {
    const result = mapCppEstimate(estimate)
    expect(result.annualPension).toBeCloseTo(16375.20)
  })
})

// ── Client factory test ─────────────────────────────────────────────────────

describe('createCppClient', () => {
  const transport: CppTransport = {
    fetchContributions: async () => [contributionRecord],
    fetchEstimates: async () => [estimate],
  }

  it('returns a client with CPP_QPP provider', () => {
    const client = createCppClient(transport)
    expect(client.provider).toBe('CPP_QPP')
  })

  it('fetchPlans returns static CPP plan', async () => {
    const client = createCppClient(transport)
    const plans = await client.fetchPlans('org1')
    expect(plans).toHaveLength(1)
    expect(plans[0]!.planName).toBe('Canada Pension Plan')
    expect(plans[0]!.jurisdiction).toBe('federal')
  })

  it('fetchContributions maps via transport', async () => {
    const client = createCppClient(transport)
    const contribs = await client.fetchContributions('org1', 'M-1')
    expect(contribs).toHaveLength(1)
    expect(contribs[0]!.provider).toBe('CPP_QPP')
  })

  it('fetchEstimates maps via transport', async () => {
    const client = createCppClient(transport)
    const estimates = await client.fetchEstimates('org1', '123-456-789')
    expect(estimates).toHaveLength(1)
    expect(estimates[0]!.monthlyPension).toBe(1364.60)
  })

  it('healthCheck returns ok', async () => {
    const client = createCppClient(transport)
    const health = await client.healthCheck()
    expect(health.ok).toBe(true)
  })
})
