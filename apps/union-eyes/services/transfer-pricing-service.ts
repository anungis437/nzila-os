import { db } from "@/db";
import {
  currencyEnforcementPolicy,
  bankOfCanadaRates,
  transactionCurrencyConversions,
  currencyEnforcementViolations,
  t106FilingTracking,
  transferPricingDocumentation,
  fxRateAuditLog,
  currencyEnforcementAudit,
} from "@/db/schema/domains/finance";
import { eq, and, gte, desc } from "drizzle-orm";

/**
 * Transfer Pricing & Currency Service
 * Enforces CAD-only transactions, Bank of Canada FX rates, T106 filing
 */

export interface ForeignTransactionRequest {
  transactionId: string;
  originalCurrency: string;
  originalAmount: number;
  transactionType: string;
  exceptionReason?: string;
  requestedBy: string;
}

export interface T106FilingData {
  fiscalYear: string;
  reportableTransactions: string[];
  totalCADEquivalent: number;
}

export interface TransferPricingDoc {
  transactionId: string;
  transactionType: string;
  fromParty: string;
  toParty: string;
  cadAmount: number;
  pricingJustification: string;
  documentedBy: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  comparableTransactions?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supportingDocuments?: any[];
}

export class TransferPricingService {
  private static readonly MANDATORY_CURRENCY = "CAD";
  private static readonly T106_THRESHOLD_CAD = 1000000.0; // $1M
  private static readonly BOC_API_URL = "https://www.bankofcanada.ca/valet/observations";

  /**
   * Enforce CAD-only transaction policy
   */
  static async validateTransactionCurrency(
    currency: string,
    amount: number,
    transactionId: string,
    userId: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    const policy = await this.getEnforcementPolicy();

    if (!policy.enforcementEnabled) {
      return { allowed: true };
    }

    if (currency === this.MANDATORY_CURRENCY) {
      return { allowed: true };
    }

    // Foreign currency attempted - log violation
    await this.logViolation({
      violationType: "foreign_currency_used",
      violationDescription: `Transaction attempted in ${currency} (${amount}), CAD is mandatory`,
      transactionId,
      attemptedCurrency: currency,
      attemptedAmount: amount,
      attemptedBy: userId,
    });

    return {
      allowed: false,
      reason: `Only CAD transactions are permitted. Please convert to CAD using Bank of Canada rates.`,
    };
  }

  /**
   * Convert foreign currency to CAD using Bank of Canada noon rates
   */
  static async convertToCAN(request: ForeignTransactionRequest): Promise<{
    cadAmount: number;
    fxRate: number;
    rateDate: Date;
  }> {
    const _policy = await this.getEnforcementPolicy();

    // Get latest Bank of Canada rate for currency
    const rate = await this.getBankOfCanadaRate(request.originalCurrency);

    if (!rate) {
      throw new Error(
        `No Bank of Canada rate available for ${request.originalCurrency}. Cannot process transaction.`
      );
    }

    // Calculate CAD amount
    const cadAmount = request.originalAmount * parseFloat(rate.noonRate);

    // Record conversion
    const [_conversion] = await db
      .insert(transactionCurrencyConversions)
      .values({
        transactionId: request.transactionId,
        transactionType: request.transactionType,
        originalCurrency: request.originalCurrency,
        originalAmount: request.originalAmount.toFixed(2),
        cadAmount: cadAmount.toFixed(2),
        fxRateUsed: rate.noonRate,
        fxRateDate: rate.rateDate,
        fxRateSource: "bank_of_canada",
        exceptionApproved: !!request.exceptionReason,
        exceptionReason: request.exceptionReason,
        conversionMethod: "noon_rate",
      })
      .returning();

    // Audit log
    await this.logAuditAction({
      actionType: "currency_converted",
      actionDescription: `Converted ${request.originalCurrency} ${request.originalAmount} to CAD ${cadAmount.toFixed(2)} using Bank of Canada noon rate`,
      transactionId: request.transactionId,
      affectedCurrency: request.originalCurrency,
      affectedAmount: request.originalAmount,
      performedBy: request.requestedBy,
    });

    // Check if T106 filing threshold exceeded
    await this.checkT106Threshold(cadAmount);

    return {
      cadAmount,
      fxRate: parseFloat(rate.noonRate),
      rateDate: rate.rateDate,
    };
  }

  /**
   * Get Bank of Canada FX rate for currency
   */
  static async getBankOfCanadaRate(currency: string) {
    // Check if rate exists for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingRate = await db
      .select()
      .from(bankOfCanadaRates)
      .where(
        and(
          eq(bankOfCanadaRates.currency, currency),
          gte(bankOfCanadaRates.rateDate, today)
        )
      )
      .orderBy(desc(bankOfCanadaRates.rateDate))
      .limit(1);

    if (existingRate.length > 0) {
      return existingRate[0];
    }

    // Fetch from Bank of Canada API
    // Production: Implement automated daily rate imports via scheduled job
    // API endpoint: https://www.bankofcanada.ca/valet/observations/
    // Required currencies: USD, EUR, GBP, JPY, AUD, etc.
    // Schedule: Import daily at 1:30 PM ET after BoC noon rate publication
    // Implementation steps:
    //   1. Create scheduled job (packages/jobs/src/fx-rates-import.ts)
    //   2. Configure cron: 0 18 * * 1-5 (1:00 PM ET Mon-Fri, UTC)
    //   3. Call BoC Valet API with date range: 
    //      GET /valet/observations/FXUSDCAD,FXEURCAD,FXGBPCAD/csv?start_date=YYYY-MM-DD
    //   4. Parse CSV response and call importBankOfCanadaRates()
    //   5. Handle holidays/weekends (use previous business day rate)
    //   6. Add alerting for import failures (affects transaction processing)
    //
    // For now, rates must be manually imported or synchronized from external source
    throw new Error(
      `Bank of Canada rate for ${currency} not available in database. ` +
      `Import latest rates using importBankOfCanadaRates() or set up automated daily imports. ` +
      `See https://www.bankofcanada.ca/valet/docs for API documentation.`
    );
  }

  /**
   * Import Bank of Canada FX rates (daily job)
   */
  static async importBankOfCanadaRates(
    rates: { currency: string; noonRate: number; rateDate: Date }[]
  ) {
    const imported = [];

    for (const rate of rates) {
      const [importedRate] = await db
        .insert(bankOfCanadaRates)
        .values({
          rateDate: rate.rateDate,
          currency: rate.currency,
          noonRate: rate.noonRate.toFixed(8),
          source: "bank_of_canada_api",
          dataQuality: "official",
        })
        .returning();

      imported.push(importedRate);

      // Audit log
      await this.logFXRateAction({
        actionType: "rate_imported",
        actionDescription: `Imported Bank of Canada noon rate for ${rate.currency}: ${rate.noonRate}`,
        currency: rate.currency,
        rateDate: rate.rateDate,
        newRate: rate.noonRate,
      });
    }

    return imported;
  }

  /**
   * Check if T106 filing threshold exceeded (>$1M foreign transactions)
   */
  private static async checkT106Threshold(cadAmount: number) {
    if (cadAmount < this.T106_THRESHOLD_CAD) {
      return;
    }

    const currentYear = new Date().getFullYear().toString();

    // Get or create T106 tracking record for current fiscal year
    let tracking = await db
      .select()
      .from(t106FilingTracking)
      .where(eq(t106FilingTracking.fiscalYear, currentYear))
      .limit(1);

    if (tracking.length === 0) {
      // Create new tracking record
      const [newTracking] = await db
        .insert(t106FilingTracking)
        .values({
          fiscalYear: currentYear,
          totalForeignTransactions: "0.00",
          totalCADEquivalent: "0.00",
          t106ThresholdExceeded: false,
          t106FilingRequired: false,
          filingStatus: "not_required",
        })
        .returning();

      tracking = [newTracking];
    }

    const currentTotal = parseFloat(tracking[0].totalCADEquivalent);
    const newTotal = currentTotal + cadAmount;

    // Update tracking
    await db
      .update(t106FilingTracking)
      .set({
        totalCADEquivalent: newTotal.toFixed(2),
        t106ThresholdExceeded: newTotal >= this.T106_THRESHOLD_CAD,
        t106FilingRequired: newTotal >= this.T106_THRESHOLD_CAD,
        filingStatus: newTotal >= this.T106_THRESHOLD_CAD ? "pending" : "not_required",
        updatedAt: new Date(),
      })
      .where(eq(t106FilingTracking.fiscalYear, currentYear));

    // If threshold exceeded, log audit event
    if (newTotal >= this.T106_THRESHOLD_CAD && currentTotal < this.T106_THRESHOLD_CAD) {
      await this.logAuditAction({
        actionType: "t106_threshold_exceeded",
        actionDescription: `T106 filing threshold exceeded for fiscal year ${currentYear}. Total foreign transactions: CAD $${newTotal.toFixed(2)}`,
        performedBy: "system",
        complianceImpact: "high",
      });
    }
  }

  /**
   * File T106 return (>$1M foreign transactions)
   */
  static async fileT106Return(data: T106FilingData, filedBy: string) {
    // Update tracking record
    await db
      .update(t106FilingTracking)
      .set({
        filingStatus: "filed",
        filedDate: new Date(),
        filedBy,
        reportableTransactionIds: data.reportableTransactions,
        reportableTransactionCount: data.reportableTransactions.length.toString(),
        updatedAt: new Date(),
      })
      .where(eq(t106FilingTracking.fiscalYear, data.fiscalYear));

    // Audit log
    await this.logAuditAction({
      actionType: "t106_filed",
      actionDescription: `T106 return filed for fiscal year ${data.fiscalYear}. Total reportable: CAD $${data.totalCADEquivalent.toFixed(2)}`,
      performedBy: filedBy,
      complianceImpact: "high",
    });
  }

  /**
   * Document transfer pricing (arms-length transactions)
   */
  static async documentTransferPricing(doc: TransferPricingDoc) {
    const [documentation] = await db
      .insert(transferPricingDocumentation)
      .values({
        transactionId: doc.transactionId,
        transactionType: doc.transactionType,
        fromParty: doc.fromParty,
        toParty: doc.toParty,
        cadAmount: doc.cadAmount.toFixed(2),
        pricingJustification: doc.pricingJustification,
        comparableTransactions: doc.comparableTransactions,
        supportingDocuments: doc.supportingDocuments,
        documentedBy: doc.documentedBy,
        armsLengthRequired: true,
        armsLengthConfirmed: false, // Requires review
        reviewRequired: true,
      })
      .returning();

    return documentation;
  }

  /**
   * Verify arms-length pricing
   */
  static async verifyArmsLengthPricing(
    documentationId: string,
    reviewedBy: string,
    confirmed: boolean,
    reviewNotes?: string
  ) {
    await db
      .update(transferPricingDocumentation)
      .set({
        armsLengthConfirmed: confirmed,
        reviewedBy,
        reviewedAt: new Date(),
        reviewNotes,
        updatedAt: new Date(),
      })
      .where(eq(transferPricingDocumentation.id, documentationId));

    // Audit log
    await this.logAuditAction({
      actionType: "arms_length_verified",
      actionDescription: `Transfer pricing ${confirmed ? "confirmed" : "rejected"} as arms-length`,
      performedBy: reviewedBy,
      complianceImpact: confirmed ? "none" : "high",
    });
  }

  /**
   * Log currency enforcement violation
   */
  private static async logViolation(params: {
    violationType: string;
    violationDescription: string;
    transactionId?: string;
    attemptedCurrency?: string;
    attemptedAmount?: number;
    attemptedBy: string;
  }) {
    await db.insert(currencyEnforcementViolations).values({
      violationType: params.violationType,
      violationDescription: params.violationDescription,
      transactionId: params.transactionId,
      attemptedCurrency: params.attemptedCurrency,
      attemptedAmount: params.attemptedAmount?.toFixed(2),
      attemptedBy: params.attemptedBy,
      status: "pending",
    });
  }

  /**
   * Log FX rate action
   */
  private static async logFXRateAction(params: {
    actionType: string;
    actionDescription: string;
    currency?: string;
    rateDate?: Date;
    oldRate?: number;
    newRate?: number;
    performedBy?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: any;
  }) {
    await db.insert(fxRateAuditLog).values({
      actionType: params.actionType,
      actionDescription: params.actionDescription,
      currency: params.currency,
      rateDate: params.rateDate,
      oldRate: params.oldRate?.toFixed(8),
      newRate: params.newRate?.toFixed(8),
      performedBy: params.performedBy,
      metadata: params.metadata,
    });
  }

  /**
   * Log currency enforcement audit action
   */
  private static async logAuditAction(params: {
    actionType: string;
    actionDescription: string;
    transactionId?: string;
    affectedCurrency?: string;
    affectedAmount?: number;
    performedBy: string;
    performedByRole?: string;
    complianceImpact?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: any;
  }) {
    await db.insert(currencyEnforcementAudit).values({
      actionType: params.actionType,
      actionDescription: params.actionDescription,
      transactionId: params.transactionId,
      affectedCurrency: params.affectedCurrency,
      affectedAmount: params.affectedAmount?.toFixed(2),
      performedBy: params.performedBy,
      performedByRole: params.performedByRole,
      complianceImpact: params.complianceImpact,
      metadata: params.metadata,
    });
  }

  /**
   * Get enforcement policy
   */
  private static async getEnforcementPolicy() {
    const policies = await db.select().from(currencyEnforcementPolicy).limit(1);

    if (policies.length === 0) {
      // Create default policy
      const [policy] = await db
        .insert(currencyEnforcementPolicy)
        .values({
          enforcementEnabled: true,
          mandatoryCurrency: this.MANDATORY_CURRENCY,
          allowForeignCurrency: false,
          t106FilingRequired: true,
          t106ThresholdCAD: this.T106_THRESHOLD_CAD.toFixed(2),
        })
        .returning();

      return policy;
    }

    return policies[0];
  }

  /**
   * Get T106 filing status for fiscal year
   */
  static async getT106Status(fiscalYear: string) {
    const tracking = await db
      .select()
      .from(t106FilingTracking)
      .where(eq(t106FilingTracking.fiscalYear, fiscalYear))
      .limit(1);

    if (tracking.length === 0) {
      return {
        filingRequired: false,
        thresholdExceeded: false,
        totalCADEquivalent: 0,
        filingStatus: "not_required",
      };
    }

    return tracking[0];
  }

  /**
   * Get all currency enforcement violations
   */
  static async getViolations(status?: string) {
    if (status) {
      return await db
        .select()
        .from(currencyEnforcementViolations)
        .where(eq(currencyEnforcementViolations.status, status))
        .orderBy(desc(currencyEnforcementViolations.createdAt));
    }

    return await db
      .select()
      .from(currencyEnforcementViolations)
      .orderBy(desc(currencyEnforcementViolations.createdAt));
  }
}
