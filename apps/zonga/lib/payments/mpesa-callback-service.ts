import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { platformDb } from '@nzila/db/platform'
import { logger } from '@/lib/logger'
import { enqueueJob } from '@/lib/queue-jobs'
import { resolveCommercialDbOrgId, resolveSystemActorId } from '@/lib/commercial-context'

export const MpesaCallbackSchema = z.object({
  output_ResponseCode: z.string(),
  output_ResponseDesc: z.string(),
  output_TransactionID: z.string(),
  output_ConversationID: z.string(),
  output_ThirdPartyConversationID: z.string(),
  output_ResultCode: z.string().optional(),
  output_ResultDesc: z.string().optional(),
})

export type MpesaCallbackPayload = z.infer<typeof MpesaCallbackSchema>

type IntentRow = {
  id: string
  org_id: string
  user_id: string
  amount: string | number
  currency: string
  status: string
  metadata: Record<string, unknown> | null
}

const RETRYABLE_CODES = new Set(['INS-1', 'INS-15', 'INS-16', 'INS-22'])

function mapCallbackStatus(responseCode: string): 'captured' | 'processing' | 'failed' {
  if (responseCode === 'INS-0') return 'captured'
  if (RETRYABLE_CODES.has(responseCode)) return 'processing'
  return 'failed'
}

async function persistWebhookEvent(orgId: string, payload: MpesaCallbackPayload): Promise<{ id: string; alreadyProcessed: boolean }> {
  const externalId = payload.output_ThirdPartyConversationID

  const existing = await platformDb.execute(sql`
    SELECT id, processed
    FROM zonga_payment_webhook_events
    WHERE provider = 'vodacom_mpesa'
      AND event_type = 'callback'
      AND external_id = ${externalId}
    ORDER BY created_at DESC
    LIMIT 1
  `) as unknown as Array<{ id: string; processed: boolean }>

  if (existing[0]?.id) {
    return { id: existing[0].id, alreadyProcessed: Boolean(existing[0].processed) }
  }

  const inserted = await platformDb.execute(sql`
    INSERT INTO zonga_payment_webhook_events (
      org_id, provider, event_type, external_id, payload, processed
    ) VALUES (
      ${orgId}, 'vodacom_mpesa', 'callback',
      ${externalId}, ${JSON.stringify(payload)}::jsonb, false
    )
    RETURNING id
  `) as unknown as Array<{ id: string }>

  return { id: inserted[0]!.id, alreadyProcessed: false }
}

async function markWebhookProcessed(webhookId: string): Promise<void> {
  await platformDb.execute(sql`
    UPDATE zonga_payment_webhook_events
    SET processed = true, processed_at = NOW()
    WHERE id = ${webhookId}
  `)
}

async function enqueueFailureAlert(orgId: string, payload: MpesaCallbackPayload, reason: string): Promise<void> {
  const key = `mpesa-alert:${payload.output_ThirdPartyConversationID}:${payload.output_ResponseCode}`
  await enqueueJob({
    orgId,
    queue: 'alerts',
    jobType: 'mpesa.payment.failure',
    idempotencyKey: key,
    payload: {
      reason,
      responseCode: payload.output_ResponseCode,
      responseDescription: payload.output_ResponseDesc,
      thirdPartyConversationId: payload.output_ThirdPartyConversationID,
      transactionId: payload.output_TransactionID,
    },
    maxRetries: 1,
  })
}

async function emitLedgerAudit(intent: IntentRow, payload: MpesaCallbackPayload, status: 'captured' | 'processing' | 'failed'): Promise<void> {
  const action = status === 'captured' ? 'ledger.payment.capture' : status === 'processing' ? 'ledger.payment.pending_retry' : 'ledger.payment.failed'
  const actor = resolveSystemActorId('mpesa-webhook')

  await platformDb.execute(sql`
    INSERT INTO audit_log (action, actor_id, entity_type, entity_id, org_id, metadata)
    VALUES (
      ${action},
      ${actor},
      'payment_intent',
      ${intent.id},
      ${intent.org_id},
      ${JSON.stringify({
        responseCode: payload.output_ResponseCode,
        responseDesc: payload.output_ResponseDesc,
        transactionId: payload.output_TransactionID,
        thirdPartyConversationId: payload.output_ThirdPartyConversationID,
      })}::jsonb
    )
  `)
}

async function emitRevenueForCreator(intent: IntentRow, payload: MpesaCallbackPayload): Promise<void> {
  const metadata = intent.metadata ?? {}
  const creatorId = typeof metadata.creatorId === 'string' ? metadata.creatorId : null
  if (!creatorId) return

  const amount = Number(intent.amount)
  if (!Number.isFinite(amount) || amount <= 0) return

  await platformDb.execute(sql`
    INSERT INTO zonga_revenue_events (
      id, org_id, creator_id, type, amount, currency, source,
      description, external_ref, created_by, metadata, occurred_at
    ) VALUES (
      gen_random_uuid(),
      ${intent.org_id},
      ${creatorId}::uuid,
      'subscription',
      ${amount},
      ${intent.currency},
      'vodacom_mpesa',
      'Vodacom M-Pesa subscription capture',
      ${payload.output_TransactionID},
      NULL,
      ${JSON.stringify({
        paymentIntentId: intent.id,
        transactionId: payload.output_TransactionID,
        thirdPartyConversationId: payload.output_ThirdPartyConversationID,
      })}::jsonb,
      NOW()
    )
  `)
}

export async function reconcileMpesaCallback(payload: MpesaCallbackPayload): Promise<{ reconciled: boolean; idempotent: boolean; status: string }> {
  const platformOrgId = resolveCommercialDbOrgId(process.env.PLATFORM_ORG_ID)
  const webhook = await persistWebhookEvent(platformOrgId, payload)

  if (webhook.alreadyProcessed) {
    return { reconciled: true, idempotent: true, status: 'already_processed' }
  }

  const intents = await platformDb.execute(sql`
    SELECT id, org_id, user_id, amount, currency, status, metadata
    FROM zonga_payment_intents
    WHERE idempotency_key = ${payload.output_ThirdPartyConversationID}
       OR provider_intent_id = ${payload.output_TransactionID}
    ORDER BY created_at DESC
    LIMIT 1
  `) as unknown as IntentRow[]

  const intent = intents[0]
  if (!intent) {
    await enqueueFailureAlert(platformOrgId, payload, 'intent_not_found')
    await markWebhookProcessed(webhook.id)
    logger.error('M-Pesa callback could not be reconciled: intent not found', {
      thirdPartyConversationId: payload.output_ThirdPartyConversationID,
      transactionId: payload.output_TransactionID,
    })
    return { reconciled: false, idempotent: false, status: 'intent_not_found' }
  }

  const nextStatus = mapCallbackStatus(payload.output_ResponseCode)
  const currentStatus = String(intent.status)

  const callbackMeta = {
    mpesaCallback: {
      responseCode: payload.output_ResponseCode,
      responseDescription: payload.output_ResponseDesc,
      transactionId: payload.output_TransactionID,
      conversationId: payload.output_ConversationID,
      resultCode: payload.output_ResultCode,
      resultDesc: payload.output_ResultDesc,
      updatedAt: new Date().toISOString(),
    },
  }

  await platformDb.execute(sql`
    UPDATE zonga_payment_intents
    SET
      status = ${nextStatus},
      provider_intent_id = ${payload.output_TransactionID},
      metadata = COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify(callbackMeta)}::jsonb,
      captured_at = CASE WHEN ${nextStatus} = 'captured' THEN NOW() ELSE captured_at END,
      updated_at = NOW()
    WHERE id = ${intent.id}
  `)

  await emitLedgerAudit(intent, payload, nextStatus)

  if (nextStatus === 'captured' && currentStatus !== 'captured') {
    await emitRevenueForCreator(intent, payload)
  }

  if (nextStatus === 'processing') {
    await enqueueJob({
      orgId: intent.org_id,
      queue: 'payments',
      jobType: 'mpesa.reconcile.retry',
      idempotencyKey: `mpesa-retry:${payload.output_ThirdPartyConversationID}`,
      payload: {
        paymentIntentId: intent.id,
        thirdPartyConversationId: payload.output_ThirdPartyConversationID,
        transactionId: payload.output_TransactionID,
        responseCode: payload.output_ResponseCode,
      },
      maxRetries: 5,
      scheduledAt: new Date(Date.now() + 60_000).toISOString(),
    })
  }

  if (nextStatus === 'failed') {
    await enqueueFailureAlert(intent.org_id, payload, 'provider_failed')
  }

  await markWebhookProcessed(webhook.id)
  return { reconciled: true, idempotent: false, status: nextStatus }
}
