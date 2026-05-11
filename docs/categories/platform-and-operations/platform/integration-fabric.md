# Integration Fabric — Architecture Guide

> **Status**: Active  
> **Packages**: `@nzila/platform-integrations-types`, `@nzila/platform-integrations`, `@nzila/platform-integrations-connectors`

---

## 1. Overview

The Integration Fabric is a platform-level capability for connecting Nzila OS apps to external systems. It provides:

- **Connector adapters** — pluggable protocol adapters (webhook, REST API, CSV/SFTP)
- **Execution engine** — orchestrates inbound/outbound runs with idempotency, auditing, and event emission
- **Mapping engine** — declarative field transformation with 11 built-in operations
- **Webhook engine** — outbound delivery with retry, backoff, HMAC signing, and dead-letter queue
- **Sync engine** — bidirectional sync with four source-of-truth policies
- **Identity linker** — map internal entity IDs to external system IDs
- **Rate limiter** — per-connection token-bucket rate limiting
- **Drizzle schema** — 7 tables, 6 enums, 20+ indexes

Union Eyes is the first consumer. All other Nzila OS apps can adopt the same fabric.

---

## 2. Package Structure

```
packages/
  platform-integrations-types/    # Shared types, branded IDs, Zod schemas
  platform-integrations/          # Core engines and Drizzle schema
  platform-integrations-connectors/ # Built-in connector adapters
```

### Dependency Graph

```
platform-integrations-connectors
  └─▶ platform-integrations
        └─▶ platform-integrations-types
              └─▶ zod
```

---

## 3. Connector Adapter Pattern

Every external integration is modelled as a **ConnectorAdapter**:

```ts
interface ConnectorAdapter {
  readonly definition: ConnectorDefinition
  testConnection(connection: IntegrationConnection): Promise<ConnectionTestResult>
  executeInbound(connection: IntegrationConnection, rawPayload: unknown): Promise<ConnectorExecutionResult>
  executeOutbound(connection: IntegrationConnection, payload: unknown): Promise<ConnectorExecutionResult>
}
```

Adapters register with the global `ConnectorRegistry`:

```ts
import { connectorRegistry } from '@nzila/platform-integrations'
import { registerBuiltinConnectors } from '@nzila/platform-integrations-connectors'

// Register the 3 built-in connectors
registerBuiltinConnectors()

// Or register a custom adapter
connectorRegistry.register(myCustomAdapter)
```

### Built-in Connectors

| Connector | Type | Inbound | Outbound |
|-----------|------|---------|----------|
| `WebhookConnector` | `webhook` | HMAC-verified POST reception | HMAC-signed POST delivery |
| `RestApiConnector` | `rest_api` | GET with query params | POST with JSON body |
| `CsvSftpConnector` | `csv_sftp` | CSV string parsing | CSV generation from records |

---

## 4. Execution Flow

### Inbound

```
External System → Webhook/API → ConnectorAdapter.executeInbound()
  → ExecutionEngine.executeInbound()
    1. Idempotency check (skip if duplicate)
    2. Create IntegrationRun (status: running)
    3. Execute adapter
    4. Record idempotency key
    5. Audit trail entry
    6. Emit integration.inbound.completed event
    7. Return mapped payload
```

### Outbound

```
App event → ExecutionEngine.executeOutbound()
  1. Idempotency check
  2. Create IntegrationRun
  3. Execute adapter (POST to external)
  4. Record idempotency key
  5. Audit trail entry
  6. Emit integration.outbound.completed event
```

---

## 5. Mapping Engine

The mapping engine transforms payloads using declarative rules. Each rule specifies an operation, source field, target field, and optional parameters.

### Operations

| Operation | Description |
|-----------|-------------|
| `rename` | Move value from source → target field |
| `constant` | Set target to a fixed value |
| `default` | Set target only if missing |
| `enum_translate` | Map value through a lookup table |
| `nested_extract` | Extract from dot-notated nested path |
| `date_normalize` | Parse and reformat dates |
| `identity_lookup` | Resolve external ID via IdentityLinker |
| `coerce` | Cast between string/number/boolean |
| `omit` | Remove field from output |
| `flatten` | Flatten nested object into parent |
| `computed` | Evaluate an expression (template literal) |

### Example

```ts
const engine = new MappingEngine()
const result = engine.execute(inputPayload, [
  { operation: 'rename', sourceField: 'emp_id', targetField: 'employeeId' },
  { operation: 'enum_translate', sourceField: 'status', targetField: 'status', params: { mapping: { 'A': 'active', 'T': 'terminated' } } },
  { operation: 'coerce', sourceField: 'salary', targetField: 'salary', params: { targetType: 'number' } },
])
```

---

## 6. Webhook Delivery Lifecycle

```
Event → WebhookEngine.publishEvent()
  → Find matching subscriptions (by eventType)
  → For each subscription → deliver()
    1. POST payload with X-Nzila-Signature HMAC header
    2. If 2xx → record success delivery attempt
    3. If failure → retry with exponential backoff (base × 2^attempt)
    4. If max retries exceeded → dead-letter queue
```

Dead letters can be replayed via `WebhookEngine.replay()` or the Control Plane UI.

---

## 7. Sync Engine

The sync engine handles bidirectional data synchronization with conflict resolution.

### Source-of-Truth Modes

| Mode | Inbound writes | Outbound writes | Use case |
|------|---------------|----------------|----------|
| `internal` | Blocked | Allowed | Internal system is authoritative |
| `external` | Allowed | Blocked | External system is authoritative |
| `field_level` | Per-field rules | Per-field rules | Mixed ownership |
| `append_only` | Allowed | Allowed | Both sides can write, no conflicts |

### Field-Level Ownership

In `field_level` mode, each field has an owner (`internal` or `external`) and a write policy:

```ts
{
  mode: 'field_level',
  fieldRules: [
    { field: 'status', owner: 'internal', writePolicy: 'owner_wins' },
    { field: 'name.*', owner: 'external', writePolicy: 'owner_wins', lastWriteWins: true },
  ]
}
```

Wildcard patterns (e.g., `name.*`) match nested field paths.

---

## 8. Identity Linking

The identity linker maps internal entity IDs to external system IDs across connections.

```ts
const linker = new IdentityLinker(store, auditHooks)

// Create a link
await linker.link({
  orgId: 'org-1', connectionId: 'conn-1',
  entityType: 'case', internalId: 'case-123',
  externalId: 'WD-456', externalSystem: 'workday',
}, actorId)

// Resolve an external ID to internal
const result = await linker.resolve({
  orgId: 'org-1', entityType: 'case',
  externalId: 'WD-456', externalSystem: 'workday',
})
// → { found: true, internalId: 'case-123', stale: false }
```

Links can be marked stale (e.g., when external system reports deletion) rather than deleted, preserving the audit trail.

---

## 9. Rate Limiting

Per-connection token-bucket rate limiter:

- **Per-minute limit**: 60 requests (default)
- **Per-hour limit**: 1000 requests (default)
- Both limits must pass; tokens refill each period

```ts
const limiter = new InMemoryRateLimiter()
const key = InMemoryRateLimiter.key('conn-1')
const result = limiter.check(key)
// → { allowed: true, remaining: 59, resetAt: Date }
```

---

## 10. Database Schema

7 tables in a single migration (`20260715_integration_fabric.sql`):

| Table | Purpose |
|-------|---------|
| `integration_connections` | Connection config per org + connector type |
| `integration_event_subscriptions` | Webhook subscription registrations |
| `integration_runs` | Execution run log with status tracking |
| `integration_delivery_attempts` | Individual webhook delivery attempts |
| `integration_dead_letters` | Failed deliveries for replay |
| `external_identity_links` | Internal ↔ external ID mappings |
| `integration_mapping_rules` | Declarative field mapping rule definitions |

All tables are org-scoped (`org_id` column) and include `created_at`/`updated_at` timestamps.

---

## 11. Observability

- **Audit trail**: Every run, delivery, link, and sync operation is recorded via `IntegrationAuditHooks` → `@nzila/audit` hash chain
- **Events**: Integration lifecycle events emitted via `@nzila/platform-events` bus
- **Control Plane**: Dashboard views for connections, runs, dead letters at `/integrations`
- **Dead letter monitoring**: View, filter, and replay failed deliveries

---

## 12. Adding a New Connector

1. Create a new file in `packages/platform-integrations-connectors/src/`
2. Implement `ConnectorAdapter` interface
3. Export from the package barrel
4. Register in `registerBuiltinConnectors()` or lazily at app startup
5. Add tests

See existing connectors (`webhook-connector.ts`, `rest-api-connector.ts`, `csv-sftp-connector.ts`) as templates.
