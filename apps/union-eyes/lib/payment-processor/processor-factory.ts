/**
 * Payment Processor Factory
 * Creates and manages payment processor instances
 */

import { logger } from '@/lib/logger';
import {
  IPaymentProcessor,
  PaymentProcessorType,
  ProcessorConfig,
  PaymentProcessorError,
} from './types';
import { StripeProcessor } from './processors/stripe-processor';
import { PayPalProcessor } from './processors/paypal-processor';
import { SquareProcessor } from './processors/square-processor';
import { ManualProcessor } from './processors/future-processors';

/**
 * Processor factory configuration
 */
export interface ProcessorFactoryConfig {
  defaultProcessor?: PaymentProcessorType;
  processors: {
    [PaymentProcessorType.STRIPE]?: ProcessorConfig;
    [PaymentProcessorType.PAYPAL]?: ProcessorConfig;
    [PaymentProcessorType.SQUARE]?: ProcessorConfig;
    [PaymentProcessorType.MANUAL]?: ProcessorConfig;
  };
}

/**
 * Payment Processor Factory
 * Singleton that manages all payment processor instances
 */
export class PaymentProcessorFactory {
  private static instance: PaymentProcessorFactory;
  private processors: Map<PaymentProcessorType, IPaymentProcessor> = new Map();
  private defaultProcessorType: PaymentProcessorType = PaymentProcessorType.STRIPE;
  private initialized = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): PaymentProcessorFactory {
    if (!PaymentProcessorFactory.instance) {
      PaymentProcessorFactory.instance = new PaymentProcessorFactory();
    }
    return PaymentProcessorFactory.instance;
  }

  /**
   * Initialize the factory with configuration
   */
  async initialize(config: ProcessorFactoryConfig): Promise<void> {
    if (this.initialized) {
      logger.warn('Payment processor factory already initialized');
      return;
    }

    this.defaultProcessorType = config.defaultProcessor || PaymentProcessorType.STRIPE;

    // Initialize each configured processor
    const initPromises: Promise<void>[] = [];

    for (const [type, processorConfig] of Object.entries(config.processors)) {
      if (processorConfig) {
        const processorType = type as PaymentProcessorType;
        initPromises.push(this.initializeProcessor(processorType, processorConfig));
      }
    }

    await Promise.all(initPromises);

    this.initialized = true;
    
    logger.info('Payment processor factory initialized', {
      defaultProcessor: this.defaultProcessorType,
      processorsCount: this.processors.size,
      processors: Array.from(this.processors.keys()),
    });
  }

  /**
   * Initialize a specific processor
   */
  private async initializeProcessor(
    type: PaymentProcessorType,
    config: ProcessorConfig
  ): Promise<void> {
    try {
      const processor = this.createProcessorInstance(type);
      await processor.initialize(config);
      this.processors.set(type, processor);
      
      logger.info(`Initialized ${type} payment processor`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to initialize ${type} processor`, error instanceof Error ? error : new Error(errorMessage));
      
      // Don&apos;t throw for optional processors, but do throw for the default processor
      if (type === this.defaultProcessorType) {
        throw error;
      }
    }
  }

  /**
   * Create a processor instance
   */
  private createProcessorInstance(type: PaymentProcessorType): IPaymentProcessor {
    switch (type) {
      case PaymentProcessorType.STRIPE:
        return new StripeProcessor();
      
      case PaymentProcessorType.PAYPAL:
        return new PayPalProcessor();
      
      case PaymentProcessorType.SQUARE:
        return new SquareProcessor();
      
      case PaymentProcessorType.MANUAL:
        return new ManualProcessor();
      
      default:
        throw new PaymentProcessorError(
          `Unknown processor type: ${type}`,
          type,
          'UNKNOWN_PROCESSOR'
        );
    }
  }

  /**
   * Get a processor by type
   */
  getProcessor(type?: PaymentProcessorType): IPaymentProcessor {
    if (!this.initialized) {
      throw new PaymentProcessorError(
        'Payment processor factory not initialized',
        type || this.defaultProcessorType,
        'NOT_INITIALIZED'
      );
    }

    const processorType = type || this.defaultProcessorType;
    const processor = this.processors.get(processorType);

    if (!processor) {
      throw new PaymentProcessorError(
        `Processor ${processorType} not configured or unavailable`,
        processorType,
        'PROCESSOR_UNAVAILABLE'
      );
    }

    return processor;
  }

  /**
   * Get the default processor
   */
  getDefaultProcessor(): IPaymentProcessor {
    return this.getProcessor(this.defaultProcessorType);
  }

  /**
   * Check if a processor is available
   */
  isProcessorAvailable(type: PaymentProcessorType): boolean {
    return this.processors.has(type);
  }

  /**
   * Get all available processor types
   */
  getAvailableProcessors(): PaymentProcessorType[] {
    return Array.from(this.processors.keys());
  }

  /**
   * Get processor capabilities
   */
  getProcessorCapabilities(type: PaymentProcessorType) {
    const processor = this.processors.get(type);
    return processor?.capabilities;
  }
}

/**
 * Load configuration from environment variables
 */
export function loadProcessorConfigFromEnv(): ProcessorFactoryConfig {
  const config: ProcessorFactoryConfig = {
    defaultProcessor: PaymentProcessorType.STRIPE,
    processors: {},
  };

  // Stripe configuration
  if (process.env.STRIPE_SECRET_KEY) {
    config.processors[PaymentProcessorType.STRIPE] = {
      apiKey: process.env.STRIPE_SECRET_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'test',
    };
  }

  // PayPal configuration
  if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
    config.processors[PaymentProcessorType.PAYPAL] = {
      apiKey: process.env.PAYPAL_CLIENT_ID,
      webhookSecret: process.env.PAYPAL_WEBHOOK_ID,
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'test',
      metadata: {
        clientSecret: process.env.PAYPAL_CLIENT_SECRET,
      },
    };
  }

  // Square configuration
  if (process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_APPLICATION_ID) {
    config.processors[PaymentProcessorType.SQUARE] = {
      apiKey: process.env.SQUARE_ACCESS_TOKEN,
      webhookSecret: process.env.SQUARE_WEBHOOK_SECRET,
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'test',
      metadata: {
        applicationId: process.env.SQUARE_APPLICATION_ID,
      },
    };
  }

  // Manual processor (always available)
  config.processors[PaymentProcessorType.MANUAL] = {
    apiKey: 'manual', // No API key needed
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'test',
  };

  return config;
}

/**
 * Convenience function to initialize the factory from environment
 */
export async function initializePaymentProcessors(): Promise<PaymentProcessorFactory> {
  const factory = PaymentProcessorFactory.getInstance();
  const config = loadProcessorConfigFromEnv();
  await factory.initialize(config);
  return factory;
}
