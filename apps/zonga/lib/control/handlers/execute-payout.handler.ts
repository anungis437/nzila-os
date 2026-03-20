/**
 * Zonga — Execute Payout Handler
 *
 * Executes a creator payout via Stripe Connect and records it in the
 * domain table + audit log + evidence pack.
 */
import { randomUUID } from 'node:crypto'
import type { CommandHandler, CommandResult } from '../types'
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

    // 2. Execute via Stripe Connect
    const payoutCurrency = command.currency?.toLowerCase() ?? 'usd'
    const payoutRail = (command.payout_rail ?? PayoutRail.STRIPE_CONNECT) as PayoutRail

    const result = await executeCreatorPayout({
      creatorConnectAccountId: command.creator_id,
      amountCents: Math.round(command.amount * 100),
      currency: payoutCurrency,
      payoutRail,
    })

    const payoutId = randomUUID()
    const settledCurrency = result?.settledCurrency ?? payoutCurrency.toUpperCase()

    // 3. Write to domain table
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

    // 4. Audit trail
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

    // 5. Evidence pack
    const pack = buildEvidencePackFromAction({
      actionType: 'PAYOUT_EXECUTED',
      orgId: context.org_id,
      executedBy: command.actor_id,
      actionId: randomUUID(),
    })
    await processEvidencePack(pack)

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
