/**
 * OTPP Processor
 * Ontario Teachers' Pension Plan integration
 * 
 * Handles contribution calculations for Ontario teachers
 * OTPP is a defined benefit pension plan
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
 * OTPP contribution rates by year
 * OTPP uses tiered contribution rates based on earnings thresholds
 */
const CONTRIBUTION_RATES: Record<number, ContributionRates> = {
  2026: {
    taxYear: 2026,
    employeeRate: new Decimal('0.122'),      // 12.2% (average rate)
    employerRate: new Decimal('0.161'),      // 16.1% (employer pays more)
    yearlyMaximumPensionableEarnings: new Decimal('250000'), // No strict maximum
    yearlyMaximumContribution: new Decimal('40000'),         // Practical limit
    effectiveDate: new Date('2026-01-01'),
  },
  2025: {
    taxYear: 2025,
    employeeRate: new Decimal('0.118'),
    employerRate: new Decimal('0.157'),
    yearlyMaximumPensionableEarnings: new Decimal('250000'),
    yearlyMaximumContribution: new Decimal('38000'),
    effectiveDate: new Date('2025-01-01'),
    expiryDate: new Date('2025-12-31'),
  },
};

/**
 * OTPP earnings thresholds for tiered contributions
 */
interface EarningsTier {
  threshold: Decimal;
  employeeRate: Decimal;
  employerRate: Decimal;
}

const OTPP_TIERS_2026: EarningsTier[] = [
  {
    threshold: new Decimal('68500'),   // Up to CPP maximum
    employeeRate: new Decimal('0.106'), // 10.6%
    employerRate: new Decimal('0.146'), // 14.6%
  },
  {
    threshold: new Decimal('999999999'), // Above CPP maximum
    employeeRate: new Decimal('0.138'), // 13.8%
    employerRate: new Decimal('0.176'), // 17.6%
  },
];

/**
 * OTPP Processor
 */
export class OTTPProcessor extends BasePensionProcessor {
  private earningsTiers: EarningsTier[] = OTPP_TIERS_2026;

  constructor(config: PensionPlanConfig) {
    super('otpp' as PensionPlanType, config);
  }

  /**
   * Initialize the processor
   */
  async initialize(): Promise<void> {
    this.logInfo('Initializing OTPP processor', {
      planType: this.type,
      environment: this.environment,
    });

    // Load contribution rates into cache
    for (const [year, rate] of Object.entries(CONTRIBUTION_RATES)) {
      this.contributionRatesCache.set(parseInt(year), rate);
    }

    // Validate employer account number
    if (!this.config.employerAccountNumber) {
      this.logWarn('No employer account number provided for OTPP');
    }

    this.initialized = true;
    this.logInfo('OTPP processor initialized successfully', {
      employerAccountNumber: this.config.employerAccountNumber ? '***' + this.config.employerAccountNumber.slice(-4) : 'not set',
    });
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

    // OTPP requires members to be in Ontario
    if (member.province && member.province.toUpperCase() !== 'ON') {
      throw new PensionProcessorError(
        `OTPP is only available for Ontario teachers (member province: ${member.province})`,
        this.type,
        'INVALID_PROVINCE'
      );
    }

    const taxYear = this.getTaxYear(earnings.periodEndDate);
    const rates = await this.getContributionRates(taxYear);

    // All earnings are pensionable for OTPP (no basic exemption)
    const pensionableEarnings = earnings.pensionableEarnings;

    // Calculate contributions using tiered rates
    const { employeeContribution, employerContribution } = 
      this.calculateTieredContributions(pensionableEarnings, ytdEarnings);

    // Check if approaching maximum contribution
    const newYTDEmployeeContribution = ytdContributions.plus(employeeContribution);
    const _newYTDEmployerContribution = ytdContributions.plus(employerContribution);

    if (newYTDEmployeeContribution.greaterThan(rates.yearlyMaximumContribution)) {
      this.logWarn('Approaching maximum contribution limit', {
        memberId: member.id,
        ytdContribution: newYTDEmployeeContribution.toString(),
        maximum: rates.yearlyMaximumContribution.toString(),
      });
    }

    const totalContribution = employeeContribution.plus(employerContribution);

    // Determine effective rates (weighted average)
    const effectiveEmployeeRate = employeeContribution.dividedBy(pensionableEarnings);
    const effectiveEmployerRate = employerContribution.dividedBy(pensionableEarnings);

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
      pensionableEarnings,
      
      employeeContribution: this.roundCurrency(employeeContribution),
      employerContribution: this.roundCurrency(employerContribution),
      totalContribution: this.roundCurrency(totalContribution),
      
      employeeRate: effectiveEmployeeRate,
      employerRate: effectiveEmployerRate,
      
      ytdPensionableEarnings: ytdEarnings.plus(pensionableEarnings),
      ytdEmployeeContribution: ytdContributions.plus(employeeContribution),
      ytdEmployerContribution: ytdContributions.plus(employerContribution),
      
      yearlyMaximumPensionableEarnings: rates.yearlyMaximumPensionableEarnings,
      yearlyMaximumContribution: rates.yearlyMaximumContribution,
      
      calculatedAt: new Date(),
      taxYear,
      metadata: {
        tieredCalculation: true,
        employmentStatus: member.employmentStatus,
      },
    };

    this.logInfo('OTPP contribution calculated', {
      memberId: member.id,
      employeeContribution: employeeContribution.toString(),
      employerContribution: employerContribution.toString(),
      effectiveEmployeeRate: effectiveEmployeeRate.toFixed(4),
      effectiveEmployerRate: effectiveEmployerRate.toFixed(4),
    });

    return calculation;
  }

  /**
   * Calculate tiered contributions based on earnings thresholds
   */
  private calculateTieredContributions(
    pensionableEarnings: Decimal,
    ytdEarnings: Decimal
  ): { employeeContribution: Decimal; employerContribution: Decimal } {
    let employeeContribution = new Decimal(0);
    let employerContribution = new Decimal(0);
    let remainingEarnings = pensionableEarnings;
    let currentYTD = ytdEarnings;

    for (let i = 0; i < this.earningsTiers.length; i++) {
      const tier = this.earningsTiers[i];
      const previousThreshold = i > 0 ? this.earningsTiers[i - 1].threshold : new Decimal(0);
      const tierMax = tier.threshold;

      // Calculate how much of current earnings fall in this tier
      let earningsInTier = new Decimal(0);

      if (currentYTD.lessThan(tierMax)) {
        // Some or all earnings in this tier
        const spaceInTier = tierMax.minus(currentYTD);
        earningsInTier = Decimal.min(remainingEarnings, spaceInTier);
        
        if (currentYTD.lessThan(previousThreshold)) {
          // Need to account for previous tier space
          earningsInTier = Decimal.min(remainingEarnings, tierMax.minus(previousThreshold));
        }
      }

      if (earningsInTier.greaterThan(0)) {
        employeeContribution = employeeContribution.plus(
          earningsInTier.times(tier.employeeRate)
        );
        employerContribution = employerContribution.plus(
          earningsInTier.times(tier.employerRate)
        );

        remainingEarnings = remainingEarnings.minus(earningsInTier);
        currentYTD = currentYTD.plus(earningsInTier);
      }

      if (remainingEarnings.lessThanOrEqualTo(0)) {
        break;
      }
    }

    return { employeeContribution, employerContribution };
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
    // OTPP includes most employment earnings
    const nonPensionableTypes = [
      'expense_reimbursement',
      'workers_compensation',
      'disability_long_term', // Short-term is pensionable
    ];

    return !nonPensionableTypes.includes(earningsType.toLowerCase());
  }

  /**
   * Submit remittance to OTPP
   */
  async submitRemittance(remittanceId: string): Promise<ContributionRemittance> {
    this.ensureInitialized();

    if (!this.config.employerAccountNumber) {
      throw new PensionProcessorError(
        'Employer account number required for OTPP remittance',
        this.type,
        'MISSING_ACCOUNT_NUMBER'
      );
    }

    this.logInfo('Submitting remittance to OTPP', {
      remittanceId,
      employerAccount: '***' + this.config.employerAccountNumber.slice(-4),
      environment: this.environment,
    });

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 100));

    if (this.environment === 'sandbox') {
      const confirmationNumber = `OTPP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      this.logInfo('Remittance submitted successfully (sandbox)', {
        remittanceId,
        confirmationNumber,
      });

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
      'Production OTPP remittance submission not yet implemented',
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

    this.logInfo('Generating OTPP annual statement', {
      memberId,
      taxYear,
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
      metadata: {
        employerAccountNumber: this.config.employerAccountNumber,
      },
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
      supportsBuyBack: true,           // OTPP supports service buy-back
      supportsEarlyRetirement: true,   // OTPP has early retirement options
      minimumAge: undefined,           // No minimum age for contribution
      maximumAge: undefined,           // Can contribute past retirement
    };
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
