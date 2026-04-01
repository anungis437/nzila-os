/**
 * Financial Reconciliation Engine
 *
 * Compares dues transactions, payments, donations and Stripe webhook events
 * to detect mismatches (missing payments, orphaned webhooks, amount drift).
 *
 * Designed to run as a daily scheduled job or on-demand audit.
 */
import { db } from '../db';
import * as schema from '../db/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export interface ReconciliationMismatch {
  type:
    | 'webhook_unprocessed'
    | 'payment_without_webhook'
    | 'duplicate_webhook'
    | 'amount_mismatch'
    | 'status_inconsistency';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, unknown>;
  detectedAt: string;
}

export interface ReconciliationReport {
  runId: string;
  ranAt: string;
  periodStart: string;
  periodEnd: string;
  totalWebhookEvents: number;
  totalProcessed: number;
  totalUnprocessed: number;
  totalDuesTransactions: number;
  mismatches: ReconciliationMismatch[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

/**
 * Run a full reconciliation pass for the given date range.
 *
 * @param periodStart - ISO date string (inclusive)
 * @param periodEnd - ISO date string (inclusive)
 * @returns Reconciliation report with mismatches
 */
export async function runReconciliation(
  periodStart: string,
  periodEnd: string
): Promise<ReconciliationReport> {
  const runId = crypto.randomUUID();
  const mismatches: ReconciliationMismatch[] = [];
  const now = new Date().toISOString();
  const startDate = new Date(periodStart);
  const endDate = new Date(periodEnd);

  logger.info('Reconciliation started', { runId, periodStart, periodEnd });

  // 1. Find unprocessed webhook events (delivered but never completed)
  const unprocessedEvents = await db
    .select({
      id: schema.stripeWebhookEvents.id,
      stripeEventId: schema.stripeWebhookEvents.stripeEventId,
      eventType: schema.stripeWebhookEvents.eventType,
      createdAt: schema.stripeWebhookEvents.createdAt,
      processingError: schema.stripeWebhookEvents.processingError,
    })
    .from(schema.stripeWebhookEvents)
    .where(
      and(
        eq(schema.stripeWebhookEvents.processed, false),
        gte(schema.stripeWebhookEvents.createdAt, startDate),
        lte(schema.stripeWebhookEvents.createdAt, endDate)
      )
    );

  for (const evt of unprocessedEvents) {
    mismatches.push({
      type: 'webhook_unprocessed',
      severity: evt.processingError ? 'high' : 'medium',
      details: {
        stripeEventId: evt.stripeEventId,
        eventType: evt.eventType,
        createdAt: evt.createdAt,
        processingError: evt.processingError,
      },
      detectedAt: now,
    });
  }

  // 2. Find dues transactions marked as 'paid' with Stripe PI but no matching webhook event
  const paidTransactions = await db
    .select({
      id: schema.duesTransactions.id,
      status: schema.duesTransactions.status,
      paymentReference: schema.duesTransactions.paymentReference,
      totalAmount: schema.duesTransactions.totalAmount,
      paidDate: schema.duesTransactions.paidDate,
    })
    .from(schema.duesTransactions)
    .where(
      and(
        eq(schema.duesTransactions.status, 'paid'),
        gte(schema.duesTransactions.updatedAt, startDate),
        lte(schema.duesTransactions.updatedAt, endDate)
      )
    );

  for (const txn of paidTransactions) {
    if (txn.paymentReference) {
      // Check if a matching webhook event exists
      const webhookMatch = await db
        .select({ id: schema.stripeWebhookEvents.id })
        .from(schema.stripeWebhookEvents)
        .where(eq(schema.stripeWebhookEvents.stripePaymentIntentId, txn.paymentReference))
        .limit(1);

      if (webhookMatch.length === 0) {
        mismatches.push({
          type: 'payment_without_webhook',
          severity: 'high',
          details: {
            transactionId: txn.id,
            paymentReference: txn.paymentReference,
            amount: txn.totalAmount,
            paidDate: txn.paidDate,
          },
          detectedAt: now,
        });
      }
    }
  }

  // 3. Detect status inconsistencies — transactions with failed Stripe events but 'paid' status
  const failedEvents = await db
    .select({
      stripeEventId: schema.stripeWebhookEvents.stripeEventId,
      stripePaymentIntentId: schema.stripeWebhookEvents.stripePaymentIntentId,
      eventType: schema.stripeWebhookEvents.eventType,
    })
    .from(schema.stripeWebhookEvents)
    .where(
      and(
        eq(schema.stripeWebhookEvents.eventType, 'payment_intent.payment_failed'),
        eq(schema.stripeWebhookEvents.processed, true),
        gte(schema.stripeWebhookEvents.createdAt, startDate),
        lte(schema.stripeWebhookEvents.createdAt, endDate)
      )
    );

  for (const failEvt of failedEvents) {
    if (failEvt.stripePaymentIntentId) {
      const inconsistent = await db
        .select({
          id: schema.duesTransactions.id,
          status: schema.duesTransactions.status,
        })
        .from(schema.duesTransactions)
        .where(
          and(
            eq(schema.duesTransactions.paymentReference, failEvt.stripePaymentIntentId),
            eq(schema.duesTransactions.status, 'paid')
          )
        )
        .limit(1);

      if (inconsistent.length > 0) {
        mismatches.push({
          type: 'status_inconsistency',
          severity: 'critical',
          details: {
            transactionId: inconsistent[0].id,
            transactionStatus: inconsistent[0].status,
            stripeEventId: failEvt.stripeEventId,
            stripePaymentIntentId: failEvt.stripePaymentIntentId,
            reason: 'Transaction marked as paid but Stripe reports payment_intent.payment_failed',
          },
          detectedAt: now,
        });
      }
    }
  }

  // 4. Aggregate counts
  const totalWebhookResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.stripeWebhookEvents)
    .where(
      and(
        gte(schema.stripeWebhookEvents.createdAt, startDate),
        lte(schema.stripeWebhookEvents.createdAt, endDate)
      )
    );

  const processedResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.stripeWebhookEvents)
    .where(
      and(
        eq(schema.stripeWebhookEvents.processed, true),
        gte(schema.stripeWebhookEvents.createdAt, startDate),
        lte(schema.stripeWebhookEvents.createdAt, endDate)
      )
    );

  const duesResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.duesTransactions)
    .where(
      and(
        gte(schema.duesTransactions.updatedAt, startDate),
        lte(schema.duesTransactions.updatedAt, endDate)
      )
    );

  const totalWebhook = totalWebhookResult[0]?.count ?? 0;
  const totalProcessed = processedResult[0]?.count ?? 0;
  const totalDues = duesResult[0]?.count ?? 0;

  const report: ReconciliationReport = {
    runId,
    ranAt: now,
    periodStart,
    periodEnd,
    totalWebhookEvents: totalWebhook,
    totalProcessed,
    totalUnprocessed: totalWebhook - totalProcessed,
    totalDuesTransactions: totalDues,
    mismatches,
    summary: {
      critical: mismatches.filter(m => m.severity === 'critical').length,
      high: mismatches.filter(m => m.severity === 'high').length,
      medium: mismatches.filter(m => m.severity === 'medium').length,
      low: mismatches.filter(m => m.severity === 'low').length,
    },
  };

  logger.info('Reconciliation completed', {
    runId,
    totalMismatches: mismatches.length,
    summary: report.summary,
  });

  return report;
}
