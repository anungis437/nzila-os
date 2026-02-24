/**
 * T106 Statistics Canada Compliance Service
 * 
 * Supports Statistics Canada Labour Organization Survey (LOS)
 * Form T106 for labour organization financial reporting requirements.
 * 
 * Requirements:
 * - Multi-currency transaction tracking
 * - Foreign exchange gain/loss reporting
 * - Currency conversion to CAD for filing
 */

import { Decimal } from 'decimal.js';
import { ExchangeRateService } from './exchange-rate-service';
import { logger } from '@/lib/logger';

export interface T106Section {
  sectionName: string;
  categoryCode: string;
  amount: Decimal;
  currency: string;
  amountCAD: Decimal;
}

export interface T106Report {
  organizationId: string;
  reportingYear: number;
  reportingCurrency: 'CAD';
  reportDate: Date;
  
  // Revenue
  revenue: {
    memberDues: Decimal;
    perCapitaTax: Decimal;
    grants: Decimal;
    investmentIncome: Decimal;
    other: Decimal;
    total: Decimal;
  };

  // Operating Expenses
  operatingExpenses: {
    salaries: Decimal;
    benefits: Decimal;
    office: Decimal;
    utilities: Decimal;
    travel: Decimal;
    communications: Decimal;
    professional: Decimal;
    other: Decimal;
    total: Decimal;
  };

  // Special Expenses
  specialExpenses: {
    strikeFund: Decimal;
    education: Decimal;
    organizing: Decimal;
    other: Decimal;
    total: Decimal;
  };

  // FX Impact (Multi-currency)
  currencyImpact?: {
    realizedGainLoss: Decimal;
    unrealizedGainLoss: Decimal;
    totalFXImpact: Decimal;
  };

  // Assets & Liabilities
  assets: {
    cash: Decimal;
    investments: Decimal;
    fixed: Decimal;
    other: Decimal;
    total: Decimal;
  };

  liabilities: {
    accounts: Decimal;
    shortTerm: Decimal;
    longTerm: Decimal;
    other: Decimal;
    total: Decimal;
  };

  equity: Decimal;
}

export interface T106ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  hasMultiCurrency: boolean;
  hasFXTransactions: boolean;
}

/**
 * T106 Statistics Canada Compliance Service
 */
export class T106ComplianceService {
  /**
   * Generate T106 report for a labor organization
   */
  static async generateT106Report(
    organizationId: string,
    reportingYear: number
  ): Promise<T106Report> {
    const _startDate = new Date(reportingYear, 0, 1); // Jan 1
    const _endDate = new Date(reportingYear, 11, 31); // Dec 31

    logger.info(
      `Generating T106 report for org ${organizationId}, year ${reportingYear}`
    );

    // Placeholder implementation
    // In real implementation, would query GL accounts for actual values
    const report: T106Report = {
      organizationId,
      reportingYear,
      reportingCurrency: 'CAD',
      reportDate: new Date(),

      revenue: {
        memberDues: new Decimal(0),
        perCapitaTax: new Decimal(0),
        grants: new Decimal(0),
        investmentIncome: new Decimal(0),
        other: new Decimal(0),
        total: new Decimal(0),
      },

      operatingExpenses: {
        salaries: new Decimal(0),
        benefits: new Decimal(0),
        office: new Decimal(0),
        utilities: new Decimal(0),
        travel: new Decimal(0),
        communications: new Decimal(0),
        professional: new Decimal(0),
        other: new Decimal(0),
        total: new Decimal(0),
      },

      specialExpenses: {
        strikeFund: new Decimal(0),
        education: new Decimal(0),
        organizing: new Decimal(0),
        other: new Decimal(0),
        total: new Decimal(0),
      },

      assets: {
        cash: new Decimal(0),
        investments: new Decimal(0),
        fixed: new Decimal(0),
        other: new Decimal(0),
        total: new Decimal(0),
      },

      liabilities: {
        accounts: new Decimal(0),
        shortTerm: new Decimal(0),
        longTerm: new Decimal(0),
        other: new Decimal(0),
        total: new Decimal(0),
      },

      equity: new Decimal(0),
    };

    return report;
  }

  /**
   * Convert multi-currency GL balances to CAD for T106 reporting
   */
  static async convertToCADForReporting(
    amounts: { [currency: string]: Decimal },
    asOfDate: Date
  ): Promise<{ [currency: string]: { amount: Decimal; amountCAD: Decimal } }> {
    const result: { [currency: string]: { amount: Decimal; amountCAD: Decimal } } = {};

    for (const [currency, amount] of Object.entries(amounts)) {
      if (currency === 'CAD') {
        result[currency] = {
          amount,
          amountCAD: amount,
        };
      } else {
        try {
          const conversion = await ExchangeRateService.convertAmount(
            amount,
            currency,
            'CAD',
            asOfDate
          );

          result[currency] = {
            amount,
            amountCAD: conversion.convertedAmount,
          };
        } catch (error) {
          logger.error(`Failed to convert ${currency} to CAD:`, error);
          // Use last known rate or fallback
          result[currency] = {
            amount,
            amountCAD: amount, // Placeholder
          };
        }
      }
    }

    return result;
  }

  /**
   * Validate T106 report for compliance
   */
  static validateT106Report(report: T106Report): T106ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let hasMultiCurrency = false;
    let hasFXTransactions = false;

    // Validate revenue total
    const revenueTotal = report.revenue.memberDues
      .plus(report.revenue.perCapitaTax)
      .plus(report.revenue.grants)
      .plus(report.revenue.investmentIncome)
      .plus(report.revenue.other);

    if (!revenueTotal.equals(report.revenue.total)) {
      errors.push('Revenue total does not match sum of components');
    }

    // Validate operating expenses total
    const opExpTotal = report.operatingExpenses.salaries
      .plus(report.operatingExpenses.benefits)
      .plus(report.operatingExpenses.office)
      .plus(report.operatingExpenses.utilities)
      .plus(report.operatingExpenses.travel)
      .plus(report.operatingExpenses.communications)
      .plus(report.operatingExpenses.professional)
      .plus(report.operatingExpenses.other);

    if (!opExpTotal.equals(report.operatingExpenses.total)) {
      errors.push('Operating expenses total does not match sum of components');
    }

    // Validate special expenses total
    const specExpTotal = report.specialExpenses.strikeFund
      .plus(report.specialExpenses.education)
      .plus(report.specialExpenses.organizing)
      .plus(report.specialExpenses.other);

    if (!specExpTotal.equals(report.specialExpenses.total)) {
      errors.push('Special expenses total does not match sum of components');
    }

    // Validate assets total
    const assetsTotal = report.assets.cash
      .plus(report.assets.investments)
      .plus(report.assets.fixed)
      .plus(report.assets.other);

    if (!assetsTotal.equals(report.assets.total)) {
      errors.push('Assets total does not match sum of components');
    }

    // Validate liabilities total
    const liabilitiesTotal = report.liabilities.accounts
      .plus(report.liabilities.shortTerm)
      .plus(report.liabilities.longTerm)
      .plus(report.liabilities.other);

    if (!liabilitiesTotal.equals(report.liabilities.total)) {
      errors.push('Liabilities total does not match sum of components');
    }

    // Validate balance sheet equation: Assets = Liabilities + Equity
    const balanceSheetDifference = report.assets.total
      .minus(report.liabilities.total)
      .minus(report.equity)
      .abs();

    if (balanceSheetDifference.greaterThan(new Decimal('0.01'))) {
      errors.push('Balance sheet does not balance (more than 1 cent difference)');
    }

    // Check for multi-currency
    if (report.currencyImpact) {
      hasMultiCurrency = true;
      if (!report.currencyImpact.totalFXImpact.equals(0)) {
        hasFXTransactions = true;
        warnings.push(
          `FX impact detected: ${report.currencyImpact.totalFXImpact} CAD`
        );
      }
    }

    // Validate required totals are present
    if (report.revenue.total.equals(0)) {
      warnings.push('Revenue total is zero - verify data import');
    }

    // Validate year
    const currentYear = new Date().getFullYear();
    if (report.reportingYear > currentYear) {
      errors.push('Reporting year cannot be in the future');
    }

    if (report.reportingYear < 1900) {
      errors.push('Reporting year invalid');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      hasMultiCurrency,
      hasFXTransactions,
    };
  }

  /**
   * Get Statistics Canada account code mappings
   */
  static getStatCanCodeMappings(): { [glCode: string]: string } {
    return {
      // Revenue Accounts (4000 series)
      '4100-001': 'REV-PER-CAPITA', // Per-Capita Tax Revenue
      '4200-001': 'REV-DUES', // Member Dues
      '4300-001': 'REV-GRANTS', // Grants
      '4400-001': 'REV-INVEST', // Investment Income

      // Expense Accounts (5000 series)
      '5100-001': 'EXP-SALARIES', // Salaries and Wages
      '5200-001': 'EXP-BENEFITS', // Employee Benefits
      '5300-001': 'EXP-OFFICE', // Office Expenses
      '5400-001': 'EXP-TRAVEL', // Travel and Meetings
      '5500-001': 'EXP-COMM', // Communications
      '5600-001': 'EXP-PROFESSIONAL', // Professional Fees

      // Special Expenses (6000 series)
      '6100-001': 'EXP-STRIKE', // Strike Fund
      '6200-001': 'EXP-EDU', // Education and Training
      '6300-001': 'EXP-ORGANIZING', // Organizing

      // Capital Assets (7000 series)
      '7100-001': 'ASSET-FIXED', // Fixed Assets
      '7200-001': 'ASSET-INVEST', // Investments
    };
  }

  /**
   * Format T106 report for filing with Statistics Canada
   */
  static formatForFiling(report: T106Report): string {
    const lines: string[] = [
      `T106 Report - ${report.organizationId}`,
      `Year: ${report.reportingYear}`,
      `Report Date: ${report.reportDate.toISOString().split('T')[0]}`,
      '',
      'REVENUE',
      `Member Dues,${report.revenue.memberDues}`,
      `Per-Capita Tax,${report.revenue.perCapitaTax}`,
      `Grants,${report.revenue.grants}`,
      `Investment Income,${report.revenue.investmentIncome}`,
      `Other Revenue,${report.revenue.other}`,
      `Total Revenue,${report.revenue.total}`,
      '',
      'OPERATING EXPENSES',
      `Salaries & Wages,${report.operatingExpenses.salaries}`,
      `Benefits,${report.operatingExpenses.benefits}`,
      `Office,${report.operatingExpenses.office}`,
      `Utilities,${report.operatingExpenses.utilities}`,
      `Travel,${report.operatingExpenses.travel}`,
      `Communications,${report.operatingExpenses.communications}`,
      `Professional Fees,${report.operatingExpenses.professional}`,
      `Other,${report.operatingExpenses.other}`,
      `Total Operating Expenses,${report.operatingExpenses.total}`,
      '',
      'SPECIAL EXPENSES',
      `Strike Fund,${report.specialExpenses.strikeFund}`,
      `Education & Training,${report.specialExpenses.education}`,
      `Organizing,${report.specialExpenses.organizing}`,
      `Other,${report.specialExpenses.other}`,
      `Total Special Expenses,${report.specialExpenses.total}`,
    ];

    if (report.currencyImpact) {
      lines.push('');
      lines.push('CURRENCY IMPACT (Multi-currency)');
      lines.push(
        `Realized FX Gain/Loss,${report.currencyImpact.realizedGainLoss}`
      );
      lines.push(
        `Unrealized FX Gain/Loss,${report.currencyImpact.unrealizedGainLoss}`
      );
      lines.push(`Total FX Impact,${report.currencyImpact.totalFXImpact}`);
    }

    lines.push('');
    lines.push('BALANCE SHEET');
    lines.push(`Assets,${report.assets.total}`);
    lines.push(`Liabilities,${report.liabilities.total}`);
    lines.push(`Equity,${report.equity}`);

    return lines.join('\n');
  }
}
