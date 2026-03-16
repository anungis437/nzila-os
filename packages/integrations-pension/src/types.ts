/**
 * Nzila OS — Pension Integration: Core Types
 *
 * Types for pension system integrations (OTPP, CPP/QPP, OMERS, etc.)
 */

import { z } from 'zod'

// ── Provider / Status enums ─────────────────────────────────────────────────

export const PensionProviderSchema = z.enum([
  'OTPP', 'CPP_QPP', 'OMERS', 'HOOPP', 'LAPP', 'PSPP', 'BCMPP', 'SHEPP', 'CSSB', 'CUSTOM',
])

export const PlanTypeSchema = z.enum([
  'defined_benefit', 'defined_contribution', 'hybrid', 'target_benefit', 'multi_employer',
])

export const MemberStatusSchema = z.enum([
  'active', 'deferred', 'retired', 'disabled', 'terminated', 'deceased', 'suspended',
])

export const ContributionTypeSchema = z.enum([
  'employee_regular', 'employer_regular', 'employee_voluntary', 'employee_buyback',
  'transfer_in', 'adjustment',
])

export type PensionProvider = z.infer<typeof PensionProviderSchema>
export type PlanType = z.infer<typeof PlanTypeSchema>
export type MemberStatus = z.infer<typeof MemberStatusSchema>
export type ContributionType = z.infer<typeof ContributionTypeSchema>

// ── Domain objects ──────────────────────────────────────────────────────────

export interface PensionPlan {
  readonly externalId: string
  readonly provider: PensionProvider
  readonly planName: string
  readonly planType: PlanType
  readonly planNumber?: string
  readonly jurisdiction?: string
  readonly effectiveDate: string
  readonly terminationDate?: string
  readonly employeeContributionRate?: number
  readonly employerContributionRate?: number
  readonly vestingPeriodMonths?: number
  readonly normalRetirementAge?: number
  readonly earlyRetirementAge?: number
  readonly status: string
}

export interface PensionMember {
  readonly externalId: string
  readonly provider: PensionProvider
  readonly employeeId: string
  readonly employeeName?: string
  readonly planId: string
  readonly membershipNumber?: string
  readonly memberStatus: MemberStatus
  readonly enrollmentDate: string
  readonly vestingDate?: string
  readonly creditedService?: number
  readonly pensionableSalary?: number
  readonly expectedRetirementDate?: string
}

export interface PensionContribution {
  readonly externalId: string
  readonly provider: PensionProvider
  readonly memberId: string
  readonly planId: string
  readonly contributionType: ContributionType
  readonly periodStart: string
  readonly periodEnd: string
  readonly employeeAmount?: number
  readonly employerAmount?: number
  readonly pensionableEarnings?: number
  readonly status: string
}

export interface PensionEstimate {
  readonly externalId: string
  readonly provider: PensionProvider
  readonly memberId: string
  readonly planId: string
  readonly estimateDate: string
  readonly retirementAge: number
  readonly annualPension?: number
  readonly monthlyPension?: number
  readonly commutedValue?: number
}

// ── Sync result ─────────────────────────────────────────────────────────────

export interface PensionSyncResult {
  readonly provider: PensionProvider
  readonly planssynced: number
  readonly memberssynced: number
  readonly contributionsSynced: number
  readonly errors: string[]
}

// ── Client interface (adapter port) ─────────────────────────────────────────

export interface PensionClient {
  readonly provider: PensionProvider
  fetchPlans(orgId: string): Promise<PensionPlan[]>
  fetchMembers(orgId: string, planId: string): Promise<PensionMember[]>
  fetchContributions(orgId: string, memberId: string): Promise<PensionContribution[]>
  fetchEstimates(orgId: string, memberId: string): Promise<PensionEstimate[]>
  healthCheck(): Promise<{ ok: boolean; latencyMs: number; details?: string }>
}
