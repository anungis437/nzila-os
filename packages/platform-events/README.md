# @nzila/platform-events

Unified platform event bus with typing, persistence, and dispatch. Provides a canonical event system for cross-app communication.

## Capabilities

| Area | Functions |
|------|-----------|
| **Bus** | `PlatformEventBus` — typed event publishing and subscription |
| **Store** | `DrizzleEventStore` — persistent event storage via Drizzle ORM |
| **Dispatcher** | `PlatformEventDispatcher` — event routing and dispatch |
| **Schema** | `createPlatformEvent` — canonical event construction with validation |

## Source Layout

```
src/
├── bus.ts
├── dispatcher.ts
├── schema.ts
├── store.ts
├── types.ts
├── index.ts
└── __tests__/
```

## Exports

- `.` — barrel exports
- `./types` — event type definitions
- `./schema` — Zod event schemas
- `./bus` — event bus
- `./store` — event persistence
- `./dispatcher` — event dispatcher
