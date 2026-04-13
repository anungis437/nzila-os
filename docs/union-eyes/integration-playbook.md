# Union Eyes — Integration Playbook

> **Status**: Active  
> **App**: Union Eyes (`apps/union-eyes`)  
> **Integration hooks**: `lib/integrations/integration-fabric-hooks.ts`

---

## 1. Overview

Union Eyes is the first Nzila OS app to consume the Integration Fabric. This playbook covers how to:

- Set up an external connection (e.g., Workday, employer HR system)
- Register event subscriptions for outbound notifications
- Configure mapping rules to transform data between UE and external formats
- Handle inbound cases and members from external systems
- Emit outbound events when internal changes occur
- Manage identity links between UE entities and external records
- Monitor integrations via the Control Plane

---

## 2. Architecture

```
External HR System
  │
  ▼ (webhook POST)
UE API Route → WebhookConnector.executeInbound()
  → MappingEngine (transform payload)
  → IdentityLinker (resolve/create external ID link)
  → UeIntegrationFabric.processInboundCase()
  → Insert into UE database tables
  → Audit record

UE Internal Event (e.g., case.resolved)
  → UeIntegrationFabric.emitOutboundEvent()
  → WebhookEngine.publishEvent()
  → For each matching subscription:
      → MappingEngine (transform to external format)
      → WebhookConnector.executeOutbound() (HMAC-signed POST)
      → Delivery attempt recorded
      → On failure → dead-letter queue
```

---

## 3. Setting Up a Connection

### 3.1 Create the Connection Record

Insert into `integration_connections` via the store or migration:

```ts
const connection = await connectionStore.create({
  orgId: 'org-uuid',
  connectorType: 'webhook',       // or 'rest_api', 'csv_sftp'
  name: 'Workday HR Integration',
  status: 'active',
  configJson: {
    targetUrl: 'https://employer.example.com/api/webhook',
    signingSecret: 'vault://nzila-staging-kv/workday-signing-secret',
  },
  credentialRef: 'vault://nzila-staging-kv/workday-api-key',
})
```

### 3.2 Test the Connection

```ts
const adapter = connectorRegistry.get('webhook')
const result = await adapter.testConnection(connection)
// → { success: true, latencyMs: 142, message: 'OK' }
```

### 3.3 Activate

Update `status` from `pending` to `active` once the test passes.

---

## 4. Registering Event Subscriptions

To receive outbound notifications when UE events occur:

```ts
await subscriptionStore.create({
  orgId: 'org-uuid',
  connectionId: connection.id,
  eventType: 'case.resolved',     // matches UE_INTEGRATION_EVENTS
  targetUrl: 'https://employer.example.com/api/case-updates',
  signingSecret: 'vault://...',
  isActive: true,
  filterJson: {},                  // optional event filters
})
```

### Available UE Events

| Event | Trigger |
|-------|---------|
| `case.created` | New case filed |
| `case.updated` | Case details changed |
| `case.resolved` | Case resolution recorded |
| `case.escalated` | Case escalated to higher level |
| `grievance.filed` | New grievance submitted |
| `grievance.updated` | Grievance details changed |
| `grievance.resolved` | Grievance resolution recorded |
| `member.created` | New member registered |
| `member.updated` | Member details changed |
| `member.terminated` | Member terminated |
| `benefit.claimed` | Benefit claim submitted |
| `benefit.approved` | Benefit claim approved |
| `benefit.denied` | Benefit claim denied |
| `document.uploaded` | Supporting document uploaded |

---

## 5. Configuring Mapping Rules

Mapping rules transform payloads between external and internal formats.

### 5.1 Define the Rules

```ts
await mappingRuleStore.create({
  orgId: 'org-uuid',
  connectionId: connection.id,
  name: 'Workday Inbound Case Mapping',
  direction: 'inbound',
  entityType: 'case',
  priority: 1,
  isActive: true,
  rulesJson: [
    { operation: 'rename', sourceField: 'employee_id', targetField: 'memberId' },
    { operation: 'rename', sourceField: 'case_description', targetField: 'description' },
    { operation: 'enum_translate', sourceField: 'priority_code', targetField: 'priority', params: { mapping: { 'H': 'high', 'M': 'medium', 'L': 'low' }, fallback: 'medium' } },
    { operation: 'constant', targetField: 'source', params: { value: 'workday' } },
    { operation: 'default', sourceField: 'category', targetField: 'category', params: { value: 'general' } },
  ],
})
```

### 5.2 Preview Before Activating

Dry-run a mapping without saving:

```ts
const fabric = new UeIntegrationFabric(/* dependencies */)
const preview = fabric.previewMapping(connectionId, inboundPayload)
// Returns the transformed payload without side effects
```

---

## 6. Handling Inbound Cases

When an external system sends a case via webhook:

```ts
// In your webhook API route handler
const fabric = new UeIntegrationFabric(/* dependencies */)

const result = await fabric.processInboundCase(
  connectionId,
  rawPayload,      // the POST body from external system
  actorId,         // the integration service principal
)
// result.mappedPayload — the transformed case data
// result.identityLink — the external ↔ internal ID link
```

### What Happens Internally

1. Mapping engine transforms the raw payload using configured rules
2. Identity linker checks if a link already exists for this external case
3. If new → creates identity link + case record
4. If existing → updates the existing case (subject to sync policy)
5. Audit record created
6. Integration run recorded

---

## 7. Emitting Outbound Events

When a UE entity changes, emit an event to all subscribed external systems:

```ts
// After resolving a case in your business logic
await fabric.emitOutboundEvent('case.resolved', {
  caseId: 'case-123',
  resolution: 'settled',
  resolvedAt: new Date().toISOString(),
  resolvedBy: actorId,
}, orgId)
```

The webhook engine will:
1. Find all active subscriptions for `case.resolved` in this org
2. Apply outbound mapping rules (if configured)
3. POST to each subscriber's target URL with HMAC signature
4. Record delivery attempts
5. Retry on failure; dead-letter after max retries

---

## 8. Managing Identity Links

### Resolve an External ID

```ts
const result = await fabric.resolveExternalId(
  'case',           // entity type
  'WD-456',         // external ID
  'workday',        // external system name
  orgId,
)
if (result.found) {
  // result.internalId → 'case-123'
  // result.stale → false
}
```

### View Links for an Internal Entity

```ts
const links = await identityLinker.findLinksForInternal('case', 'case-123', orgId)
// Returns all external system links for this case
```

### Mark a Link as Stale

When an external system reports a record was deleted or archived:

```ts
await identityLinker.markStale(linkId, orgId, actorId)
```

---

## 9. Monitoring via Control Plane

### Dashboard Views

| Route | Purpose |
|-------|---------|
| `/integrations` | Overview: connection count, active runs, dead letters |
| `/integrations/dead-letters` | View and replay failed deliveries |

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/control-plane/integrations` | List connections + summary stats |
| GET | `/api/control-plane/integrations/dead-letters` | List dead letters |
| POST | `/api/control-plane/integrations/dead-letters` | Replay a dead letter by ID |

---

## 10. Troubleshooting

### Inbound Webhook Returns 401

- Check that the `X-Nzila-Signature` header is present
- Verify the signing secret matches between sender and connection config
- Ensure the signature format is `sha256=<hex>` (not base64)

### Outbound Delivery Failing

- Check the dead-letter queue in Control Plane
- Verify the target URL is reachable (test connection)
- Check rate limiter — connection may be throttled (60/min, 1000/hr)
- Review delivery attempts for HTTP status codes

### Duplicate Records Created

- Check idempotency key format — the external event ID must be consistent across retries
- Verify TTL hasn't expired (default 24h)

### Mapping Produces Unexpected Output

- Use `previewMapping()` to dry-run with sample data
- Check rule priority — rules execute in array order
- Verify `enum_translate` mappings include all expected values (or set a `fallback`)

### Identity Link Not Found

- Check entity type matches exactly (e.g., `case` not `cases`)
- Verify org ID is correct — links are org-scoped
- Check if link was marked stale — resolve returns `stale: true` if so
