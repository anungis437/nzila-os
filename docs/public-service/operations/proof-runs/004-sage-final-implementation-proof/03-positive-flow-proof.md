# 03 — Positive End-to-End Flow Proof

## Overall status: PASS_WITH_CONDITIONS

The positive control chain is proven at the **service, repository and PostgreSQL state
-machine level** with real SHA-256 hashing and, for the database-backed stages, against
the official PostgreSQL 18.4 server and/or PGlite. It is **not** a complete externally
integrated operational flow, because the following were **not** executed in a deployed
production-equivalent environment:

```
live notification provider (Resend)          — NOT executed
live distributed Redis rate limiter          — NOT executed
live object storage                          — NOT executed
live mailbox receipt + recipient claim       — NOT executed
live monitoring                              — NOT executed
live restoration                             — NOT executed
```

Therefore this gate is **PASS_WITH_CONDITIONS**, not `PASS`.

### Proven

- service and repository orchestration
- PostgreSQL state transitions (official server + PGlite)
- authorization / RLS (doc 05)
- immutable export lifecycle
- delivery state machinery (state transitions, receipts, revocation logic)
- retention, legal holds and destruction controls (doc 07)

### Not proven

- the complete externally integrated operational flow (live provider + Redis + object
  storage + mailbox + monitoring + restoration end to end)

## Workspace, evidence, review, decision (steps 1–5)

| Step | Evidence | Result |
|---|---|---|
| Workspace create/select (authorized) | `services.test.ts`, `workspace-service` | PASS |
| Governed evidence recorded | `services.test.ts` evidence lifecycle | PASS |
| Provenance + uncertainty metadata | evidence source classification tests | PASS |
| Named-human review | governance-routes / review-note tests | PASS |
| Separation-enforced named-human decision | decision-record + `assertNamedHumanReviewer` | PASS |

## Export (steps 6–10)

| Step | Evidence | Result |
|---|---|---|
| Export request (authorized requester) | `services.test.ts` export workflow | PASS |
| Independent approver approves exact scope | approver-separation tests | PASS |
| Immutable package generation | `export-package` + durability tests | PASS |
| Manifest + package hash verification | `verifySageExportPackageBytes` tests | PASS |
| Audit outbox emits safe events | export-durability outbox tests | PASS |

## Delivery (steps 11–18) — CONDITIONAL

| Step | Evidence | Result |
|---|---|---|
| Recipient-delivery request | `delivery.test.ts` | PASS (code-proven) |
| Independent delivery approver | delivery approval separation tests | PASS (code-proven) |
| Grant-scoped notification dispatch | replay-first issuance + stable `messageId` tests | PASS (code-proven) |
| Mailbox-control verification | delivery identity tests | PASS (code-proven) |
| Secure recipient session | recipient-context + claim tests | PASS (code-proven) |
| Recipient accesses exact approved package | recipient download route tests | PASS (code-proven) |
| Download/access receipt recorded | delivery receipt tests | PASS (code-proven) |
| Revocation/expiry invalidates access | grant revoke/expiry tests | PASS (code-proven) |

> **Condition:** delivery is proven at the code/persistence level. **Live dispatch to a
> real mailbox via Resend and a live recipient claim were NOT exercised** (B-004 does not
> apply here; carried as conditions C-1/C-2 and gate G6/G7).

## Records lifecycle (steps 19–28)

| Step | Evidence | Result |
|---|---|---|
| Versioned retention policy assigned | official-PG lifecycle + `records-services.test.ts` | PASS |
| Retain-until + basis provenance frozen | provenance tests (`retention_basis_source_*`) | PASS |
| Legal hold blocks destruction | official-PG hold-wins + eligibility tests | PASS |
| Hold released by authorized named human | release-hold tests | PASS |
| Destruction requested after eligibility | request tests | PASS |
| Different human approves exact scope | requester≠approver tests | PASS |
| Durable destruction attempt persisted | official-PG + `createDestructionAttempt` | PASS |
| Object absence independently verified | `verifyObjectAbsent` mandatory tests | PASS |
| Immutable non-downloadable tombstone | tombstone guard + access-regression tests | PASS |
| Destruction evidence + audit readable | privacy + evidence tests | PASS |

> **Condition:** destruction is proven against the repo-embedded object store; the **live
> external object-storage adapter path was NOT exercised** (C-9 / gate G9).

## Verdict

Positive control chain: **PASS_WITH_CONDITIONS**. The service/DB chain is proven; the
complete externally integrated operational flow (live Resend, Redis, object storage,
mailbox, monitoring, restoration) is **not proven** in this environment.
