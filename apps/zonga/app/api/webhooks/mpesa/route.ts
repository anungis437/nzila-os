/**
 * API — /api/webhooks/mpesa
 *
 * Receives Vodacom M-Pesa OpenAPI callback notifications.
 * Processes transaction status updates (C2B completion, reversal results).
 *
 * The OpenAPI gateway sends callbacks with the ThirdPartyConversationID
 * that we generated — used as the correlation key.
 */
import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { isVodacomMpesaEnabled } from '@/lib/vodacom-mpesa'
import {
  MpesaCallbackSchema,
  reconcileMpesaCallback,
} from '@/lib/payments/mpesa-callback-service'

export async function POST(request: Request) {
  if (!isVodacomMpesaEnabled()) {
    return NextResponse.json({ error: 'M-Pesa integration disabled' }, { status: 404 })
  }

  let body: unknown

  try {
    body = await request.json()
  } catch {
    logger.warn('M-Pesa callback: invalid JSON body')
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = MpesaCallbackSchema.safeParse(body)
  if (!parsed.success) {
    logger.warn('M-Pesa callback: schema validation failed', { errors: parsed.error.flatten() })
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const payload = parsed.data

  const reconciliation = await reconcileMpesaCallback(payload)

  logger.info('M-Pesa callback reconciled', {
    conversationId: payload.output_ConversationID,
    thirdPartyConversationId: payload.output_ThirdPartyConversationID,
    transactionId: payload.output_TransactionID,
    responseCode: payload.output_ResponseCode,
    reconciled: reconciliation.reconciled,
    idempotent: reconciliation.idempotent,
    status: reconciliation.status,
  })

  // Always ACK to prevent Vodacom retries
  return NextResponse.json({
    received: true,
    reconciled: reconciliation.reconciled,
    idempotent: reconciliation.idempotent,
    status: reconciliation.status,
  })
}
