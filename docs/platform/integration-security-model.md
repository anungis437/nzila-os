# Integration Fabric — Security Model

> **Status**: Active  
> **Applies to**: `@nzila/platform-integrations`, `@nzila/platform-integrations-connectors`

---

## 1. Principles

1. **Org-scoped isolation** — Every connection, run, link, and dead letter belongs to exactly one organization. Cross-org data access is impossible at the schema level.
2. **No plaintext secrets** — Connection credentials are stored as opaque `CredentialRef` references, never as plaintext in the database. Secret resolution happens at runtime via a vault adapter.
3. **Audit everything** — All mutation operations produce append-only, hash-chained audit records via `@nzila/audit`.
4. **Defense in depth** — HMAC signature verification, rate limiting, idempotency, and dead-letter isolation each operate independently.

---

## 2. Org-Scoped Isolation

All 7 database tables include an `org_id UUID NOT NULL` column. Every query MUST filter by `org_id` to prevent cross-tenant data leakage.

```sql
-- Every table enforces org scoping
CREATE TABLE integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  ...
);
CREATE INDEX idx_connections_org ON integration_connections(org_id);
```

Engines and stores receive `orgId` as a required parameter — it is never inferred from ambient context.

---

## 3. HMAC Webhook Signatures

### Outbound (Signing)

When delivering a webhook payload, the `WebhookEngine` computes an HMAC signature and attaches it as the `X-Nzila-Signature` header:

```
X-Nzila-Signature: sha256=<hex-digest>
```

- **Algorithm**: HMAC-SHA256 (default) or HMAC-SHA512
- **Key**: Per-subscription signing secret (stored as `CredentialRef`)
- **Payload**: Raw JSON body string

### Inbound (Verification)

The `WebhookConnector` verifies inbound webhook signatures:

1. Extract `X-Nzila-Signature` header
2. Recompute HMAC over the raw body using the connection's signing secret
3. Compare using **timing-safe equality** (`crypto.timingSafeEqual`) to prevent timing attacks
4. Reject if signature is missing, malformed, or mismatched

### Implementation

```ts
// signature.ts — timing-safe comparison
import { createHmac, timingSafeEqual } from 'node:crypto'

export function verifyHmacSignature(
  payload: string,
  secret: string,
  receivedSignature: string,
  algorithm: 'sha256' | 'sha512' = 'sha256',
): boolean {
  const expected = computeHmacSignature(payload, secret, algorithm)
  const a = Buffer.from(expected)
  const b = Buffer.from(receivedSignature)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
```

---

## 4. Credential Reference Pattern

Connection records store a `credential_ref` string — an opaque pointer to a secrets backend (e.g., Azure Key Vault, environment variable, encrypted store). The integration fabric **never** reads, logs, or serializes actual secret values.

```ts
interface IntegrationConnection {
  credentialRef: CredentialRef  // e.g., "vault://nzila-staging-kv/workday-api-key"
  // ...
}
```

Secret resolution is the responsibility of the consuming app (e.g., Union Eyes resolves refs via its own vault client before passing credentials to a connector adapter).

---

## 5. Audit Trail

Every significant action produces an audit record via `IntegrationAuditHooks`:

| Action | Trigger |
|--------|---------|
| `integration.run.started` | Execution engine begins a run |
| `integration.run.completed` | Run finishes (success or failure) |
| `integration.delivery.attempted` | Webhook delivery attempt |
| `integration.delivery.dead_lettered` | Delivery moved to dead-letter queue |
| `integration.delivery.replayed` | Dead letter replayed |
| `identity.linked` | New identity link created |
| `identity.unlinked` | Identity link deleted |
| `identity.marked_stale` | Identity link marked stale |
| `sync.session.started` | Sync session begins |
| `sync.session.completed` | Sync session ends |

Each record includes: `actorId`, `orgId`, `action`, `resource` (entity type + ID), `payload` (details), `traceId`.

Audit records are stored in a SHA-256 hash chain via `@nzila/audit` — each record's hash includes the previous record's hash, making tampering detectable.

---

## 6. Rate Limiting

Per-connection token-bucket rate limiter prevents abuse and protects external systems:

- **Per-minute**: 60 requests (configurable)
- **Per-hour**: 1000 requests (configurable)
- Both buckets must have available tokens
- Buckets are keyed by connection ID — one noisy connection cannot affect others
- Rate limit state is in-memory (resets on process restart)

When rate-limited, the engine returns a `RateLimitResult` with `allowed: false`, `remaining: 0`, and `resetAt` timestamp.

---

## 7. Idempotency

The idempotency store prevents duplicate processing of the same event:

- **Key format**: `{connectionId}:{direction}:{externalEventId}`
- **TTL**: 24 hours (configurable)
- Before each run, the execution engine checks for an existing key
- If found, the run is skipped with a logged duplicate notice
- After successful completion, the key is recorded with the run result

This prevents issues like:
- Webhook retries causing duplicate case creation
- Network timeouts leading to repeated outbound deliveries

---

## 8. Dead-Letter Isolation

Failed webhook deliveries are moved to a dead-letter queue after exhausting retries:

- Dead letters are **org-scoped** — only the owning organization can view or replay them
- The `error_detail` field captures the failure reason without leaking payload data to logs
- Replay operations create new delivery attempts (audited) rather than mutating the dead letter
- Dead letters have status tracking: `pending`, `replayed`, `expired`

---

## 9. Input Validation

All external inputs are validated with Zod schemas before processing:

- `createConnectionSchema` — validates connection creation payloads
- `inboundPayloadSchema` — validates inbound webhook/API payloads
- `mappingRuleDefinitionSchema` — validates mapping rule configurations
- `webhookSubscriptionSchema` — validates subscription registrations

Schema validation happens at the API boundary. Internal engine methods assume pre-validated data.

---

## 10. Transport Security

- All webhook deliveries MUST use HTTPS (enforced by connector configuration)
- API key / Bearer token auth options for REST API connectors
- Basic auth credentials are Base64-encoded per RFC 7617 (over HTTPS only)
- No credentials are included in query strings — always in headers or body

---

## 11. Threat Model Summary

| Threat | Mitigation |
|--------|-----------|
| Cross-tenant data access | org_id scoping on all tables + required filter |
| Webhook spoofing | HMAC signature verification with timing-safe compare |
| Credential leakage | CredentialRef indirection — no plaintext in DB or logs |
| Replay attacks | Idempotency store with TTL |
| Denial of service | Per-connection rate limiting |
| Audit tampering | SHA-256 hash chain (append-only) |
| Payload injection | Zod schema validation at API boundary |
| Dead letter information disclosure | Org-scoped isolation, no payload in error logs |
