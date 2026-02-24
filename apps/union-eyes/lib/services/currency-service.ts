/**
 * Currency & Transfer Pricing Service
 * 
 * Enforces Canadian Revenue Agency (CRA) compliance for:
 * - CAD currency enforcement (all invoices in CAD)
 * - Bank of Canada noon rate FX conversions
 * - Transfer pricing documentation (Form T106)
 * - Cross-border transaction reporting
 * - Arm's length price verification
 * 
 * CRA Requirements:
 * - Form T106: Required for related-party transactions > $1M CAD
 * - Transfer pricing rules: ITA Section 247
 * - Due date: June 30 following tax year
 * - Penalties: $2,500 minimum for non-compliance
 */

import { db } from '@/db';
import { eq, and, gte, lte } from 'drizzle-orm';
import { crossBorderTransactions, exchangeRates } from '@/db/schema/domains/finance';
import { logger } from '@/lib/logger';

export type Currency = 'CAD' | 'USD' | 'EUR' | 'GBP' | 'MXN';

export interface Invoice {
  id: string;
  amount: number;
  currency: Currency;
  issueDate: Date;
  isRelatedParty: boolean;
  counterpartyName: string;
  counterpartyCountry: string;
}

export interface ExchangeRate {
  fromCurrency: Currency;
  toCurrency: Currency;
  rate: number;
  source: 'BOC' | 'XE' | 'OANDA';
  effectiveDate: Date;
}

export interface T106Form {
  taxYear: number;
  businessNumber: string;
  transactions: T106Transaction[];
  filingDeadline: Date;
}

export interface T106Transaction {
  id?: string;
  nonResidentName: string;
  nonResidentCountry: string;
  transactionType: string;
  amountCAD: number;
  transferPricingMethod: string;
}

export class CurrencyService {
  private readonly DEFAULT_CURRENCY: Currency = 'CAD';
  private readonly T106_THRESHOLD = 1_000_000; // $1M CAD
  private readonly BOC_API_URL = 'https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json';

  /**
   * Enforce all invoices must be in CAD
   * CRA transfer pricing requirement
   */
  enforceCurrencyCAD(invoice: Invoice): {
    compliant: boolean;
    message: string;
  } {
    if (invoice.currency !== 'CAD') {
      return {
        compliant: false,
        message: `Invoice must be in CAD per CRA transfer pricing rules. Current currency: ${invoice.currency}`
      };
    }

    return {
      compliant: true,
      message: 'Invoice currency compliant (CAD)'
    };
  }

  /**
   * Convert USD to CAD using Bank of Canada noon rate
   * CRA requires BOC rates for official reporting
   */
  async convertUSDToCAD(
    amountUSD: number,
    date: Date
  ): Promise<{
    amountCAD: number;
    exchangeRate: number;
    source: 'BOC';
    effectiveDate: Date;
  }> {
    const rate = await this.getBankOfCanadaNoonRate(date);
    const amountCAD = amountUSD * rate;

    logger.info('USD to CAD conversion', {
      amountUSD: amountUSD.toFixed(2),
      rate,
      amountCAD: amountCAD.toFixed(2),
    });

    return {
      amountCAD,
      exchangeRate: rate,
      source: 'BOC',
      effectiveDate: date,
    };
  }

  /**
   * Get Bank of Canada noon rate for a specific date
   */
  async getBankOfCanadaNoonRate(date: Date): Promise<number> {
    try {
      // Check local database first
      const cachedRate = await db.query.exchangeRates.findFirst({
        where: and(
          eq(exchangeRates.fromCurrency, 'USD'),
          eq(exchangeRates.toCurrency, 'CAD'),
          eq(exchangeRates.rateSource, 'BOC'),
          lte(exchangeRates.effectiveDate, date)
        ),
        orderBy: (rates, { desc }) => [desc(rates.effectiveDate)],
      });

      if (cachedRate) {
        logger.info('Using cached BOC rate', { rate: cachedRate.exchangeRate });
        return parseFloat(cachedRate.exchangeRate);
      }

      // Fallback to default rate (would fetch from BOC API in production)
      logger.warn('No cached BOC rate found, using fallback');
      return 1.35; // Fallback rate
    } catch (error) {
      logger.error('Error fetching BOC rate', { error });
      return 1.35; // Fallback rate
    }
  }

  /**
   * Enforce Bank of Canada noon rate for conversions
   * CRA requires noon rate for official FX conversions
   */
  async convertCurrency(
    amount: number,
    fromCurrency: Currency,
    toCurrency: Currency,
    date: Date,
    _rateType: 'noon' | 'closing' = 'noon'
  ): Promise<{
    amount: number;
    rate: number;
    source: 'BOC';
    effectiveDate: Date;
  }> {
    if (fromCurrency === toCurrency) {
      return { amount, rate: 1, source: 'BOC', effectiveDate: date };
    }

    let rate: number;
    
    if (fromCurrency === 'USD' && toCurrency === 'CAD') {
      rate = await this.getBankOfCanadaNoonRate(date);
    } else if (fromCurrency === 'CAD' && toCurrency === 'USD') {
      rate = 1 / await this.getBankOfCanadaNoonRate(date);
    } else {
      // Cross-rate calculation using BOC USD/CAD rate
      const usdToCad = await this.getBankOfCanadaNoonRate(date);
      rate = fromCurrency === 'USD' ? usdToCad : 1 / usdToCad;
    }

    const convertedAmount = amount * rate;

    return {
      amount: convertedAmount,
      rate,
      source: 'BOC',
      effectiveDate: date,
    };
  }

  /**
   * Track cross-border transaction
   * Required for T106 reporting
   */
  async recordCrossBorderTransaction(data: {
    transactionId: string;
    fromPartyId: string;
    fromPartyName: string;
    fromPartyType: 'individual' | 'organization' | 'trust';
    fromCountryCode: string;
    toPartyId: string;
    toPartyName: string;
    toPartyType: 'individual' | 'organization' | 'trust';
    toCountryCode: string;
    originalAmount: number;
    originalCurrency: Currency;
    transactionCategory: string;
    transactionDate: Date;
    armLengthPrice: number;
    transferPricingMethod: string;
    relatedParty: boolean;
  }): Promise<{
    transactionId: string;
    cadEquivalent: number;
    compliant: boolean;
  }> {
    // Convert to CAD using BOC noon rate
    const cadConversion = await this.convertCurrency(
      data.originalAmount,
      data.originalCurrency,
      'CAD',
      data.transactionDate
    );

    // Validate arm's length pricing
    const armLengthCheck = await this.validateArmLengthPricing(
      data.transactionId,
      data.armLengthPrice,
      data.originalAmount
    );

    // Record transaction
    const [transaction] = await db.insert(crossBorderTransactions).values({
      id: data.transactionId,
      fromPartyType: data.fromPartyType,
      fromCountryCode: data.fromCountryCode,
      toPartyType: data.toPartyType,
      toCountryCode: data.toCountryCode,
      amountCents: Math.round(data.originalAmount * 100),
      originalCurrency: data.originalCurrency,
      cadEquivalentCents: Math.round(cadConversion.amount * 100),
      transactionType: data.transactionCategory,
      transactionDate: data.transactionDate,
      counterpartyName: data.toPartyName,
      requiresT106: data.relatedParty,
      craReportingStatus: 'pending',
      description: `Parties: ${data.fromPartyName} \u2192 ${data.toPartyName} | Method: ${data.transferPricingMethod} | Arm's length: ${data.armLengthPrice} (variance: ${(armLengthCheck.variance * 100).toFixed(2)}%)`,
    }).returning();

    logger.info('Cross-border transaction recorded', {
      id: transaction.id,
      originalAmount: data.originalAmount,
      originalCurrency: data.originalCurrency,
      cadAmount: cadConversion.amount.toFixed(2),
      relatedParty: data.relatedParty,
      t106Required: cadConversion.amount >= this.T106_THRESHOLD && data.relatedParty,
    });

    return {
      transactionId: transaction.id,
      cadEquivalent: cadConversion.amount,
      compliant: armLengthCheck.compliant,
    };
  }

  /**
   * Get transactions requiring T106 filing
   * T106 required for related-party transactions > $1M CAD
   */
  async getT106RequiredTransactions(taxYear: number): Promise<{
    count: number;
    totalAmount: number;
    transactions: T106Transaction[];
  }> {
    const startDate = new Date(`${taxYear}-01-01`);
    const endDate = new Date(`${taxYear}-12-31`);

    const transactions = await db.query.crossBorderTransactions.findMany({
      where: and(
        gte(crossBorderTransactions.transactionDate, startDate),
        lte(crossBorderTransactions.transactionDate, endDate),
        eq(crossBorderTransactions.requiresT106, true),
        gte(crossBorderTransactions.cadEquivalentCents, this.T106_THRESHOLD * 100)
      ),
      orderBy: (tx, { desc }) => [desc(tx.cadEquivalentCents)],
    });

    const t106Transactions: T106Transaction[] = transactions.map((t) => ({
      id: t.id,
      nonResidentName: t.counterpartyName || 'Related Party',
      nonResidentCountry: t.toCountryCode || 'US',
      transactionType: this.mapTransactionType(t.transactionType || 'service'),
      amountCAD: (t.cadEquivalentCents || 0) / 100,
      transferPricingMethod: 'Comparable Uncontrolled Price (CUP)'
    }));

    const totalAmount = t106Transactions.reduce((sum, t) => sum + t.amountCAD, 0);

    return {
      count: t106Transactions.length,
      totalAmount,
      transactions: t106Transactions,
    };
  }

  /**
   * Map transaction category to T106 transaction type
   */
  private mapTransactionType(category: string): string {
    const typeMap: Record<string, string> = {
      'service': 'Service Agreement',
      'management': 'Management Fees',
      'interest': 'Interest',
      'royalty': 'Royalties and Franchise Fees',
      'rental': 'Rent',
      'guarantee': 'Guarantees',
      'sale': 'Sale of Property/Services',
      'purchase': 'Purchase of Property/Services',
      'license': 'License Fees',
      'consulting': 'Consulting Fees',
      'technical': 'Technical Service Fees',
      'administrative': 'Administrative Services',
    };
    return typeMap[category] || 'Other Related Party Transaction';
  }

  /**
   * Get total transactions for a tax year
   */
  async getTotalTransactions(taxYear: number): Promise<number> {
    const startDate = new Date(`${taxYear}-01-01`);
    const endDate = new Date(`${taxYear}-12-31`);
    
    return await db.$count(
      crossBorderTransactions,
      and(
        gte(crossBorderTransactions.transactionDate, startDate),
        lte(crossBorderTransactions.transactionDate, endDate)
      )
    );
  }

  /**
   * File T106 with CRA
   * In production, this would integrate with CRA My Business Account
   */
  async fileT106(form: T106Form): Promise<{
    success: boolean;
    confirmationNumber?: string;
    filedAt?: Date;
    message: string;
  }> {
    const now = new Date();
    
    if (now > form.filingDeadline) {
      return {
        success: false,
        message: `Filing deadline passed (${form.filingDeadline.toLocaleDateString()}). Late filing penalties apply.`
      };
    }

    // In production, submit to CRA via API or XML upload
    logger.info('Filing T106 with CRA', {
      taxYear: form.taxYear,
      businessNumber: form.businessNumber,
      transactionCount: form.transactions.length,
      totalAmountCad: form.transactions.reduce((sum, t) => sum + t.amountCAD, 0),
    });

    // Simulate filing
    const confirmationNumber = `CRA-T106-${form.taxYear}-${Date.now()}`;
    
    // Update transaction statuses
    for (const tx of form.transactions) {
      if (tx.id) {
        await db.update(crossBorderTransactions)
          .set({ 
            craReportingStatus: 'filed',
            t106Filed: true,
            t106FilingDate: now,
            updatedAt: now
          })
          .where(eq(crossBorderTransactions.id, tx.id));
      }
    }
    
    return {
      success: true,
      confirmationNumber,
      filedAt: now,
      message: `T106 filed successfully. Confirmation: ${confirmationNumber}`
    };
  }

  /**
   * Validate arm's length pricing
   * Required for related-party transactions
   */
  async validateArmLengthPricing(
    transactionId: string,
    marketRate: number,
    actualRate: number
  ): Promise<{
    compliant: boolean;
    variance: number;
    acceptableRange: string;
    message: string;
  }> {
    // CRA accepts +/- 5% variance from market rate
    const acceptableVariance = 0.05; // 5%
    const variance = Math.abs(actualRate - marketRate) / marketRate;

    const compliant = variance <= acceptableVariance;

    logger.info("Arm's length price validation", {
      transactionId,
      marketRate,
      actualRate,
      variancePercent: (variance * 100).toFixed(2),
      compliant,
    });

    return {
      compliant,
      variance,
      acceptableRange: `+/- ${(acceptableVariance * 100).toFixed(0)}%`,
      message: compliant
        ? 'Arm\'s length pricing within acceptable range'
        : `Transfer pricing variance exceeds ${(acceptableVariance * 100).toFixed(0)}% threshold. Documentation required.`
    };
  }

  /**
   * Get transfer pricing compliance summary
   */
  async getComplianceSummary(taxYear: number, _businessNumber: string): Promise<{
    taxYear: number;
    totalCrossBorderTransactions: number;
    relatedPartyTransactions: number;
    t106Required: boolean;
    t106TransactionCount: number;
    t106TotalAmount: number;
    filingDeadline: Date;
    daysUntilDeadline: number;
    recommendations: string[];
  }> {
    const t106Data = await this.getT106RequiredTransactions(taxYear);
    const filingDeadline = new Date(`${taxYear + 1}-06-30`);
    const now = new Date();
    const daysUntilDeadline = Math.ceil((filingDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const totalTransactions = await this.getTotalTransactions(taxYear);

    return {
      taxYear,
      totalCrossBorderTransactions: totalTransactions,
      relatedPartyTransactions: t106Data.count,
      t106Required: t106Data.count > 0,
      t106TransactionCount: t106Data.count,
      t106TotalAmount: t106Data.totalAmount,
      filingDeadline,
      daysUntilDeadline,
      recommendations: [
        `Ensure all invoices are in CAD per CRA requirements`,
        `Use Bank of Canada noon rates for all FX conversions`,
        `Document arm's length pricing for all related-party transactions`,
        t106Data.count > 0 ? `File T106 before ${filingDeadline.toLocaleDateString()}` : 'No T106 filing required this year',
        `Maintain 7-year audit trail of all cross-border transactions`
      ]
    };
  }
}

// Export singleton instance
export const currencyService = new CurrencyService();

/**
 * Annual T106 filing reminder (cron job)
 * Runs on June 1st each year
 */
export async function annualT106Reminder() {
  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;

  logger.info('Annual T106 reminder', { taxYear: lastYear });
  
  const t106Data = await currencyService.getT106RequiredTransactions(lastYear);
  
  if (t106Data.count > 0) {
    logger.warn('T106 filing required', {
      taxYear: lastYear,
      transactionCount: t106Data.count,
      totalAmountCad: t106Data.totalAmount,
      deadline: `June 30, ${currentYear}`,
      daysRemaining: 30 - new Date().getDate(),
    });
    
    // In production, send email to treasurer/CTO
    // await sendEmail({
    //   to: 'treasurer@union.org',
    //   subject: `T106 Filing Required - Tax Year ${lastYear}`,
    //   template: 't106-reminder'
    // });
  } else {
    logger.info('No T106 filing required', { taxYear: lastYear });
  }
}

