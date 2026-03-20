/**
 * Zonga — Execute Payout Handler
 *
 * Executes a creator payout via Stripe Connect and records it in the
 * domain table + audit log + evidence pack.
 */
import { randomUUID } from 'node:crypto'
import type { CommandHandler, CommandResult } from '../types'
import { gatePayout } from '../control-plane-bridge'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import {
  buildZongaAuditEvent,
  ZongaAuditAction,
  ZongaEntityType,
  PayoutStatus,
  PayoutRail,
  PayoutPreviewRequestSchema,
} from '@/lib/zonga-services'
import { executeCreatorPayout } from '@/lib/stripe'
import { buildEvidencePackFromAction, processEvidencePack } from '@/lib/evidence'
import { logTransition } from '@/lib/commerce-telemetry'
import { compensateFailedPayout } from '@/lib/guards/compensation'

export interface ExecutePayoutCommand {
  type: 'execute_payout'
  creator_id: string
  amount: number
  currency?: string
  payout_rail?: string
  creator_name?: string
  actor_id: string
}

export const executePayoutHandler: CommandHandler<ExecutePayoutCommand> = {
  commandType: 'execute_payout',

  async execute(command, context): Promise<CommandResult> {
    // 1. Validate
    const parsed = PayoutPreviewRequestSchema.safeParse({
      creatorId: command.creator_id,
      grossAmount: command.amount,
      currency: command.currency ?? 'USD',
    })
    if (!parsed.success) {
      return {
        success: false,
        errors: [{
          code: 'VALIDATION_ERROR',
          message: 'Invalid payout data',
          details: parsed.error.flatten().fieldErrors,
        }],
      }
    }

    // 2. Gate payout via control plane (balance, disputes, ledger backing)
    const [revenue] = (await platformDb.execute(
      sql`SELECT COALESCE(SUM(amount), 0) as total
      FROM zonga_revenue_events
      WHERE creator_id = ${command.creator_id} AND org_id = ${context.org_id}`,
    )) as unknown as [{ total: number }]

    const [paid] = (await platformDb.execute(
      sql`SELECT COALESCE(SUM(amount), 0) as total
      FROM zonga_payouts
      WHERE creator_id = ${command.creator_id} AND org_id = ${context.org_id}
        AND status = ${PayoutStatus.COMPLETED}`,
    )) as unknown as [{ total: number }]

    const [disputes] = (await platformDb.execute(
      sql`SELECT COUNT(*) as cnt
      FROM zonga_rights_disputes
      WHERE org_id = ${context.org_id}
        AND status IN ('open', 'under_review')
        AND release_id IN (
          SELECT release_id FROM zonga_royalty_splits
          WHERE creator_id = ${command.creator_id} AND org_id = ${context.org_id}
        )`,
    )) as unknown as [{ cnt: number }]

    const [ledger] = (await platformDb.execute(
      sql`SELECT COUNT(*) as cnt
      FROM audit_log
      WHERE entity_type = 'revenue_event' AND org_id = ${context.org_id}
        AND metadata->>'creatorId' = ${command.creator_id}`,
    )) as unknown as [{ cnt: number }]

    const gateResult = gatePayout({
      creator_id: command.creator_id,
      amount: command.amount,
      currency: command.currency ?? 'USD',
      ledgerEntries: Number(ledger?.cnt ?? 0) > 0
        ? [{ id: 'synthetic', transactionId: '', accountId: command.creator_id, direction: 'credit' as const, amount: Number(revenue?.total ?? 0), currency: command.currency ?? 'USD', createdAt: new Date() }]
        : [],
      totalRevenue: Number(revenue?.total ?? 0),
      totalPayouts: Number(paid?.total ?? 0),
      hasActiveDisputes: Number(disputes?.cnt ?? 0) > 0,
    })

    if (!gateResult.allowed) {
      logger.warn('Payout blocked by control plane gate', {
        creatorId: command.creator_id,
        amount: command.amount,
        reason: gateResult.reason,
      })
      return {
        success: false,
        errors: [{
          code: 'PAYOUT_GATED',
          message: gateResult.reason ?? 'Payout blocked by control plane',
        }],
      }
    }

    // 3. Execute via Stripe Connect
    const payoutCurrency = command.currency?.toLowerCase() ?? 'usd'
    const payoutRail = (command.payout_rail ?? PayoutRail.STRIPE_CONNECT) as PayoutRail
    const payoutId = randomUUID()

    let result: Awaited<ReturnType<typeof executeCreatorPayout>> | undefined

    try {
      result = await executeCreatorPayout({
        creatorConnectAccountId: command.creator_id,
        amountCents: Math.round(command.amount * 100),
        currency: payoutCurrency,
        payoutRail,
      })
    } catch (stripeErr) {
      logger.error('Stripe payout execution failed', {
        payoutId,
        creatorId: command.creator_id,
        error: stripeErr instanceof Error ? stripeErr.message : String(stripeErr),
      })
      return {
        success: false,
        errors: [{
          code: 'STRIPE_EXECUTION_FAILED',
          message: stripeErr instanceof Error ? stripeErr.message : 'Stripe payout failed',
        }],
      }
    }

    const settledCurrency = result?.settledCurrency ?? payoutCurrency.toUpperCase()

    // 4. Write to domain table
    await platformDb.execute(
      sql`INSERT INTO zonga_payouts
        (id, org_id, creator_id, creator_name, amount, currency, payout_rail, status, stripe_transfer_id, created_by, created_at)
      VALUES (
        ${payoutId}, ${context.org_id}, ${command.creator_id}, ${command.creator_name ?? null},
        ${command.amount}, ${settledCurrency}, ${payoutRail},
        ${PayoutStatus.COMPLETED}, ${result?.transferId ?? null},
        ${command.actor_id}, NOW()
      )`,
    )

    // 5. Audit trail + evidence (with compensation on failure)
    try {
      await platformDb.execute(
        sql`INSERT INTO audit_log (action, actor_id, entity_type, org_id, metadata)
        VALUES ('payout.executed', ${command.actor_id}, 'payout', ${payoutId},
          ${JSON.stringify({
            orgId: context.org_id,
            creatorId: command.creator_id,
            creatorName: command.creator_name,
            amount: command.amount,
            currency: settledCurrency,
            payoutRail,
            status: PayoutStatus.COMPLETED,
            stripeTransferId: result?.transferId ?? null,
          })}::jsonb)`,
      )

      const auditEvent = buildZongaAuditEvent({
        action: ZongaAuditAction.PAYOUT_EXECUTE,
        entityType: ZongaEntityType.PAYOUT,
        orgId: context.org_id,
        actorId: command.actor_id,
        targetId: payoutId,
        metadata: { amount: command.amount, creatorId: command.creator_id },
      })
      logger.info('Payout executed via command bus', { ...auditEvent })

      logTransition(
        { orgId: context.org_id },
        'payout',
        PayoutStatus.PENDING,
        PayoutStatus.COMPLETED,
        true,
      )

      // 6. Evidence pack
      const pack = buildEvidencePackFromAction({
        actionType: 'PAYOUT_EXECUTED',
        orgId: context.org_id,
        executedBy: command.actor_id,
        actionId: randomUUID(),
      })
      await processEvidencePack(pack)
    } catch (postErr) {
      // Stripe succeeded but audit/evidence failed — compensate
      logger.error('Post-payout steps failed, compensating', {
        payoutId,
        error: postErr instanceof Error ? postErr.message : String(postErr),
      })
      await compensateFailedPayout(
        payoutId,
        context.org_id,
        `Post-execution failure: ${postErr instanceof Error ? postErr.message : 'unknown'}`,
      )
      return {
        success: false,
        errors: [{
          code: 'POST_EXECUTION_FAILURE',
          message: 'Payout recorded but audit trail failed — compensation applied',
        }],
      }
    }

    return {
      success: true,
      entity_type: 'payout',
      entity_id: payoutId,
      status_after: PayoutStatus.COMPLETED,
      audit_ref: context.correlation_id,
      message: 'Payout executed',
    }
  },
}
