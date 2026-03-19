# @nzila/platform-integrations-control-plane

Platform-level integration management with provider registry, webhook signature verification, dead-letter queue, rate limiting, and dashboard.

## Capabilities

| Area | Functions |
|------|-----------|
| **Registry** | `ProviderRegistry` — register and manage integration providers |
| **Webhooks** | `verifyWebhookSignature` — cryptographic webhook signature verification |
| **DLQ** | `DlqManager` — dead-letter queue for failed integration events |
| **Rate Limiting** | `IntegrationRateLimiter` — per-provider rate limit enforcement |
| **Dashboard** | `buildDashboardSummary` — integration health and status dashboard |

## Source Layout

```
src/
├── dashboard.ts
├── dlq.ts
├── rate-limiter.ts
├── registry.ts
├── types.ts
├── webhook-verify.ts
├── index.ts
└── __tests__/
```

## Exports

- `.` — barrel exports
- `./types` — integration type definitions
- `./registry` — provider registry
- `./webhook-verify` — webhook verification
- `./dlq` — dead-letter queue
- `./rate-limiter` — rate limiting
- `./dashboard` — dashboard utilities
