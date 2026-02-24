"use server";

import { eq, and, desc, sql } from "drizzle-orm";
import { duesTransactions, type DuesTransaction, type NewDuesTransaction } from "../schema/dues-transactions-schema";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { withRLSContext } from "@/lib/db/with-rls-context";
import { logger } from "@/lib/logger";

/**
 * Get dues balance summary for a member
 */
export const getDuesBalanceByMember = async (
  memberId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    try {
      // Get all transactions for the member
      const transactions = await dbOrTx
        .select()
        .from(duesTransactions)
        .where(eq(duesTransactions.memberId, memberId))
        .orderBy(desc(duesTransactions.dueDate));

      // Calculate totals
      const pending = transactions.filter(t => t.status === 'pending');
      const overdue = transactions.filter(t => t.status === 'overdue');
      const paid = transactions.filter(t => t.status === 'paid');

      const pendingBalance = pending.reduce((sum, t) => sum + parseFloat(t.totalAmount), 0);
      const overdueBalance = overdue.reduce((sum, t) => sum + parseFloat(t.totalAmount), 0);
      const paidTotal = paid.reduce((sum, t) => sum + parseFloat(t.totalAmount), 0);

      return {
        memberId,
        currentBalance: pendingBalance + overdueBalance,
        pendingBalance,
        overdueBalance,
        paidTotal,
        pendingTransactions: pending.length,
        overdueTransactions: overdue.length,
        lastPaymentDate: paid[0]?.paidDate || null,
        transactions,
      };
    } catch (error) {
      logger.error("Error getting dues balance", { error, memberId });
      throw new Error("Failed to get dues balance");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withRLSContext(async (tx: NodePgDatabase<any>) => executeQuery(tx));
  }
};

/**
 * Get dues transactions for a member
 */
export const getDuesTransactionsByMember = async (
  memberId: string,
  options?: {
    status?: 'pending' | 'paid' | 'overdue' | 'waived' | 'cancelled';
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    try {
      let query = dbOrTx
        .select()
        .from(duesTransactions)
        .where(eq(duesTransactions.memberId, memberId))
        .orderBy(desc(duesTransactions.dueDate));

      if (options?.limit) {
        query = query.limit(options.limit) as typeof query;
      }

      const transactions = await query;

      // Apply additional filters in-memory for simplicity
      let filtered = transactions;
      
      if (options?.status) {
        filtered = filtered.filter(t => t.status === options.status);
      }
      
      if (options?.startDate) {
        filtered = filtered.filter(t => new Date(t.periodStart) >= options.startDate!);
      }
      
      if (options?.endDate) {
        filtered = filtered.filter(t => new Date(t.periodEnd) <= options.endDate!);
      }

      return filtered;
    } catch (error) {
      logger.error("Error getting dues transactions", { error, memberId });
      throw new Error("Failed to get dues transactions");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withRLSContext(async (tx: NodePgDatabase<any>) => executeQuery(tx));
  }
};

/**
 * Get dues transactions for an organization
 */
export const getDuesTransactionsByOrganization = async (
  organizationId: string,
  options?: {
    status?: 'pending' | 'paid' | 'overdue' | 'waived' | 'cancelled';
    startDate?: Date;
    endDate?: Date;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    try {
      const transactions = await dbOrTx
        .select()
        .from(duesTransactions)
        .where(eq(duesTransactions.organizationId, organizationId))
        .orderBy(desc(duesTransactions.dueDate));

      let filtered = transactions;
      
      if (options?.status) {
        filtered = filtered.filter(t => t.status === options.status);
      }
      
      if (options?.startDate) {
        filtered = filtered.filter(t => new Date(t.periodStart) >= options.startDate!);
      }
      
      if (options?.endDate) {
        filtered = filtered.filter(t => new Date(t.periodEnd) <= options.endDate!);
      }

      return filtered;
    } catch (error) {
      logger.error("Error getting organization dues", { error, organizationId });
      throw new Error("Failed to get organization dues");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withRLSContext(async (tx: NodePgDatabase<any>) => executeQuery(tx));
  }
};

/**
 * Create a new dues transaction
 */
export const createDuesTransaction = async (
  data: NewDuesTransaction,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    try {
      const [transaction] = await dbOrTx
        .insert(duesTransactions)
        .values(data)
        .returning();

      return transaction;
    } catch (error) {
      logger.error("Error creating dues transaction", { error, organizationId: data.organizationId });
      throw new Error("Failed to create dues transaction");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withRLSContext(async (tx: NodePgDatabase<any>) => executeQuery(tx));
  }
};

/**
 * Update dues transaction status (e.g., when payment is received)
 */
export const updateDuesTransactionStatus = async (
  transactionId: string,
  status: 'pending' | 'paid' | 'overdue' | 'waived' | 'cancelled',
  paymentDetails?: {
    paymentMethod?: string;
    paymentReference?: string;
    receiptUrl?: string;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    try {
      const updateData: Partial<DuesTransaction> = {
        status,
        updatedAt: new Date(),
      };

      if (status === 'paid') {
        updateData.paidDate = new Date();
        if (paymentDetails) {
          updateData.paymentMethod = paymentDetails.paymentMethod;
          updateData.paymentReference = paymentDetails.paymentReference;
          updateData.receiptUrl = paymentDetails.receiptUrl;
        }
      }

      const [updated] = await dbOrTx
        .update(duesTransactions)
        .set(updateData)
        .where(eq(duesTransactions.id, transactionId))
        .returning();

      return updated;
    } catch (error) {
      logger.error("Error updating dues transaction", { error, transactionId });
      throw new Error("Failed to update dues transaction");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withRLSContext(async (tx: NodePgDatabase<any>) => executeQuery(tx));
  }
};

/**
 * Mark overdue transactions (to be called by a scheduled job)
 */
export const markOverdueTransactions = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    try {
      const today = new Date();
      
      const updated = await dbOrTx
        .update(duesTransactions)
        .set({
          status: 'overdue',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(duesTransactions.status, 'pending'),
            sql`${duesTransactions.dueDate} < ${today.toISOString().split('T')[0]}`
          )
        )
        .returning();

      return updated.length;
    } catch (error) {
      logger.error("Error marking overdue transactions", { error });
      throw new Error("Failed to mark overdue transactions");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withRLSContext(async (tx: NodePgDatabase<any>) => executeQuery(tx));
  }
};

/**
 * Get dues summary for an organization (for admin dashboard)
 */
export const getOrganizationDuesSummary = async (
  organizationId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    try {
      const transactions = await dbOrTx
        .select()
        .from(duesTransactions)
        .where(eq(duesTransactions.organizationId, organizationId));

      const pending = transactions.filter(t => t.status === 'pending');
      const overdue = transactions.filter(t => t.status === 'overdue');
      const paid = transactions.filter(t => t.status === 'paid');
      const waived = transactions.filter(t => t.status === 'waived');

      const pendingTotal = pending.reduce((sum, t) => sum + parseFloat(t.totalAmount), 0);
      const overdueTotal = overdue.reduce((sum, t) => sum + parseFloat(t.totalAmount), 0);
      const paidTotal = paid.reduce((sum, t) => sum + parseFloat(t.totalAmount), 0);
      const waivedTotal = waived.reduce((sum, t) => sum + parseFloat(t.totalAmount), 0);

      // Get unique members
      const uniqueMembers = new Set(transactions.map(t => t.memberId));
      const membersWithOverdue = new Set(overdue.map(t => t.memberId));

      return {
        organizationId,
        totalCollected: paidTotal,
        totalPending: pendingTotal,
        totalOverdue: overdueTotal,
        totalWaived: waivedTotal,
        totalOutstanding: pendingTotal + overdueTotal,
        transactionCount: {
          pending: pending.length,
          overdue: overdue.length,
          paid: paid.length,
          waived: waived.length,
          total: transactions.length,
        },
        memberCount: {
          total: uniqueMembers.size,
          withOverdue: membersWithOverdue.size,
        },
      };
    } catch (error) {
      logger.error("Error getting organization dues summary", { error, organizationId });
      throw new Error("Failed to get organization dues summary");
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withRLSContext(async (tx: NodePgDatabase<any>) => executeQuery(tx));
  }
};

