/**
 * Pension — OTPP / CPP Integration (re-export from @nzila/integrations-pension)
 *
 * Provides pension plan management, contribution tracking, and
 * regulatory reporting for Canadian employer pension obligations.
 *
 * @module cfo/pension
 */

// ── Re-exports from workspace package ───────────────────────────────────────

export {
  createOtppClient,
  mapOtppMember,
  mapOtppContribution,
  createCppClient,
  mapCppContribution,
  mapCppEstimate,
  PensionProviderSchema,
  PlanTypeSchema,
  MemberStatusSchema,
  ContributionTypeSchema,
} from '@nzila/integrations-pension'

export type {
  OtppTransport,
  OtppMemberRecord,
  OtppContributionRecord,
  CppTransport,
  CppContributionRecord,
  CppEstimate,
  PensionClient,
  PensionPlan,
  PensionMember,
  PensionContribution,
  PensionEstimate,
  PensionSyncResult,
  PensionProvider,
  PlanType,
  MemberStatus,
  ContributionType,
} from '@nzila/integrations-pension'

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
