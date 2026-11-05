# Payment Processor Abstraction Layer

## Overview

The Payment Processor Abstraction Layer provides a unified interface for integrating multiple payment processors (Stripe, PayPal, Square, etc.) into the UnionEyes application.

## Why We Need This

### Before: Hardcoded Processor Integration
```typescript
// ❌ Tightly coupled to Stripe
import { stripe } from '@/lib/stripe';

const paymentIntent = await stripe.paymentIntents.create({
  amount: amount * 100,
  currency: 'cad',
  payment_method: paymentMethodId,
  confirm: true,
});
```

**Problems:**
- Adding a new processor requires changing every payment route
- No consistent error handling across processors
- Difficult to switch between processors
- Cannot support multi-processor environments

### After: Abstracted Processor Integration
```typescript
// ✅ Processor-agnostic
import { PaymentProcessorFactory } from '@/lib/payment-processor';

const processor = PaymentProcessorFactory.getInstance().getProcessor();

const paymentIntent = await processor.createPaymentIntent({
  amount: new Decimal('10.00'),
  currency: 'cad',
  paymentMethodId,
  confirm: true,
});
```

**Benefits:**
- Add new processors without changing existing code
- Consistent interface across all processors
- Easy to switch processors per transaction
- Better error handling and logging
- Support for multiple processors simultaneously

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 Application Layer                        │
│  (API Routes, Webhook Handlers, Services)                │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│           PaymentProcessorFactory                        │
│  - Manages processor instances                           │
│  - Routes to correct processor                           │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ▼                          ▼
┌───────────────┐          ┌───────────────┐
│IPaymentProcessor│        │IPaymentProcessor│
│   Interface    │          │   Interface    │
└───────┬───────┘          └───────┬───────┘
        │                          │
   ┌────┴─────┐            ┌──────┴──────┐
   ▼          ▼            ▼             ▼
┌────────┐ ┌────────┐  ┌────────┐  ┌────────┐
│Stripe  │ │Manual  │  │PayPal  │  │Square  │
│Processor│ │Processor│  │Processor│  │Processor│
└────────┘ └────────┘  └────────┘  └────────┘
```

---

## Supported Processors

| Processor | Status | Capabilities |
|-----------|--------|--------------|
| **Stripe** | ✅ Fully Implemented | Payment intents, refunds, customers, payment methods, webhooks |
| **PayPal** | 🚧 Placeholder | Ready for implementation |
| **Square** | 🚧 Placeholder | Ready for implementation |
| **Manual** | 🚧 Placeholder | Cheque, bank transfer tracking |

---

## Getting Started

### 1. Initialize at Application Startup

```typescript
// instrumentation.ts or app startup
import { initializePaymentProcessors } from '@/lib/payment-processor';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await initializePaymentProcessors();
  }
}
```

### 2. Configure Processors via Environment Variables

```env
# Stripe (Primary)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# PayPal (Future)
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_WEBHOOK_ID=...

# Square (Future)
SQUARE_ACCESS_TOKEN=...
SQUARE_WEBHOOK_SECRET=...
```

### 3. Use in API Routes

```typescript
import { PaymentProcessorFactory, PaymentProcessorType } from '@/lib/payment-processor';
import { Decimal } from 'decimal.js';

export async function POST(request: Request) {
  try {
    // Get processor (defaults to Stripe)
    const factory = PaymentProcessorFactory.getInstance();
    const processor = factory.getProcessor();
    
    // Or specify a processor
    // const processor = factory.getProcessor(PaymentProcessorType.PAYPAL);
    
    // Create payment
    const payment = await processor.createPaymentIntent({
      amount: new Decimal('100.00'),
      currency: 'cad',
      paymentMethodId: 'pm_xxx',
      confirm: true,
      metadata: {
        userId: 'user_123',
        type: 'dues_payment',
      },
    });
    
    // Store payment with processor info
    await db.insert(duesTransactions).values({
      ...otherFields,
      processorType: processor.type,
      processorPaymentId: payment.processorPaymentId,
      processorCustomerId: payment.customerId,
    });
    
    return NextResponse.json({ success: true, payment });
  } catch (error) {
    if (error instanceof PaymentIntentError) {
      return NextResponse.json({ 
        error: error.message,
        processor: error.processor,
      }, { status: 400 });
    }
    throw error;
  }
}
```

---

## Key Concepts

### Payment Intent

All processors use the concept of a "payment intent" - a representation of a payment to be made.

```typescript
interface PaymentIntent {
  id: string;
  amount: Decimal;
  currency: string;
  status: PaymentStatus;
  processorType: PaymentProcessorType;
  processorPaymentId: string; // Original processor ID
  metadata?: Record<string, any>;
}
```

### Processor Types

```typescript
enum PaymentProcessorType {
  STRIPE = 'stripe',
  PAYPAL = 'paypal',
  SQUARE = 'square',
  MANUAL = 'manual',
}
```

### Payment Status

Unified payment statuses across all processors:

```typescript
enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}
```

---

## Common Operations

### Create Payment Intent

```typescript
const payment = await processor.createPaymentIntent({
  amount: new Decimal('50.00'),
  currency: 'cad',
  paymentMethodId: 'pm_123',
  customerId: 'cus_123', // Optional
  confirm: true,
  metadata: { orderId: '12345' },
});
```

### Create Refund

```typescript
const refund = await processor.createRefund({
  paymentIntentId: 'pi_123',
  amount: new Decimal('25.00'), // Partial refund
  reason: 'Customer requested refund',
});
```

### Create Customer

```typescript
const customerId = await processor.createCustomer({
  email: 'member@union.com',
  name: 'John Doe',
  phone: '+1234567890',
  address: {
    line1: '123 Main St',
    city: 'Toronto',
    state: 'ON',
    postalCode: 'M5H 2N2',
    country: 'CA',
  },
});
```

### Verify Webhook

```typescript
const result = await processor.verifyWebhook(
  payload,  // Raw request body
  signature // Header signature
);

if (result.verified) {
  await processor.processWebhook(result.event);
}
```

---

## Error Handling

The abstraction provides specific error types:

```typescript
import { 
  PaymentProcessorError,
  PaymentIntentError,
  RefundError,
  CustomerError,
  WebhookVerificationError,
} from '@/lib/payment-processor';

try {
  await processor.createPaymentIntent(options);
} catch (error) {
  if (error instanceof PaymentIntentError) {
    console.error('Payment failed:', error.message);
    console.error('Processor:', error.processor);
    console.error('Details:', error.details);
  }
}
```

---

## Database Schema

### New Fields Added

#### `dues_transactions`
- `processor_type` - Which processor was used
- `processor_payment_id` - Processor-specific payment ID
- `processor_customer_id` - Processor-specific customer ID

#### `payments`
- `processor_type` - Which processor was used
- `processor_customer_id` - Processor-specific customer ID

#### `payment_methods`
- `processor_type` - Which processor manages this method
- `processor_method_id` - Processor-specific method ID

### Migration

Run the migration to add processor support:

```bash
psql -d unioneyes -f db/migrations/add-payment-processor-support.sql
```

---

## Adding a New Processor

### 1. Create Processor Class

```typescript
// lib/payment-processor/processors/new-processor.ts
import { BasePaymentProcessor } from './base-processor';
import { PaymentProcessorType } from '../types';

export class NewProcessor extends BasePaymentProcessor {
  constructor() {
    super(PaymentProcessorType.NEW, {
      supportsRecurringPayments: true,
      supportsRefunds: true,
      supportedCurrencies: ['usd', 'cad'],
      // ... other capabilities
    });
  }

  async initialize(config: ProcessorConfig): Promise<void> {
    await super.initialize(config);
    // Initialize SDK
  }

  async createPaymentIntent(options): Promise<PaymentIntent> {
    // Implement using processor's API
  }

  // ... implement other methods
}
```

### 2. Register in Factory

```typescript
// lib/payment-processor/processor-factory.ts
import { NewProcessor } from './processors/new-processor';

private createProcessorInstance(type: PaymentProcessorType): IPaymentProcessor {
  switch (type) {
    case PaymentProcessorType.NEW:
      return new NewProcessor();
    // ... other cases
  }
}
```

### 3. Add Environment Configuration

```typescript
// processor-factory.ts
if (process.env.NEW_PROCESSOR_API_KEY) {
  config.processors[PaymentProcessorType.NEW] = {
    apiKey: process.env.NEW_PROCESSOR_API_KEY,
    webhookSecret: process.env.NEW_PROCESSOR_WEBHOOK_SECRET,
  };
}
```

---

## Testing

### Mock Processor for Tests

```typescript
import { BasePaymentProcessor } from '@/lib/payment-processor';

class MockProcessor extends BasePaymentProcessor {
  constructor() {
    super(PaymentProcessorType.STRIPE, mockCapabilities);
  }

  async createPaymentIntent(options) {
    return {
      id: 'mock_pi_123',
      amount: options.amount,
      status: PaymentStatus.SUCCEEDED,
      // ... mock data
    };
  }
}
```

---

## Refactoring Existing Routes

**Key Changes:**
1. Import `PaymentProcessorFactory` instead of `stripe`
2. Get processor instance via factory
3. Use processor methods instead of direct Stripe calls
4. Store `processorType`, `processorPaymentId`, and `processorCustomerId`
5. Handle processor-specific errors

---

## Future Enhancements

### Multi-Processor Support
- Route payments to different processors based on:
  - Member preference
  - Transaction type
  - Geographic location
  - Cost optimization

### Processor Selection API
```typescript
GET /api/payment/processors
{
  "available": ["stripe", "paypal", "square"],
  "default": "stripe",
  "capabilities": {
    "stripe": { ... },
    "paypal": { ... }
  }
}
```

### Automatic Failover
```typescript
// Try primary processor, fallback to secondary
const processors = [
  PaymentProcessorType.STRIPE,
  PaymentProcessorType.SQUARE,
];

for (const processorType of processors) {
  try {
    const processor = factory.getProcessor(processorType);
    return await processor.createPaymentIntent(options);
  } catch (error) {
    logger.warn(`${processorType} failed, trying next processor`);
  }
}
```

---

## Resources

- **Stripe API**: https://stripe.com/docs/api
- **PayPal API**: https://developer.paypal.com/docs/api/
- **Square API**: https://developer.squareup.com/docs/

---

## Support

For questions or issues with the payment processor abstraction:
1. Review processor capabilities via `processor.capabilities`
2. Check logs for detailed error information
3. See [Stripe processor](./processors/stripe-processor.ts) for full implementation example
4. Read the unit tests in `lib/payment-processor/__tests__/`
