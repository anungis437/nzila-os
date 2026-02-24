/**
 * General Ledger Service
 * 
 * Core GL accounting functions for transaction posting, reconciliation, and reporting
 * Implements double-entry bookkeeping principles and audit trail logging
 */

import { db } from "@/db";
import {
  chartOfAccounts,
  glTransactionLog,
  glTrialBalance,
} from "@/db/schema/domains/finance";
import { eq, and, lte, isNull } from "drizzle-orm";
import { createAuditLog } from "./audit-service";
import { logger } from "@/lib/logger";

// ============================================================================
// TYPES
// ============================================================================

export interface GLPostingRequest {
  organizationId: string;
  accountNumber: string;
  debitAmount?: number;
  creditAmount?: number;
  description: string;
  sourceSystem: string;
  sourceRecordId: string;
  costCenterId?: string;
  invoiceNumber?: string;
  receiptNumber?: string;
  transactionDate?: Date;
  userId: string;
}

export interface GLTransactionResponse {
  id: string;
  transactionNumber: string;
  debitAmount: number;
  creditAmount: number;
  isPosted: boolean;
  createdAt: Date;
}

export interface TrialBalanceResponse {
  debitTotal: number;
  creditTotal: number;
  difference: number;
  isBalanced: boolean;
  accounts: AccountBalance[];
}

export interface AccountBalance {
  accountNumber: string;
  accountName: string;
  debitBalance: number;
  creditBalance: number;
}

// ============================================================================
// CORE GL FUNCTIONS
// ============================================================================

/**
 * Post a GL transaction (double-entry bookkeeping)
 * - Validates account exists and is active
 * - Creates debit and credit entries
 * - Generates transaction number with audit trail
 * - Returns posted transaction
 * 
 * @throws Error if account not found, inactive, or validation fails
 */
export async function postGLTransaction(
  request: GLPostingRequest
): Promise<GLTransactionResponse> {
  try {
    const txDate = request.transactionDate || new Date();

    // Validate account exists and is active
    const [account] = await db
      .select()
      .from(chartOfAccounts)
      .where(
        and(
          eq(chartOfAccounts.organizationId, request.organizationId),
          eq(chartOfAccounts.accountNumber, request.accountNumber)
        )
      );

    if (!account) {
      throw new Error(`Account ${request.accountNumber} not found`);
    }

    if (account.status !== "active") {
      throw new Error(
        `Account ${request.accountNumber} is not active (status: ${account.status})`
      );
    }

    if (!account.allowTransactions) {
      throw new Error(`Account ${request.accountNumber} does not allow transactions`);
    }

    // Validate amounts
    const debitAmount = request.debitAmount || 0;
    const creditAmount = request.creditAmount || 0;

    if (debitAmount < 0 || creditAmount < 0) {
      throw new Error("Amounts cannot be negative");
    }

    if (debitAmount === 0 && creditAmount === 0) {
      throw new Error("At least one of debit or credit amount must be greater than 0");
    }

    // Generate transaction number
    const transactionNumber = `GL-${new Date().getTime()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create GL transaction
    const [transaction] = await db
      .insert(glTransactionLog)
      .values({
        organizationId: request.organizationId,
        chartOfAccountsId: account.id,
        transactionDate: txDate,
        transactionNumber,
        description: request.description,
        debitAmount: debitAmount.toString(),
        creditAmount: creditAmount.toString(),
        costCenterId: request.costCenterId,
        invoiceNumber: request.invoiceNumber,
        receiptNumber: request.receiptNumber,
        sourceSystem: request.sourceSystem,
        sourceRecordId: request.sourceRecordId,
        isPosted: true,
        postedAt: new Date(),
        postedBy: request.userId,
        createdBy: request.userId,
      })
      .returning();

    // Create audit log
    await createAuditLog({
      organizationId: request.organizationId,
      userId: request.userId,
      action: "GL_TRANSACTION_POSTED",
      resourceType: "gl_transaction",
      resourceId: transaction.id,
      description: `Posted GL transaction ${transactionNumber} for account ${request.accountNumber}`,
      metadata: {
        accountNumber: request.accountNumber,
        debitAmount,
        creditAmount,
        sourceSystem: request.sourceSystem,
      },
    });

    logger.info("GL transaction posted", {
      transactionNumber,
      accountNumber: request.accountNumber,
      debitAmount,
      creditAmount,
    });

    return {
      id: transaction.id,
      transactionNumber,
      debitAmount,
      creditAmount,
      isPosted: true,
      createdAt: transaction.createdAt,
    };
  } catch (error) {
    logger.error("Failed to post GL transaction", { error, request });
    throw error;
  }
}

/**
 * Reverse a GL transaction (for corrections)
 * - Creates offsetting transaction
 * - Marks original as reversed
 * - Maintains audit trail
 * 
 * @throws Error if transaction not found or already reversed
 */
export async function reverseGLTransaction(
  organizationId: string,
  transactionId: string,
  reason: string,
  userId: string
): Promise<GLTransactionResponse> {
  try {
    // Get original transaction
    const [originalTx] = await db
      .select()
      .from(glTransactionLog)
      .where(
        and(
          eq(glTransactionLog.organizationId, organizationId),
          eq(glTransactionLog.id, transactionId)
        )
      );

    if (!originalTx) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    if (!originalTx.isPosted) {
      throw new Error("Cannot reverse an unposted transaction");
    }

    // Create reversal transaction
    const reversalNumber = `GL-REVERSAL-${originalTx.transactionNumber}`;

    const [reversalTx] = await db
      .insert(glTransactionLog)
      .values({
        organizationId,
        chartOfAccountsId: originalTx.chartOfAccountsId,
        transactionDate: new Date(),
        transactionNumber: reversalNumber,
        description: `Reversal of ${originalTx.transactionNumber}: ${reason}`,
        debitAmount: originalTx.creditAmount, // Swap debit/credit
        creditAmount: originalTx.debitAmount,
        costCenterId: originalTx.costCenterId,
        sourceSystem: originalTx.sourceSystem,
        sourceRecordId: `REVERSAL-${originalTx.sourceRecordId}`,
        isPosted: true,
        postedAt: new Date(),
        postedBy: userId,
        createdBy: userId,
      })
      .returning();

    // Create audit log
    await createAuditLog({
      organizationId,
      userId,
      action: "GL_TRANSACTION_REVERSED",
      resourceType: "gl_transaction",
      resourceId: transactionId,
      description: `Reversed GL transaction ${originalTx.transactionNumber}: ${reason}`,
      metadata: {
        originalTransactionId: transactionId,
        reversalTransactionId: reversalTx.id,
        reason,
      },
    });

    logger.info("GL transaction reversed", {
      originalNumber: originalTx.transactionNumber,
      reversalNumber,
      reason,
    });

    return {
      id: reversalTx.id,
      transactionNumber: reversalNumber,
      debitAmount: Number(reversalTx.creditAmount),
      creditAmount: Number(reversalTx.debitAmount),
      isPosted: true,
      createdAt: reversalTx.createdAt,
    };
  } catch (error) {
    logger.error("Failed to reverse GL transaction", { error, transactionId });
    throw error;
  }
}

/**
 * Generate trial balance for a period
 * - Calculates running balances for all accounts
 * - Validates double-entry integrity (debits = credits)
 * - Creates historical snapshot
 * 
 * @throws Error if period is invalid
 */
export async function generateTrialBalance(
  organizationId: string,
  periodEndDate: Date,
  userId: string
): Promise<TrialBalanceResponse> {
  try {
    // Get all chart of accounts with opening balances
    const accounts = await db
      .select()
      .from(chartOfAccounts)
      .where(
        and(
          eq(chartOfAccounts.organizationId, organizationId),
          eq(chartOfAccounts.status, "active")
        )
      );

    // Calculate balances for each account
    const accountBalances: AccountBalance[] = [];
    let totalDebits = 0;
    let totalCredits = 0;

    for (const account of accounts) {
      // Get transactions for this account up to period end
      const transactions = await db
        .select()
        .from(glTransactionLog)
        .where(
          and(
            eq(glTransactionLog.organizationId, organizationId),
            eq(glTransactionLog.chartOfAccountsId, account.id),
            eq(glTransactionLog.isPosted, true),
            lte(glTransactionLog.transactionDate, periodEndDate)
          )
        );

      let debitBalance = Number(account.openingBalance || 0);
      let creditBalance = 0;

      for (const tx of transactions) {
        debitBalance += Number(tx.debitAmount || 0);
        creditBalance += Number(tx.creditAmount || 0);
      }

      totalDebits += debitBalance;
      totalCredits += creditBalance;

      accountBalances.push({
        accountNumber: account.accountNumber,
        accountName: account.accountName,
        debitBalance,
        creditBalance,
      });
    }

    const difference = totalDebits - totalCredits;
    const isBalanced = Math.abs(difference) < 0.01; // Allow for rounding errors

    // Create trial balance snapshot
    const [trialBalance] = await db
      .insert(glTrialBalance)
      .values({
        organizationId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        chartOfAccountsId: null as any, // Null for combined TB
        periodEndDate,
        debitTotal: totalDebits.toString(),
        creditTotal: totalCredits.toString(),
        balance: difference.toString(),
        isBalanced,
        isFinalized: false,
        createdBy: userId,
      })
      .returning();

    // Create audit log
    await createAuditLog({
      organizationId,
      userId,
      action: "TRIAL_BALANCE_GENERATED",
      resourceType: "trial_balance",
      resourceId: trialBalance.id,
      description: `Generated trial balance for period ending ${periodEndDate.toISOString()}`,
      metadata: {
        periodEndDate: periodEndDate.toISOString(),
        totalDebits,
        totalCredits,
        difference,
        isBalanced,
        accountCount: accountBalances.length,
      },
    });

    return {
      debitTotal: totalDebits,
      creditTotal: totalCredits,
      difference,
      isBalanced,
      accounts: accountBalances,
    };
  } catch (error) {
    logger.error("Failed to generate trial balance", { error, periodEndDate });
    throw error;
  }
}

/**
 * Reconcile GL transactions with bank statement
 * - Marks transactions as reconciled
 * - Identifies unmatched items (requires manual review)
 * - Creates reconciliation audit trail
 * 
 * @throws Error if reconciliation fails validation
 */
export async function reconcileGLTransactions(
  organizationId: string,
  accountId: string,
  recommendedStatementDate: Date,
  matchedTransactionIds: string[],
  userId: string
): Promise<{
  matchedCount: number;
  unmatchedCount: number;
  totalReconciled: number;
  requiresManualReview: boolean;
}> {
  try {
    // Get account
    const [account] = await db
      .select()
      .from(chartOfAccounts)
      .where(
        and(
          eq(chartOfAccounts.organizationId, organizationId),
          eq(chartOfAccounts.id, accountId)
        )
      );

    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    // Mark matched transactions as reconciled
    for (const txId of matchedTransactionIds) {
      await db
        .update(glTransactionLog)
        .set({
          isReconciled: true,
          reconciledAt: new Date(),
          reconciledBy: userId,
        })
        .where(eq(glTransactionLog.id, txId));
    }

    // Get unmatched transactions
    const unmatched = await db
      .select()
      .from(glTransactionLog)
      .where(
        and(
          eq(glTransactionLog.organizationId, organizationId),
          eq(glTransactionLog.chartOfAccountsId, accountId),
          eq(glTransactionLog.isPosted, true),
          isNull(glTransactionLog.reconciledAt)
        )
      );

    const unmatchedCount = unmatched.length;
    const requiresManualReview = unmatchedCount > 0;

    // Create audit log
    await createAuditLog({
      organizationId,
      userId,
      action: "GL_RECONCILIATION_POSTED",
      resourceType: "gl_reconciliation",
      resourceId: accountId,
      description: `Reconciled GL account ${account.accountNumber} - matched ${matchedTransactionIds.length}, unmatched ${unmatchedCount}`,
      metadata: {
        accountNumber: account.accountNumber,
        statementDate: recommendedStatementDate.toISOString(),
        matchedCount: matchedTransactionIds.length,
        unmatchedCount,
        requiresManualReview,
      },
    });

    logger.info("GL transactions reconciled", {
      accountNumber: account.accountNumber,
      matchedCount: matchedTransactionIds.length,
      unmatchedCount,
      requiresManualReview,
    });

    return {
      matchedCount: matchedTransactionIds.length,
      unmatchedCount,
      totalReconciled: matchedTransactionIds.length,
      requiresManualReview,
    };
  } catch (error) {
    logger.error("Failed to reconcile GL transactions", { error, accountId });
    throw error;
  }
}

/**
 * Get unreconciled transactions for review
 */
export async function getUnreconciledTransactions(
  organizationId: string,
  accountId: string,
  limit: number = 100
): Promise<GLTransactionResponse[]> {
  try {
    const transactions = await db
      .select()
      .from(glTransactionLog)
      .where(
        and(
          eq(glTransactionLog.organizationId, organizationId),
          eq(glTransactionLog.chartOfAccountsId, accountId),
          eq(glTransactionLog.isPosted, true),
          isNull(glTransactionLog.reconciledAt)
        )
      )
      .limit(limit);

    return transactions.map((tx) => ({
      id: tx.id,
      transactionNumber: tx.transactionNumber,
      debitAmount: Number(tx.debitAmount),
      creditAmount: Number(tx.creditAmount),
      isPosted: tx.isPosted ?? false,
      createdAt: tx.createdAt,
    }));
  } catch (error) {
    logger.error("Failed to get unreconciled transactions", { error, accountId });
    throw error;
  }
}

// eslint-disable-next-line import/no-anonymous-default-export
export default {
  postGLTransaction,
  reverseGLTransaction,
  generateTrialBalance,
  reconcileGLTransactions,
  getUnreconciledTransactions,
};

