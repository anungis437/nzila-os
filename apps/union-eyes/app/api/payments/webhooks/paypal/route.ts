import { ApiError, ErrorCode } from '@/lib/api/errors'
/** PayPal delivery authentication for the existing callback URL.
 * Signature verification precedes the unavailable response. Current base
 * finance exclusions permit no payment effect or receipt from these events.
 * Unrelated authenticated topics are ignored without recording a receipt. */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { readBoundedJson, RequestBodyTooLargeError } from '@/lib/api/bounded-json'

export const runtime = 'nodejs'
export const maxDuration = 30

const MAX_WEBHOOK_BYTES = 256 * 1024

/** What an event must be, and the parts of its resource the handler reads. PayPal sends more, which is kept as sent: its signature is checked over the event as it came. */
const paypalEventSchema = z
  .object({
    id: z.string().min(1).max(255),
    event_type: z.string().min(1).max(255),
    resource: z
      .object({
        id: z.string().optional(),
        custom_id: z.string().optional(),
        invoice_id: z.string().optional(),
        status: z.string().optional(),
        amount: z.object({ value: z.string().optional() }).passthrough().optional(),
        status_details: z.object({ reason: z.string().optional() }).passthrough().optional(),
        supplementary_data: z
          .object({
            related_ids: z.object({ order_id: z.string().optional() }).passthrough().optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough()

type PayPalEvent = z.infer<typeof paypalEventSchema>

/** A request that cannot be an authentic PayPal event: the caller's error, never retried into success. */
class WebhookRequestError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413,
  ) {
    super(message)
    this.name = 'WebhookRequestError'
  }
}

async function getPayPalAccessToken(
  clientId: string,
  clientSecret: string,
  baseUrl: string,
): Promise<string> {
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`PayPal auth failed: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  return data.access_token as string
}

async function verifyPayPalWebhook(
  event: Record<string, unknown>,
  headers: Headers,
  baseUrl: string,
  clientId: string,
  clientSecret: string,
  webhookId: string,
): Promise<boolean> {
  const transmissionId = headers.get('paypal-transmission-id')
  const transmissionTime = headers.get('paypal-transmission-time')
  const transmissionSig = headers.get('paypal-transmission-sig')
  const certUrl = headers.get('paypal-cert-url')
  const authAlgo = headers.get('paypal-auth-algo')

  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
    throw new WebhookRequestError('Missing PayPal signature headers', 400)
  }

  const token = await getPayPalAccessToken(clientId, clientSecret, baseUrl)

  const verifyBody = {
    auth_algo: authAlgo,
    cert_url: certUrl,
    transmission_id: transmissionId,
    transmission_sig: transmissionSig,
    transmission_time: transmissionTime,
    webhook_id: webhookId,
    webhook_event: event,
  }

  const response = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(verifyBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`PayPal webhook verification failed: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  return data.verification_status === 'SUCCESS'
}

/** The event body, read under a size cap, and the event it must be. A body that is not a PayPal event is the caller's error. */
async function readEvent(
  request: NextRequest,
): Promise<{ raw: Record<string, unknown>; event: PayPalEvent }> {
  let parsed: unknown
  try {
    parsed = await readBoundedJson(request, MAX_WEBHOOK_BYTES)
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError)
      throw new WebhookRequestError('Payload too large', 413)
    throw new WebhookRequestError('Invalid payload', 400)
  }
  const event = paypalEventSchema.safeParse(parsed)
  if (!event.success) throw new WebhookRequestError('Invalid payload', 400)
  // The signature is verified over the body as PayPal sent it, not over the parsed copy.
  return { raw: parsed as Record<string, unknown>, event: event.data }
}

/**
 * POST handler for PayPal webhooks
 */
export async function POST(request: NextRequest) {
  try {
    const clientId = process.env.PAYPAL_CLIENT_ID
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET
    const webhookId = process.env.PAYPAL_WEBHOOK_ID

    if (!clientId || !clientSecret || !webhookId) {
      logger.error('PayPal webhook configuration missing')
      return NextResponse.json({ error: 'PayPal webhook not configured' }, { status: 503 })
    }

    const baseUrl =
      process.env.NODE_ENV === 'production'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com'

    const { raw, event } = await readEvent(request)

    // The signature is checked first: nothing below reads or writes the database for a request that is not PayPal's.
    const verified = await verifyPayPalWebhook(
      raw,
      request.headers,
      baseUrl,
      clientId,
      clientSecret,
      webhookId,
    )

    if (!verified) {
      logger.error('PayPal webhook signature invalid')
      return NextResponse.json({ error: 'Invalid PayPal signature' }, { status: 400 })
    }

    const eventType = event.event_type

    if (
      [
        'PAYMENT.CAPTURE.COMPLETED',
        'PAYMENT.CAPTURE.DENIED',
        'PAYMENT.CAPTURE.FAILED',
        'PAYMENT.CAPTURE.REFUNDED',
      ].includes(eventType)
    )
      throw ApiError.notImplemented(
        'Dues payment processing is unavailable in the current base release.',
      )
    return NextResponse.json({ received: true, status: 'ignored' }, { status: 200 })
  } catch (error) {
    if (error instanceof ApiError && error.code === ErrorCode.NOT_IMPLEMENTED)
      return NextResponse.json(
        { received: false, error: error.message, code: error.code },
        { status: 501 },
      )
    if (error instanceof WebhookRequestError) {
      logger.warn('PayPal webhook request refused', { message: error.message })
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logger.error('Error processing PayPal webhook', { error })
    // A 5xx makes PayPal deliver the event again; every handler above is idempotent, so a transient failure is retried, not lost.
    return NextResponse.json(
      { received: false, error: 'Internal processing error' },
      { status: 500 },
    )
  }
}
