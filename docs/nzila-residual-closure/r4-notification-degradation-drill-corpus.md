# R4 — Notification Degradation Drill Corpus

> **Status: PARTIALLY CLOSED.** Drill protocol shipped; live execution scoped to recurring chore cadence `chore/r4-notification-degradation-drill-corpus`.

## Authority

This document is the canonical notification degradation drill protocol for Nzila OS. Notifications must NEVER create operational ambiguity: bounded retries, operational honesty banners, continuity-safe fallback behavior, duplicate suppression, escalation preservation. Governance-safe, continuity-safe, anti-surveillance, evidence-anchored, reviewer-of-record bound. Operational, institutional, deterministic, bounded.

## 1. Drill matrix

| Drill | Trigger | Expected behavior | Honesty signal |
|---|---|---|---|
| **Email provider outage** | block Resend egress (NSG rule or API key revocation in dev KV) | bounded retry budget exhausted → notification queued in DB; UI banner "notification dispatch degraded — queued for retry" | reviewer-of-record sees queue depth |
| **Delayed notification queues** | inject 30s artificial delay in notification dispatcher | dispatch proceeds with elevated latency; no silent drop; queue depth metric exposed | bounded queue ceiling enforced |
| **Webhook degradation** | unset webhook signing secret on a non-critical webhook subscriber | webhook delivery returns 401; bounded retry; eventual move to dead-letter with explicit operator notice | no silent webhook drop |
| **Retry collapse** | force every retry attempt to fail (provider 503 storm) | retry budget exhausted; notification moved to dead-letter; reviewer-of-record sees explicit "dead-letter quota — operator action required" | escalation preserved |
| **Partial delivery failure** | succeed on email but fail on SMS leg | partial-success state explicit; bounded re-dispatch only on the failed leg; never silent re-dispatch on the successful leg | duplicate suppression honored |

## 2. Bounded contracts

The notification layer enforces:

- **Bounded retries** — max 3 attempts, exponential backoff, capped at 60s
- **Bounded queue** — per-org queue ceiling; overflow emits explicit "queue ceiling reached" notice
- **Duplicate suppression** — idempotency key on every dispatch; same key ↔ same dispatch attempt
- **Escalation preservation** — dead-letter queue carries the original event + retry trace; reviewer-of-record can re-dispatch manually
- **Operational honesty banners** — never silently drop; never silently skip; never silently re-dispatch the successful leg

## 3. Execution procedure

For each environment (dev / staging / demo; pilot scoped to post-R1 + post-R6):

1. Capture pre-drill notification queue state
2. Execute degradation trigger
3. Probe dispatcher behavior under degradation
4. Verify operational honesty banner copy matches doctrine
5. Restore provider
6. Verify queue drains deterministically
7. Capture artifact under `chore/r4-notification-degradation-drill-corpus` evidence directory

## 4. Required validations

- bounded retries
- operational honesty banners
- continuity-safe fallback behavior
- duplicate suppression
- escalation preservation

## 5. Anti-pattern enumeration (rejected)

The notification layer must NEVER:

- create operational ambiguity
- silently drop a notification
- silently re-dispatch a successful leg
- silently exceed the bounded retry budget
- silently exceed the bounded queue ceiling
- collapse dead-letter events without operator acknowledgment

## 6. Cadence

Notification drills are bound to:

- per provider key rotation (R8 trigger)
- per webhook subscriber addition / removal
- quarterly institutional drill

## 7. Verdict

R4 protocol is **fully specified, evidence-anchored, reviewer-of-record bound, cadence-aligned**. Notifications degrade safely; operational ambiguity is structurally forbidden.

**Status: PARTIALLY CLOSED. Chore PR: `chore/r4-notification-degradation-drill-corpus` (recurring).**
