/**
 * PayPal Webhook Handler for Dues Payments
 * Handles PayPal webhook events for payment processing
 * 
 * POST /api/payments/webhooks/paypal - Process PayPal webhooks
 * 
 * Verifies the webhook signature with PayPal before anything is read from the database, then processes PAYMENT.CAPTURE events. A machine
 * caller has no tenant session: the payment service records the payment and its audit in a system transaction of its own, and the
 * notice to the member is sent with system delivery steps (see PaymentService and NotificationService.send).
 * 
 * The answer is PayPal's retry contract. 2xx means the event is recorded (or was already). A request that cannot be an authentic PayPal event
 * is a 4xx. A transient failure (the database, PayPal's verification service) is a 5xx, so PayPal delivers the event again: every handler
 * is idempotent, a replay of a recorded payment is a no-op.
 * 
 * @module app/api/payments/webhooks/paypal
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { PaymentAuthorityError, PaymentService } from '@/lib/services/payment-service';
import { isWebhookProcessed, recordWebhookProcessed } from '@/lib/services/rewards/webhook-service';
import { readBoundedJson, RequestBodyTooLargeError } from '@/lib/api/bounded-json';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_WEBHOOK_BYTES = 256 * 1024;

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
        supplementary_data: z.object({ related_ids: z.object({ order_id: z.string().optional() }).passthrough().optional() }).passthrough().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

type PayPalEvent = z.infer<typeof paypalEventSchema>;

/** A request that cannot be an authentic PayPal event: the caller's error, never retried into success. */
class WebhookRequestError extends Error {
  constructor(message: string, readonly status: 400 | 413) {
    super(message);
    this.name = 'WebhookRequestError';
  }
}

async function getPayPalAccessToken(clientId: string, clientSecret: string, baseUrl: string): Promise<string> {
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PayPal auth failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.access_token as string;
}

async function verifyPayPalWebhook(
  event: Record<string, unknown>,
  headers: Headers,
  baseUrl: string,
  clientId: string,
  clientSecret: string,
  webhookId: string
): Promise<boolean> {
  const transmissionId = headers.get('paypal-transmission-id');
  const transmissionTime = headers.get('paypal-transmission-time');
  const transmissionSig = headers.get('paypal-transmission-sig');
  const certUrl = headers.get('paypal-cert-url');
  const authAlgo = headers.get('paypal-auth-algo');

  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
    throw new WebhookRequestError('Missing PayPal signature headers', 400);
  }

  const token = await getPayPalAccessToken(clientId, clientSecret, baseUrl);

  const verifyBody = {
    auth_algo: authAlgo,
    cert_url: certUrl,
    transmission_id: transmissionId,
    transmission_sig: transmissionSig,
    transmission_time: transmissionTime,
    webhook_id: webhookId,
    webhook_event: event,
  };

  const response = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(verifyBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PayPal webhook verification failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.verification_status === 'SUCCESS';
}

function getTransactionIdFromPayPalEvent(resource: NonNullable<PayPalEvent['resource']>): string | null {
  return (
    resource.custom_id ||
    resource.invoice_id ||
    resource.supplementary_data?.related_ids?.order_id ||
    null
  );
}

/** The event body, read under a size cap, and the event it must be. A body that is not a PayPal event is the caller's error. */
async function readEvent(request: NextRequest): Promise<{ raw: Record<string, unknown>; event: PayPalEvent }> {
  let parsed: unknown;
  try {
    parsed = await readBoundedJson(request, MAX_WEBHOOK_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) throw new WebhookRequestError('Payload too large', 413);
    throw new WebhookRequestError('Invalid payload', 400);
  }
  const event = paypalEventSchema.safeParse(parsed);
  if (!event.success) throw new WebhookRequestError('Invalid payload', 400);
  // The signature is verified over the body as PayPal sent it, not over the parsed copy.
  return { raw: parsed as Record<string, unknown>, event: event.data };
}

/**
 * POST handler for PayPal webhooks
 */
export async function POST(request: NextRequest) {
  try {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;

    if (!clientId || !clientSecret || !webhookId) {
      logger.error('PayPal webhook configuration missing');
      return NextResponse.json(
        { error: 'PayPal webhook not configured' },
        { status: 503 }
      );
    }

    const baseUrl = process.env.NODE_ENV === 'production'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';

    const { raw, event } = await readEvent(request);

    // The signature is checked first: nothing below reads or writes the database for a request that is not PayPal's.
    const verified = await verifyPayPalWebhook(
      raw,
      request.headers,
      baseUrl,
      clientId,
      clientSecret,
      webhookId
    );

    if (!verified) {
      logger.error('PayPal webhook signature invalid');
      return NextResponse.json(
        { error: 'Invalid PayPal signature' },
        { status: 400 }
      );
    }

    const eventType = event.event_type;
    const eventId = event.id;
    const resource: NonNullable<PayPalEvent['resource']> = event.resource ?? {};

    // Idempotency: skip already-processed events
    if (await isWebhookProcessed('paypal', eventId)) {
      return NextResponse.json({ received: true, status: 'duplicate' }, { status: 200 });
    }

    logger.info('PayPal webhook received', {
      eventId,
      eventType,
    });

    const transactionId = getTransactionIdFromPayPalEvent(resource);

    try {
      switch (eventType) {
        case 'PAYMENT.CAPTURE.COMPLETED':
          if (transactionId && resource.id) {
            await PaymentService.handlePaymentSuccess({
              transactionId,
              processorPaymentId: resource.id,
              processorType: 'paypal',
              amount: resource.amount?.value || '0.00',
              paymentMethod: 'paypal',
            });
          } else {
            logger.warn('PayPal payment completed without transaction id or capture id', { eventId });
          }
          break;

        case 'PAYMENT.CAPTURE.DENIED':
        case 'PAYMENT.CAPTURE.FAILED':
          if (transactionId) {
            await PaymentService.handlePaymentFailure({
              transactionId,
              processorPaymentId: resource.id,
              processorType: 'paypal',
              errorMessage: resource.status || 'PayPal payment failed',
              errorCode: resource.status_details?.reason || 'PAYPAL_FAILED',
            });
          } else {
            logger.warn('PayPal payment failed without transaction id', { eventId });
          }
          break;

        case 'PAYMENT.CAPTURE.REFUNDED':
          logger.info('PayPal refund received', { eventId, resourceId: resource.id });
          break;

        default:
          logger.info('Unhandled PayPal webhook event', { eventType });
      }
    } catch (error) {
      // An event the application refuses (unknown transaction, an amount that differs from the record, a different payment for a paid
      // transaction) fails closed and is reported as such; it never credits, and a redelivery is refused the same way.
      if (error instanceof PaymentAuthorityError) {
        logger.warn('PayPal webhook event rejected', { eventId, code: error.code });
        return NextResponse.json(
          { received: false, error: 'payment_rejected', code: error.code },
          { status: 422 }
        );
      }
      throw error;
    }

    // Record successful processing for idempotency
    await recordWebhookProcessed({
      provider: 'paypal',
      webhookId: eventId,
      eventType,
      payloadJson: raw,
    });

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    if (error instanceof WebhookRequestError) {
      logger.warn('PayPal webhook request refused', { message: error.message });
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('Error processing PayPal webhook', { error });
    // A 5xx makes PayPal deliver the event again; every handler above is idempotent, so a transient failure is retried, not lost.
    return NextResponse.json({ received: false, error: 'Internal processing error' }, { status: 500 });
  }
}
