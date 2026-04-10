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

interface MpesaCallbackPayload {
  output_ResponseCode: string
  output_ResponseDesc: string
  output_TransactionID: string
  output_ConversationID: string
  output_ThirdPartyConversationID: string
  output_ResultCode?: string
  output_ResultDesc?: string
}

export async function POST(request: Request) {
  if (!isVodacomMpesaEnabled()) {
    return NextResponse.json({ error: 'M-Pesa integration disabled' }, { status: 404 })
  }

  let payload: MpesaCallbackPayload

  try {
    payload = (await request.json()) as MpesaCallbackPayload
  } catch {
    logger.warn('M-Pesa callback: invalid JSON body')
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Basic validation — reject payloads missing the correlation ID
  if (!payload.output_ThirdPartyConversationID) {
    logger.warn('M-Pesa callback: missing ThirdPartyConversationID')
    return NextResponse.json({ error: 'Missing conversation ID' }, { status: 400 })
  }

  logger.info('M-Pesa callback received', {
    conversationId: payload.output_ConversationID,
    thirdPartyConversationId: payload.output_ThirdPartyConversationID,
    transactionId: payload.output_TransactionID,
    responseCode: payload.output_ResponseCode,
  })

  // TODO: When persistence layer is wired, look up the payment intent
  // by ThirdPartyConversationID and update its status based on ResponseCode.
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
