# 04 — Adversarial Flow Proof

Every denial below is exercised by an executed test that asserts a typed, non-disclosing
rejection. Database-level denials run against the official PostgreSQL 18.4 server; service
-level denials run against the real `@nzila/sage-core` services.

## Authorization denials

| Scenario | Evidence | Result |
|---|---|---|
| Cross-tenant workspace access | official-PG RLS (org A ↛ org B) + `authorizeSageWorkspaceAccess` NOT_FOUND | DENIED |
| Cross-tenant evidence access | RLS + evidence authorize tests | DENIED |
| Cross-tenant package access | tenant-scoped `getExportPackage` tests | DENIED |
| Generic admin attempting narrow records authority | `a generic admin without destruction-approve authority cannot approve` | DENIED (FORBIDDEN) |
| Recipient actor attempting internal lifecycle action | official-PG `recipient role has no lifecycle write access` (permission denied) | DENIED |
| System actor attempting human approval | `assertActorIsHuman` / system-actor rejection tests | DENIED |
| Requester approving own request | requester≠approver export tests | DENIED |
| Requester approving own destruction | `the requester cannot approve their own destruction` | DENIED |
| Unauthorized internal-route invocation | `destruction-internal-route.test.ts` (constant-time token) | DENIED (401) |

## Export & delivery denials

| Scenario | Evidence | Result |
|---|---|---|
| Package hash drift after approval | `a package/scope drift after request returns CONFLICT` | DENIED (CONFLICT) |
| Manifest drift after approval | scope-drift CONFLICT tests | DENIED |
| Recipient hash drift after approval | delivery compat/replay tests | DENIED |
| Replayed issuance with changed parameters | replay-first incompatible-replay `conflict()` | DENIED |
| Expired invitation / revoked grant | grant expiry/revoke tests | DENIED |
| Replayed claim token / wrong mailbox / wrong session | recipient claim + session tests | DENIED |
| Stale dispatcher owner completion | owner-fenced mark/release tests | DENIED |
| Distributed limiter unavailable | fail-closed limiter test | DENIED (fail-closed) |
| Notification provider transient / permanent failure | dispatcher release-to-pending / dead-letter tests | HANDLED |

> **Condition:** provider transient/permanent failure handling is proven in unit tests
> using a fake provider; not exercised against live Resend (gate G7).

## Retention & destruction denials

| Scenario | Evidence | Result |
|---|---|---|
| Destruction without retention assignment | `denies destruction when no retention policy is assigned` | DENIED |
| Destruction before retain-until | `blocks a destruction request while retention has not elapsed` | DENIED |
| Destruction while any legal hold active | official-PG + `active hold blocks destruction` | DENIED |
| Hold racing before deletion point of no return | official-PG `hold wins` (two connections) | DENIED (deletion aborts) |
| Hold racing after deletion started | official-PG `destruction wins` (later hold rejected) | DENIED (CONFLICT) |
| Same person request+approve destruction | requester≠approver tests | DENIED |
| Stale destruction executor | official-PG executor fencing | DENIED (fenced) |
| Object hash mismatch | scope/integrity mismatch → `verification_failed` | DENIED (no delete) |
| Delete success without verified absence | `deletion success without verified absence is NOT complete` | DENIED (failed, no tombstone) |
| Object absent without prior authoritative attempt | `not_found_before_delete` (no tombstone) | DENIED |
| Attempt replay after successful destruction | idempotent replay returns authoritative evidence | SAFE (no second delete) |
| Download / redelivery after tombstone | access-regression tests | DENIED |

## Verdict

All adversarial scenarios that can be exercised at the code + database level are
**DENIED / HANDLED** with typed, non-disclosing, tenant-safe results and no leakage of
secrets or raw storage references. Live-provider failure injection (Resend) is the only
condition carried to G7.
