/**
 * PayPal Payment Processor Implementation
 * Integrates PayPal Checkout and PayPal Commerce Platform
 * 
 * @see https://developer.paypal.com/docs/api/overview/
 * Uses PayPal REST APIs (Vault + Checkout)
 */

import { BasePaymentProcessor } from './base-processor';
import {
  PaymentProcessorType,
  PaymentIntent,
  PaymentMethod,
  PaymentMethodType,
  PaymentStatus,
  CustomerInfo,
  RefundRequest,
  RefundResult,
  CreatePaymentIntentOptions,
  WebhookEvent,
  WebhookEventType,
  WebhookVerification,
  ProcessorConfig,
  PaymentIntentError,
  RefundError,
  CustomerError,
  WebhookVerificationError,
} from '../types';
import { Decimal } from 'decimal.js';
import { logger } from '@/lib/logger';

/**
 * PayPal REST Types (used for API responses)
 */
interface PayPalOrder {
  id: string;
  status: 'CREATED' | 'SAVED' | 'APPROVED' | 'VOIDED' | 'COMPLETED' | 'PAYER_ACTION_REQUIRED';
  purchase_units: Array<{
    amount: {
      currency_code: string;
      value: string;
    };
    payments?: {
      captures?: Array<{
        id: string;
        status: string;
        amount: {
          currency_code: string;
          value: string;
        };
      }>;
    };
  }>;
  payer?: {
    email_address?: string;
    name?: {
      given_name?: string;
      surname?: string;
    };
  };
  create_time: string;
}

interface PayPalRefund {
  id: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED' | 'CANCELLED';
  amount: {
    currency_code: string;
    value: string;
  };
  create_time: string;
}

interface PayPalVaultCustomer {
  id: string;
  email_address?: string;
  name?: {
    given_name?: string;
    surname?: string;
  };
  phone?: {
    phone_number?: {
      national_number?: string;
    };
  };
  address?: {
    address_line_1?: string;
    address_line_2?: string;
    admin_area_2?: string;
    admin_area_1?: string;
    postal_code?: string;
    country_code?: string;
  };
  create_time?: string;
  update_time?: string;
}

interface PayPalPaymentToken {
  id: string;
  customer_id?: string;
  payment_source?: {
    card?: {
      brand?: string;
      last_digits?: string;
      expiry?: string; // YYYY-MM
    };
    paypal?: {
      email_address?: string;
    };
  };
  create_time?: string;
}

export class PayPalProcessor extends BasePaymentProcessor {
  private clientId?: string;
  private clientSecret?: string;
  private environment: 'sandbox' | 'production' = 'production';
  private accessToken?: string;
  private tokenExpiry?: Date;

  constructor() {
    super(PaymentProcessorType.PAYPAL, {
      supportsRecurringPayments: true,
      supportsRefunds: true,
      supportsPartialRefunds: true,
      supportsCustomers: true,
      supportsPaymentMethods: true,
      supportsWebhooks: true,
      supportedCurrencies: ['usd', 'cad', 'eur', 'gbp', 'aud', 'jpy'],
      supportedPaymentMethods: [
        PaymentMethodType.PAYPAL,
        PaymentMethodType.CREDIT_CARD,
        PaymentMethodType.DEBIT_CARD,
      ],
    });
  }

  async initialize(config: ProcessorConfig): Promise<void> {
    await super.initialize(config);
    
    // Extract client ID and secret from config
    this.clientId = config.apiKey;
    this.clientSecret = config.metadata?.clientSecret as string;
    this.environment = config.environment === 'test' ? 'sandbox' : 'production';
    
    if (!this.clientSecret) {
      throw new PaymentIntentError(
        'PayPal client secret required in config.metadata.clientSecret',
        this.type
      );
    }
    
    // Get initial access token
    await this.getAccessToken();
    
    logger.info('PayPal processor initialized', {
      environment: this.environment,
      clientId: this.clientId?.substring(0, 8) + '...',
    });
  }

  /**
   * Get or refresh PayPal OAuth access token
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const baseUrl = this.environment === 'sandbox'
        ? 'https://api-m.sandbox.paypal.com'
        : 'https://api-m.paypal.com';
      
      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });

      if (!response.ok) {
        throw new Error(`PayPal authentication failed: ${response.statusText}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      // Set expiry to 90% of actual expiry to ensure we refresh before expiration
      this.tokenExpiry = new Date(Date.now() + (data.expires_in * 900));
      
      return this.accessToken as string;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError('getAccessToken', error instanceof Error ? error : new Error(errorMessage));
      throw new PaymentIntentError(
        `Failed to obtain PayPal access token: ${errorMessage}`,
        this.type,
        error
      );
    }
  }

  /**
   * Get PayPal API base URL
   */
  private getBaseUrl(): string {
    return this.environment === 'sandbox'
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';
  }

  /**
   * Make authenticated request to PayPal API
   */
  private async paypalRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getAccessToken();
    const url = `${this.getBaseUrl()}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `req_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PayPal API error: ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Create a payment intent (PayPal Order)
   */
  async createPaymentIntent(options: CreatePaymentIntentOptions): Promise<PaymentIntent> {
    try {
      this.logOperation('createPaymentIntent', { 
        amount: options.amount.toString(), 
        currency: options.currency 
      });

      const orderData = {
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: options.currency.toUpperCase(),
            value: options.amount.toString(),
          },
          description: options.description,
          custom_id: options.metadata?.customId as string,
        }],
        application_context: {
          return_url: options.metadata?.returnUrl as string,
          cancel_url: options.metadata?.cancelUrl as string,
        },
      };

      const order = await this.paypalRequest<PayPalOrder>(
        '/v2/checkout/orders',
        {
          method: 'POST',
          body: JSON.stringify(orderData),
        }
      );

      return this.mapPayPalOrderToPaymentIntent(order);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError('createPaymentIntent', error instanceof Error ? error : new Error(errorMessage));
      throw new PaymentIntentError(
        `Failed to create PayPal order: ${errorMessage}`,
        this.type,
        error
      );
    }
  }

  /**
   * Retrieve a payment intent
   */
  async retrievePaymentIntent(paymentIntentId: string): Promise<PaymentIntent> {
    try {
      this.logOperation('retrievePaymentIntent', { paymentIntentId });

      const order = await this.paypalRequest<PayPalOrder>(
        `/v2/checkout/orders/${paymentIntentId}`
      );

      return this.mapPayPalOrderToPaymentIntent(order);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError('retrievePaymentIntent', error instanceof Error ? error : new Error(errorMessage), { paymentIntentId });
      throw new PaymentIntentError(
        `Failed to retrieve PayPal order: ${errorMessage}`,
        this.type,
        error
      );
    }
  }

  /**
   * Confirm a payment intent (Capture PayPal Order)
   */
  async confirmPaymentIntent(paymentIntentId: string): Promise<PaymentIntent> {
    try {
      this.logOperation('confirmPaymentIntent', { paymentIntentId });

      const order = await this.paypalRequest<PayPalOrder>(
        `/v2/checkout/orders/${paymentIntentId}/capture`,
        { method: 'POST' }
      );

      return this.mapPayPalOrderToPaymentIntent(order);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError('confirmPaymentIntent', error instanceof Error ? error : new Error(errorMessage), { paymentIntentId });
      throw new PaymentIntentError(
        `Failed to capture PayPal order: ${errorMessage}`,
        this.type,
        error
      );
    }
  }

  /**
   * Cancel a payment intent
   */
  async cancelPaymentIntent(paymentIntentId: string): Promise<PaymentIntent> {
    try {
      this.logOperation('cancelPaymentIntent', { paymentIntentId });

      // PayPal doesn&apos;t have a direct cancel, retrieve current state
      const order = await this.retrievePaymentIntent(paymentIntentId);
      
      // Only CREATED or APPROVED orders can be effectively "cancelled" by ignoring them
      logger.info('PayPal order cancellation noted', { orderId: paymentIntentId });

      return order;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError('cancelPaymentIntent', error instanceof Error ? error : new Error(errorMessage), { paymentIntentId });
      throw new PaymentIntentError(
        `Failed to cancel PayPal order: ${errorMessage}`,
        this.type,
        error
      );
    }
  }

  /**
   * Create a refund
   */
  async createRefund(request: RefundRequest): Promise<RefundResult> {
    try {
      this.logOperation('createRefund', { 
        paymentIntentId: request.paymentIntentId,
        amount: request.amount?.toString(),
      });

      // First, get the order to find the capture ID
      const order = await this.paypalRequest<PayPalOrder>(
        `/v2/checkout/orders/${request.paymentIntentId}`
      );

      const capture = order.purchase_units[0]?.payments?.captures?.[0];
      if (!capture) {
        throw new RefundError('No capture found for this order', this.type);
      }

      const refundData: Record<string, unknown> = {};
      if (request.amount) {
        refundData.amount = {
          currency_code: order.purchase_units[0].amount.currency_code,
          value: request.amount.toString(),
        };
      }
      if (request.reason) {
        refundData.note_to_payer = request.reason;
      }

      const refund = await this.paypalRequest<PayPalRefund>(
        `/v2/payments/captures/${capture.id}/refund`,
        {
          method: 'POST',
          body: JSON.stringify(refundData),
        }
      );

      return {
        id: refund.id,
        amount: new Decimal(refund.amount.value),
        currency: refund.amount.currency_code.toLowerCase(),
        status: this.mapPayPalRefundStatus(refund.status),
        paymentIntentId: request.paymentIntentId,
        reason: request.reason,
        createdAt: new Date(refund.create_time),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError('createRefund', error instanceof Error ? error : new Error(errorMessage), { paymentIntentId: request.paymentIntentId });
      throw new RefundError(
        `Failed to create PayPal refund: ${errorMessage}`,
        this.type,
        error
      );
    }
  }

  /**
   * Retrieve a refund
   */
  async retrieveRefund(refundId: string): Promise<RefundResult> {
    try {
      this.logOperation('retrieveRefund', { refundId });

      const refund = await this.paypalRequest<PayPalRefund>(
        `/v2/payments/refunds/${refundId}`
      );

      return {
        id: refund.id,
        amount: new Decimal(refund.amount.value),
        currency: refund.amount.currency_code.toLowerCase(),
        status: this.mapPayPalRefundStatus(refund.status),
        paymentIntentId: '', // PayPal doesn&apos;t return original order ID in refund
        createdAt: new Date(refund.create_time),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError('retrieveRefund', error instanceof Error ? error : new Error(errorMessage), { refundId });
      throw new RefundError(
        `Failed to retrieve PayPal refund: ${errorMessage}`,
        this.type,
        error
      );
    }
  }

  /**
   * Create a customer (PayPal Customer/Vault)
   */
  async createCustomer(customer: CustomerInfo): Promise<string> {
    try {
      this.logOperation('createCustomer', { email: customer.email });

      const payload: Record<string, unknown> = {
        email_address: customer.email,
      };

      if (customer.name) {
        const [givenName, ...surnameParts] = customer.name.split(' ');
        payload.name = {
          given_name: givenName,
          surname: surnameParts.join(' ') || undefined,
        };
      }

      if (customer.phone) {
        payload.phone = { phone_number: { national_number: customer.phone } };
      }

      if (customer.address) {
        payload.address = {
          address_line_1: customer.address.line1,
          address_line_2: customer.address.line2,
          admin_area_2: customer.address.city,
          admin_area_1: customer.address.state,
          postal_code: customer.address.postalCode,
          country_code: customer.address.country,
        };
      }

      const created = await this.paypalRequest<PayPalVaultCustomer>(
        '/v3/vault/customers',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );

      logger.info('PayPal customer created', {
        email: customer.email,
        customerId: created.id,
      });

      return created.id;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError('createCustomer', error instanceof Error ? error : new Error(errorMessage), { email: customer.email });
      throw new CustomerError(
        `Failed to create PayPal customer: ${errorMessage}`,
        this.type,
        error
      );
    }
  }

  /**
   * Retrieve a customer
   */
  async retrieveCustomer(customerId: string): Promise<CustomerInfo> {
    try {
      this.logOperation('retrieveCustomer', { customerId });

      const customer = await this.paypalRequest<PayPalVaultCustomer>(
        `/v3/vault/customers/${customerId}`
      );

      return {
        id: customer.id,
        email: customer.email_address || '',
        name: [customer.name?.given_name, customer.name?.surname].filter(Boolean).join(' ') || undefined,
        phone: customer.phone?.phone_number?.national_number,
        address: customer.address ? {
          line1: customer.address.address_line_1,
          line2: customer.address.address_line_2,
          city: customer.address.admin_area_2,
          state: customer.address.admin_area_1,
          postalCode: customer.address.postal_code,
          country: customer.address.country_code,
        } : undefined,
        metadata: { source: 'paypal' },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError('retrieveCustomer', error instanceof Error ? error : new Error(errorMessage), { customerId });
      throw new CustomerError(
        `Failed to retrieve PayPal customer: ${errorMessage}`,
        this.type,
        error
      );
    }
  }

  /**
   * Update a customer
   */
  async updateCustomer(customerId: string, updates: Partial<CustomerInfo>): Promise<CustomerInfo> {
    try {
      this.logOperation('updateCustomer', { customerId });

      const patchOps: Array<{ op: 'replace'; path: string; value: any }> = [];

      if (updates.email) {
        patchOps.push({ op: 'replace', path: '/email_address', value: updates.email });
      }

      if (updates.name) {
        const [givenName, ...surnameParts] = updates.name.split(' ');
        patchOps.push({ op: 'replace', path: '/name', value: {
          given_name: givenName,
          surname: surnameParts.join(' ') || undefined,
        } });
      }

      if (updates.phone) {
        patchOps.push({ op: 'replace', path: '/phone', value: {
          phone_number: { national_number: updates.phone },
        } });
      }

      if (updates.address) {
        patchOps.push({ op: 'replace', path: '/address', value: {
          address_line_1: updates.address.line1,
          address_line_2: updates.address.line2,
          admin_area_2: updates.address.city,
          admin_area_1: updates.address.state,
          postal_code: updates.address.postalCode,
          country_code: updates.address.country,
        } });
      }

      if (patchOps.length > 0) {
        await this.paypalRequest<void>(
          `/v3/vault/customers/${customerId}`,
          {
            method: 'PATCH',
            body: JSON.stringify(patchOps),
          }
        );
      }

      return this.retrieveCustomer(customerId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError('updateCustomer', error instanceof Error ? error : new Error(errorMessage), { customerId });
      throw new CustomerError(
        `Failed to update PayPal customer: ${errorMessage}`,
        this.type,
        error
      );
    }
  }

  /**
   * Attach a payment method to a customer
   */
  async attachPaymentMethod(paymentMethodId: string, customerId: string): Promise<PaymentMethod> {
    try {
      this.logOperation('attachPaymentMethod', { paymentMethodId, customerId });

      const token = await this.paypalRequest<PayPalPaymentToken>(
        `/v3/vault/payment-tokens/${paymentMethodId}`
      );

      return this.mapPaymentTokenToMethod(token, customerId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError('attachPaymentMethod', error instanceof Error ? error : new Error(errorMessage), { paymentMethodId, customerId });
      throw new CustomerError(
        `Failed to attach PayPal payment method: ${errorMessage}`,
        this.type,
        error
      );
    }
  }

  /**
   * Detach a payment method from a customer
   */
  async detachPaymentMethod(paymentMethodId: string): Promise<PaymentMethod> {
    try {
      this.logOperation('detachPaymentMethod', { paymentMethodId });

      const existing = await this.paypalRequest<PayPalPaymentToken>(
        `/v3/vault/payment-tokens/${paymentMethodId}`
      );

      await this.paypalRequest<void>(
        `/v3/vault/payment-tokens/${paymentMethodId}`,
        { method: 'DELETE' }
      );

      return this.mapPaymentTokenToMethod(existing, existing.customer_id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError('detachPaymentMethod', error instanceof Error ? error : new Error(errorMessage), { paymentMethodId });
      throw new CustomerError(
        `Failed to detach PayPal payment method: ${errorMessage}`,
        this.type,
        error
      );
    }
  }

  /**
   * List payment methods for a customer
   */
  async listPaymentMethods(customerId: string): Promise<PaymentMethod[]> {
    try {
      this.logOperation('listPaymentMethods', { customerId });

      const response = await this.paypalRequest<{ payment_tokens?: PayPalPaymentToken[]; items?: PayPalPaymentToken[] }>(
        `/v3/vault/payment-tokens?customer_id=${customerId}`
      );

      const tokens = response.payment_tokens || response.items || [];
      return tokens.map((token) => this.mapPaymentTokenToMethod(token, customerId));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError('listPaymentMethods', error instanceof Error ? error : new Error(errorMessage), { customerId });
      throw new CustomerError(
        `Failed to list PayPal payment methods: ${errorMessage}`,
        this.type,
        error
      );
    }
  }

  private mapPaymentTokenToMethod(token: PayPalPaymentToken, customerId?: string): PaymentMethod {
    const card = token.payment_source?.card;
    const expiryParts = card?.expiry?.split('-') || [];

    return {
      id: token.id,
      type: card ? PaymentMethodType.CREDIT_CARD : PaymentMethodType.PAYPAL,
      processor: this.type,
      processorMethodId: token.id,
      customerId: customerId || token.customer_id,
      last4: card?.last_digits,
      expiryMonth: expiryParts[1] ? Number(expiryParts[1]) : undefined,
      expiryYear: expiryParts[0] ? Number(expiryParts[0]) : undefined,
      brand: card?.brand,
      metadata: { source: 'paypal' },
      createdAt: token.create_time ? new Date(token.create_time) : new Date(),
    };
  }

  /**
   * Verify webhook signature
   */
  async verifyWebhook(payload: string, signature: string): Promise<WebhookVerification> {
    try {
      if (!this.config?.webhookSecret) {
        throw new WebhookVerificationError(
          'PayPal webhook ID not configured',
          this.type
        );
      }

      // PayPal webhook verification using webhook ID
      const webhookEvent = JSON.parse(payload);
      
      const verifyData = {
        auth_algo: signature.split('=')[0],
        cert_url: webhookEvent.cert_url,
        transmission_id: webhookEvent.transmission_id,
        transmission_sig: signature,
        transmission_time: webhookEvent.transmission_time,
        webhook_id: this.config.webhookSecret,
        webhook_event: webhookEvent,
      };

      const response = await this.paypalRequest<{ verification_status: string }>(
        '/v1/notifications/verify-webhook-signature',
        {
          method: 'POST',
          body: JSON.stringify(verifyData),
        }
      );

      const verified = response.verification_status === 'SUCCESS';

      return {
        verified,
        event: verified ? {
          id: webhookEvent.id,
          type: this.mapPayPalEventType(webhookEvent.event_type),
          processor: this.type,
          data: webhookEvent.resource,
          createdAt: new Date(webhookEvent.create_time),
          rawEvent: webhookEvent,
        } : undefined,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError('verifyWebhook', error instanceof Error ? error : new Error(errorMessage));
      return {
        verified: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Process webhook event
   */
  async processWebhook(event: WebhookEvent): Promise<void> {
    this.logOperation('processWebhook', { eventType: event.type, eventId: event.id });
    
    // Webhook processing logic handled by webhook route handlers
  }

  /**
   * Map PayPal order to payment intent
   */
  private mapPayPalOrderToPaymentIntent(order: PayPalOrder): PaymentIntent {
    const purchaseUnit = order.purchase_units[0];
    
    return {
      id: order.id,
      amount: new Decimal(purchaseUnit.amount.value),
      currency: purchaseUnit.amount.currency_code.toLowerCase(),
      status: this.mapPayPalOrderStatus(order.status),
      customerId: order.payer?.email_address,
      metadata: { 
        paypalOrderId: order.id,
        payerEmail: order.payer?.email_address,
      },
      createdAt: new Date(order.create_time),
      processorType: this.type,
      processorPaymentId: order.id,
    };
  }

  /**
   * Map PayPal order status to payment status
   */
  private mapPayPalOrderStatus(status: PayPalOrder['status']): PaymentStatus {
    const statusMap = {
      'CREATED': PaymentStatus.PENDING,
      'SAVED': PaymentStatus.PENDING,
      'APPROVED': PaymentStatus.PROCESSING,
      'VOIDED': PaymentStatus.CANCELLED,
      'COMPLETED': PaymentStatus.SUCCEEDED,
      'PAYER_ACTION_REQUIRED': PaymentStatus.PENDING,
    } as const;
    
    return statusMap[status] ?? PaymentStatus.PENDING;
  }

  /**
   * Map PayPal refund status to payment status
   */
  private mapPayPalRefundStatus(status: PayPalRefund['status']): PaymentStatus {
    const statusMap = {
      'COMPLETED': PaymentStatus.REFUNDED,
      'PENDING': PaymentStatus.PROCESSING,
      'FAILED': PaymentStatus.FAILED,
      'CANCELLED': PaymentStatus.CANCELLED,
    } as const;
    
    return statusMap[status] ?? PaymentStatus.PROCESSING;
  }

  /**
   * Map PayPal event types to common event types
   */
  private mapPayPalEventType(paypalEventType: string): WebhookEventType {
    const eventMap: Record<string, WebhookEventType> = {
      'PAYMENT.CAPTURE.COMPLETED': WebhookEventType.PAYMENT_SUCCEEDED,
      'PAYMENT.CAPTURE.DENIED': WebhookEventType.PAYMENT_FAILED,
      'PAYMENT.CAPTURE.REFUNDED': WebhookEventType.PAYMENT_REFUNDED,
      'BILLING.SUBSCRIPTION.CREATED': WebhookEventType.SUBSCRIPTION_CREATED,
      'BILLING.SUBSCRIPTION.UPDATED': WebhookEventType.SUBSCRIPTION_UPDATED,
      'BILLING.SUBSCRIPTION.CANCELLED': WebhookEventType.SUBSCRIPTION_CANCELLED,
      'CUSTOMER.CREATED': WebhookEventType.CUSTOMER_CREATED,
      'VAULT.PAYMENT-TOKEN.CREATED': WebhookEventType.PAYMENT_METHOD_ATTACHED,
      'VAULT.PAYMENT-TOKEN.DELETED': WebhookEventType.PAYMENT_METHOD_DETACHED,
    };
    
    return eventMap[paypalEventType] || WebhookEventType.PAYMENT_SUCCEEDED;
  }
}
