# Platform Event Bus — Architecture

> Package: `@nzila/platform-events`

## Overview

Canonical domain event envelope and typed bus for all NzilaOS verticals. Replaces per-vertical event systems with a unified platform bus that preserves full traceability.

## Architecture

```
┌────────────────────────────────────────┐
│         PlatformEventBus               │
│  ┌──────────────┐  ┌────────────────┐  │
│  │  Subscribers  │  │  EventStore    │  │
│  │  (typed)      │  │  (optional)    │  │
│  └──────┬───────┘  └───────┬────────┘  │
│         │                  │           │
│  ┌──────▼──────────────────▼────────┐  │
│  │     PlatformEvent<T> Envelope    │  │
│  │  type, payload, metadata, id     │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

## Event Envelope

Every platform event carries:

| Field | Type | Purpose |
|---|---|---|
| `id` | UUID | Unique event identifier |
| `type` | string | Event category (25 defined) |
| `payload` | `Readonly<T>` | Typed, immutable payload |
| `metadata.orgId` | UUID | Org isolation (never "tenant") |
| `metadata.actorId` | string | Who caused the event |
| `metadata.correlationId` | UUID | Cross-service correlation |
| `metadata.causationId` | UUID | Parent event link |
| `metadata.traceId` | string | Observability trace |
| `metadata.source` | string | Originating service |
| `occurredAt` | ISO 8601 | Event timestamp |
| `schemaVersion` | number | Forward compatibility |

## Event Categories

25 canonical event types across all verticals:

- `EVIDENCE_PACK_CREATED`, `EVIDENCE_PACK_SEALED`, `EVIDENCE_PACK_VERIFIED`
- `COMPLIANCE_SNAPSHOT_GENERATED`, `COMPLIANCE_SNAPSHOT_VERIFIED`
- `INTEGRATION_REGISTERED`, `INTEGRATION_HEALTH_CHANGED`
- `AUDIT_EVENT_RECORDED`
- `USER_INVITED`, `USER_ROLE_CHANGED`, `USER_DEACTIVATED`
- And 14 more covering commerce, agri, payments, and platform operations

## Validation

All events are validated against Zod schemas before emission. Schema enforces:

- UUID format for `id`, `orgId`, `correlationId`
- Non-empty `type` from the allowed category set
- ISO 8601 datetime for `occurredAt`
- Positive integer `schemaVersion`

## Persistence

Optional `EventStore` port enables Drizzle-backed persistence to `platform_events` table with 3 indexes (type + orgId, correlationId, occurredAt).

## Usage

```typescript
import { PlatformEventBus, createPlatformEvent } from '@nzila/platform-events'

const bus = new PlatformEventBus()

bus.subscribe('EVIDENCE_PACK_SEALED', async (event) => {
  // Handle sealed evidence pack
})

const event = createPlatformEvent('EVIDENCE_PACK_SEALED', {
  packId: 'pack-001',
  orgId: 'org-uuid',
  actorId: 'user-001',
})

await bus.emit(event)
```

## Design Decisions

1. **In-memory first**: No external broker dependency for local development
2. **Wildcard support**: `bus.subscribe('*', handler)` for cross-cutting concerns
3. **Error isolation**: One subscriber failure doesn't block others
4. **Schema validation**: Zod validation on every `emit()` call
5. **Compatible**: Same subscribe/emit pattern as existing `InMemoryEventBus`
