/**
 * Payment Processor Abstraction Layer
 * Provides a common interface for multiple payment providers
 * 
 * Supported Processors:
 * - Stripe (Primary)
 * - PayPal (Future)
 * - Square (Future)
 * - Manual/Bank Transfer (Future)
 */

import { Decimal } from 'decimal.js';

/**
 * Supported payment processor types
 */
export enum PaymentProcessorType {
  STRIPE = 'stripe',
  PAYPAL = 'paypal',
  SQUARE = 'square',
  MANUAL = 'manual',
}

/**
 * Payment method types across all processors
 */
export enum PaymentMethodType {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  BANK_ACCOUNT = 'bank_account',
  ACH = 'ach',
  PAYPAL = 'paypal',
  INTERAC = 'interac',
  CHEQUE = 'cheque',
  MANUAL_TRANSFER = 'manual_transfer',
}

/**
 * Payment status across all processors
 */
export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}

/**
 * Webhook event types
 */
export enum WebhookEventType {
  PAYMENT_SUCCEEDED = 'payment.succeeded',
  PAYMENT_FAILED = 'payment.failed',
  PAYMENT_REFUNDED = 'payment.refunded',
  SUBSCRIPTION_CREATED = 'subscription.created',
  SUBSCRIPTION_UPDATED = 'subscription.updated',
  SUBSCRIPTION_CANCELLED = 'subscription.cancelled',
  PAYMENT_METHOD_ATTACHED = 'payment_method.attached',
  PAYMENT_METHOD_DETACHED = 'payment_method.detached',
  CUSTOMER_CREATED = 'customer.created',
  CUSTOMER_UPDATED = 'customer.updated',
}

/**
 * Common payment intent interface
 */
export interface PaymentIntent {
  id: string;
  amount: Decimal;
  currency: string;
  status: PaymentStatus;
  paymentMethodId?: string;
  customerId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  processorType: PaymentProcessorType;
  processorPaymentId: string; // Original processor-specific ID
}

/**
 * Common payment method interface
 */
export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  processor: PaymentProcessorType;
  processorMethodId: string; // Original processor-specific ID
  customerId?: string;
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
  brand?: string; // Visa, Mastercard, etc.
  bankName?: string;
  metadata?: Record<string, unknown>;
  isDefault?: boolean;
  createdAt: Date;
}

/**
 * Customer information interface
 */
export interface CustomerInfo {
  id?: string;
  email: string;
  name?: string;
  phone?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Refund request interface
 */
export interface RefundRequest {
  paymentIntentId: string;
  amount?: Decimal; // If not provided, full refund
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Refund result interface
 */
export interface RefundResult {
  id: string;
  amount: Decimal;
  currency: string;
  status: PaymentStatus;
  paymentIntentId: string;
  reason?: string;
  createdAt: Date;
}

/**
 * Payment intent creation options
 */
export interface CreatePaymentIntentOptions {
  amount: Decimal;
  currency: string;
  paymentMethodId?: string;
  customerId?: string;
  confirm?: boolean;
  captureMethod?: 'automatic' | 'manual';
  setupFutureUsage?: 'on_session' | 'off_session';
  metadata?: Record<string, unknown>;
  description?: string;
  receiptEmail?: string;
}

/**
 * Webhook event interface
 */
export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  processor: PaymentProcessorType;
  data: unknown; // Processor-specific data
  createdAt: Date;
  rawEvent: unknown; // Original event from processor
}

/**
 * Webhook verification result
 */
export interface WebhookVerification {
  verified: boolean;
  event?: WebhookEvent;
  error?: string;
}

/**
 * Payment processor configuration
 */
export interface ProcessorConfig {
  apiKey: string;
  webhookSecret?: string;
  environment?: 'test' | 'production';
  metadata?: Record<string, unknown>;
}

/**
 * Payment processor capabilities
 */
export interface ProcessorCapabilities {
  supportsRecurringPayments: boolean;
  supportsRefunds: boolean;
  supportsPartialRefunds: boolean;
  supportsCustomers: boolean;
  supportsPaymentMethods: boolean;
  supportsWebhooks: boolean;
  supportedCurrencies: string[];
  supportedPaymentMethods: PaymentMethodType[];
}

/**
 * Main payment processor interface
 * All payment processors must implement this interface
 */
export interface IPaymentProcessor {
  /**
   * Processor identification
   */
  readonly type: PaymentProcessorType;
  readonly capabilities: ProcessorCapabilities;

  /**
   * Initialize the processor with configuration
   */
  initialize(config: ProcessorConfig): Promise<void>;

  /**
   * Payment Intent Operations
   */
  createPaymentIntent(options: CreatePaymentIntentOptions): Promise<PaymentIntent>;
  retrievePaymentIntent(paymentIntentId: string): Promise<PaymentIntent>;
  confirmPaymentIntent(paymentIntentId: string): Promise<PaymentIntent>;
  cancelPaymentIntent(paymentIntentId: string): Promise<PaymentIntent>;

  /**
   * Refund Operations
   */
  createRefund(request: RefundRequest): Promise<RefundResult>;
  retrieveRefund(refundId: string): Promise<RefundResult>;

  /**
   * Customer Operations
   */
  createCustomer(customer: CustomerInfo): Promise<string>;
  retrieveCustomer(customerId: string): Promise<CustomerInfo>;
  updateCustomer(customerId: string, updates: Partial<CustomerInfo>): Promise<CustomerInfo>;

  /**
   * Payment Method Operations
   */
  attachPaymentMethod(paymentMethodId: string, customerId: string): Promise<PaymentMethod>;
  detachPaymentMethod(paymentMethodId: string): Promise<PaymentMethod>;
  listPaymentMethods(customerId: string): Promise<PaymentMethod[]>;

  /**
   * Webhook Operations
   */
  verifyWebhook(payload: string, signature: string): Promise<WebhookVerification>;
  processWebhook(event: WebhookEvent): Promise<void>;

  /**
   * Utility Methods
   */
  convertAmount(amount: Decimal, currency: string): number;
  formatAmount(amount: number, currency: string): Decimal;
}

/**
 * Payment processor error types
 */
export class PaymentProcessorError extends Error {
  constructor(
    message: string,
    public readonly processor: PaymentProcessorType,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'PaymentProcessorError';
  }
}

export class PaymentIntentError extends PaymentProcessorError {
  constructor(message: string, processor: PaymentProcessorType, details?: unknown) {
    super(message, processor, 'PAYMENT_INTENT_ERROR', details);
    this.name = 'PaymentIntentError';
  }
}

export class RefundError extends PaymentProcessorError {
  constructor(message: string, processor: PaymentProcessorType, details?: unknown) {
    super(message, processor, 'REFUND_ERROR', details);
    this.name = 'RefundError';
  }
}

export class WebhookVerificationError extends PaymentProcessorError {
  constructor(message: string, processor: PaymentProcessorType, details?: unknown) {
    super(message, processor, 'WEBHOOK_VERIFICATION_ERROR', details);
    this.name = 'WebhookVerificationError';
  }
}

export class CustomerError extends PaymentProcessorError {
  constructor(message: string, processor: PaymentProcessorType, details?: unknown) {
    super(message, processor, 'CUSTOMER_ERROR', details);
    this.name = 'CustomerError';
  }
}
