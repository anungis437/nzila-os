# 07 — Retention, Legal-Hold and Destruction Proof

Executed against the official PostgreSQL **18.4** server and PGlite (PostgreSQL 16),
plus the `@nzila/sage-core` records services.

## Proven properties

| Property | Evidence | Result |
|---|---|---|
| Retention assignment is versioned and immutable | append-only guard (`sage_reject_row_update`) — PGlite + official-PG | PASS |
| Retain-until has authoritative source provenance | `retention_basis_source_type/id/timestamp`; `created_at`/`delivered_at`/`event_date` bases | PASS |
| Active-hold set digest frozen | `computeActiveHoldSetDigest` at request + `approved_active_hold_set_digest` at approval | PASS |
| Hold placement + destruction coordinate atomically | `beginDeletion` single-statement `deletion_started` + `NOT EXISTS active hold` | PASS |
| Durable attempt exists BEFORE deletion | `createDestructionAttempt('prepared')` before any `deleteObject` | PASS |
| Provider idempotency key is stable | `provider_idempotency_key` frozen on the attempt | PASS |
| Crash after `deletion_started` recoverable | official-PG crash+reconnect (new connection recovers from durable attempt) | PASS |
| Crash after provider acceptance recoverable | recovery branch replays idempotently, verifies absence | PASS |
| Absence verification mandatory | `verifyObjectAbsent`; delete-success ≠ destruction | PASS |
| Tombstone transition one-way | `sage_export_package_tombstone_guard` (available→destroyed once; reversal rejected) | PASS |
| Audit + destruction evidence immutable | append-only evidence; privacy tests (hash-only) | PASS |

## Controlled test-object destruction

A controlled destruction of a **synthetic** test object was executed end to end in the
proof storage adapter path (official-PG crash/recovery test drives
delete → verify-absent → `completeDestruction` → tombstone). **No actual customer
package was used.** The object bytes are removed and the package row remains as a
non-downloadable tombstone.

## What was NOT exercised

- Destruction against a **live external object-storage provider** — NOT_PROVEN (the
  repo-embedded object store was used; the production object-storage adapter path is
  proven in code but not against a live provider).

## Verdict

Retention, legal-hold and controlled-destruction correctness (including crash/reconnect
recovery and the point-of-no-return race) is **PASS** against real PostgreSQL. Live
external object-storage operation is the only carried condition (gate G9 condition).
