# 06 — Delivery and Notification Proof

## Composition verified in code

| Element | Evidence | Status |
|---|---|---|
| Approved notification provider (Resend) adapter | `delivery-notifier-adapter.ts` (`ResendSageDeliveryNotifier`) | PROVEN (code) |
| Stable message identity (`sage-delivery-invitation:${grantId}`) | replay-first issuance tests | PROVEN |
| Provider-message ID persistence | delivery grant/notification persistence tests | PROVEN |
| Leased / fenced notification dispatcher | `notification-dispatcher.ts` claim `FOR UPDATE SKIP LOCKED`, owner-fenced | PROVEN |
| Retry scheduling (full-jitter backoff) | `releaseNotificationOutboxToPending` + `calculateBackoff` tests | PROVEN |
| Dead-letter handling | `markNotificationDeadLetter` tests | PROVEN |
| Versioned encryption key ring | `notification-encryption.ts` key-ring + unknown-key-throws tests | PROVEN |
| Terminal ciphertext destruction | migration 0042 payload-destruction tests | PROVEN |
| Redis-backed rate limiting | `checkDistributedRateLimit` (Upstash Lua) + fail-closed test | PROVEN (fail-closed); live Redis NOT_PROVEN |
| Safe aggregate readiness reporting | internal readiness route tests | PROVEN (code); deployed surface NOT_PROVEN |

## Delivery guarantee (accurate statement)

The proven guarantee is **at-least-once notification attempts with a stable message
identity, plus provider deduplication where supported** (Resend `Idempotency-Key`
header = `messageId`). **Exactly-once delivery is NOT claimed** and is not implemented.

## What was NOT exercised in this proof environment

- **Live dispatch to a real mailbox via Resend** — NOT_PROVEN (no provider credentials
  provisioned; and mailbox delivery must never be exercised against real recipient
  addresses in a proof).
- **Live Redis** rate limiting under load — NOT_PROVEN (fail-closed behaviour proven in
  unit tests only).

## Verdict

Delivery + notification **logic and persistence: PROVEN**. **Live provider/Redis
operation: NOT_PROVEN.** Gate G6 = PASS_WITH_CONDITIONS; gate G7 = PASS_WITH_CONDITIONS
(logic proven, live operational resilience deferred to a deployed proof).
