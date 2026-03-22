/**
 * Pension — OTPP / CPP Integration
 *
 * Provides pension plan management, contribution tracking, and
 * regulatory reporting for Canadian employer pension obligations.
 * Self-contained stubs until @nzila/integrations-pension is available.
 *
 * @module cfo/pension
 */

import { z } from 'zod'

// ── Types ───────────────────────────────────────────────────────────────────

export interface OtppTransport { apiKey: string; baseUrl?: string }
export interface OtppMemberRecord { memberId: string; name: string; plan: string }
export interface OtppContributionRecord { memberId: string; amount: number; period: string }
export interface CppTransport { apiKey: string }
export interface CppContributionRecord { sin: string; amount: number; period: string }
export interface CppEstimate { annualBenefit: number; startAge: number }
export interface PensionClient { healthCheck(): Promise<{ ok: boolean }> }
export interface PensionPlan { id: string; name: string; type: PlanType; provider: PensionProvider }
export interface PensionMember { id: string; name: string; status: MemberStatus; planId: string }
export interface PensionContribution { memberId: string; amount: number; type: ContributionType; period: string }
export interface PensionEstimate { annualBenefit: number; startAge: number }
export interface PensionSyncResult { created: number; updated: number; errors: string[] }
export type PensionProvider = z.infer<typeof PensionProviderSchema>
export type PlanType = z.infer<typeof PlanTypeSchema>
export type MemberStatus = z.infer<typeof MemberStatusSchema>
export type ContributionType = z.infer<typeof ContributionTypeSchema>

export const PensionProviderSchema = z.enum(['otpp', 'cpp', 'qpp', 'rpsp'])
export const PlanTypeSchema = z.enum(['defined_benefit', 'defined_contribution', 'group_rrsp'])
export const MemberStatusSchema = z.enum(['active', 'inactive', 'retired', 'terminated'])
export const ContributionTypeSchema = z.enum(['employee', 'employer', 'voluntary'])

// ── Stub Factories ──────────────────────────────────────────────────────────

export function createOtppClient(_transport: OtppTransport): PensionClient { return { async healthCheck() { return { ok: true } } } }
export function mapOtppMember(raw: Record<string, string>): OtppMemberRecord { return { memberId: raw['id'] ?? '', name: raw['name'] ?? '', plan: raw['plan'] ?? '' } }
export function mapOtppContribution(raw: Record<string, string>): OtppContributionRecord { return { memberId: raw['memberId'] ?? '', amount: Number(raw['amount'] ?? 0), period: raw['period'] ?? '' } }
export function createCppClient(_transport: CppTransport): PensionClient { return { async healthCheck() { return { ok: true } } } }
export function mapCppContribution(raw: Record<string, string>): CppContributionRecord { return { sin: raw['sin'] ?? '', amount: Number(raw['amount'] ?? 0), period: raw['period'] ?? '' } }
export function mapCppEstimate(raw: Record<string, string>): CppEstimate { return { annualBenefit: Number(raw['benefit'] ?? 0), startAge: Number(raw['age'] ?? 65) } }

// ── CFO Facades ─────────────────────────────────────────────────────────────

/**
 * 2025 CPP/QPP contribution rates and maximums.
 */
export const CPP_RATES_2025 = {
  /** CPP1 employee rate */
  cpp1Rate: 0.0595,
  /** CPP2 employee rate (on earnings between YMPE and YAMPE) */
  cpp2Rate: 0.04,
  /** Year's Maximum Pensionable Earnings */
  ympe: 71_300,
  /** Year's Additional Maximum Pensionable Earnings */
  yampe: 79_400,
  /** Basic exemption */
  basicExemption: 3_500,
  /** Maximum employee CPP1 contribution */
  maxCpp1: 4_034.10,
  /** Maximum employee CPP2 contribution */
  maxCpp2: 324.00,
} as const

/**
 * Calculate employer CPP contributions for a given salary.
 */
export function calculateEmployerCPP(annualSalary: number): {
  cpp1: number
  cpp2: number
  total: number
} {
  const pensionableEarnings1 = Math.min(annualSalary, CPP_RATES_2025.ympe) - CPP_RATES_2025.basicExemption
  const cpp1 = Math.min(
    Math.max(0, pensionableEarnings1) * CPP_RATES_2025.cpp1Rate,
    CPP_RATES_2025.maxCpp1,
  )

  const pensionableEarnings2 = Math.min(annualSalary, CPP_RATES_2025.yampe) - CPP_RATES_2025.ympe
  const cpp2 = Math.min(
    Math.max(0, pensionableEarnings2) * CPP_RATES_2025.cpp2Rate,
    CPP_RATES_2025.maxCpp2,
  )

  return {
    cpp1: Math.round(cpp1 * 100) / 100,
    cpp2: Math.round(cpp2 * 100) / 100,
    total: Math.round((cpp1 + cpp2) * 100) / 100,
  }
}

/**
 * Generate GL journal entries for pension contributions.
 */
export function pensionContributionJournalEntry(
  date: string,
  employeeCpp: number,
  employerCpp: number,
  rpspContribution: number,
): {
  date: string
  reference: string
  lines: { accountCode: string; debit: number; credit: number; description: string }[]
} {
  return {
    date,
    reference: `PENSION-${date}`,
    lines: [
      { accountCode: '5410', debit: employerCpp, credit: 0, description: 'Employer CPP contribution' },
      { accountCode: '5420', debit: rpspContribution, credit: 0, description: 'Employer RPSP contribution' },
      { accountCode: '2310', debit: 0, credit: employeeCpp, description: 'Employee CPP payable' },
      { accountCode: '2310', debit: 0, credit: employerCpp, description: 'Employer CPP payable' },
      { accountCode: '2320', debit: 0, credit: rpspContribution, description: 'RPSP contribution payable' },
    ],
  }
}
