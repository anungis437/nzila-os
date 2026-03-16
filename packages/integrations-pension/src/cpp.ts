/**
 * Nzila OS — Pension Integration: CPP/QPP Adapter
 *
 * Canada Pension Plan / Quebec Pension Plan sync.
 * Handles federal pension contribution tracking.
 */

import { z } from 'zod'
import type {
  PensionClient,
  PensionPlan,
  PensionMember,
  PensionContribution,
  PensionEstimate,
} from './types'

// ── CPP schemas ─────────────────────────────────────────────────────────────

export const cppContributionRecordSchema = z.object({
  sin: z.string(),
  employeeName: z.string().nullable(),
  year: z.number(),
  month: z.number(),
  employeeContribution: z.number(),
  employerContribution: z.number(),
  pensionableEarnings: z.number(),
  maxPensionableEarnings: z.number(),
  basicExemption: z.number(),
})

export type CppContributionRecord = z.infer<typeof cppContributionRecordSchema>

export const cppEstimateSchema = z.object({
  sin: z.string(),
  estimateDate: z.string(),
  retirementAge: z.number(),
  monthlyAmount: z.number(),
  startDate: z.string(),
})

export type CppEstimate = z.infer<typeof cppEstimateSchema>

// ── CPP Transport interface ─────────────────────────────────────────────────

export interface CppTransport {
  fetchContributions(orgId: string, year: number): Promise<CppContributionRecord[]>
  fetchEstimates(orgId: string, memberId: string): Promise<CppEstimate[]>
}

// ── Mapping functions ───────────────────────────────────────────────────────

export function mapCppContribution(record: CppContributionRecord): PensionContribution {
  const monthStr = String(record.month).padStart(2, '0')
  return {
    externalId: `CPP-${record.sin}-${record.year}-${monthStr}`,
    provider: 'CPP_QPP',
    memberId: record.sin,
    planId: 'CPP',
    contributionType: 'employee_regular',
    periodStart: `${record.year}-${monthStr}-01`,
    periodEnd: `${record.year}-${monthStr}-28`,
    employeeAmount: record.employeeContribution,
    employerAmount: record.employerContribution,
    pensionableEarnings: record.pensionableEarnings,
    status: 'posted',
  }
}

export function mapCppEstimate(record: CppEstimate): PensionEstimate {
  return {
    externalId: `CPP-EST-${record.sin}-${record.estimateDate}`,
    provider: 'CPP_QPP',
    memberId: record.sin,
    planId: 'CPP',
    estimateDate: record.estimateDate,
    retirementAge: record.retirementAge,
    monthlyPension: record.monthlyAmount,
    annualPension: record.monthlyAmount * 12,
  }
}

/**
 * Create a PensionClient for CPP/QPP.
 */
export function createCppClient(transport: CppTransport): PensionClient {
  return {
    provider: 'CPP_QPP',

    async fetchPlans(): Promise<PensionPlan[]> {
      return [
        {
          externalId: 'CPP',
          provider: 'CPP_QPP',
          planName: 'Canada Pension Plan',
          planType: 'defined_benefit',
          planNumber: 'CPP-FED',
          jurisdiction: 'federal',
          effectiveDate: '1966-01-01',
          employeeContributionRate: 0.0595,
          employerContributionRate: 0.0595,
          normalRetirementAge: 65,
          earlyRetirementAge: 60,
          status: 'active',
        },
      ]
    },

    async fetchMembers(): Promise<PensionMember[]> {
      // CPP member data comes via contribution records
      return []
    },

    async fetchContributions(orgId: string): Promise<PensionContribution[]> {
      const currentYear = new Date().getFullYear()
      const records = await transport.fetchContributions(orgId, currentYear)
      return records.map(mapCppContribution)
    },

    async fetchEstimates(_orgId: string, memberId: string): Promise<PensionEstimate[]> {
      const records = await transport.fetchEstimates(_orgId, memberId)
      return records.map(mapCppEstimate)
    },

    async healthCheck() {
      const start = Date.now()
      return { ok: true, latencyMs: Date.now() - start, details: 'CPP/QPP interface available' }
    },
  }
}
