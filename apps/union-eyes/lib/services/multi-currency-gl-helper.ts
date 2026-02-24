/**
 * Multi-Currency GL Helpers
 * 
 * Helper functions for multi-currency general ledger operations:
 * - Transaction posting with currency support
 * - Account revaluation
 * - Exchange gain/loss calculations
 * - Currency balance reporting
 */

import { Decimal } from 'decimal.js';
import { ExchangeRateService } from './exchange-rate-service';
import { logger } from '@/lib/logger';

export interface MultiCurrencyLine {
  accountCode: string;
  debitAmount: Decimal;
  creditAmount: Decimal;
  currency: string;
  originalCurrency?: string;
  originalAmount?: Decimal;
  exchangeRate?: Decimal;
}

export interface RevaluationEntry {
  accountCode: string;
  originalBalance: Decimal;
  originalCurrency: string;
  revaluedBalance: Decimal;
  reportingCurrency: string;
  gainLoss: Decimal;
  revaluationDate: Date;
  exchangeRate: Decimal;
}

export interface CurrencyPair {
  currency1: string;
  currency2: string;
}

/**
 * Multi-Currency GL Helper Functions
 */
export class MultiCurrencyGLHelper {
  /**
   * Convert GL transaction line to reporting currency
   */
  static async convertLineToReportingCurrency(
    line: MultiCurrencyLine,
    reportingCurrency: string,
    transactionDate: Date
  ): Promise<{
    debitAmount: Decimal;
    creditAmount: Decimal;
    exchangeRate: Decimal;
    conversionCurrency?: string;
  }> {
    // If already in reporting currency, no conversion needed
    if (line.currency === reportingCurrency) {
      return {
        debitAmount: line.debitAmount,
        creditAmount: line.creditAmount,
        exchangeRate: new Decimal(1),
      };
    }

    try {
      const conversion = await ExchangeRateService.convertAmount(
        new Decimal(1), // Convert 1 unit first to get rate
        line.currency,
        reportingCurrency,
        transactionDate
      );

      const exchangeRate = conversion.rate;

      return {
        debitAmount: line.debitAmount.times(exchangeRate),
        creditAmount: line.creditAmount.times(exchangeRate),
        exchangeRate,
        conversionCurrency: line.currency,
      };
    } catch (error) {
      logger.error(
        `Failed to convert ${line.currency} to ${reportingCurrency}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Revalue foreign currency account balances
   */
  static async revalueAccount(
    accountCode: string,
    accountBalance: Decimal,
    accountCurrency: string,
    reportingCurrency: string,
    revaluationDate: Date,
    previousRate?: Decimal
  ): Promise<RevaluationEntry> {
    // Get current exchange rate
    const currentRate = await ExchangeRateService.getRate(
      accountCurrency,
      reportingCurrency,
      revaluationDate
    );

    if (!currentRate) {
      throw new Error(
        `Cannot revalue ${accountCode}: rate not available for ${accountCurrency}/${reportingCurrency}`
      );
    }

    const revaluedAmount = accountBalance.times(currentRate.rate);

    // Calculate gain/loss
    let gainLoss = new Decimal(0);
    if (previousRate) {
      const previousRevaluedAmount = accountBalance.times(previousRate);
      gainLoss = revaluedAmount.minus(previousRevaluedAmount);
    }

    return {
      accountCode,
      originalBalance: accountBalance,
      originalCurrency: accountCurrency,
      revaluedBalance: revaluedAmount,
      reportingCurrency,
      gainLoss,
      revaluationDate,
      exchangeRate: currentRate.rate,
    };
  }

  /**
   * Calculate exchange gain/loss for a transaction
   */
  static async calculateExchangeGainLoss(
    originalAmount: Decimal,
    originalCurrency: string,
    settlementCurrency: string,
    transactionDate: Date,
    settlementDate: Date
  ): Promise<{
    transactionDateRate: Decimal;
    settlementDateRate: Decimal;
    gainLoss: Decimal;
  }> {
    const transactionRate = await ExchangeRateService.getRate(
      originalCurrency,
      settlementCurrency,
      transactionDate
    );

    const settlementRate = await ExchangeRateService.getRate(
      originalCurrency,
      settlementCurrency,
      settlementDate
    );

    if (!transactionRate || !settlementRate) {
      throw new Error('Exchange rates not available for gain/loss calculation');
    }

    const transactionAmount = originalAmount.times(transactionRate.rate);
    const settlementAmount = originalAmount.times(settlementRate.rate);
    const gainLoss = settlementAmount.minus(transactionAmount);

    return {
      transactionDateRate: transactionRate.rate,
      settlementDateRate: settlementRate.rate,
      gainLoss,
    };
  }

  /**
   * Validate multi-currency journal entry (debits = credits in base currency)
   */
  static async validateMultiCurrencyEntry(
    lines: MultiCurrencyLine[],
    baseCurrency: string,
    transactionDate: Date
  ): Promise<{
    isValid: boolean;
    totalDebits: Decimal;
    totalCredits: Decimal;
    difference: Decimal;
  }> {
    let totalDebits = new Decimal(0);
    let totalCredits = new Decimal(0);

    for (const line of lines) {
      // Convert to base currency if needed
      if (line.currency !== baseCurrency) {
        const conversion = await ExchangeRateService.convertAmount(
          new Decimal(1),
          line.currency,
          baseCurrency,
          transactionDate
        );

        totalDebits = totalDebits.plus(line.debitAmount.times(conversion.rate));
        totalCredits = totalCredits.plus(line.creditAmount.times(conversion.rate));
      } else {
        totalDebits = totalDebits.plus(line.debitAmount);
        totalCredits = totalCredits.plus(line.creditAmount);
      }
    }

    const difference = totalDebits.minus(totalCredits).abs();
    const tolerance = new Decimal('0.01'); // Allow 1 cent difference due to rounding

    return {
      isValid: difference.lessThanOrEqualTo(tolerance),
      totalDebits,
      totalCredits,
      difference,
    };
  }

  /**
   * Convert statement amounts to multiple currencies for reporting
   */
  static async convertStatementAmounts(
    amounts: { [key: string]: Decimal },
    fromCurrency: string,
    toCurrencies: string[],
    asOfDate: Date
  ): Promise<{ [key: string]: { [key: string]: Decimal } }> {
    const result: { [key: string]: { [key: string]: Decimal } } = {};

    for (const key in amounts) {
      result[key] = {};
      result[key][fromCurrency] = amounts[key];

      for (const toCurrency of toCurrencies) {
        try {
          const conversion = await ExchangeRateService.convertAmount(
            amounts[key],
            fromCurrency,
            toCurrency,
            asOfDate
          );
          result[key][toCurrency] = conversion.convertedAmount;
        } catch (error) {
          logger.warn(
            `Could not convert ${fromCurrency} to ${toCurrency}: ${error}`
          );
        }
      }
    }

    return result;
  }

  /**
   * Get realized vs unrealized FX impact
   */
  static calculateFXImpact(
    bookedAmount: Decimal,
    bookedCurrency: string,
    settledAmount: Decimal,
    _settledCurrency: string,
    _reportingCurrency: string
  ): {
    realized: Decimal;
    unrealized: Decimal;
    total: Decimal;
  } {
    // This is a simplified calculation
    // In real implementation, would track historical booking rates

    return {
      realized: settledAmount.minus(bookedAmount),
      unrealized: new Decimal(0),
      total: settledAmount.minus(bookedAmount),
    };
  }
}
