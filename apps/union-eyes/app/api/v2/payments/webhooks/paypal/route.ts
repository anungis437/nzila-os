import { NextResponse } from 'next/server';
/**
 * POST /api/payments/webhooks/paypal
 * Migrated to withApi() framework
 */
import { logger } from '@/lib/logger';
import { PaymentService } from '@/lib/services/payment-service';
 
 
 
 
 
 
import { withApi, ApiError } from '@/lib/api/framework';

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
  payload: string,
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
    throw new Error('Missing PayPal signature headers');
  }
  const token = await getPayPalAccessToken(clientId, clientSecret, baseUrl);
  const event = JSON.parse(payload);
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

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Payments'],
      summary: 'POST paypal',
    },
  },
  async ({ request, userId: _userId, organizationId: _organizationId, user: _user, body: _body, query: _query, params: _params }) => {

        const clientId = process.env.PAYPAL_CLIENT_ID;
        const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
        const webhookId = process.env.PAYPAL_WEBHOOK_ID;
        if (!clientId || !clientSecret || !webhookId) {
          logger.error('PayPal webhook configuration missing');
          throw ApiError.internal('PayPal webhook not configured');
        }
        const baseUrl = process.env.NODE_ENV === 'production'
          ? 'https://api-m.paypal.com'
          : 'https://api-m.sandbox.paypal.com';
        const payload = await request.text();
        const verified = await verifyPayPalWebhook(
          payload,
          request.headers,
          baseUrl,
          clientId,
          clientSecret,
          webhookId
        );
        if (!verified) {
          logger.error('PayPal webhook signature invalid');
          throw ApiError.badRequest('Invalid PayPal signature');
        }
        const event = JSON.parse(payload);
        const eventType = event.event_type;
        const resource = event.resource || {};
        logger.info('PayPal webhook received', {
          eventId: event.id,
          eventType,
        });
        const transactionId = getTransactionIdFromPayPalEvent(resource);
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
        return NextResponse.json({ received: true }, { status: 200 });
  },
);
