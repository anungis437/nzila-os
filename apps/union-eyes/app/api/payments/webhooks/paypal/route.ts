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
import { logger } from '@/lib/logger';
import { PaymentAuthorityError, PaymentService } from '@/lib/services/payment-service';
import { isWebhookProcessed, recordWebhookProcessed } from '@/lib/services/rewards/webhook-service';
import { readBoundedJson, RequestBodyTooLargeError } from '@/lib/api/bounded-json';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_WEBHOOK_BYTES = 256 * 1024;

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getTransactionIdFromPayPalEvent(resource: any): string | null {
  return (
    resource?.custom_id ||
    resource?.invoice_id ||
    resource?.supplementary_data?.related_ids?.order_id ||
    null
  );
}

/** The event body, read under a size cap. It is a JSON object: anything else cannot be a PayPal event. */
async function readEvent(request: NextRequest): Promise<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = await readBoundedJson(request, MAX_WEBHOOK_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) throw new WebhookRequestError('Payload too large', 413);
    throw new WebhookRequestError('Invalid payload', 400);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new WebhookRequestError('Invalid payload', 400);
  return parsed as Record<string, unknown>;
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

    const event = await readEvent(request);

    // The signature is checked first: nothing below reads or writes the database for a request that is not PayPal's.
    const verified = await verifyPayPalWebhook(
      event,
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
    const eventId = event.id as string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resource = (event.resource || {}) as Record<string, any>;

    // Idempotency: skip already-processed events
    if (eventId && await isWebhookProcessed('paypal', eventId)) {
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
          if (transactionId) {
            await PaymentService.handlePaymentSuccess({
              transactionId,
              processorPaymentId: resource.id,
              processorType: 'paypal',
              amount: resource?.amount?.value || '0.00',
              paymentMethod: 'paypal',
            });
          } else {
            logger.warn('PayPal payment completed without transaction id', { eventId: event.id });
          }
          break;

        case 'PAYMENT.CAPTURE.DENIED':
        case 'PAYMENT.CAPTURE.FAILED':
          if (transactionId) {
            await PaymentService.handlePaymentFailure({
              transactionId,
              processorPaymentId: resource.id,
              processorType: 'paypal',
              errorMessage: resource?.status || 'PayPal payment failed',
              errorCode: resource?.status_details?.reason || 'PAYPAL_FAILED',
            });
          } else {
            logger.warn('PayPal payment failed without transaction id', { eventId: event.id });
          }
          break;

        case 'PAYMENT.CAPTURE.REFUNDED':
          logger.info('PayPal refund received', { eventId: event.id, resourceId: resource.id });
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
    if (eventId) {
      await recordWebhookProcessed({
        provider: 'paypal',
        webhookId: eventId,
        eventType: String(eventType || 'unknown'),
        payloadJson: event,
      });
    }

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
