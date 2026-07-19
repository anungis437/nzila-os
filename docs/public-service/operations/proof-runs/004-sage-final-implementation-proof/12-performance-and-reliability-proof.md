# 12 — Performance and Reliability Proof

## Reliability under concurrency — PROVEN (real PostgreSQL, independent sessions)

The official PostgreSQL 18.4 suite exercised true multi-session concurrency and proved
the required non-duplication invariants:

| Concurrency scenario | Result |
|---|---|
| Two workers claim the same destruction request simultaneously | Exactly one winner (no duplicate grants/attempts) |
| Legal-hold vs destruction race (hold wins) | Deletion aborts atomically; zero storage calls |
| Legal-hold vs destruction race (destruction wins) | Later hold deterministically rejected |
| Stale executor lease vs fresh worker | Old owner fenced; single authoritative attempt |
| Crash + reconnect during `deletion_started` | Recovered from durable attempt; exactly one attempt total |

**No concurrency test produced duplicate grants, duplicate provider identities,
duplicate destruction attempts, or cross-tenant leakage.** This is the core reliability
requirement and it is **PASS**.

Additional at-least-once + fencing reliability (outbox dispatch, notification dispatcher
lease/fence, idempotent replay) is proven in the unit suites (os-core idempotency-lease,
delivery/notification dispatcher tests).

## Performance thresholds — NOT_PROVEN (no deployed environment)

Latency/throughput thresholds for representative operations (workspace loading, evidence
listing, package generation, recipient claim, download authorization, dispatcher batch,
retention eligibility, hold placement, destruction preflight, tombstone reads) require a
**deployed production-like environment** to measure against platform budgets. This proof
environment is a local developer machine and does **not** provide a representative
measurement surface.

| Aspect | Status |
|---|---|
| Concurrency correctness (no duplicates / no cross-tenant leakage) | **PASS** |
| Latency/throughput vs platform budgets | **NOT_PROVEN** (no deployed environment) |

## Verdict

Gate G14 = **PASS_WITH_CONDITIONS** — concurrency reliability is proven; deployed-
environment performance budgets are NOT_PROVEN and are a condition for a full GO.
