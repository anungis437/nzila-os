---
name: nzila-audit-atomicity
description: Use when fixing audit/write atomicity, exactly-once financial or governance actions, delivery ledgers, or concurrent transaction integrity. Require coupled state transitions and explicit failure evidence.
---

# Audit and business-write atomicity

## Trigger
Use for audit atomicity findings, transaction boundaries, idempotent handlers, settlement posting, reversals, and immutable evidence writes.

## Procedure
1. Find the authoritative business invariant, affected producer/consumer, table owners, existing audit contract (`packages/audit` where relevant), and current transaction boundary. Inventory primary writes, audit events, outbox records, retries, and downstream effects.
2. Map the failure matrix: audit-store unavailable, business write rejected, rollback, concurrent duplicate requests, timeout after commit, retries after crash, tenant mismatch, serialization conflict, and poison/replayed events.
3. Where business state and audit record share a database, persist both in one real database transaction and fail closed on either write failure. Where systems differ, do not assert cross-system atomicity; use a durable transactional outbox/inbox with idempotent consumers and explicit reconciliation.
4. Require database-enforced uniqueness for business idempotency keys, stable correlation IDs, tenant/actor binding, canonical timestamps, immutable evidence payloads, and monotonic lifecycle transitions. Lock or compare-and-swap at the correct aggregate boundary.
5. Ensure that catches, finally blocks, background dispatch, logging wrappers, and API response paths cannot turn an audit failure into business success. Check effective DB roles and RLS for both writes, not just the TypeScript service layer.
6. Prove targeted adversarial cases: concurrent requests, forced audit failure, forced business failure, crash/restart replay, double delivery, foreign-tenant access, and partial downstream recovery. Record what ran and what requires PostgreSQL or deployed runtime.
7. Reconcile the exact register IDs only after implementation evidence exists; retain `NOT_PROVEN` for unexecuted integration or runtime tests.

## Hard boundaries
- Do not widen database grants, disable RLS, mutate historical audit entries, or bypass approval/financial mandates to make a test pass.
- No `exactly-once` claim without durable uniqueness and verified retry behavior.
- No GO or deployment without the separate runtime and authorization gates.

