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
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { isVodacomMpesaEnabled } from '@/lib/vodacom-mpesa'

const MpesaCallbackSchema = z.object({
  output_ResponseCode: z.string(),
  output_ResponseDesc: z.string(),
  output_TransactionID: z.string(),
  output_ConversationID: z.string(),
  output_ThirdPartyConversationID: z.string(),
  output_ResultCode: z.string().optional(),
  output_ResultDesc: z.string().optional(),
})

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

  logger.info('M-Pesa callback received', {
    conversationId: payload.output_ConversationID,
    thirdPartyConversationId: payload.output_ThirdPartyConversationID,
    transactionId: payload.output_TransactionID,
    responseCode: payload.output_ResponseCode,
  })

  // Persistence reconciliation is intentionally deferred until the payment
  // intent store is wired to Vodacom callback correlation identifiers.
  //
  // const intent = await paymentIntentRepo.findByIdempotencyKey(
  //   payload.output_ThirdPartyConversationID
  // )
  // if (intent) {
  //   const newStatus = payload.output_ResponseCode === 'INS-0'
  //     ? PaymentIntentStatus.CAPTURED
  //     : PaymentIntentStatus.FAILED
  //   await paymentIntentRepo.updateStatus(intent.id, newStatus)
  //   await auditLogger.log({ ... })
  // }

  // Always ACK to prevent Vodacom retries
  return NextResponse.json({ received: true })
}
