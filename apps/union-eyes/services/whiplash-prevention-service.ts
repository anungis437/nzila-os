import { db } from "@/db";
import {
  stripeConnectAccounts,
  _paymentClassificationPolicy,
  paymentRoutingRules,
  separatedPaymentTransactions,
  whiplashViolations,
  strikeFundPaymentAudit,
  accountBalanceReconciliation,
  whiplashPreventionAudit,
} from "@/db/schema/whiplash-prevention-schema";
import { eq, and, desc, gte } from "drizzle-orm";

/**
 * Whiplash Prevention Service
 * Enforces Stripe Connect separation for strike fund payments
 */

export interface StripeConnectAccountParams {
  accountType: "operational" | "strike_fund" | "legal_defense" | "education_fund";
  accountPurpose: string;
  stripeAccountId: string;
  accountEmail: string;
  accountName: string;
  country?: string;
  currency?: string;
  trustAccountDesignation?: boolean;
  bankAccountLast4?: string;
  bankName?: string;
  createdBy: string;
}

export interface PaymentTransaction {
  paymentType: string;
  paymentCategory: string;
  paymentAmount: number; // In cents
  paymentCurrency?: string;
  payerId: string;
  payerEmail: string;
  payeeId?: string;
  payeeName?: string;
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: any;
}

export class WhiplashPreventionService {
  /**
   * Register Stripe Connect account
   */
  static async registerConnectAccount(params: StripeConnectAccountParams) {
    // Ensure strike fund accounts are separate and trust-designated
    if (params.accountType === "strike_fund") {
      params.trustAccountDesignation = true;
    }

    const [account] = await db
      .insert(stripeConnectAccounts)
      .values({
        ...params,
        separateAccount: true,
        accountStatus: "active",
        accountVerified: false,
        country: params.country || "CA",
        currency: params.currency || "CAD",
      })
      .returning();

    await this.logAuditAction({
      actionType: "account_created",
      actionDescription: `Stripe Connect account registered: ${params.accountType}`,
      accountId: account.id,
      performedBy: params.createdBy,
      complianceImpact: "medium",
    });

    return account;
  }

  /**
   * Create payment routing rule
   */
  static async createRoutingRule(params: {
    paymentType: string;
    paymentCategory: string;
    destinationAccountId: string;
    destinationAccountType: string;
    routingMandatory?: boolean;
    fallbackAccountId?: string;
    allowFallback?: boolean;
  }) {
    // Enforce mandatory routing for strike payments
    if (params.paymentCategory === "strike_fund") {
      params.routingMandatory = true;
      params.allowFallback = false; // Never allow fallback for strike payments
    }

    const [rule] = await db
      .insert(paymentRoutingRules)
      .values({
        ...params,
        routingMandatory: params.routingMandatory ?? true,
        allowFallback: params.allowFallback ?? false,
        routingPriority: "1",
      })
      .returning();

    return rule;
  }

  /**
   * Route payment to correct Stripe Connect account
   */
  static async routePayment(transaction: PaymentTransaction): Promise<{
    routedToAccountId: string;
    routedToAccountType: string;
    separationEnforced: boolean;
    correctAccountUsed: boolean;
    violationDetected?: boolean;
    violationId?: string;
  }> {
    // Get routing rule for payment type
    const routingRule = await db
      .select()
      .from(paymentRoutingRules)
      .where(
        and(
          eq(paymentRoutingRules.paymentType, transaction.paymentType),
          eq(paymentRoutingRules.paymentCategory, transaction.paymentCategory)
        )
      )
      .limit(1);

    if (routingRule.length === 0) {
      throw new Error(`No routing rule found for payment type: ${transaction.paymentType}`);
    }

    const rule = routingRule[0];

    // Get destination account
    const account = await db
      .select()
      .from(stripeConnectAccounts)
      .where(eq(stripeConnectAccounts.id, rule.destinationAccountId))
      .limit(1);

    if (account.length === 0) {
      throw new Error(`Destination account not found: ${rule.destinationAccountId}`);
    }

    const destinationAccount = account[0];

    // Enforce strike fund separation
    if (transaction.paymentCategory === "strike_fund" && destinationAccount.accountType !== "strike_fund") {
      // CRITICAL VIOLATION: Strike payment routed to non-strike account
      await this.detectViolation({
        violationType: "strike_payment_to_operational",
        severity: "critical",
        paymentType: transaction.paymentType,
        expectedAccountId: rule.destinationAccountId,
        actualAccountId: rule.destinationAccountId, // Same account but wrong type
        amountInvolved: transaction.paymentAmount.toString(),
        violationDescription: `Strike fund payment routed to ${destinationAccount.accountType} account instead of strike_fund account`,
      });

      return {
        routedToAccountId: rule.destinationAccountId,
        routedToAccountType: destinationAccount.accountType,
        separationEnforced: false,
        correctAccountUsed: false,
        violationDetected: true,
      };
    }

    // Log transaction
    const [transactionRecord] = await db
      .insert(separatedPaymentTransactions)
      .values({
        paymentType: transaction.paymentType,
        paymentCategory: transaction.paymentCategory,
        paymentAmount: transaction.paymentAmount.toString(),
        paymentCurrency: transaction.paymentCurrency || "CAD",
        payerId: transaction.payerId,
        payerEmail: transaction.payerEmail,
        payeeId: transaction.payeeId,
        payeeName: transaction.payeeName,
        stripePaymentIntentId: transaction.stripePaymentIntentId,
        stripeChargeId: transaction.stripeChargeId,
        routedToAccountId: rule.destinationAccountId,
        routedToAccountType: destinationAccount.accountType,
        routingRuleId: rule.id,
        separationEnforced: true,
        correctAccountUsed: true,
        paymentStatus: "completed",
        metadata: transaction.metadata,
      })
      .returning();

    await this.logAuditAction({
      actionType: "payment_routed",
      actionDescription: `Payment routed to ${destinationAccount.accountType} account`,
      accountId: rule.destinationAccountId,
      transactionId: transactionRecord.id,
      performedBy: transaction.payerId,
      complianceImpact: "none",
    });

    return {
      routedToAccountId: rule.destinationAccountId,
      routedToAccountType: destinationAccount.accountType,
      separationEnforced: true,
      correctAccountUsed: true,
      violationDetected: false,
    };
  }

  /**
   * Detect whiplash violation
   */
  private static async detectViolation(params: {
    violationType: string;
    severity: string;
    transactionId?: string;
    paymentType: string;
    expectedAccountId?: string;
    actualAccountId?: string;
    amountInvolved?: string;
    violationDescription: string;
  }) {
    const [violation] = await db
      .insert(whiplashViolations)
      .values({
        ...params,
        correctionRequired: true,
        violationStatus: "open",
      })
      .returning();

    await this.logAuditAction({
      actionType: "violation_detected",
      actionDescription: params.violationDescription,
      accountId: params.actualAccountId,
      transactionId: params.transactionId,
      performedBy: "system",
      complianceImpact: "critical",
    });

    return violation.id;
  }

  /**
   * Verify payment routing compliance
   */
  static async verifyPaymentRouting(transactionId: string): Promise<{
    compliant: boolean;
    violations: string[];
  }> {
    const transaction = await db
      .select()
      .from(separatedPaymentTransactions)
      .where(eq(separatedPaymentTransactions.id, transactionId))
      .limit(1);

    if (transaction.length === 0) {
      throw new Error("Transaction not found");
    }

    const tx = transaction[0];
    const violations: string[] = [];

    // Check if separation was enforced
    if (!tx.separationEnforced) {
      violations.push("Payment separation not enforced");
    }

    // Check if correct account was used
    if (!tx.correctAccountUsed) {
      violations.push("Payment routed to incorrect account");
    }

    // Check if strike payment went to strike fund account
    if (tx.paymentCategory === "strike_fund" && tx.routedToAccountType !== "strike_fund") {
      violations.push("Strike payment not routed to strike fund account");
    }

    return {
      compliant: violations.length === 0,
      violations,
    };
  }

  /**
   * Get strike fund payment transactions
   */
  static async getStrikeFundTransactions(startDate?: Date, _endDate?: Date) {
    let query = db
      .select()
      .from(separatedPaymentTransactions)
      .where(eq(separatedPaymentTransactions.paymentCategory, "strike_fund"));

    if (startDate) {
      query = query.where(gte(separatedPaymentTransactions.transactionDate, startDate));
    }

    return await query.orderBy(desc(separatedPaymentTransactions.transactionDate));
  }

  /**
   * Get open violations
   */
  static async getOpenViolations() {
    return await db
      .select()
      .from(whiplashViolations)
      .where(eq(whiplashViolations.violationStatus, "open"))
      .orderBy(desc(whiplashViolations.violationDate));
  }

  /**
   * Resolve violation
   */
  static async resolveViolation(
    violationId: string,
    correctionAction: string,
    resolvedBy: string,
    resolutionNotes: string
  ) {
    const [violation] = await db
      .update(whiplashViolations)
      .set({
        violationStatus: "resolved",
        correctionAction,
        resolvedBy,
        resolvedAt: new Date(),
        resolutionNotes,
        updatedAt: new Date(),
      })
      .where(eq(whiplashViolations.id, violationId))
      .returning();

    await this.logAuditAction({
      actionType: "correction_applied",
      actionDescription: `Violation resolved: ${correctionAction}`,
      performedBy: resolvedBy,
      complianceImpact: "medium",
    });

    return violation;
  }

  /**
   * Reconcile account balance
   */
  static async reconcileAccountBalance(
    accountId: string,
    stripeReportedBalance: number,
    systemCalculatedBalance: number,
    reconciledBy: string
  ) {
    const balanceMatch = stripeReportedBalance === systemCalculatedBalance;
    const discrepancyAmount = Math.abs(stripeReportedBalance - systemCalculatedBalance);

    const [reconciliation] = await db
      .insert(accountBalanceReconciliation)
      .values({
        accountId,
        accountType: "strike_fund", // Get from account record
        stripeReportedBalance: stripeReportedBalance.toString(),
        systemCalculatedBalance: systemCalculatedBalance.toString(),
        balanceMatch,
        discrepancyAmount: discrepancyAmount > 0 ? discrepancyAmount.toString() : undefined,
        reconciliationStatus: balanceMatch ? "reconciled" : "discrepancy",
        reconciledBy,
      })
      .returning();

    return reconciliation;
  }

  /**
   * Generate strike fund audit report
   */
  static async generateStrikeFundAudit(auditPeriod: string, auditedBy: string) {
    const periodStart = new Date();
    periodStart.setMonth(periodStart.getMonth() - 3); // Last 3 months

    const allPayments = await db
      .select()
      .from(separatedPaymentTransactions)
      .where(gte(separatedPaymentTransactions.transactionDate, periodStart));

    const strikePayments = allPayments.filter((p) => p.paymentCategory === "strike_fund");
    const correctStrikeRouting = strikePayments.filter((p) => p.routedToAccountType === "strike_fund");
    const incorrectStrikeRouting = strikePayments.filter((p) => p.routedToAccountType !== "strike_fund");

    const operationalPayments = allPayments.filter((p) => p.paymentCategory === "operational");

    const strikeAmount = strikePayments.reduce((sum, p) => sum + parseFloat(p.paymentAmount), 0);
    const operationalAmount = operationalPayments.reduce((sum, p) => sum + parseFloat(p.paymentAmount), 0);

    const violations = await db
      .select()
      .from(whiplashViolations)
      .where(gte(whiplashViolations.violationDate, periodStart));

    const criticalViolations = violations.filter((v) => v.severity === "critical");

    const separationComplianceRate = strikePayments.length > 0
      ? ((correctStrikeRouting.length / strikePayments.length) * 100).toFixed(2)
      : "100.00";

    const amountMisrouted = incorrectStrikeRouting.reduce((sum, p) => sum + parseFloat(p.paymentAmount), 0);

    const [audit] = await db
      .insert(strikeFundPaymentAudit)
      .values({
        auditPeriod,
        totalStrikePayments: strikePayments.length.toString(),
        totalStrikeAmount: strikeAmount.toString(),
        strikePaymentsToCorrectAccount: correctStrikeRouting.length.toString(),
        strikePaymentsToWrongAccount: incorrectStrikeRouting.length.toString(),
        totalOperationalPayments: operationalPayments.length.toString(),
        totalOperationalAmount: operationalAmount.toString(),
        separationComplianceRate,
        totalViolations: violations.length.toString(),
        criticalViolations: criticalViolations.length.toString(),
        amountMisrouted: amountMisrouted > 0 ? amountMisrouted.toString() : undefined,
        auditedBy,
      })
      .returning();

    return audit;
  }

  /**
   * Log audit action
   */
  private static async logAuditAction(params: {
    actionType: string;
    actionDescription: string;
    accountId?: string;
    transactionId?: string;
    performedBy: string;
    complianceImpact?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: any;
  }) {
    await db.insert(whiplashPreventionAudit).values({
      actionType: params.actionType,
      actionDescription: params.actionDescription,
      accountId: params.accountId,
      transactionId: params.transactionId,
      performedBy: params.performedBy,
      complianceImpact: params.complianceImpact,
      metadata: params.metadata,
    });
  }

  /**
   * Get all Stripe Connect accounts
   */
  static async getAllConnectAccounts() {
    return await db
      .select()
      .from(stripeConnectAccounts)
      .orderBy(desc(stripeConnectAccounts.createdAt));
  }

  /**
   * Get specific account
   */
  static async getConnectAccount(accountId: string) {
    const account = await db
      .select()
      .from(stripeConnectAccounts)
      .where(eq(stripeConnectAccounts.id, accountId))
      .limit(1);

    return account.length > 0 ? account[0] : null;
  }
}
