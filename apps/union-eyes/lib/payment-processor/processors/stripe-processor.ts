/**
 * Stripe Payment Processor Implementation
 * Primary payment processor for UnionEyes
 */

// eslint-disable-next-line no-restricted-imports -- TODO(platform-migration): migrate to @nzila/ wrapper
import Stripe from 'stripe';
import { BasePaymentProcessor, mapProcessorStatus } from './base-processor';
import {
  PaymentProcessorType,
  PaymentIntent,
  PaymentMethod,
  PaymentMethodType,
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

export class StripeProcessor extends BasePaymentProcessor {
  private stripe?: Stripe;

  constructor() {
    super(PaymentProcessorType.STRIPE, {
      supportsRecurringPayments: true,
      supportsRefunds: true,
      supportsPartialRefunds: true,
      supportsCustomers: true,
      supportsPaymentMethods: true,
      supportsWebhooks: true,
      supportedCurrencies: ['usd', 'cad', 'eur', 'gbp', 'aud', 'jpy'],
      supportedPaymentMethods: [
        PaymentMethodType.CREDIT_CARD,
        PaymentMethodType.DEBIT_CARD,
        PaymentMethodType.BANK_ACCOUNT,
        PaymentMethodType.ACH,
      ],
    });
  }

  async initialize(config: ProcessorConfig): Promise<void> {
    await super.initialize(config);
    
    this.stripe = new Stripe(config.apiKey, {
      apiVersion: '2024-06-20',
      appInfo: {
        name: 'UnionEyes',
        version: '1.0.0',
      },
      typescript: true,
    });
  }

  private getStripe(): Stripe {
    this.ensureInitialized();
    if (!this.stripe) {
      throw new PaymentIntentError('Stripe client not initialized', this.type);
    }
    return this.stripe;
  }

  /**
   * Create a payment intent
   */
  async createPaymentIntent(options: CreatePaymentIntentOptions): Promise<PaymentIntent> {
    try {
      this.logOperation('createPaymentIntent', { amount: options.amount.toString(), currency: options.currency });
      
      const stripe = this.getStripe();
      const amount = this.convertAmount(options.amount, options.currency);
      
      const createParams: Stripe.PaymentIntentCreateParams = {
        amount,
        currency: options.currency.toLowerCase(),
        metadata: options.metadata ? this.toStripeMetadata(options.metadata) : undefined,
      };
      
      if (options.customerId) {
        createParams.customer = options.customerId;
      }
      
      if (options.paymentMethodId) {
        createParams.payment_method = options.paymentMethodId;
      }
      
      if (options.confirm) {
        createParams.confirm = true;
        createParams.automatic_payment_methods = {
          enabled: true,
          allow_redirects: 'never',
        };
      }
      
      if (options.setupFutureUsage) {
        createParams.setup_future_usage = options.setupFutureUsage;
      }
      
      if (options.description) {
        createParams.description = options.description;
      }
      
      if (options.receiptEmail) {
        createParams.receipt_email = options.receiptEmail;
      }
      
      const paymentIntent = await stripe.paymentIntents.create(createParams);
      
      return this.mapStripePaymentIntent(paymentIntent);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError('createPaymentIntent', error instanceof Error ? error : new Error(errorMessage));
      throw new PaymentIntentError(
        `Failed to create payment intent: ${errorMessage}`,
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
      
      const stripe = this.getStripe();
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      return this.mapStripePaymentIntent(paymentIntent);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError('retrievePaymentIntent', error instanceof Error ? error : new Error(errorMessage), { paymentIntentId });
      throw new PaymentIntentError(
        `Failed to retrieve payment intent: ${errorMessage}`,
        this.type,
        error
      );
    }
  }

  /**
   * Confirm a payment intent
   */
  async confirmPaymentIntent(paymentIntentId: string): Promise<PaymentIntent> {
    try {
      this.logOperation('confirmPaymentIntent', { paymentIntentId });
      
      const stripe = this.getStripe();
      const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId);
      
      return this.mapStripePaymentIntent(paymentIntent);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError('confirmPaymentIntent', error instanceof Error ? error : new Error(errorMessage), { paymentIntentId });
      throw new PaymentIntentError(
        `Failed to confirm payment intent: ${errorMessage}`,
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
      
      const stripe = this.getStripe();
      const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);
      
      return this.mapStripePaymentIntent(paymentIntent);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError('cancelPaymentIntent', error instanceof Error ? error : new Error(errorMessage), { paymentIntentId });
      throw new PaymentIntentError(
        `Failed to cancel payment intent: ${errorMessage}`,
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
      
      const stripe = this.getStripe();
      
      const refundParams: Stripe.RefundCreateParams = {
        payment_intent: request.paymentIntentId,
        metadata: request.metadata ? this.toStripeMetadata(request.metadata) : undefined,
      };
      
      if (request.amount) {
        // Get the payment intent to know the currency
        const paymentIntent = await stripe.paymentIntents.retrieve(request.paymentIntentId);
        refundParams.amount = this.convertAmount(request.amount, paymentIntent.currency);
      }
      
      if (request.reason) {
        refundParams.reason = request.reason as Stripe.RefundCreateParams.Reason;
      }
      
      const refund = await stripe.refunds.create(refundParams);
      
      return {
        id: refund.id,
        amount: this.formatAmount(refund.amount, refund.currency),
        currency: refund.currency,
        status: mapProcessorStatus(refund.status || 'succeeded', this.type),
        paymentIntentId: request.paymentIntentId,
        reason: request.reason,
        createdAt: new Date(refund.created * 1000),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError('createRefund', error instanceof Error ? error : new Error(errorMessage), { paymentIntentId: request.paymentIntentId });
      throw new RefundError(
        `Failed to create refund: ${errorMessage}`,
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
      
      const stripe = this.getStripe();
      const refund = await stripe.refunds.retrieve(refundId);
      
      return {
        id: refund.id,
        amount: this.formatAmount(refund.amount, refund.currency),
        currency: refund.currency,
        status: mapProcessorStatus(refund.status || 'succeeded', this.type),
        paymentIntentId: typeof refund.payment_intent === 'string' ? refund.payment_intent : '',
        createdAt: new Date(refund.created * 1000),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError('retrieveRefund', error instanceof Error ? error : new Error(errorMessage), { refundId });
      throw new RefundError(
        `Failed to retrieve refund: ${errorMessage}`,
        this.type,
        error
      );
    }
  }

  /**
   * Create a customer
   */
  async createCustomer(customer: CustomerInfo): Promise<string> {
    try {
      this.logOperation('createCustomer', { email: customer.email });
      
      const stripe = this.getStripe();
      
      const customerParams: Stripe.CustomerCreateParams = {
        email: customer.email,
        metadata: customer.metadata ? this.toStripeMetadata(customer.metadata) : undefined,
      };
      
      if (customer.name) {
        customerParams.name = customer.name;
      }
      
      if (customer.phone) {
        customerParams.phone = customer.phone;
      }
      
      if (customer.address) {
        customerParams.address = {
          line1: customer.address.line1,
          line2: customer.address.line2,
          city: customer.address.city,
          state: customer.address.state,
          postal_code: customer.address.postalCode,
          country: customer.address.country,
        };
      }
      
      const stripeCustomer = await stripe.customers.create(customerParams);
      
      return stripeCustomer.id;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError('createCustomer', error instanceof Error ? error : new Error(errorMessage), { email: customer.email });
      throw new CustomerError(
        `Failed to create customer: ${errorMessage}`,
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
      
      const stripe = this.getStripe();
      const customer = await stripe.customers.retrieve(customerId);
      
      if (customer.deleted) {
        throw new CustomerError('Customer has been deleted', this.type);
      }
      
      return {
        id: customer.id,
        email: customer.email || '',
        name: customer.name || undefined,
        phone: customer.phone || undefined,
        address: customer.address ? {
          line1: customer.address.line1 || undefined,
          line2: customer.address.line2 || undefined,
          city: customer.address.city || undefined,
          state: customer.address.state || undefined,
          postalCode: customer.address.postal_code || undefined,
          country: customer.address.country || undefined,
        } : undefined,
        metadata: customer.metadata,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError('retrieveCustomer', error instanceof Error ? error : new Error(errorMessage), { customerId });
      throw new CustomerError(
        `Failed to retrieve customer: ${errorMessage}`,
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
      
      const stripe = this.getStripe();
      
      const updateParams: Stripe.CustomerUpdateParams = {};
      
      if (updates.email) updateParams.email = updates.email;
      if (updates.name) updateParams.name = updates.name;
      if (updates.phone) updateParams.phone = updates.phone;
      if (updates.metadata) updateParams.metadata = this.toStripeMetadata(updates.metadata);
      
      if (updates.address) {
        updateParams.address = {
          line1: updates.address.line1,
          line2: updates.address.line2,
          city: updates.address.city,
          state: updates.address.state,
          postal_code: updates.address.postalCode,
          country: updates.address.country,
        };
      }
      
      const customer = await stripe.customers.update(customerId, updateParams);
      
      return this.retrieveCustomer(customer.id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError('updateCustomer', error instanceof Error ? error : new Error(errorMessage), { customerId });
      throw new CustomerError(
        `Failed to update customer: ${errorMessage}`,
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
      
      const stripe = this.getStripe();
      const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });
      
      return this.mapStripePaymentMethod(paymentMethod);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError('attachPaymentMethod', error instanceof Error ? error : new Error(errorMessage), { paymentMethodId, customerId });
      throw new CustomerError(
        `Failed to attach payment method: ${errorMessage}`,
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
      
      const stripe = this.getStripe();
      const paymentMethod = await stripe.paymentMethods.detach(paymentMethodId);
      
      return this.mapStripePaymentMethod(paymentMethod);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError('detachPaymentMethod', error instanceof Error ? error : new Error(errorMessage), { paymentMethodId });
      throw new CustomerError(
        `Failed to detach payment method: ${errorMessage}`,
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
      
      const stripe = this.getStripe();
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card', // Can be extended to support other types
      });
      
      return paymentMethods.data.map(pm => this.mapStripePaymentMethod(pm));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError('listPaymentMethods', error instanceof Error ? error : new Error(errorMessage), { customerId });
      throw new CustomerError(
        `Failed to list payment methods: ${errorMessage}`,
        this.type,
        error
      );
    }
  }

  /**
   * Verify webhook signature
   */
  async verifyWebhook(payload: string, signature: string): Promise<WebhookVerification> {
    try {
      if (!this.config?.webhookSecret) {
        throw new WebhookVerificationError(
          'Webhook secret not configured',
          this.type
        );
      }
      
      const stripe = this.getStripe();
      const event = stripe.webhooks.constructEvent(
        payload,
        signature,
        this.config.webhookSecret
      );
      
      return {
        verified: true,
        event: {
          id: event.id,
          type: this.mapStripeEventType(event.type),
          processor: this.type,
          data: event.data.object,
          createdAt: new Date(event.created * 1000),
          rawEvent: event,
        },
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
    
    // Webhook processing logic is handled by the webhook route handlers
    // This method is a placeholder for any processor-specific webhook processing
  }

  /**
   * Map Stripe payment intent to common format
   */
  private mapStripePaymentIntent(paymentIntent: Stripe.PaymentIntent): PaymentIntent {
    return {
      id: paymentIntent.id,
      amount: this.formatAmount(paymentIntent.amount, paymentIntent.currency),
      currency: paymentIntent.currency,
      status: mapProcessorStatus(paymentIntent.status, this.type),
      paymentMethodId: typeof paymentIntent.payment_method === 'string' 
        ? paymentIntent.payment_method 
        : undefined,
      customerId: typeof paymentIntent.customer === 'string'
        ? paymentIntent.customer
        : undefined,
      metadata: paymentIntent.metadata,
      createdAt: new Date(paymentIntent.created * 1000),
      processorType: this.type,
      processorPaymentId: paymentIntent.id,
    };
  }

  /**
   * Map Stripe payment method to common format
   */
  private mapStripePaymentMethod(paymentMethod: Stripe.PaymentMethod): PaymentMethod {
    let methodType = PaymentMethodType.CREDIT_CARD;
    let last4: string | undefined;
    let brand: string | undefined;
    let expiryMonth: number | undefined;
    let expiryYear: number | undefined;
    
    if (paymentMethod.type === 'card' && paymentMethod.card) {
      last4 = paymentMethod.card.last4;
      brand = paymentMethod.card.brand;
      expiryMonth = paymentMethod.card.exp_month;
      expiryYear = paymentMethod.card.exp_year;
      methodType = PaymentMethodType.CREDIT_CARD;
    } else if (paymentMethod.type === 'us_bank_account') {
      methodType = PaymentMethodType.ACH;
      if (paymentMethod.us_bank_account) {
        last4 = paymentMethod.us_bank_account.last4 || undefined;
      }
    }
    
    return {
      id: paymentMethod.id,
      type: methodType,
      processor: this.type,
      processorMethodId: paymentMethod.id,
      customerId: typeof paymentMethod.customer === 'string'
        ? paymentMethod.customer
        : undefined,
      last4,
      brand,
      expiryMonth,
      expiryYear,
      createdAt: new Date(paymentMethod.created * 1000),
    };
  }

  /**
   * Map Stripe event types to common event types
   */
  private mapStripeEventType(stripeEventType: string): WebhookEventType {
    const eventMap: Record<string, WebhookEventType> = {
      'payment_intent.succeeded': WebhookEventType.PAYMENT_SUCCEEDED,
      'payment_intent.payment_failed': WebhookEventType.PAYMENT_FAILED,
      'charge.refunded': WebhookEventType.PAYMENT_REFUNDED,
      'customer.subscription.created': WebhookEventType.SUBSCRIPTION_CREATED,
      'customer.subscription.updated': WebhookEventType.SUBSCRIPTION_UPDATED,
      'customer.subscription.deleted': WebhookEventType.SUBSCRIPTION_CANCELLED,
      'payment_method.attached': WebhookEventType.PAYMENT_METHOD_ATTACHED,
      'payment_method.detached': WebhookEventType.PAYMENT_METHOD_DETACHED,
      'customer.created': WebhookEventType.CUSTOMER_CREATED,
      'customer.updated': WebhookEventType.CUSTOMER_UPDATED,
    };
    
    return eventMap[stripeEventType] || WebhookEventType.PAYMENT_SUCCEEDED;
  }

  private toStripeMetadata(metadata: Record<string, unknown>): Stripe.MetadataParam {
    const result: Stripe.MetadataParam = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (value === null || typeof value === 'string' || typeof value === 'number') {
        result[key] = value;
        continue;
      }

      if (typeof value === 'boolean') {
        result[key] = value ? 'true' : 'false';
        continue;
      }

      result[key] = JSON.stringify(value);
    }
    return result;
  }
}
