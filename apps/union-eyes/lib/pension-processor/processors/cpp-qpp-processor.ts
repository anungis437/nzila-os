/**
 * CPP/QPP Processor
 * Canada Pension Plan and Quebec Pension Plan integration
 * 
 * Handles contribution calculations based on CRA guidelines
 * Rates updated for 2026 tax year
 */

import { Decimal } from 'decimal.js';
import { BasePensionProcessor } from '../base-processor';
import type {
  PensionPlanType,
  PensionMember,
  PensionableEarnings,
  ContributionCalculation,
  ContributionRates,
  AnnualPensionStatement,
  PensionPlanConfig,
  ContributionRemittance,
} from '../types';
import { PensionProcessorError, ContributionPeriod } from '../types';

/**
 * CPP/QPP contribution rates by year
 * Source: Canada Revenue Agency
 */
const CONTRIBUTION_RATES: Record<number, ContributionRates> = {
  2026: {
    taxYear: 2026,
    employeeRate: new Decimal('0.0595'),     // 5.95%
    employerRate: new Decimal('0.0595'),     // 5.95% (matches employee)
    yearlyMaximumPensionableEarnings: new Decimal('68500'),
    basicExemptAmount: new Decimal('3500'),
    yearlyMaximumContribution: new Decimal('3867.50'),
    effectiveDate: new Date('2026-01-01'),
  },
  2025: {
    taxYear: 2025,
    employeeRate: new Decimal('0.0595'),
    employerRate: new Decimal('0.0595'),
    yearlyMaximumPensionableEarnings: new Decimal('66600'),
    basicExemptAmount: new Decimal('3500'),
    yearlyMaximumContribution: new Decimal('3754.45'),
    effectiveDate: new Date('2025-01-01'),
    expiryDate: new Date('2025-12-31'),
  },
  2024: {
    taxYear: 2024,
    employeeRate: new Decimal('0.0570'),
    employerRate: new Decimal('0.0570'),
    yearlyMaximumPensionableEarnings: new Decimal('66600'),
    basicExemptAmount: new Decimal('3500'),
    yearlyMaximumContribution: new Decimal('3599.10'),
    effectiveDate: new Date('2024-01-01'),
    expiryDate: new Date('2024-12-31'),
  },
};

/**
 * QPP-specific rates (slightly different from CPP)
 */
const QPP_CONTRIBUTION_RATES: Record<number, ContributionRates> = {
  2026: {
    taxYear: 2026,
    employeeRate: new Decimal('0.064'),      // 6.4%
    employerRate: new Decimal('0.064'),      // 6.4%
    yearlyMaximumPensionableEarnings: new Decimal('68500'),
    basicExemptAmount: new Decimal('3500'),
    yearlyMaximumContribution: new Decimal('4160.00'),
    effectiveDate: new Date('2026-01-01'),
  },
  2025: {
    taxYear: 2025,
    employeeRate: new Decimal('0.064'),
    employerRate: new Decimal('0.064'),
    yearlyMaximumPensionableEarnings: new Decimal('66600'),
    basicExemptAmount: new Decimal('3500'),
    yearlyMaximumContribution: new Decimal('4038.40'),
    effectiveDate: new Date('2025-01-01'),
    expiryDate: new Date('2025-12-31'),
  },
};

/**
 * CPP/QPP Processor
 */
export class CPPQPPProcessor extends BasePensionProcessor {
  private isQPP: boolean;

  constructor(
    type: PensionPlanType,
    config: PensionPlanConfig
  ) {
    super(type, config);
    this.isQPP = type === 'qpp';
  }

  /**
   * Initialize the processor
   */
  async initialize(): Promise<void> {
    this.logInfo('Initializing CPP/QPP processor', {
      planType: this.type,
      environment: this.environment,
      isQPP: this.isQPP,
    });

    // Load contribution rates into cache
    const rates = this.isQPP ? QPP_CONTRIBUTION_RATES : CONTRIBUTION_RATES;
    for (const [year, rate] of Object.entries(rates)) {
      this.contributionRatesCache.set(parseInt(year), rate);
    }

    this.initialized = true;
    this.logInfo('CPP/QPP processor initialized successfully');
  }

  /**
   * Calculate contribution for a member
   */
  async calculateContribution(
    member: PensionMember,
    earnings: PensionableEarnings,
    ytdEarnings: Decimal = new Decimal(0),
    ytdContributions: Decimal = new Decimal(0)
  ): Promise<ContributionCalculation> {
    this.ensureInitialized();
    this.validateMemberEligibility(member);

    const taxYear = this.getTaxYear(earnings.periodEndDate);
    const rates = await this.getContributionRates(taxYear);

    // Check age eligibility (18-70 for CPP/QPP)
    const age = this.calculateAge(member.dateOfBirth, earnings.periodEndDate);
    if (age < 18 || age > 70) {
      this.logWarn('Member outside eligible age range', {
        memberId: member.id,
        age,
        planType: this.type,
      });
      
      return this.createZeroContribution(member, earnings, rates, taxYear);
    }

    // Calculate pensionable earnings (gross - basic exemption pro-rated)
    const periodFactor = this.calculatePeriodFactor(
      earnings.periodStartDate,
      earnings.periodEndDate
    );
    const basicExemptionForPeriod = rates.basicExemptAmount!.times(periodFactor);
    
    let pensionableEarnings = earnings.grossEarnings.minus(basicExemptionForPeriod);
    if (pensionableEarnings.lessThan(0)) {
      pensionableEarnings = new Decimal(0);
    }

    // Calculate new YTD pensionable earnings
    const newYTDPensionableEarnings = ytdEarnings.plus(pensionableEarnings);

    // Check if at maximum pensionable earnings
    let cappedPensionableEarnings = pensionableEarnings;
    if (newYTDPensionableEarnings.greaterThan(rates.yearlyMaximumPensionableEarnings)) {
      const excessAmount = newYTDPensionableEarnings.minus(rates.yearlyMaximumPensionableEarnings);
      cappedPensionableEarnings = pensionableEarnings.minus(excessAmount);
      
      if (cappedPensionableEarnings.lessThan(0)) {
        cappedPensionableEarnings = new Decimal(0);
      }

      this.logInfo('Pensionable earnings capped at maximum', {
        memberId: member.id,
        original: pensionableEarnings.toString(),
        capped: cappedPensionableEarnings.toString(),
        ytd: newYTDPensionableEarnings.toString(),
        maximum: rates.yearlyMaximumPensionableEarnings.toString(),
      });
    }

    // Calculate contributions
    let employeeContribution = this.roundCurrency(
      cappedPensionableEarnings.times(rates.employeeRate)
    );
    let employerContribution = this.roundCurrency(
      cappedPensionableEarnings.times(rates.employerRate)
    );

    // Check if at maximum contribution
    const newYTDEmployeeContribution = ytdContributions.plus(employeeContribution);
    if (newYTDEmployeeContribution.greaterThan(rates.yearlyMaximumContribution)) {
      const excessContribution = newYTDEmployeeContribution.minus(rates.yearlyMaximumContribution);
      employeeContribution = employeeContribution.minus(excessContribution);
      employerContribution = employerContribution.minus(excessContribution);
      
      if (employeeContribution.lessThan(0)) {
        employeeContribution = new Decimal(0);
      }
      if (employerContribution.lessThan(0)) {
        employerContribution = new Decimal(0);
      }

      this.logInfo('Contribution capped at maximum', {
        memberId: member.id,
        ytd: newYTDEmployeeContribution.toString(),
        maximum: rates.yearlyMaximumContribution.toString(),
      });
    }

    const totalContribution = employeeContribution.plus(employerContribution);

    const calculation: ContributionCalculation = {
      memberId: member.id,
      planType: this.type,
      contributionPeriod: this.determineContributionPeriod(
        earnings.periodStartDate,
        earnings.periodEndDate
      ),
      periodStartDate: earnings.periodStartDate,
      periodEndDate: earnings.periodEndDate,
      
      grossEarnings: earnings.grossEarnings,
      pensionableEarnings: cappedPensionableEarnings,
      basicExemptAmount: basicExemptionForPeriod,
      
      employeeContribution,
      employerContribution,
      totalContribution,
      
      employeeRate: rates.employeeRate,
      employerRate: rates.employerRate,
      
      ytdPensionableEarnings: ytdEarnings.plus(cappedPensionableEarnings),
      ytdEmployeeContribution: ytdContributions.plus(employeeContribution),
      ytdEmployerContribution: ytdContributions.plus(employerContribution),
      
      yearlyMaximumPensionableEarnings: rates.yearlyMaximumPensionableEarnings,
      yearlyMaximumContribution: rates.yearlyMaximumContribution,
      
      calculatedAt: new Date(),
      taxYear,
    };

    this.logInfo('Contribution calculated', {
      memberId: member.id,
      planType: this.type,
      employeeContribution: employeeContribution.toString(),
      employerContribution: employerContribution.toString(),
    });

    return calculation;
  }

  /**
   * Get current contribution rates
   */
  async getContributionRates(taxYear?: number): Promise<ContributionRates> {
    const year = taxYear || this.getTaxYear();
    
    const rates = this.contributionRatesCache.get(year);
    if (!rates) {
      throw new PensionProcessorError(
        `Contribution rates not available for tax year ${year}`,
        this.type,
        'RATES_NOT_FOUND'
      );
    }

    return rates;
  }

  /**
   * Validate if earnings are pensionable
   */
  isPensionableEarnings(
    member: PensionMember,
    earningsType: string
  ): boolean {
    // Most types of employment earnings are pensionable for CPP/QPP
    const nonPensionableTypes = [
      'tips', // Tips are generally not pensionable
      'gifts',
      'expense_reimbursement',
      'workers_compensation',
      'disability_benefits',
    ];

    return !nonPensionableTypes.includes(earningsType.toLowerCase());
  }

  /**
   * Submit remittance to CRA
   */
  async submitRemittance(remittanceId: string): Promise<ContributionRemittance> {
    this.ensureInitialized();

    // In production, this would make an API call to CRA's remittance system
    // For now, simulate the submission

    this.logInfo('Submitting remittance to CRA', {
      remittanceId,
      planType: this.type,
      environment: this.environment,
    });

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // In sandbox mode, always succeed
    if (this.environment === 'sandbox') {
      const confirmationNumber = `CPP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      this.logInfo('Remittance submitted successfully (sandbox)', {
        remittanceId,
        confirmationNumber,
      });

      // Return updated remittance (in real implementation, would fetch from storage)
      return {
        id: remittanceId,
        planType: this.type,
        remittanceMonth: 0,
        remittanceYear: 0,
        totalPensionableEarnings: new Decimal(0),
        totalEmployeeContributions: new Decimal(0),
        totalEmployerContributions: new Decimal(0),
        totalContributions: new Decimal(0),
        numberOfMembers: 0,
        memberIds: [],
        dueDate: new Date(),
        remittanceDate: new Date(),
        confirmationNumber,
        status: 'confirmed',
      };
    }

    throw new PensionProcessorError(
      'Production remittance submission not yet implemented',
      this.type,
      'NOT_IMPLEMENTED'
    );
  }

  /**
   * Generate annual statement
   */
  async generateAnnualStatement(
    memberId: string,
    taxYear: number
  ): Promise<AnnualPensionStatement> {
    this.ensureInitialized();

    // In production, this would fetch data from database/storage
    this.logInfo('Generating annual statement', {
      memberId,
      taxYear,
      planType: this.type,
    });

    // Placeholder implementation
    const statement: AnnualPensionStatement = {
      memberId,
      planType: this.type,
      taxYear,
      totalPensionableEarnings: new Decimal(0),
      totalEmployeeContributions: new Decimal(0),
      totalEmployerContributions: new Decimal(0),
      contributionMonths: 12,
      generatedAt: new Date(),
    };

    return statement;
  }

  /**
   * Get plan capabilities
   */
  getCapabilities() {
    return {
      supportsElectronicRemittance: true,
      supportsAutomaticEnrollment: true,
      supportsBuyBack: false,
      supportsEarlyRetirement: false,
      minimumAge: 18,
      maximumAge: 70,
    };
  }

  /**
   * Create zero contribution for ineligible member
   */
  private createZeroContribution(
    member: PensionMember,
    earnings: PensionableEarnings,
    rates: ContributionRates,
    taxYear: number
  ): ContributionCalculation {
    return {
      memberId: member.id,
      planType: this.type,
      contributionPeriod: this.determineContributionPeriod(
        earnings.periodStartDate,
        earnings.periodEndDate
      ),
      periodStartDate: earnings.periodStartDate,
      periodEndDate: earnings.periodEndDate,
      
      grossEarnings: earnings.grossEarnings,
      pensionableEarnings: new Decimal(0),
      basicExemptAmount: rates.basicExemptAmount,
      
      employeeContribution: new Decimal(0),
      employerContribution: new Decimal(0),
      totalContribution: new Decimal(0),
      
      employeeRate: rates.employeeRate,
      employerRate: rates.employerRate,
      
      ytdPensionableEarnings: new Decimal(0),
      ytdEmployeeContribution: new Decimal(0),
      ytdEmployerContribution: new Decimal(0),
      
      yearlyMaximumPensionableEarnings: rates.yearlyMaximumPensionableEarnings,
      yearlyMaximumContribution: rates.yearlyMaximumContribution,
      
      calculatedAt: new Date(),
      taxYear,
    };
  }

  /**
   * Calculate period factor for basic exemption calculation
   */
  private calculatePeriodFactor(startDate: Date, endDate: Date): Decimal {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Assume 365 days per year
    return new Decimal(diffDays).dividedBy(365);
  }

  /**
   * Determine contribution period from dates
   */
  private determineContributionPeriod(
    startDate: Date,
    endDate: Date
  ): ContributionPeriod {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 7) return ContributionPeriod.WEEKLY;
    if (diffDays <= 14) return ContributionPeriod.BI_WEEKLY;
    if (diffDays <= 16) return ContributionPeriod.SEMI_MONTHLY;
    if (diffDays <= 31) return ContributionPeriod.MONTHLY;
    if (diffDays <= 92) return ContributionPeriod.QUARTERLY;
    return ContributionPeriod.ANNUAL;
  }
}
