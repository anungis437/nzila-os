/**
 * Legacy wrapper for payment processor placeholders.
 *
 * These exports now point to the real processor implementations.
 */

export { PayPalProcessor } from './paypal-processor';
export { SquareProcessor } from './square-processor';

// ManualProcessor — offline/manual payment recording (no external API calls)
import { BasePaymentProcessor } from './base-processor';
import {
  PaymentProcessorType,
  type ProcessorConfig,
  type CreatePaymentIntentOptions,
  type PaymentIntent,
  type RefundRequest,
  type RefundResult,
  type CustomerInfo,
  type PaymentMethod,
  type WebhookVerification,
  type WebhookEvent,
  PaymentStatus,
} from '../types';
import { Decimal } from 'decimal.js';
import { randomUUID } from 'crypto';

export class ManualProcessor extends BasePaymentProcessor {
  constructor() {
    super(PaymentProcessorType.MANUAL, {
      supportsRecurringPayments: false,
      supportsRefunds: true,
      supportsPartialRefunds: false,
      supportsCustomers: false,
      supportsPaymentMethods: false,
      supportsWebhooks: false,
      supportedCurrencies: ['USD', 'CAD'],
      supportedPaymentMethods: [],
    });
  }

  async initialize(_config: ProcessorConfig): Promise<void> { /* no-op — no external service */ }

  async createPaymentIntent(options: CreatePaymentIntentOptions): Promise<PaymentIntent> {
    const id = `manual_pi_${randomUUID()}`;
    return {
      id,
      amount: options.amount,
      currency: options.currency,
      status: PaymentStatus.PENDING,
      metadata: options.metadata,
      createdAt: new Date(),
      processorType: PaymentProcessorType.MANUAL,
      processorPaymentId: id,
    };
  }

  async retrievePaymentIntent(id: string): Promise<PaymentIntent> {
    return {
      id,
      amount: new Decimal(0),
      currency: 'CAD',
      status: PaymentStatus.PENDING,
      createdAt: new Date(),
      processorType: PaymentProcessorType.MANUAL,
      processorPaymentId: id,
    };
  }

  async confirmPaymentIntent(id: string): Promise<PaymentIntent> {
    return {
      id,
      amount: new Decimal(0),
      currency: 'CAD',
      status: PaymentStatus.SUCCEEDED,
      createdAt: new Date(),
      processorType: PaymentProcessorType.MANUAL,
      processorPaymentId: id,
    };
  }

  async cancelPaymentIntent(id: string): Promise<PaymentIntent> {
    return {
      id,
      amount: new Decimal(0),
      currency: 'CAD',
      status: PaymentStatus.CANCELLED,
      createdAt: new Date(),
      processorType: PaymentProcessorType.MANUAL,
      processorPaymentId: id,
    };
  }

  async createRefund(request: RefundRequest): Promise<RefundResult> {
    return {
      id: `manual_rf_${randomUUID()}`,
      paymentIntentId: request.paymentIntentId,
      amount: request.amount ?? new Decimal(0),
      currency: 'CAD',
      status: PaymentStatus.REFUNDED,
      createdAt: new Date(),
    };
  }

  async retrieveRefund(id: string): Promise<RefundResult> {
    return { id, paymentIntentId: '', amount: new Decimal(0), currency: 'CAD', status: PaymentStatus.REFUNDED, createdAt: new Date() };
  }

  async createCustomer(_customer: CustomerInfo): Promise<string> { return `manual_cus_${randomUUID()}`; }
  async retrieveCustomer(id: string): Promise<CustomerInfo> { return { id, email: '' }; }
  async updateCustomer(id: string, updates: Partial<CustomerInfo>): Promise<CustomerInfo> { return { id, email: '', ...updates }; }
  async attachPaymentMethod(_methodId: string, _customerId: string): Promise<PaymentMethod> {
    return { id: _methodId, type: 'manual' as never, processor: PaymentProcessorType.MANUAL, processorMethodId: _methodId, createdAt: new Date() };
  }
  async detachPaymentMethod(methodId: string): Promise<PaymentMethod> {
    return { id: methodId, type: 'manual' as never, processor: PaymentProcessorType.MANUAL, processorMethodId: methodId, createdAt: new Date() };
  }
  async listPaymentMethods(_customerId: string): Promise<PaymentMethod[]> { return []; }
  async verifyWebhook(_payload: string, _signature: string): Promise<WebhookVerification> { return { verified: false }; }
  async processWebhook(_event: WebhookEvent): Promise<void> { /* no-op */ }
  convertAmount(amount: Decimal, _currency: string): number { return amount.toNumber(); }
  formatAmount(amount: number, _currency: string): Decimal { return new Decimal(amount); }
}
