/**
 * Pension Processor Types
 * Defines types for Canadian pension plan integrations (CPP/QPP, OTPP, etc.)
 */

import { Decimal } from 'decimal.js';

/**
 * Supported pension plan types
 */
export enum PensionPlanType {
  CPP = 'cpp',        // Canada Pension Plan
  QPP = 'qpp',        // Quebec Pension Plan
  OTPP = 'otpp',      // Ontario Teachers' Pension Plan
}

/**
 * Pension contribution types
 */
export enum ContributionType {
  EMPLOYEE = 'employee',
  EMPLOYER = 'employer',
  TOTAL = 'total',
}

/**
 * Employment status for pension eligibility
 */
export enum EmploymentStatus {
  FULL_TIME = 'full_time',
  PART_TIME = 'part_time',
  CASUAL = 'casual',
  CONTRACT = 'contract',
}

/**
 * Contribution period (for reporting)
 */
export enum ContributionPeriod {
  WEEKLY = 'weekly',
  BI_WEEKLY = 'bi_weekly',
  SEMI_MONTHLY = 'semi_monthly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUAL = 'annual',
}

/**
 * Member information for pension calculations
 */
export interface PensionMember {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  hireDate: Date;
  employmentStatus: EmploymentStatus;
  province: string;
  annualSalary: Decimal;
  metadata?: Record<string, unknown>;
}

/**
 * Earnings information for a contribution period
 */
export interface PensionableEarnings {
  grossEarnings: Decimal;
  pensionableEarnings: Decimal;
  nonPensionableEarnings?: Decimal;
  overtimeEarnings?: Decimal;
  bonusEarnings?: Decimal;
  periodStartDate: Date;
  periodEndDate: Date;
  payPeriodNumber?: number;
}

/**
 * Contribution calculation result
 */
export interface ContributionCalculation {
  memberId: string;
  planType: PensionPlanType;
  contributionPeriod: ContributionPeriod;
  periodStartDate: Date;
  periodEndDate: Date;
  
  // Earnings
  grossEarnings: Decimal;
  pensionableEarnings: Decimal;
  
  // Basic exempt amount (CPP/QPP)
  basicExemptAmount?: Decimal;
  
  // Contributions
  employeeContribution: Decimal;
  employerContribution: Decimal;
  totalContribution: Decimal;
  
  // Rates applied
  employeeRate: Decimal;
  employerRate: Decimal;
  
  // Year-to-date totals
  ytdPensionableEarnings: Decimal;
  ytdEmployeeContribution: Decimal;
  ytdEmployerContribution: Decimal;
  
  // Maximum limits
  yearlyMaximumPensionableEarnings?: Decimal;
  yearlyMaximumContribution?: Decimal;
  
  // Metadata
  calculatedAt: Date;
  taxYear: number;
  metadata?: Record<string, unknown>;
}

/**
 * Contribution remittance (payment to pension authority)
 */
export interface ContributionRemittance {
  id: string;
  planType: PensionPlanType;
  remittanceMonth: number;
  remittanceYear: number;
  
  totalPensionableEarnings: Decimal;
  totalEmployeeContributions: Decimal;
  totalEmployerContributions: Decimal;
  totalContributions: Decimal;
  
  numberOfMembers: number;
  memberIds: string[];
  
  dueDate: Date;
  remittanceDate?: Date;
  confirmationNumber?: string;
  
  status: 'pending' | 'submitted' | 'confirmed' | 'failed';
  metadata?: Record<string, unknown>;
}

/**
 * Annual pension statement
 */
export interface AnnualPensionStatement {
  memberId: string;
  planType: PensionPlanType;
  taxYear: number;
  
  totalPensionableEarnings: Decimal;
  totalEmployeeContributions: Decimal;
  totalEmployerContributions: Decimal;
  
  contributionMonths: number;
  
  generatedAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Pension plan configuration
 */
export interface PensionPlanConfig {
  planType: PensionPlanType;
  apiKey?: string;
  apiSecret?: string;
  employerAccountNumber?: string;
  environment: 'sandbox' | 'production';
  metadata?: Record<string, unknown>;
}

/**
 * Contribution rate configuration
 */
export interface ContributionRates {
  taxYear: number;
  employeeRate: Decimal;
  employerRate: Decimal;
  yearlyMaximumPensionableEarnings: Decimal;
  yearlyMaximumContribution: Decimal;
  basicExemptAmount?: Decimal; // CPP/QPP only
  effectiveDate: Date;
  expiryDate?: Date;
}

/**
 * Pension processor error
 */
export class PensionProcessorError extends Error {
  constructor(
    message: string,
    public planType: PensionPlanType,
    public code?: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'PensionProcessorError';
  }
}

/**
 * Pension processor interface
 */
export interface IPensionProcessor {
  readonly type: PensionPlanType;
  readonly environment: 'sandbox' | 'production';
  
  /**
   * Initialize the processor
   */
  initialize(): Promise<void>;
  
  /**
   * Calculate contribution for a member
   */
  calculateContribution(
    member: PensionMember,
    earnings: PensionableEarnings,
    ytdEarnings?: Decimal,
    ytdContributions?: Decimal
  ): Promise<ContributionCalculation>;
  
  /**
   * Get current contribution rates
   */
  getContributionRates(taxYear?: number): Promise<ContributionRates>;
  
  /**
   * Validate if earnings are pensionable
   */
  isPensionableEarnings(
    member: PensionMember,
    earningsType: string
  ): boolean;
  
  /**
   * Create remittance for a period
   */
  createRemittance(
    contributions: ContributionCalculation[],
    remittanceMonth: number,
    remittanceYear: number
  ): Promise<ContributionRemittance>;
  
  /**
   * Submit remittance to pension authority
   */
  submitRemittance(remittanceId: string): Promise<ContributionRemittance>;
  
  /**
   * Generate annual statement for a member
   */
  generateAnnualStatement(
    memberId: string,
    taxYear: number
  ): Promise<AnnualPensionStatement>;
  
  /**
   * Get plan capabilities
   */
  getCapabilities(): {
    supportsElectronicRemittance: boolean;
    supportsAutomaticEnrollment: boolean;
    supportsBuyBack: boolean;
    supportsEarlyRetirement: boolean;
    minimumAge?: number;
    maximumAge?: number;
  };
}
