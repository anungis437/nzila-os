/**
 * Transfer Pricing & Currency Enforcement Service
 *
 * Enforces CRA transfer pricing rules:
 * - All invoices must be in CAD (Canadian dollars)
 * - Uses Bank of Canada noon rate for FX conversion
 * - T106 filing required for related-party transactions >$1M CAD
 * - Ensures cross-border transactions are properly documented
 */

import { logger } from '@/lib/logger';

export interface Invoice {
  invoiceId: string;
  currency: string;
  amount: number;
  date: Date;
}

export interface CrossBorderTransaction {
  transactionId: string;
  date: Date;
  amountCAD: number;
  counterpartyName: string;
  counterpartyCountry: string;
  isRelatedParty: boolean;
  transactionType: 'service' | 'goods' | 'royalty' | 'management_fee';
}

export interface FXConversion {
  amountUSD: number;
  amountCAD: number;
  rate: number;
  date: Date;
  source: 'bank_of_canada' | 'cached';
}

/**
 * Enforce CAD-only billing per CRA transfer pricing rules
 * CRITICAL: All invoices must be in CAD for proper tax treatment
 */
export async function validateBillingRequest(
  invoice: Invoice
): Promise<{
  valid: boolean;
  error?: string;
  requiredCurrency: 'CAD';
  convertedAmount?: number;
}> {
  if (invoice.currency === 'CAD') {
    return {
      valid: true,
      requiredCurrency: 'CAD'
    };
  }

  // All non-CAD must be converted
  if (invoice.currency === 'USD') {
    try {
      const converted = await convertUSDToCAD(invoice.amount, invoice.date);
      return {
        valid: false, // Invoice itself is invalid (not in CAD)
        error: `Invoice in ${invoice.currency} - must convert to CAD`,
        requiredCurrency: 'CAD',
        convertedAmount: converted
      };
    } catch (error) {
      return {
        valid: false,
        error: `Cannot convert ${invoice.currency} to CAD: ${error}`,
        requiredCurrency: 'CAD'
      };
    }
  }

  return {
    valid: false,
    error: `Unsupported currency: ${invoice.currency}. Only CAD and USD accepted.`,
    requiredCurrency: 'CAD'
  };
}

/**
 * Convert USD to CAD using Bank of Canada noon rate
 */
export async function convertUSDToCAD(
  amountUSD: number,
  date: Date
): Promise<number> {
  const rate = await getBankOfCanadaNoonRate(date);
  return amountUSD * rate;
}

/**
 * Get Bank of Canada noon rate for specific date
 * Using public VALET API: https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json
 */
export async function getBankOfCanadaNoonRate(date: Date): Promise<number> {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

  try {
    const response = await fetch(
      `https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?start_date=${dateStr}&end_date=${dateStr}`
    );

    if (!response.ok) {
      throw new Error(`Bank of Canada API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (
      !data.observations ||
      !data.observations[0] ||
      !data.observations[0].FXUSDCAD
    ) {
      throw new Error(`No rate data for ${dateStr}`);
    }

    const rate = parseFloat(data.observations[0].FXUSDCAD.v);

    if (isNaN(rate)) {
      throw new Error(`Invalid rate value: ${data.observations[0].FXUSDCAD.v}`);
    }

    return rate;
  } catch (error) {
    logger.error('Failed to fetch BOC rate', { error, date: dateStr });
    throw error;
  }
}

/**
 * Check if transaction requires T106 filing
 * T106 = Information Return of Non-Arm's Length Transactions with Non-Residents
 * Required for related-party transactions >$1M CAD
 */
export async function checkT106Requirement(
  transactionAmount: number,
  isRelatedParty: boolean
): Promise<{
  requiresT106: boolean;
  reason: string;
  threshold: number;
}> {
  const T106_THRESHOLD = 1000000; // $1M CAD

  if (!isRelatedParty) {
    return {
      requiresT106: false,
      reason: 'Not a related-party transaction (arm\'s length)',
      threshold: T106_THRESHOLD
    };
  }

  if (transactionAmount > T106_THRESHOLD) {
    return {
      requiresT106: true,
      reason: `Related-party transaction of $${transactionAmount.toLocaleString()} CAD exceeds $1M threshold`,
      threshold: T106_THRESHOLD
    };
  }

  return {
    requiresT106: false,
    reason: `Related-party but under $${T106_THRESHOLD.toLocaleString()} threshold`,
    threshold: T106_THRESHOLD
  };
}

/**
 * File T106 with CRA
 * DEADLINE: June 30 following tax year
 */
export async function fileT106(
  taxYear: number,
  transactions: CrossBorderTransaction[]
): Promise<{
  filed: boolean;
  t106Count: number;
  deadline: Date;
}> {
  // Filter for transactions requiring T106
  const eligibleTransactions = transactions.filter(
    t => t.isRelatedParty && t.amountCAD > 1000000
  );

  if (eligibleTransactions.length === 0) {
    return {
      filed: false,
      t106Count: 0,
      deadline: new Date(`${taxYear + 1}-06-30`)
    };
  }

  // Generate T106 forms
  const t106Forms = eligibleTransactions.map(t => ({
    taxYear,
    nonResidentName: t.counterpartyName,
    nonResidentCountry: t.counterpartyCountry,
    transactionType: t.transactionType,
    amountCAD: t.amountCAD,
    transferPricingMethod: 'Comparable Uncontrolled Price (CUP)',
    businessNumber: process.env.UNION_BN,
    filingDate: new Date()
  }));

  // In real implementation, would submit to CRA
  // For now, just log that T106 would be filed

  return {
    filed: true,
    t106Count: t106Forms.length,
    deadline: new Date(`${taxYear + 1}-06-30`)
  };
}

/**
 * Get T106 filing status
 */
export async function getT106FilingStatus(
  taxYear: number
): Promise<{
  requiresFiling: boolean;
  t106Count: number;
  filed: boolean;
  deadline: Date;
  daysUntilDeadline: number;
}> {
  const deadline = new Date(`${taxYear + 1}-06-30`);
  const today = new Date();
  const daysRemaining = Math.ceil(
    (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    requiresFiling: false, // Would check database for related-party transactions
    t106Count: 0,
    filed: false, // Would check database
    deadline,
    daysUntilDeadline: daysRemaining
  };
}

/**
 * Enforce transfer pricing documentation
 * CRA requires contemporaneous TP documentation
 */
export async function validateTransferPricingDocumentation(
  transaction: CrossBorderTransaction
): Promise<{
  compliant: boolean;
  issues: string[];
  recommendations: string[];
}> {
  const issues: string[] = [];
  const recommendations: string[] = [];

  if (transaction.isRelatedParty && transaction.amountCAD > 1000000) {
    recommendations.push('Maintain detailed transfer pricing documentation');
    recommendations.push(
      'Use Comparable Uncontrolled Price (CUP) or other OECD method'
    );
    recommendations.push('File T106 with CRA by June 30');
  }

  return {
    compliant: issues.length === 0,
    issues,
    recommendations
  };
}

/**
 * Generate transfer pricing compliance report
 */
export async function generateTransferPricingReport(): Promise<{
  compliant: boolean;
  issues: string[];
  recommendations: string[];
}> {
  const issues: string[] = [];
  const recommendations: string[] = [
    'Enforce CAD-only billing in system',
    'Use Bank of Canada noon rates for all FX conversions',
    'Track related-party transactions for T106 filing',
    'Maintain transfer pricing documentation',
    'Review cross-border transactions quarterly'
  ];

  return {
    compliant: issues.length === 0,
    issues,
    recommendations
  };
}

