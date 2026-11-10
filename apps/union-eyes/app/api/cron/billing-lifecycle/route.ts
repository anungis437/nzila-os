/**
 * POST /api/cron/billing-lifecycle
 *
 * Automates monthly billing lifecycle:
 * - ensure current billing period exists
 * - generate invoices for active subscriptions
 * - finalize draft invoices
 * - mark unpaid overdue invoices as failed lifecycle state
 */

import { withApi } from '@/lib/api/framework'
import { withSystemContext } from '@/lib/db/with-rls-context'
import { billingAutomationMandates, billingAutomationRuns } from '@/db/schema'
import { and, eq, gt, isNotNull, lte, ne, sql } from 'drizzle-orm'
import { runBillingLifecycleAutomation } from '@/services/platform-economics/billing-service'

export const dynamic = 'force-dynamic'

export const POST = withApi(
  {
    auth: { cron: true },
    openapi: {
      tags: ['Cron', 'Billing'],
      summary: 'Run automated billing lifecycle scheduler',
    },
  },
  async () => {
    const runAt = new Date()
    const periodLabel = `${runAt.getUTCFullYear()}-${String(runAt.getUTCMonth() + 1).padStart(2, '0')}`
    const mandates = await withSystemContext((tx) => tx
      .select({ id: billingAutomationMandates.id, organizationId: billingAutomationMandates.organizationId })
      .from(billingAutomationMandates)
      .where(and(
        eq(billingAutomationMandates.status, 'active'),
        eq(billingAutomationMandates.cadence, 'monthly'),
        lte(billingAutomationMandates.validFrom, runAt),
        gt(billingAutomationMandates.validUntil, runAt),
        isNotNull(billingAutomationMandates.approvedBy),
        ne(billingAutomationMandates.approvedBy, billingAutomationMandates.issuedBy),
      )))

    const results: Array<{ organizationId: string; status: string }> = []
    for (const mandate of mandates) {
      const reservation = await withSystemContext(async (tx) => {
        const [reserved] = await tx
          .insert(billingAutomationRuns)
          .values({ organizationId: mandate.organizationId, mandateId: mandate.id, periodLabel, status: 'running' })
          .onConflictDoNothing()
          .returning({ id: billingAutomationRuns.id })
        if (!reserved) {
          const [retry] = await tx
            .update(billingAutomationRuns)
            .set({ status: 'running', attemptCount: sql`${billingAutomationRuns.attemptCount} + 1`, lastError: null, updatedAt: runAt })
            .where(and(
              eq(billingAutomationRuns.organizationId, mandate.organizationId),
              eq(billingAutomationRuns.periodLabel, periodLabel),
              eq(billingAutomationRuns.status, 'failed'),
            ))
            .returning({ id: billingAutomationRuns.id })
          if (!retry) return false
        }
        return true
      })
      if (!reservation) {
        results.push({ organizationId: mandate.organizationId, status: 'already_reserved' })
        continue
      }
      try {
        const result = await withSystemContext(async (tx) => {
          const lifecycle = await runBillingLifecycleAutomation(
            [mandate.organizationId],
            runAt,
            `system:billing-mandate:${mandate.id}`,
          )
          await tx
            .update(billingAutomationRuns)
            .set({ status: 'completed', result: lifecycle, completedAt: new Date(), updatedAt: new Date() })
            .where(and(
              eq(billingAutomationRuns.organizationId, mandate.organizationId),
              eq(billingAutomationRuns.periodLabel, periodLabel),
            ))
          return { organizationId: mandate.organizationId, status: 'completed' }
        })
        results.push(result)
      } catch (error) {
        await withSystemContext((tx) => tx
            .update(billingAutomationRuns)
            .set({ status: 'failed', lastError: error instanceof Error ? error.message.slice(0, 1000) : 'unknown', updatedAt: new Date() })
            .where(and(
              eq(billingAutomationRuns.organizationId, mandate.organizationId),
              eq(billingAutomationRuns.periodLabel, periodLabel),
            )))
        results.push({ organizationId: mandate.organizationId, status: 'failed' })
      }
    }
    return { periodLabel, mandates: mandates.length, results }
  },
)
