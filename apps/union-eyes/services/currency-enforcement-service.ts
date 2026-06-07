// Currency Enforcement Service
// Enforces CAD-only pricing for all invoices per CRA transfer pricing rules
// Implements Bank of Canada noon rate FX conversions and T106 filing

import { db } from '@/db';
import { crossBorderTransactions, t106Filings, type NewCrossBorderTransaction } from '@/db/schema/domains/finance';
import { eq, and, gte, desc } from 'drizzle-orm';
import { logger } from '@/lib/logger';

/**
 * Currency Enforcement Service
 * 
 * CRA Requirements:
 * - All Canadian invoices must be in CAD
 * - Cross-border transactions require T106 filing if >$1M CAD
 * - FX conversions must use Bank of Canada noon rate
 */

const _DEFAULT_CURRENCY = 'CAD';
const T106_THRESHOLD = 1000000; // $1M CAD

export class CurrencyEnforcementService {
  /**
   * Enforce CAD Currency
   * All invoices must be in CAD per CRA transfer pricing rules
   */
  async enforceCurrencyCAD(invoice: {
    amount: number;
    currency: string;
    customerId: string;
    invoiceDate: Date;
  }): Promise<{ approved: boolean; reason?: string; amountCAD?: number }> {
    // Check if invoice is already in CAD
    if (invoice.currency === 'CAD') {
      return {
        approved: true,
        amountCAD: invoice.amount,
      };
    }

    // Reject non-CAD invoices
    return {
      approved: false,
      reason: `All invoices must be in CAD per CRA transfer pricing rules. Provided currency: ${invoice.currency}. Please convert to CAD using Bank of Canada noon rate.`,
    };
  }

  /**
   * Convert USD to CAD
   * Uses Bank of Canada noon rate (official FX rate)
   */
  async convertUSDToCAD(amountUSD: number, date: Date): Promise<{
    amountCAD: number;
    exchangeRate: number;
    rateDate: Date;
    source: string;
  }> {
    const rate = await this.getBankOfCanadaNoonRate(date);
    
    return {
      amountCAD: amountUSD * rate,
      exchangeRate: rate,
      rateDate: date,
      source: 'Bank of Canada (FXUSDCAD)',
    };
  }

  /**
   * Get Bank of Canada Noon Rate
   * Official FX rate published daily by Bank of Canada
   */
  async getBankOfCanadaNoonRate(date: Date): Promise<number> {
    try {
      // Bank of Canada Valet API (public, no auth required)
      // https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json
      const dateStr = date.toISOString().split('T')[0];
      
      const response = await fetch(
        `https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?start_date=${dateStr}&end_date=${dateStr}`
      );
      
      if (!response.ok) {
        throw new Error(`Bank of Canada API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.observations || data.observations.length === 0) {
        throw new Error(`No FX rate available for date: ${dateStr}`);
      }
      
      const rate = parseFloat(data.observations[0].FXUSDCAD.v);
      
      if (isNaN(rate)) {
        throw new Error(`Invalid FX rate received: ${data.observations[0].FXUSDCAD.v}`);
      }
      
      return rate;
    } catch (error) {
      // Fallback to cached rate or manual entry
        logger.error('Failed to fetch Bank of Canada rate', { error });
      
      // Get most recent cached rate
      const cachedRate = await this.getCachedBOCRate(date);
      if (cachedRate) {
          logger.warn('Using cached BOC rate', {
            date: cachedRate.date,
            rate: cachedRate.rate,
          });
        return cachedRate.rate;
      }
      
      throw new Error('Unable to fetch or find cached Bank of Canada FX rate');
    }
  }

  /**
   * Get Cached BOC Rate
   * Retrieve most recent cached exchange rate
   */
  private async getCachedBOCRate(targetDate: Date): Promise<{ rate: number; date: Date } | null> {
    const recentTransaction = await db
      .select()
      .from(crossBorderTransactions)
      .where(
        and(
          eq(crossBorderTransactions.currency, 'USD'),
          gte(crossBorderTransactions.transactionDate, new Date(targetDate.getTime() - 7 * 24 * 60 * 60 * 1000)) // Within 7 days
        )
      )
      .orderBy(desc(crossBorderTransactions.transactionDate))
      .limit(1);
    
    if (recentTransaction[0]?.bocNoonRate) {
      return {
        rate: Number(recentTransaction[0].bocNoonRate),
        date: recentTransaction[0].transactionDate,
      };
    }
    
    return null;
  }

  /**
   * Check T106 Requirement
   * T106 = Information Return of Non-Arm's Length Transactions with Non-Residents
   * Required for transactions >$1M CAD with related parties
   */
  async checkT106Requirement(transaction: {
    amount: number;
    currency: string;
    counterpartyCountry: string;
    isRelatedParty: boolean;
    transactionDate: Date;
  }): Promise<{
    requiresT106: boolean;
    reason: string;
    amountCAD?: number;
  }> {
    // T106 only applies to non-resident related parties
    if (transaction.counterpartyCountry === 'CA') {
      return {
        requiresT106: false,
        reason: 'Canadian counterparty - T106 not required',
      };
    }

    if (!transaction.isRelatedParty) {
      return {
        requiresT106: false,
        reason: 'Not a related-party transaction - T106 not required',
      };
    }

    // Convert to CAD if needed
    let amountCAD = transaction.amount;
    if (transaction.currency !== 'CAD') {
      const conversion = await this.convertUSDToCAD(transaction.amount, transaction.transactionDate);
      amountCAD = conversion.amountCAD;
    }

    // Check if exceeds $1M threshold
    if (amountCAD > T106_THRESHOLD) {
      return {
        requiresT106: true,
        reason: `Transaction of $${amountCAD.toLocaleString('en-CA')} CAD exceeds $1M threshold for related-party non-resident transactions`,
        amountCAD,
      };
    }

    return {
      requiresT106: false,
      reason: `Transaction of $${amountCAD.toLocaleString('en-CA')} CAD below $1M threshold`,
      amountCAD,
    };
  }

  /**
   * Record Cross-Border Transaction
   * Track all cross-border transactions for T106 filing
   */
  async recordCrossBorderTransaction(data: NewCrossBorderTransaction) {
    // Check T106 requirement
    const t106Check = await this.checkT106Requirement({
      amount: Number(data.amountCAD),
      currency: data.currency || 'CAD',
      counterpartyCountry: data.counterpartyCountry,
      isRelatedParty: data.isRelatedParty || false,
      transactionDate: data.transactionDate,
    });

    // Get BOC rate if USD transaction
    let bocNoonRate = null;
    if (data.currency === 'USD') {
      bocNoonRate = await this.getBankOfCanadaNoonRate(data.transactionDate);
    }

    const [transaction] = await db.insert(crossBorderTransactions).values({
      ...data,
      requiresT106: t106Check.requiresT106,
      bocNoonRate: bocNoonRate ? bocNoonRate.toString() : null,
    }).returning();

    // Create T106 filing task if required
    if (t106Check.requiresT106) {
      await this.flagForT106Filing(transaction.id, data.transactionDate.getFullYear());
    }

    return transaction;
  }

  /**
   * Flag for T106 Filing
   * Create task for T106 filing (due June 30 following tax year)
   */
  private async flagForT106Filing(transactionId: string, taxYear: number): Promise<void> {
    // Check if filing already exists for this tax year
    const existingFiling = await db
      .select()
      .from(t106Filings)
      .where(eq(t106Filings.taxYear, taxYear))
      .limit(1);

    if (!existingFiling[0]) {
      // Create new T106 filing task
      const filingDeadline = new Date(`${taxYear + 1}-06-30`);
      
      await db.insert(t106Filings).values({
        taxYear,
        filingDeadline,
        status: 'pending',
        transactionIds: [transactionId],
      });
    } else {
      // Add transaction to existing filing
      const currentTransactionIds = existingFiling[0].transactionIds as string[] || [];
      if (!currentTransactionIds.includes(transactionId)) {
        currentTransactionIds.push(transactionId);
        
        await db
          .update(t106Filings)
          .set({
            transactionIds: currentTransactionIds,
          })
          .where(eq(t106Filings.id, existingFiling[0].id));
      }
    }
  }

  /**
   * Generate T106 Filing
   * Generate T106 form for CRA submission
   */
  async generateT106Filing(taxYear: number): Promise<{
    taxYear: number;
    businessNumber: string;
    transactions: Array<{
      transactionId: string;
      nonResidentName: string;
      nonResidentCountry: string;
      transactionType: string;
      amountCAD: number;
      transferPricingMethod: string;
    }>;
    totalAmount: number;
    filingDeadline: Date;
  }> {
    // Get all transactions requiring T106 for this tax year
    const transactions = await db
      .select()
      .from(crossBorderTransactions)
      .where(
        and(
          eq(crossBorderTransactions.requiresT106, true),
          gte(crossBorderTransactions.transactionDate, new Date(`${taxYear}-01-01`)),
          gte(crossBorderTransactions.transactionDate, new Date(`${taxYear}-12-31`))
        )
      );

    if (transactions.length === 0) {
      throw new Error(`No T106-eligible transactions found for tax year ${taxYear}`);
    }

    const totalAmount = transactions.reduce((sum, t) => sum + Number(t.amountCAD), 0);

    const t106Form = {
      taxYear,
      businessNumber: process.env.UNION_BN || 'BUSINESS_NUMBER_NOT_SET',
      transactions: transactions.map(t => ({
        transactionId: t.id,
        nonResidentName: t.counterpartyName,
        nonResidentCountry: t.counterpartyCountry,
        transactionType: t.transactionType || 'service',
        amountCAD: Number(t.amountCAD),
        transferPricingMethod: 'Comparable Uncontrolled Price (CUP)',
      })),
      totalAmount,
      filingDeadline: new Date(`${taxYear + 1}-06-30`),
    };

    // Mark filing as generated
    await db
      .update(t106Filings)
      .set({
        status: 'generated',
        generatedAt: new Date(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        filingData: t106Form as any,
      })
      .where(eq(t106Filings.taxYear, taxYear));

    return t106Form;
  }

  /**
   * Get T106 Filing Status
   * Check status of T106 filings by tax year
   */
  async getT106FilingStatus(taxYear?: number): Promise<Array<{
    taxYear: number;
    status: string;
    transactionCount: number;
    totalAmount: number;
    filingDeadline: Date;
    daysToDue: number;
  }>> {
    const currentYear = new Date().getFullYear();
    const targetYear = taxYear || currentYear - 1; // Default to previous year

    const filings = await db
      .select()
      .from(t106Filings)
      .where(taxYear ? eq(t106Filings.taxYear, taxYear) : gte(t106Filings.taxYear, targetYear - 2));

    return filings.map(filing => {
      const transactionIds = filing.transactionIds as string[] || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filingData = filing.filingData as any;
      const daysToDue = Math.floor((filing.filingDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      return {
        taxYear: filing.taxYear,
        status: filing.status,
        transactionCount: transactionIds.length,
        totalAmount: filingData?.totalAmount || 0,
        filingDeadline: filing.filingDeadline,
        daysToDue,
      };
    });
  }

  /**
   * Billing API Integration
   * Enforce CAD currency on all billing operations
   */
  async validateBillingRequest(billingData: {
    customerId: string;
    amount: number;
    currency: string;
    description: string;
    invoiceDate: Date;
  }): Promise<{ valid: boolean; error?: string }> {
    // Enforce CAD currency
    const enforcement = await this.enforceCurrencyCAD({
      amount: billingData.amount,
      currency: billingData.currency,
      customerId: billingData.customerId,
      invoiceDate: billingData.invoiceDate,
    });

    if (!enforcement.approved) {
      return {
        valid: false,
        error: enforcement.reason,
      };
    }

    return { valid: true };
  }

  /**
   * Get Currency Enforcement Report
   * Dashboard summary of currency enforcement and T106 status
   */
  async getCurrencyEnforcementReport(): Promise<{
    cadEnforcement: {
      totalInvoices: number;
      cadInvoices: number;
      nonCADRejected: number;
      complianceRate: number;
    };
    t106Status: {
      currentYearTransactions: number;
      pendingFilings: number;
      completedFilings: number;
      upcomingDeadlines: Array<{ taxYear: number; deadline: Date; daysToDue: number }>;
    };
    bocRateUsage: {
      conversionsThisMonth: number;
      lastRateDate: Date;
      lastRate: number;
    };
  }> {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();

    // CAD enforcement stats
    const allTransactions = await db.select().from(crossBorderTransactions);
    const cadTransactions = allTransactions.filter(t => t.currency === 'CAD');
    
    // T106 status
    const t106Filings = await this.getT106FilingStatus();
    const pendingFilings = t106Filings.filter(f => f.status === 'pending' || f.status === 'generated');
    const completedFilings = t106Filings.filter(f => f.status === 'filed');
    const upcomingDeadlines = t106Filings
      .filter(f => f.daysToDue > 0 && f.daysToDue < 90)
      .map(f => ({
        taxYear: f.taxYear,
        deadline: f.filingDeadline,
        daysToDue: f.daysToDue,
      }));

    // BOC rate usage
    const thisMonthTransactions = allTransactions.filter(
      t => t.transactionDate.getMonth() === currentMonth && t.transactionDate.getFullYear() === currentYear
    );
    const conversions = thisMonthTransactions.filter(t => t.currency === 'USD' && t.bocNoonRate);
    const lastConversion = conversions[conversions.length - 1];

    return {
      cadEnforcement: {
        totalInvoices: allTransactions.length,
        cadInvoices: cadTransactions.length,
        nonCADRejected: allTransactions.length - cadTransactions.length,
        complianceRate: allTransactions.length > 0 
          ? Math.round((cadTransactions.length / allTransactions.length) * 100)
          : 100,
      },
      t106Status: {
        currentYearTransactions: allTransactions.filter(
          t => t.transactionDate.getFullYear() === currentYear && t.requiresT106
        ).length,
        pendingFilings: pendingFilings.length,
        completedFilings: completedFilings.length,
        upcomingDeadlines,
      },
      bocRateUsage: {
        conversionsThisMonth: conversions.length,
        lastRateDate: lastConversion?.transactionDate || new Date(),
        lastRate: lastConversion?.bocNoonRate ? Number(lastConversion.bocNoonRate) : 0,
      },
    };
  }
}

// Export singleton instance
export const currencyEnforcementService = new CurrencyEnforcementService();
