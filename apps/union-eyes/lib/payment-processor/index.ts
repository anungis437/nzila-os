/**
 * Payment Processor Abstraction Layer - Main Export
 * 
 * This module provides a unified interface for working with multiple
 * payment processors (Stripe, PayPal, Square, etc.)
 * 
 * Usage Example:
 * ```typescript
 * import { PaymentProcessorFactory, PaymentProcessorType } from '@/lib/payment-processor';
 * 
 * // Initialize once at app startup
 * await initializePaymentProcessors();
 * 
 * // Get a processor
 * const factory = PaymentProcessorFactory.getInstance();
 * const processor = factory.getProcessor(PaymentProcessorType.STRIPE);
 * 
 * // Create a payment
 * const payment = await processor.createPaymentIntent({
 *   amount: new Decimal('10.00'),
 *   currency: 'usd',
 *   confirm: true,
 * });
 * ```
 */

// Types and interfaces
export * from './types';

// Base processor
export { BasePaymentProcessor, mapProcessorStatus } from './processors/base-processor';

// Implemented processors
export { StripeProcessor } from './processors/stripe-processor';

// Future processors
export { PayPalProcessor, SquareProcessor, ManualProcessor } from './processors/future-processors';

// Factory
export {
  PaymentProcessorFactory,
  loadProcessorConfigFromEnv,
  initializePaymentProcessors,
} from './processor-factory';
export type { ProcessorFactoryConfig } from './processor-factory';
