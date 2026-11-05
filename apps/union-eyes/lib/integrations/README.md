# Integration Framework

## Overview
The Integration Framework provides a unified, extensible system for connecting UnionEyes with external systems (HRIS, accounting, insurance, pension, LMS, communication platforms, and document management systems).

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Application Layer                             │
│  (API Routes, Services, Background Jobs)                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│               Integration Framework                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  Integration │  │  Integration │  │   Webhook    │           │
│  │   Registry   │  │   Factory    │  │   Router     │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ Sync Engine  │  │    Base      │  │  Adapters    │           │
│  │              │  │  Integration │  │  (pluggable) │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                  External Systems                                │
│  Workday | BambooHR | QuickBooks | Xero | SunLife | Slack       │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Integration Registry
Central catalog of all available integrations and their capabilities.

**Features:**
- Provider metadata (name, description, capabilities)
- Environment variable requirements
- Health status tracking
- Rate limit information

**Usage:**
```typescript
import { IntegrationRegistry, IntegrationProvider } from '@/lib/integrations';

const registry = IntegrationRegistry.getInstance();

// Get integration metadata
const metadata = registry.getMetadata(IntegrationProvider.WORKDAY);

// Check if available
if (registry.isAvailable(IntegrationProvider.WORKDAY)) {
  // Good to go
}

// Check environment variables
const check = registry.checkEnvironmentVars(IntegrationProvider.WORKDAY);
if (!check.available) {
  console.log('Missing:', check.missing);
}
```

### 2. Integration Factory
Creates and manages integration adapter instances per organization.

**Features:**
- Instance caching per organization
- Configuration loading from database
- Automatic initialization
- Type-safe provider access

**Usage:**
```typescript
import { IntegrationFactory, IntegrationProvider } from '@/lib/integrations';

const factory = IntegrationFactory.getInstance();

// Get integration for org
const integration = await factory.getIntegration(
  organizationId,
  IntegrationProvider.WORKDAY
);

// Use integration
const result = await integration.sync({ type: SyncType.FULL });
```

### 3. Webhook Router
Centralized webhook verification, routing, and processing.

**Features:**
- Signature verification
- Idempotency handling (24-hour window)
- Automatic retries (3 attempts)
- Event logging and audit trail

**Usage:**
```typescript
import { processWebhook, IntegrationProvider } from '@/lib/integrations';

// In your webhook endpoint
const result = await processWebhook(
  organizationId,
  IntegrationProvider.WORKDAY,
  rawBody,
  signature,
  headers
);

if (result.success) {
  return { ok: true, eventId: result.eventId };
}
```

### 4. Sync Engine
Orchestrates data synchronization with scheduling and history tracking.

**Features:**
- Full sync and incremental sync
- Cursor-based pagination
- Automatic retry on failure
- Sync history and metrics
- Job scheduling (future: cron-based)

**Usage:**
```typescript
import { executeFullSync, executeIncrementalSync } from '@/lib/integrations';

// Full sync
const result = await executeFullSync(
  organizationId,
  IntegrationProvider.WORKDAY,
  ['employees', 'departments']
);

// Incremental sync (uses last sync cursor)
const incrementalResult = await executeIncrementalSync(
  organizationId,
  IntegrationProvider.WORKDAY,
  ['employees']
);

// Get sync history
const history = await getSyncHistory(organizationId);
```

## Integration Types

### HRIS (Human Resources Information Systems)
- **Workday**: Enterprise HRIS
- **BambooHR**: SMB HRIS
- **ADP Workforce Now**: Comprehensive HR
- **Ceridian Dayforce**: Canadian payroll/HR
- **UKG Pro**: Workforce management

**Entities:** employees, positions, departments, leave, payroll

### Accounting
- **QuickBooks Online**: Cloud accounting
- **Xero**: Small business accounting
- **Sage Intacct**: Enterprise accounting
- **FreshBooks**: Invoicing & expenses
- **Wave**: Free accounting software

**Entities:** invoices, payments, customers, accounts, transactions

### Insurance/Benefits
- **Sun Life Financial**: Canadian insurance
- **Manulife**: Wealth & insurance
- **Blue Cross**: Health insurance
- **Green Shield Canada**: Benefits provider
- **Canada Life**: Insurance & retirement

**Entities:** members, plans, claims, eligibility, wellness

### Pension Systems
- **OTPP**: Ontario Teachers' Pension Plan
- **CPP/QPP**: Canada/Quebec Pension Plan
- **Provincial Pension Plans**: Various provinces

**Entities:** members, contributions, statements, benefits

### LMS (Learning Management Systems)
- **LinkedIn Learning**: Professional development
- **Udemy**: Online courses
- **Coursera**: University-level courses

**Entities:** courses, completions, users, certificates

### Communication
- **Slack**: Team messaging
- **Microsoft Teams**: Collaboration platform

**Entities:** channels, messages, users, files

### Document Management
No document-management provider is supported. The SharePoint adapter was removed: it was never registered in the catalog or approved by the control-plane policy, and its storage tables hold no database authority.

## Database Schema

### integration_configs
Stores integration configurations and encrypted credentials per organization.

```sql
CREATE TABLE integration_configs (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  type integration_type NOT NULL,
  provider integration_provider NOT NULL,
  credentials JSONB NOT NULL, -- Encrypted
  settings JSONB,
  webhook_url TEXT,
  enabled BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP,
  UNIQUE(organization_id, provider)
);
```

### integration_sync_log
Logs all sync operations with performance metrics.

```sql
CREATE TABLE integration_sync_log (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  provider integration_provider NOT NULL,
  sync_type sync_type NOT NULL,
  entities TEXT[],
  status sync_status NOT NULL,
  records_processed INTEGER,
  records_created INTEGER,
  records_updated INTEGER,
  records_failed INTEGER,
  cursor TEXT,
  error TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);
```

### webhook_events
Stores incoming webhook events for idempotency and audit.

```sql
CREATE TABLE webhook_events (
  id TEXT PRIMARY KEY, -- Hash of payload
  organization_id UUID NOT NULL,
  provider integration_provider NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  signature TEXT,
  verified BOOLEAN DEFAULT false,
  status webhook_status NOT NULL,
  received_at TIMESTAMP,
  processed_at TIMESTAMP
);
```

## Adding a New Integration Adapter

### Step 1: Implement the Adapter

```typescript
// lib/integrations/adapters/workday-adapter.ts
import { BaseIntegration } from '../base-integration';
import {
  IntegrationType,
  IntegrationProvider,
  SyncOptions,
  SyncResult,
  HealthCheckResult,
  WebhookEvent,
} from '../types';

export class WorkdayAdapter extends BaseIntegration {
  private client?: WorkdayClient;

  constructor() {
    super(IntegrationType.HRIS, IntegrationProvider.WORKDAY, {
      supportsFullSync: true,
      supportsIncrementalSync: true,
      supportsWebhooks: false,
      supportsRealTime: false,
      supportedEntities: ['employees', 'positions', 'departments'],
      requiresOAuth: true,
      rateLimitPerMinute: 60,
    });
  }

  async connect(): Promise<void> {
    this.ensureInitialized();
    // Initialize Workday client
    this.client = new WorkdayClient({
      clientId: this.config!.credentials.clientId!,
      clientSecret: this.config!.credentials.clientSecret!,
      tenantId: this.config!.settings?.tenantId,
    });
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.client = undefined;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    // Implement health check
  }

  async sync(options: SyncOptions): Promise<SyncResult> {
    // Implement sync logic
  }

  async verifyWebhook(payload: string, signature: string): Promise<boolean> {
    // Workday doesn't support webhooks
    return false;
  }

  async processWebhook(event: WebhookEvent): Promise<void> {
    // Not supported
  }
}
```

### Step 2: Register in Factory

```typescript
// lib/integrations/factory.ts
case IntegrationProvider.WORKDAY:
  return new WorkdayAdapter();
```

### Step 3: Configure Environment

```env
WORKDAY_CLIENT_ID=your_client_id
WORKDAY_CLIENT_SECRET=your_client_secret
WORKDAY_TENANT_ID=your_tenant
```

### Step 4: Create Configuration in Database

```typescript
await db.insert(integrationConfigs).values({
  organizationId,
  type: IntegrationType.HRIS,
  provider: IntegrationProvider.WORKDAY,
  credentials: {
    clientId: process.env.WORKDAY_CLIENT_ID,
    clientSecret: process.env.WORKDAY_CLIENT_SECRET,
  },
  settings: {
    tenantId: process.env.WORKDAY_TENANT_ID,
  },
  enabled: true,
});
```

## API Endpoints (To Be Created)

### POST /api/integrations/[provider]/sync
Trigger a sync operation.

### POST /api/integrations/[provider]/webhook
Receive webhook events.

### GET /api/integrations/[provider]/status
Get integration health and sync status.

### GET /api/integrations/[provider]/history
Get sync history.

### POST /api/integrations/[provider]/connect
Initialize OAuth flow.

## Security Considerations

1. **Credential Encryption**: All credentials are encrypted at rest
2. **Least Privilege**: OAuth scopes limited to required access
3. **Webhook Verification**: All webhooks verified before processing
4. **Rate Limiting**: Per-provider rate limits enforced
5. **Audit Logging**: All integration operations logged

## Performance

- **Connection Pooling**: Reuse integration instances per org
- **Cursor-Based Pagination**: Efficient incremental syncs
- **Parallel Processing**: Batch operations where supported
- **Circuit Breaker**: Fail fast on provider downtime

## Monitoring

- Sync success/failure rates
- Average sync duration
- Webhook processing latency
- Rate limit consumption
- Error patterns by provider

## Next Steps

1. Implement first HRIS adapter (Workday or BambooHR)
2. Create API endpoints for integration management
3. Add OAuth flow UI
4. Implement job scheduler for recurring syncs
5. Add monitoring dashboards
6. Create admin UI for integration setup

## Resources

- [Stripe Integration Pattern](../payment-processor/README.md) - Similar architecture
- [Circuit Breaker](../resilience/circuit-breaker.ts) - Resilience utilities
- [Retry Logic](../resilience/retry.ts) - Retry strategies
