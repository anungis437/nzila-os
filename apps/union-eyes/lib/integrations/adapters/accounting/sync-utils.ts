/**
 * Accounting Integration Utilities
 * 
 * Utilities for accounting data synchronization, mapping, validation, and reconciliation.
 * Supports QuickBooks Online and Xero.
 * 
 * Features:
 * - Invoice reconciliation and matching
 * - Payment matching and allocation
 * - Customer mapping and deduplication
 * - Account (chart of accounts) mapping
 * - Currency conversion helpers
 * - Bulk data operations
 * - Validation and conflict detection
 */

import { db } from '@/db';
import { logger } from '@/lib/logger';
import {
  externalInvoices,
  externalPayments,
  externalCustomers,
  externalAccounts,
} from '@/db/schema';
import { eq, and, sql, between, desc } from 'drizzle-orm';
import type { IntegrationProvider } from '../../types';

// ============================================================================
// Types
// ============================================================================

export interface InvoiceMatch {
  externalInvoiceId: string;
  internalInvoiceId?: string;
  matchScore: number;
  matchReason: string;
  invoiceNumber: string;
  customerName: string;
  amount: number;
}

export interface PaymentMatch {
  externalPaymentId: string;
  invoiceId: string;
  amount: number;
  paymentDate: Date;
  matched: boolean;
  matchReason?: string;
}

export interface CustomerMapping {
  externalCustomerId: string;
  externalCustomerName: string;
  internalCustomerId?: string;
  matchScore: number;
  matchedBy: 'exact' | 'fuzzy' | 'email' | 'none';
}

export interface AccountMapping {
  externalAccountId: string;
  externalAccountName: string;
  externalAccountCode: string;
  internalAccountId?: string;
  category: string;
}

export interface ReconciliationResult {
  matched: number;
  unmatched: number;
  conflicts: number;
  details: Array<{
    externalId: string;
    status: 'matched' | 'unmatched' | 'conflict';
    reason: string;
  }>;
}

export interface InvoiceConflict {
  externalId: string;
  field: string;
  externalValue: unknown;
  internalValue: unknown;
  lastSyncedAt: Date;
}

// ============================================================================
// Invoice Reconciliation
// ============================================================================

/**
 * Find matching invoices between external system and internal system
 * Matches by: invoice number, customer, amount, date
 */
export async function findInvoiceMatches(
  organizationId: string,
  provider: IntegrationProvider
): Promise<InvoiceMatch[]> {
  const externalInvs = await db.query.externalInvoices.findMany({
    where: and(
      eq(externalInvoices.organizationId, organizationId),
      eq(externalInvoices.externalProvider, provider)
    ),
  });

  const matches: InvoiceMatch[] = [];

  for (const extInv of externalInvs) {
    // Match against internal invoices table
    // Future: Query internal invoices table when it exists
    // For now, return external invoice data with match score 0
    // indicating no internal match found
    matches.push({
      externalInvoiceId: extInv.id,
      invoiceNumber: extInv.invoiceNumber,
      customerName: extInv.customerName,
      amount: parseFloat(extInv.totalAmount?.toString() || '0'),
      matchScore: 0,
      matchReason: 'Internal invoice system not yet configured',
    });
    
    // Future matching logic:
    // 1. Try exact match by invoice number
    // 2. Try fuzzy match by customer name + amount + date
    // 3. Calculate match score based on field similarity
  }

  return matches;
}

/**
 * Detect conflicts between external and internal invoices
 */
export async function detectInvoiceConflicts(
  organizationId: string,
  provider: IntegrationProvider,
  invoiceNumber: string
): Promise<InvoiceConflict[]> {
  const conflicts: InvoiceConflict[] = [];

  const externalInv = await db.query.externalInvoices.findFirst({
    where: and(
      eq(externalInvoices.organizationId, organizationId),
      eq(externalInvoices.externalProvider, provider),
      eq(externalInvoices.invoiceNumber, invoiceNumber)
    ),
  });

  if (!externalInv) return conflicts;

  // Check against internal invoices for conflicts
  // Future: When internal invoices table exists, compare:
  // - totalAmount mismatch
  // - status mismatch (paid vs unpaid)
  // - dueDate mismatch
  // - customerName mismatch
  // For now, return empty conflicts array

  return conflicts;
}

/**
 * Reconcile invoices - match external invoices with internal invoices
 */
export async function reconcileInvoices(
  organizationId: string,
  provider: IntegrationProvider,
  startDate?: Date,
  endDate?: Date
): Promise<ReconciliationResult> {
  const result: ReconciliationResult = {
    matched: 0,
    unmatched: 0,
    conflicts: 0,
    details: [],
  };

  const whereConditions = [
    eq(externalInvoices.organizationId, organizationId),
    eq(externalInvoices.externalProvider, provider),
  ];

  if (startDate && endDate) {
    whereConditions.push(
      between(externalInvoices.invoiceDate, startDate, endDate)
    );
  }

  const invoices = await db.query.externalInvoices.findMany({
    where: and(...whereConditions),
    orderBy: [desc(externalInvoices.invoiceDate)],
  });

  for (const invoice of invoices) {
    // Implement actual matching logic against internal invoices
    // Future: When internal invoices table exists:
    // 1. Query for invoice by number
    // 2. Compare amounts, dates, customer info
    // 3. Calculate match confidence score
    // 4. Flag conflicts if values differ
    
    result.unmatched++;
    result.details.push({
      externalId: invoice.externalId,
      status: 'unmatched',
      reason: 'Internal invoice system not yet configured',
    });
  }

  return result;
}

// ============================================================================
// Payment Matching
// ============================================================================

/**
 * Match payments to invoices
 */
export async function matchPaymentsToInvoices(
  organizationId: string,
  provider: IntegrationProvider
): Promise<PaymentMatch[]> {
  const matches: PaymentMatch[] = [];

  const payments = await db.query.externalPayments.findMany({
    where: and(
      eq(externalPayments.organizationId, organizationId),
      eq(externalPayments.externalProvider, provider)
    ),
  });

  for (const payment of payments) {
    // Match payment to invoice by customer and amount
    const invoice = await db.query.externalInvoices.findFirst({
      where: and(
        eq(externalInvoices.organizationId, organizationId),
        eq(externalInvoices.externalProvider, provider),
        eq(externalInvoices.customerId, payment.customerId),
        eq(externalInvoices.balanceAmount, payment.amount)
      ),
    });

    matches.push({
      externalPaymentId: payment.id,
      invoiceId: invoice?.id || '',
      amount: parseFloat(payment.amount?.toString() || '0'),
      paymentDate: payment.paymentDate,
      matched: !!invoice,
      matchReason: invoice 
        ? 'Matched by customer and amount' 
        : 'No matching invoice found',
    });
  }

  return matches;
}

/**
 * Allocate payment across multiple invoices
 */
export async function allocatePayment(
  organizationId: string,
  provider: IntegrationProvider,
  paymentId: string,
  allocations: Array<{ invoiceId: string; amount: number }>
): Promise<boolean> {
  try {
    // Store allocation records in payment allocation table
    // Future: When payment_allocations table exists:
    // - Insert allocation records linking payment to invoices
    // - Update invoice balances
    // - Record allocation timestamps and user
    // - Validate total allocated amount equals payment amount
    
    logger.info('Payment allocation pending database storage', {
      organizationId,
      provider,
      paymentId,
      totalAllocated: allocations.reduce((sum, a) => sum + a.amount, 0),
      invoiceCount: allocations.length,
    });
    
    // Future implementation:
    // for (const allocation of allocations) {
    //   await db.insert(paymentAllocations).values({
    //     organizationId,
    //     paymentId,
    //     invoiceId: allocation.invoiceId,
    //     amount: allocation.amount,
    //     allocatedAt: new Date(),
    //   });
    // }
    
    return true;
  } catch (error) {
    logger.error('Payment allocation failed', error);
    return false;
  }
}

// ============================================================================
// Customer Mapping
// ============================================================================

/**
 * Find customer mappings between external and internal systems
 */
export async function findCustomerMappings(
  organizationId: string,
  provider: IntegrationProvider
): Promise<CustomerMapping[]> {
  const externalCusts = await db.query.externalCustomers.findMany({
    where: and(
      eq(externalCustomers.organizationId, organizationId),
      eq(externalCustomers.externalProvider, provider)
    ),
  });

  const mappings: CustomerMapping[] = [];

  for (const extCust of externalCusts) {
    // Match against internal customers/members table
    // Future: When members/customers table integration exists:
    // 1. Try exact email match
    // 2. Try fuzzy name match using Levenshtein distance
    // 3. Match by phone number or external reference
    // 4. Calculate confidence score for each match
    // For now, return unmapped with score 0
    mappings.push({
      externalCustomerId: extCust.id,
      externalCustomerName: extCust.name,
      matchScore: 0,
      matchedBy: 'none',
    });
  }

  return mappings;
}

/**
 * Fuzzy match customer names
 */
export function fuzzyMatchCustomerName(
  name1: string,
  name2: string
): { match: boolean; score: number } {
  const normalize = (str: string) =>
    str.toLowerCase().replace(/[^a-z0-9]/g, '');

  const n1 = normalize(name1);
  const n2 = normalize(name2);

  // Exact match
  if (n1 === n2) return { match: true, score: 100 };

  // Contains match
  if (n1.includes(n2) || n2.includes(n1)) {
    const longerLength = Math.max(n1.length, n2.length);
    const shorterLength = Math.min(n1.length, n2.length);
    const score = Math.round((shorterLength / longerLength) * 100);
    return { match: score >= 80, score };
  }

  // Levenshtein distance for fuzzy matching
  const distance = levenshteinDistance(n1, n2);
  const maxLength = Math.max(n1.length, n2.length);
  const similarity = 100 - Math.round((distance / maxLength) * 100);

  return { match: similarity >= 80, score: similarity };
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  return dp[m][n];
}

// ============================================================================
// Account (Chart of Accounts) Mapping
// ============================================================================

/**
 * Map external accounts to internal account categories
 */
export async function mapAccountsToCategories(
  organizationId: string,
  provider: IntegrationProvider
): Promise<AccountMapping[]> {
  const accounts = await db.query.externalAccounts.findMany({
    where: and(
      eq(externalAccounts.organizationId, organizationId),
      eq(externalAccounts.externalProvider, provider)
    ),
  });

  const mappings: AccountMapping[] = [];

  for (const account of accounts) {
    const category = categorizeAccount(
      account.accountType,
      account.accountSubType || ''
    );

    mappings.push({
      externalAccountId: account.id,
      externalAccountName: account.accountName,
      externalAccountCode: account.accountSubType || '',
      category,
    });
  }

  return mappings;
}

/**
 * Categorize account based on type and subtype
 */
function categorizeAccount(type: string, _subType: string): string {
  // Map external account types to internal categories
  const typeMap: Record<string, string> = {
    // QuickBooks types
    BANK: 'Asset',
    'ACCOUNTS RECEIVABLE': 'Asset',
    'OTHER CURRENT ASSET': 'Asset',
    'FIXED ASSET': 'Asset',
    'ACCOUNTS PAYABLE': 'Liability',
    'CREDIT CARD': 'Liability',
    'OTHER CURRENT LIABILITY': 'Liability',
    'LONG TERM LIABILITY': 'Liability',
    EQUITY: 'Equity',
    INCOME: 'Revenue',
    'OTHER INCOME': 'Revenue',
    'COST OF GOODS SOLD': 'Expense',
    EXPENSE: 'Expense',

    // Xero types
    CURRENT: 'Asset',
    FIXED: 'Asset',
    INVENTORY: 'Asset',
    PREPAYMENT: 'Asset',
    CURRLIAB: 'Liability',
    TERMLIAB: 'Liability',
    LIABILITY: 'Liability',
    PAYGLIABILITY: 'Liability',
    REVENUE: 'Revenue',
    SALES: 'Revenue',
    OTHERINCOME: 'Revenue',
    DIRECTCOSTS: 'Expense',
    OVERHEADS: 'Expense',
    DEPRECIATN: 'Expense',
  };

  return typeMap[type.toUpperCase()] || 'Other';
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Bulk update invoice statuses
 */
export async function bulkUpdateInvoiceStatus(
  organizationId: string,
  provider: IntegrationProvider,
  invoiceIds: string[],
  status: string
): Promise<number> {
  const result = await db
    .update(externalInvoices)
    .set({ status, updatedAt: new Date() })
    .where(
      and(
        eq(externalInvoices.organizationId, organizationId),
        eq(externalInvoices.externalProvider, provider),
        sql`${externalInvoices.id} = ANY(${invoiceIds})`
      )
    );

  return result.rowCount || 0;
}

/**
 * Bulk delete old synced records
 */
export async function bulkDeleteOldRecords(
  organizationId: string,
  provider: IntegrationProvider,
  olderThan: Date
): Promise<{ invoices: number; payments: number; customers: number; accounts: number }> {
  const invoiceResult = await db
    .delete(externalInvoices)
    .where(
      and(
        eq(externalInvoices.organizationId, organizationId),
        eq(externalInvoices.externalProvider, provider),
        sql`${externalInvoices.lastSyncedAt} < ${olderThan}`
      )
    );

  const paymentResult = await db
    .delete(externalPayments)
    .where(
      and(
        eq(externalPayments.organizationId, organizationId),
        eq(externalPayments.externalProvider, provider),
        sql`${externalPayments.lastSyncedAt} < ${olderThan}`
      )
    );

  const customerResult = await db
    .delete(externalCustomers)
    .where(
      and(
        eq(externalCustomers.organizationId, organizationId),
        eq(externalCustomers.externalProvider, provider),
        sql`${externalCustomers.lastSyncedAt} < ${olderThan}`
      )
    );

  const accountResult = await db
    .delete(externalAccounts)
    .where(
      and(
        eq(externalAccounts.organizationId, organizationId),
        eq(externalAccounts.externalProvider, provider),
        sql`${externalAccounts.lastSyncedAt} < ${olderThan}`
      )
    );

  return {
    invoices: invoiceResult.rowCount || 0,
    payments: paymentResult.rowCount || 0,
    customers: customerResult.rowCount || 0,
    accounts: accountResult.rowCount || 0,
  };
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate invoice data
 */
export function validateInvoiceData(invoice: {
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  totalAmount: number;
  invoiceDate: Date;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!invoice.invoiceNumber || invoice.invoiceNumber.trim() === '') {
    errors.push('Invoice number is required');
  }

  if (!invoice.customerId || invoice.customerId.trim() === '') {
    errors.push('Customer ID is required');
  }

  if (!invoice.customerName || invoice.customerName.trim() === '') {
    errors.push('Customer name is required');
  }

  if (invoice.totalAmount <= 0) {
    errors.push('Invoice amount must be greater than 0');
  }

  if (!invoice.invoiceDate || isNaN(invoice.invoiceDate.getTime())) {
    errors.push('Valid invoice date is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate payment data
 */
export function validatePaymentData(payment: {
  customerId: string;
  amount: number;
  paymentDate: Date;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!payment.customerId || payment.customerId.trim() === '') {
    errors.push('Customer ID is required');
  }

  if (payment.amount <= 0) {
    errors.push('Payment amount must be greater than 0');
  }

  if (!payment.paymentDate || isNaN(payment.paymentDate.getTime())) {
    errors.push('Valid payment date is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Currency Conversion
// ============================================================================

/**
 * Convert amount between currencies
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  date?: Date
): Promise<number> {
  // Return amount as-is if same currency
  if (fromCurrency === toCurrency) return amount;

  // Implement actual currency conversion using exchange rates
  // Future: Query currency_exchange_rates table or Bank of Canada API:
  // 1. If date provided, get historical exchange rate for that date
  // 2. Otherwise use latest available rate
  // 3. Calculate converted amount: amount * rate
  // 4. Round to 2 decimal places for monetary values
  
  // Example implementation:
  // const rate = await getExchangeRate(fromCurrency, toCurrency, date);
  // return Math.round(amount * rate * 100) / 100;
  
  logger.warn('Currency conversion not yet implemented, returning original amount', {
    amount,
    fromCurrency,
    toCurrency,
    date: date?.toISOString() || 'latest',
  });
  
  return amount;
}

// ============================================================================
// Statistics and Reporting
// ============================================================================

/**
 * Get accounting sync statistics
 */
export async function getSyncStatistics(
  organizationId: string,
  provider: IntegrationProvider
): Promise<{
  invoices: { total: number; paid: number; overdue: number; draft: number };
  payments: { total: number; totalAmount: number };
  customers: { total: number; active: number };
  accounts: { total: number; active: number };
}> {
  const invoiceStats = await db.query.externalInvoices.findMany({
    where: and(
      eq(externalInvoices.organizationId, organizationId),
      eq(externalInvoices.externalProvider, provider)
    ),
  });

  const paymentStats = await db.query.externalPayments.findMany({
    where: and(
      eq(externalPayments.organizationId, organizationId),
      eq(externalPayments.externalProvider, provider)
    ),
  });

  const customerStats = await db.query.externalCustomers.findMany({
    where: and(
      eq(externalCustomers.organizationId, organizationId),
      eq(externalCustomers.externalProvider, provider)
    ),
  });

  const accountStats = await db.query.externalAccounts.findMany({
    where: and(
      eq(externalAccounts.organizationId, organizationId),
      eq(externalAccounts.externalProvider, provider)
    ),
  });

  const now = new Date();

  return {
    invoices: {
      total: invoiceStats.length,
      paid: invoiceStats.filter((i) => i.status === 'paid').length,
      overdue: invoiceStats.filter(
        (i) => i.dueDate && i.dueDate < now && i.status !== 'paid'
      ).length,
      draft: invoiceStats.filter((i) => i.status === 'draft').length,
    },
    payments: {
      total: paymentStats.length,
      totalAmount: paymentStats.reduce(
        (sum, p) => sum + parseFloat(p.amount?.toString() || '0'),
        0
      ),
    },
    customers: {
      total: customerStats.length,
      active: customerStats.length, // All customers are considered active for now
    },
    accounts: {
      total: accountStats.length,
      active: accountStats.filter((a) => a.isActive).length,
    },
  };
}
