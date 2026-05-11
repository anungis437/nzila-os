# Integration Control Plane — Architecture

> Package: `@nzila/platform-integrations-control-plane`

## Overview

Admin/ops surface over the existing integrations infrastructure. Provides provider registry, webhook verification with replay protection, DLQ management, org-scoped rate limiting, and health dashboard aggregation.

## Architecture

```
┌───────────────────────────────────────────────────────┐
│              Integration Control Plane                 │
│                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │  Provider     │  │  Webhook     │  │  Rate       │ │
│  │  Registry     │  │  Verifier    │  │  Limiter    │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘ │
│         │                 │                 │        │
│  ┌──────▼─────────────────▼─────────────────▼──────┐ │
│  │                  DLQ Manager                     │ │
│  │        (replay, purge, inspect)                  │ │
│  └──────────────────────┬──────────────────────────┘ │
│                         │                            │
│  ┌──────────────────────▼──────────────────────────┐ │
│  │            Dashboard Summary                     │ │
│  └──────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────┘
```

## Modules

### Provider Registry

- Register/unregister integration providers per org
- Health aggregation across all org providers
- Status tracking: `active`, `inactive`, `degraded`, `error`
- Port-based persistence (DI-friendly)

### Webhook Verification

- **HMAC-SHA256** signature verification with timing-safe comparison
- **Replay protection**: configurable timestamp tolerance window
- **Prefix normalization**: handles `sha256=`, `v1=` prefixed signatures
- Outbound webhook signing via `computeHmacSha256`

### DLQ Manager

- Inspect failed integration messages
- Replay individual or batch entries
- Purge expired entries
- Per-org isolation

### Rate Limiter

- Sliding window per org + provider
- Configurable max requests and window size
- Automatic cleanup of expired windows

### Dashboard

- `buildDashboardSummary()` aggregates registry + DLQ + rate limit state
- Single API for console surface consumption

## Security Controls

| Control | Implementation |
|---|---|
| HMAC-SHA256 | `createHmac('sha256', secret)` from `node:crypto` |
| Timing-safe | `timingSafeEqual` for signature comparison |
| Replay protection | Timestamp validation within tolerance window |
| Org isolation | All operations scoped by `orgId` |

## Test Coverage

30 tests across 4 test files:

- Registry: 7 tests (CRUD, health aggregation)
- Webhook verification: 9 tests (HMAC, replay, prefixes, timing-safe)
- DLQ: 7 tests (add, replay, purge, inspect)
- Rate limiter: 7 tests (allow, deny, sliding window, cleanup)
