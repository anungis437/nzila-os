/**
 * @nzila/platform-jurisdiction-compliance — Policy Definitions
 *
 * Jurisdiction-specific compliance policies for Kenya, Uganda, Nigeria.
 * Derived from official tax authorities, labor ministries, pension regulators, NAEB/NCAT exam boards.
 *
 * Sources:
 * - Kenya: KRA, NSSF, Labour Ministry
 * - Uganda: URA, NSSF, Examinations Board
 * - Nigeria: FIRS, PenCom, NABTEB, NBTE
 *
 * @module @nzila/platform-jurisdiction-compliance/policies
 */

export interface TaxIdFormat {
  prefix: string
  length: number
  regex: string
  example: string
}

export interface TaxConfig {
  standard: number // VAT/GST standard rate (decimal, e.g., 0.16 = 16%)
  reduced: number // Reduced rate for essentials
  corporate: number // Corporate income tax rate
  personal: number // Personal income tax top rate
}

export interface LaborLaw {
  minimumWageMonthly: number // In local currency (KES, UGX, NGN)
  maximumHoursPerWeek: number
  minimumLeaveDaysPerYear: number
  pensionContributionRequired: boolean
  healthInsuranceRequired: boolean
  workersCompensationRequired: boolean
}

export interface PensionConfig {
  contribution: number // Employee contribution rate (decimal)
  employerContribution: number // Employer contribution rate (decimal)
  vesting: number // Years until fully vested
  eligibilityAgeYears: number
  annualContributionCap?: number // If applicable
}

export interface ExamBoard {
  name: string
  examTypes: readonly string[]
  certificateValidityYears: number
  appealDeadlineDays: number
}

export interface AddressFormat {
  required: readonly string[]
  example: string
}

export interface RegistrationFormat {
  pattern: string
  example: string
}

export interface Policy {
  name: string
  taxIdFormat: TaxIdFormat
  taxes: TaxConfig
  laborLaw: LaborLaw
  pension: PensionConfig
  examBoards: readonly ExamBoard[]
  addressFormat: AddressFormat
  registrationFormat: RegistrationFormat
  currency: string
  calendarYearEnd: string // e.g., "2024-12-31"
  complianceReminders: readonly string[]
}

// ─── Kenya (KE) ────────────────────────────────────────────────────────────

const kenyaPolicy: Policy = {
  name: 'Kenya',
  taxIdFormat: {
    prefix: 'KE-TAX-',
    length: 15,
    regex: '^KE-TAX-\\d{8}$',
    example: 'KE-TAX-12345678',
  },
  taxes: {
    standard: 0.16, // 16% VAT
    reduced: 0.0, // Zero-rated for some essentials
    corporate: 0.30, // 30% corporate tax
    personal: 0.32, // 32% top personal rate
  },
  laborLaw: {
    minimumWageMonthly: 32264, // KES ~2024
    maximumHoursPerWeek: 48,
    minimumLeaveDaysPerYear: 21,
    pensionContributionRequired: true,
    healthInsuranceRequired: false,
    workersCompensationRequired: true,
  },
  pension: {
    contribution: 0.06, // Employee contributes 6%
    employerContribution: 0.06, // Employer contributes 6%
    vesting: 2,
    eligibilityAgeYears: 60,
    annualContributionCap: 720000, // KES
  },
  examBoards: [
    {
      name: 'NITA',
      examTypes: ['apprenticeship', 'competency', 'advanced_craft'],
      certificateValidityYears: 3,
      appealDeadlineDays: 30,
    },
  ],
  addressFormat: {
    required: ['street', 'city', 'county', 'postalCode'],
    example: 'P.O. Box 12345, Nairobi, Nairobi County, 00100',
  },
  registrationFormat: {
    pattern: 'KE-COOP-\\d{5}',
    example: 'KE-COOP-00123',
  },
  currency: 'KES',
  calendarYearEnd: '2024-12-31',
  complianceReminders: [
    'Submit NSSF contributions by 10th of following month',
    'File annual income tax return by 30 June',
    'Renew cooperative license annually',
    'Maintain member registers per COOP Act',
  ],
}

// ─── Uganda (UG) ───────────────────────────────────────────────────────────

const ugandaPolicy: Policy = {
  name: 'Uganda',
  taxIdFormat: {
    prefix: 'UG-TAX-',
    length: 15,
    regex: '^UG-TAX-\\d{8}$',
    example: 'UG-TAX-12345678',
  },
  taxes: {
    standard: 0.18, // 18% VAT
    reduced: 0.0, // Zero-rated
    corporate: 0.30, // 30% corporate tax
    personal: 0.40, // 40% top personal rate (includes surtax)
  },
  laborLaw: {
    minimumWageMonthly: 12500, // UGX ~2024 (approximately USD 3.5/day)
    maximumHoursPerWeek: 48,
    minimumLeaveDaysPerYear: 14,
    pensionContributionRequired: true,
    healthInsuranceRequired: false,
    workersCompensationRequired: true,
  },
  pension: {
    contribution: 0.05, // Employee contributes 5% (or voluntary NSSF)
    employerContribution: 0.10, // Employer contributes 10%
    vesting: 3,
    eligibilityAgeYears: 55,
    annualContributionCap: undefined,
  },
  examBoards: [
    {
      name: 'UNEB',
      examTypes: ['apprenticeship', 'competency', 'skills_certification'],
      certificateValidityYears: 5,
      appealDeadlineDays: 45,
    },
    {
      name: 'NBTVE',
      examTypes: ['competency', 'advanced_craft'],
      certificateValidityYears: 5,
      appealDeadlineDays: 45,
    },
  ],
  addressFormat: {
    required: ['street', 'city', 'district', 'postalCode'],
    example: 'Plot 123, Main Street, Kampala, Kampala District, UG 256',
  },
  registrationFormat: {
    pattern: 'UG-COOP-\\d{5}',
    example: 'UG-COOP-00123',
  },
  currency: 'UGX',
  calendarYearEnd: '2024-12-31',
  complianceReminders: [
    'Register all cooperatives with MAAIF',
    'Submit monthly NSSF remittances by 5th',
    'File annual tax return with URA by 30 April',
    'Conduct annual audit per COOP Regulations',
    'Hold annual general meeting before 30 June',
  ],
}

// ─── Nigeria (NG) ──────────────────────────────────────────────────────────

const nigeriaPolicy: Policy = {
  name: 'Nigeria',
  taxIdFormat: {
    prefix: 'NG-TAX-',
    length: 15,
    regex: '^NG-TAX-\\d{8}$',
    example: 'NG-TAX-12345678',
  },
  taxes: {
    standard: 0.07, // 7.5% VAT (rounded to display)
    reduced: 0.05, // 5% for certain goods
    corporate: 0.30, // 30% corporate tax
    personal: 0.21, // 21% top personal rate (varies by income slab)
  },
  laborLaw: {
    minimumWageMonthly: 33000, // NGN ~2024 (national minimum wage)
    maximumHoursPerWeek: 40,
    minimumLeaveDaysPerYear: 6, // Minimum; states may extend
    pensionContributionRequired: true,
    healthInsuranceRequired: false,
    workersCompensationRequired: true,
  },
  pension: {
    contribution: 0.08, // Employee contributes 8% to PenCom
    employerContribution: 0.10, // Employer contributes 10%
    vesting: 5,
    eligibilityAgeYears: 65, // Can draw from age 55 with reduction
    annualContributionCap: undefined,
  },
  examBoards: [
    {
      name: 'NABTEB',
      examTypes: ['apprenticeship', 'national_diploma', 'advanced_diploma'],
      certificateValidityYears: 3,
      appealDeadlineDays: 14,
    },
    {
      name: 'NBTE',
      examTypes: ['national_diploma', 'advanced_diploma'],
      certificateValidityYears: 5,
      appealDeadlineDays: 21,
    },
  ],
  addressFormat: {
    required: ['street', 'city', 'state', 'postalCode'],
    example: 'Old Ikoyi Road, Victoria Island, Lagos State, LG 256005',
  },
  registrationFormat: {
    pattern: 'NG-COOP-\\d{5}',
    example: 'NG-COOP-00123',
  },
  currency: 'NGN',
  calendarYearEnd: '2024-12-31',
  complianceReminders: [
    'Register cooperative with Registrar in each state',
    'File monthly VAT returns with FIRS',
    'Submit quarterly CIT advance pay to FIRS',
    'Provide statutory audit report annually',
    'Remit pension contributions to PenCom within 7 days',
    'Maintain NHIS coverage for all employees',
    'File annual returns with CDD (Corporate Affairs Commission)',
  ],
}

// ─── Policy Registry ───────────────────────────────────────────────────────

export const policies: Record<string, Policy> = {
  KE: kenyaPolicy,
  UG: ugandaPolicy,
  NG: nigeriaPolicy,
}

/**
 * Get policy for a jurisdiction code.
 * @param jurisdiction - Code (KE, UG, NG)
 * @returns Policy object
 * @throws Error if jurisdiction not found
 */
export function getPolicy(jurisdiction: string): Policy {
  const policy = policies[jurisdiction]
  if (!policy) {
    throw new Error(`Policy not found for jurisdiction: ${jurisdiction}. Valid codes: ${Object.keys(policies).join(', ')}`)
  }
  return policy
}

/**
 * Check if a jurisdiction is supported.
 * @param jurisdiction - Code to check
 * @returns true if supported
 */
export function isSupportedJurisdiction(jurisdiction: string): boolean {
  return jurisdiction in policies
}

/**
 * List all supported jurisdiction codes.
 * @returns Array of codes
 */
export function getSupportedJurisdictions(): string[] {
  return Object.keys(policies)
}

/**
 * Compare policies (for CLI tools, doc generation, etc.)
 * @param j1 - First jurisdiction
 * @param j2 - Second jurisdiction
 * @returns Object showing differences
 */
export function comparePolicies(j1: string, j2: string): Record<string, unknown> {
  const p1 = getPolicy(j1)
  const p2 = getPolicy(j2)
  return {
    jurisdiction1: p1.name,
    jurisdiction2: p2.name,
    standardTaxDiff: Math.abs(p1.taxes.standard - p2.taxes.standard),
    minimumWageDiff: Math.abs(p1.laborLaw.minimumWageMonthly - p2.laborLaw.minimumWageMonthly),
    pensionContributionDiff: Math.abs(p1.pension.contribution - p2.pension.contribution),
  }
}
