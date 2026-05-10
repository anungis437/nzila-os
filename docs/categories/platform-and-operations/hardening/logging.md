# Logging Standards & PII Redaction

**PR 11 — Hardening Pass**  
**Status**: Implemented  
**Owner**: `@nzila/platform`

---

## Summary

This document specifies the structured logging standard for all Nzila services, including mandatory PII redaction, request correlation, and log level governance.

---

## Log Levels

| Level | When to Use | Examples |
|-------|-------------|---------|
| `error` | Unhandled exceptions, data integrity failures, security events | Audit chain broken, webhook verification failed |
| `warn` | Recoverable issues, deprecated patterns, rate limit near-threshold | DB connection retry, deprecated API usage |
| `info` | Business events, request lifecycle, state transitions | User authenticated, payment record created |
| `debug` | Developer-only diagnostic information | SQL query plans, cache hit/miss |

**Rule**: Production services run at `info` or `warn` by default. Never `debug` in prod.

---

## Correlation IDs

Every request must carry a correlation ID (`x-correlation-id` header or auto-generated UUID). Structured log entries must include:

```json
{
  "level": "info",
  "correlationId": "01HXN5PMFBP0HRYHGMJ4JG8E9P",
  "orgId": "[REDACTED]",  ← never log entity IDs in plaintext in shared infra logs
  "msg": "Payment created",
  "service": "console"
}
```

**Implementation**: Orchestrator API uses Fastify's built-in `pino` logger with `{ correlationId }` auto-injected via `fastify-request-context` (future).

---

## Mandatory PII Redaction

The following fields must **never** appear in logs verbatim:

| Field | Redaction Rule |
|-------|----------------|
| `email` | Mask to `u****@domain.com` |
| `phone` | Replace entirely with `[PHONE_REDACTED]` |
| `ssn`, `taxId` | Replace with `[TAX_ID_REDACTED]` |
| `bankAccount`, `routingNumber` | Replace with `[BANK_REDACTED]` |
| `stripeCustomerId` (in plaintext) | OK to log — it has no PII directly |
| `DATABASE_URL` | Replace with `[DB_URL_REDACTED]` |
| `CLERK_SECRET_KEY` | Replace with `[SECRET_REDACTED]` |
| Bearer tokens | Replace with `[BEARER_REDACTED]` |

### redactFields Helper

Use the `redactFields()` utility from `@nzila/os-core/telemetry` before logging user-supplied data:

```typescript
import { redactFields } from '@nzila/os-core/telemetry'

app.log.info({ ...redactFields(userPayload), action: 'user_signed_up' })
```

---

## Audit vs. Application Logs

| Type | Destination | Retention | Tamper-Proof |
|------|-------------|-----------|--------------|
| Application logs | stdout → Azure Monitor | 30 days | No |
| Audit events | `audit_events` DB table | 7 years | Yes (SHA-256 chain) |
| Evidence packs | Azure Blob (immutable tier) | 7 years | Yes (SHA-256 manifest) |

**Rule**: Never substitute an application log for an audit event. Use `recordAuditEvent()` from `@nzila/os-core/audit` for all material actions.

---

## Log Sampling

For high-volume paths (e.g., health checks, static asset requests), use `fastify`'s route-level log level override:

```typescript
app.get('/health', { config: { rateLimit: { max: 1000 } }, logLevel: 'warn' }, handler)
```

---

*Part of the Nzila Hardening Pass — Phase 3 (PR 11)*
