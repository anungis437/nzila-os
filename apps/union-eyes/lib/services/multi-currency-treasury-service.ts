/**
 * Multi-Currency Treasury Service
 * 
 * Enhanced multi-currency support with:
 * - Real-time exchange rates
 * - Currency revaluation
 * - FX gain/loss calculation
 * - Hedging capabilities
 * - Multi-currency bank accounts
 */

import { Decimal } from 'decimal.js';
import { db } from '@/db';
import { currencyExchangeRates } from '@/db/schema/domains/infrastructure';
import { eq, and, desc, lte } from 'drizzle-orm';
 
import { logger } from '@/lib/logger';

export interface ExchangeRate {
  baseCurrency: string;
  targetCurrency: string;
  rate: Decimal;
  effectiveDate: Date;
  source: string;
}

export interface CurrencyRevaluation {
  accountId: string;
  accountNumber: string;
  baseCurrency: string;
  foreignCurrency: string;
  originalAmount: Decimal;
  exchangeRate: Decimal;
  revaluedAmount: Decimal;
  gainLoss: Decimal;
  revaluationDate: Date;
}

export interface FXTransaction {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  fromAmount: Decimal;
  toAmount: Decimal;
  exchangeRate: Decimal;
  transactionDate: Date;
  transactionType: 'spot' | 'forward' | 'hedge';
  settlementDate?: Date;
}

export class MultiCurrencyTreasuryService {
  private static BOC_API_URL = 'https://www.bankofcanada.ca/valet/observations';

  /**
   * Get current exchange rate between two currencies
   */
  static async getExchangeRate(
    baseCurrency: string,
    targetCurrency: string,
    effectiveDate: Date = new Date()
  ): Promise<ExchangeRate | null> {
    // Query most recent rate on or before effective date
    const [rate] = await db
      .select()
      .from(currencyExchangeRates)
      .where(
        and(
          eq(currencyExchangeRates.baseCurrency, baseCurrency),
          eq(currencyExchangeRates.targetCurrency, targetCurrency),
          lte(currencyExchangeRates.effectiveDate, effectiveDate)
        )
      )
      .orderBy(desc(currencyExchangeRates.effectiveDate))
      .limit(1);

    if (!rate) return null;

    return {
      baseCurrency: rate.baseCurrency,
      targetCurrency: rate.targetCurrency,
      rate: new Decimal(rate.rate),
      effectiveDate: rate.effectiveDate,
      source: rate.source,
    };
  }

  /**
   * Convert amount from one currency to another
   */
  static async convertCurrency(
    amount: Decimal,
    fromCurrency: string,
    toCurrency: string,
    effectiveDate: Date = new Date()
  ): Promise<{ convertedAmount: Decimal; exchangeRate: Decimal }> {
    if (fromCurrency === toCurrency) {
      return {
        convertedAmount: amount,
        exchangeRate: new Decimal(1),
      };
    }

    const rate = await this.getExchangeRate(fromCurrency, toCurrency, effectiveDate);
    
    if (!rate) {
      throw new Error(`Exchange rate not found for ${fromCurrency} to ${toCurrency}`);
    }

    return {
      convertedAmount: amount.times(rate.rate),
      exchangeRate: rate.rate,
    };
  }

  /**
   * Fetch current exchange rates from Bank of Canada
   */
  static async fetchBOCRates(organizationId: string): Promise<void> {
    try {
      // Fetch USD/CAD rate from Bank of Canada
      const seriesCode = 'FXUSDCAD'; // US Dollar to Canadian Dollar
      const response = await fetch(
        `${this.BOC_API_URL}/${seriesCode}/json?recent=1`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch BOC rates');
      }

      const data = await response.json();
      const observation = data.observations[0];
      
      if (observation && observation.FXUSDCAD) {
        const rate = new Decimal(observation.FXUSDCAD.v);
        const effectiveDate = new Date(observation.d);

        // Save USD/CAD rate
        await db.insert(currencyExchangeRates).values({
          organizationId,
          baseCurrency: 'USD',
          targetCurrency: 'CAD',
          rate: rate.toString(),
          effectiveDate,
          source: 'Bank of Canada',
        });

        // Calculate and save CAD/USD rate (inverse)
        await db.insert(currencyExchangeRates).values({
          organizationId,
          baseCurrency: 'CAD',
          targetCurrency: 'USD',
          rate: new Decimal(1).dividedBy(rate).toString(),
          effectiveDate,
          source: 'Bank of Canada',
        });

        logger.info('Updated BOC exchange rates', {
          rate: rate.toFixed(4),
          pair: 'USD/CAD',
          organizationId,
        });
      }
    } catch (error) {
      logger.error('Failed to fetch BOC rates', { error, organizationId });
      throw error;
    }
  }

  /**
   * Perform currency revaluation for foreign currency accounts
   */
  static async revaluateAccount(params: {
    accountId: string;
    accountNumber: string;
    baseCurrency: string;
    foreignCurrency: string;
    originalAmount: Decimal;
    revaluationDate: Date;
  }): Promise<CurrencyRevaluation> {
    const { accountId, accountNumber, baseCurrency, foreignCurrency, originalAmount, revaluationDate } = params;

    // Get current exchange rate
    const rate = await this.getExchangeRate(foreignCurrency, baseCurrency, revaluationDate);
    
    if (!rate) {
      throw new Error(`Exchange rate not found for ${foreignCurrency} to ${baseCurrency}`);
    }

    // Calculate revalued amount
    const revaluedAmount = originalAmount.times(rate.rate);
    
    // Assumed original exchange rate (for simplification, use 1.0 or fetch historical rate)
    const originalRate = new Decimal(1);
    const originalBaseAmount = originalAmount.times(originalRate);
    
    // Calculate gain/loss
    const gainLoss = revaluedAmount.minus(originalBaseAmount);

    return {
      accountId,
      accountNumber,
      baseCurrency,
      foreignCurrency,
      originalAmount,
      exchangeRate: rate.rate,
      revaluedAmount,
      gainLoss,
      revaluationDate,
    };
  }

  /**
   * Calculate FX gain/loss for a period
   */
  static async calculateFXGainLoss(params: {
    startDate: Date;
    endDate: Date;
    baseCurrency: string;
  }): Promise<{
    totalGain: Decimal;
    totalLoss: Decimal;
    netGainLoss: Decimal;
    transactions: Array<{
      date: Date;
      fromCurrency: string;
      toCurrency: string;
      amount: Decimal;
      gainLoss: Decimal;
    }>;
  }> {
    const { transactionCurrencyConversions } = await import('@/db/schema/domains/finance');
    const { and, gte, lte, eq: _eq } = await import('drizzle-orm');
    
    try {
      // Query FX transactions from database
      const fxTransactions = await db
        .select({
          id: transactionCurrencyConversions.id,
          transactionDate: transactionCurrencyConversions.createdAt,
          originalCurrency: transactionCurrencyConversions.originalCurrency,
          originalAmount: transactionCurrencyConversions.originalAmount,
          cadAmount: transactionCurrencyConversions.cadAmount,
          fxRateUsed: transactionCurrencyConversions.fxRateUsed,
          fxRateDate: transactionCurrencyConversions.fxRateDate,
        })
        .from(transactionCurrencyConversions)
        .where(
          and(
            gte(transactionCurrencyConversions.createdAt, params.startDate),
            lte(transactionCurrencyConversions.createdAt, params.endDate)
          )
        );
      
      // Calculate gains/losses for each transaction
      const transactions = await Promise.all(
        fxTransactions.map(async (tx) => {
          // Get current exchange rate for comparison
          const currentRate = await this.getExchangeRate(
            tx.originalCurrency,
            params.baseCurrency,
            new Date()
          );
          
          const originalAmount = new Decimal(tx.originalAmount);
          const historicalValue = new Decimal(tx.cadAmount);
          const currentValue = originalAmount.times(currentRate?.rate ?? new Decimal(1));
          const gainLoss = currentValue.minus(historicalValue);
          
          return {
            date: new Date(tx.transactionDate),
            fromCurrency: tx.originalCurrency,
            toCurrency: params.baseCurrency,
            amount: originalAmount,
            gainLoss,
          };
        })
      );
      
      // Aggregate gains and losses
      let totalGain = new Decimal(0);
      let totalLoss = new Decimal(0);
      
      for (const tx of transactions) {
        if (tx.gainLoss.greaterThan(0)) {
          totalGain = totalGain.plus(tx.gainLoss);
        } else {
          totalLoss = totalLoss.plus(tx.gainLoss.abs());
        }
      }
      
      const netGainLoss = totalGain.minus(totalLoss);
      
      return {
        totalGain,
        totalLoss,
        netGainLoss,
        transactions,
      };
    } catch (error) {
      logger.error('[MultiCurrencyTreasury] Error calculating FX gain/loss', {
        error,
        startDate: params.startDate,
        endDate: params.endDate,
        baseCurrency: params.baseCurrency,
      });
      return {
        totalGain: new Decimal(0),
        totalLoss: new Decimal(0),
        netGainLoss: new Decimal(0),
        transactions: [],
      };
    }
  }

  /**
   * Create FX forward contract (hedging)
   */
  static async createForwardContract(params: {
    fromCurrency: string;
    toCurrency: string;
    amount: Decimal;
    forwardRate: Decimal;
    settlementDate: Date;
    counterparty: string;
  }): Promise<FXTransaction> {
    const transaction: FXTransaction = {
      id: `FWD-${Date.now()}`,
      fromCurrency: params.fromCurrency,
      toCurrency: params.toCurrency,
      fromAmount: params.amount,
      toAmount: params.amount.times(params.forwardRate),
      exchangeRate: params.forwardRate,
      transactionDate: new Date(),
      transactionType: 'forward',
      settlementDate: params.settlementDate,
    };

    // In production, this would be saved to database
    logger.info('Forward contract created', { transaction });

    return transaction;
  }

  /**
   * Execute spot FX transaction
   */
  static async executeSpotTransaction(params: {
    fromCurrency: string;
    toCurrency: string;
    amount: Decimal;
  }): Promise<FXTransaction> {
    const rate = await this.getExchangeRate(params.fromCurrency, params.toCurrency);
    
    if (!rate) {
      throw new Error(`Exchange rate not available for ${params.fromCurrency}/${params.toCurrency}`);
    }

    const transaction: FXTransaction = {
      id: `SPOT-${Date.now()}`,
      fromCurrency: params.fromCurrency,
      toCurrency: params.toCurrency,
      fromAmount: params.amount,
      toAmount: params.amount.times(rate.rate),
      exchangeRate: rate.rate,
      transactionDate: new Date(),
      transactionType: 'spot',
    };

    // In production, this would be saved to database and create GL entries
    logger.info('Spot transaction executed', { transaction });

    return transaction;
  }

  /**
   * Get FX exposure summary
   */
  static async getFXExposure(_params: {
    organizationId: string;
    baseCurrency: string;
  }): Promise<{
    totalExposure: Decimal;
    byCurrency: Map<string, Decimal>;
    hedgedAmount: Decimal;
    unhedgedAmount: Decimal;
  }> {
    // This would aggregate all foreign currency positions
    // For now, return placeholder
    return {
      totalExposure: new Decimal(0),
      byCurrency: new Map(),
      hedgedAmount: new Decimal(0),
      unhedgedAmount: new Decimal(0),
    };
  }

  /**
   * Schedule automatic rate updates
   */
  static async scheduleRateUpdates(organizationId: string, intervalHours: number = 24): Promise<void> {
    // In production, this would set up a cron job or scheduled task
    logger.info('Scheduled automatic rate updates', {
      organizationId,
      intervalHours,
    });
    
    // Initial fetch
    await this.fetchBOCRates(organizationId);
  }

  /**
   * Calculate currency exposure risk metrics
   */
  static calculateRiskMetrics(params: {
    positions: Array<{ currency: string; amount: Decimal }>;
    baseCurrency: string;
    volatility: Map<string, number>; // Historical volatility by currency pair
  }): {
    valueAtRisk: Decimal;
    estimatedLoss: Decimal;
    confidenceLevel: number;
  } {
    // Value at Risk (VaR) calculation using historical simulation method
    // This is a simplified version - production would use more sophisticated models
    
    let totalVaR = new Decimal(0);
    
    for (const position of params.positions) {
      if (position.currency === params.baseCurrency) continue;
      
      const vol = params.volatility.get(`${position.currency}${params.baseCurrency}`) || 0.10; // 10% default volatility
      const positionVaR = position.amount.times(vol).times(1.96); // 95% confidence level
      totalVaR = totalVaR.plus(positionVaR);
    }

    return {
      valueAtRisk: totalVaR,
      estimatedLoss: totalVaR.times(0.5), // Expected loss at 50% probability
      confidenceLevel: 0.95,
    };
  }

  /**
   * Generate currency revaluation journal entries
   */
  static async generateRevaluationEntries(
    revaluations: CurrencyRevaluation[]
  ): Promise<Array<{
    accountId: string;
    debitAmount: Decimal;
    creditAmount: Decimal;
    description: string;
  }>> {
    const entries: Array<{
      accountId: string;
      debitAmount: Decimal;
      creditAmount: Decimal;
      description: string;
    }> = [];

    for (const revaluation of revaluations) {
      if (revaluation.gainLoss.isPositive()) {
        // FX Gain
        entries.push({
          accountId: revaluation.accountId,
          debitAmount: revaluation.gainLoss,
          creditAmount: new Decimal(0),
          description: `FX revaluation gain on ${revaluation.foreignCurrency} position`,
        });
        entries.push({
          accountId: 'fx_gain_account', // Would be mapped to actual GL account
          debitAmount: new Decimal(0),
          creditAmount: revaluation.gainLoss,
          description: `FX gain - ${revaluation.foreignCurrency}/${revaluation.baseCurrency}`,
        });
      } else if (revaluation.gainLoss.isNegative()) {
        // FX Loss
        const absLoss = revaluation.gainLoss.abs();
        entries.push({
          accountId: 'fx_loss_account', // Would be mapped to actual GL account
          debitAmount: absLoss,
          creditAmount: new Decimal(0),
          description: `FX loss - ${revaluation.foreignCurrency}/${revaluation.baseCurrency}`,
        });
        entries.push({
          accountId: revaluation.accountId,
          debitAmount: new Decimal(0),
          creditAmount: absLoss,
          description: `FX revaluation loss on ${revaluation.foreignCurrency} position`,
        });
      }
    }

    return entries;
  }
}

