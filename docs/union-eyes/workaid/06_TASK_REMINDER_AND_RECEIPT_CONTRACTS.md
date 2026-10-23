# 06 — Task, reminder and receipt contracts

Module: [`src/followup.ts`](../../../tooling/workaid-prep/src/followup.ts), [`src/time.ts`](../../../tooling/workaid-prep/src/time.ts), [`src/dependency.ts`](../../../tooling/workaid-prep/src/dependency.ts).

## Separation from the grievance deadline engine

The WorkAid contracts import nothing from `apps/union-eyes/lib/deadline-engine/` and do not use `grievance_deadlines`, `deadline_reminders`, the recipient resolver or the CUPE intake vocabulary. Two executable guards:

- `[WA-T086] the resolver at the pinned SHA throws for claim_deadlines and resolves grievance recipients only` — the grievance-only behaviour is source-confirmed at `38a824918`.
- `[WA-T086] no WorkAid preparation source imports the deadline engine…` — scans every harness source file's import lines.

What *is* mirrored, as a contract and not as code: a durable schedule with a timezone, an idempotent schedule key, a recipient snapshot taken at schedule time, observed delivery outcomes and dead-lettering. The grievance engine's *claim_deadlines* surface is `NOT_IMPLEMENTED` and is not a WSIB timer.

## Task-of-record (decision D-02) — deliberately unresolved

`ARCHITECTURE.taskOfRecord = 'UNRESOLVED'`. Behaviour by value, all tested:

| Value | Generation | Reminders |
|---|---|---|
| `UNRESOLVED` (current) | A task record is created with `authoritative=false` so nothing is lost | **None scheduled** (`TASK_NOT_AUTHORITATIVE`) |
| `UNION_EYES` | Authoritative task | Scheduled and delivered by the contract |
| `CLIO` | **No task generated** (`CLIO_IS_TASK_OF_RECORD`) — no dual OPEN receipt task can exist | None |

Consequence to be stated plainly to Domenic: while the value is `UNRESOLVED` no alert is produced by this design. Receipt follow-up remains whatever WorkAid does today.

## One task per dispatched submission version

Key: `receipt-followup:{submissionId}:v{version}`. A replay, a retried "sent" event or two racing workers resolve to the existing task (`[WA-T037]`, `[WA-T038]`). Drafts, reviews and approvals create nothing (`[WA-T039]`). A new version gets its own task. The task carries submission, kind, matter, claim and owner so nothing is retyped; the deep link that would use it re-authorizes on open (not implemented here).

## Due dates (decision D-01)

| Configured rule | Result for a Friday 23:59 (Toronto) dispatch |
|---|---|
| none | No date. Task state `NEEDS_OWNER_CONFIRMATION`. **No default is fabricated** (`[WA-T042]`) |
| `NEXT_CALENDAR_DAY` | Saturday, with `fallsOnNonBusinessDay = true`, visible and editable |
| `NEXT_BUSINESS_DAY` | Monday (holidays skipped only if listed in the calendar) |

Dates are local calendar dates in the matter zone; no code adds 24 hours to an instant. Test `[WA-T043]` shows the naive `+24h` from 2026-03-07 23:30 EST skips the 8th; the contract returns 2026-03-08. The reminder fire time is 09:00 local converted per date (13:00Z on 2026-03-08, 14:00Z on 2026-11-01).

## Task lifecycle

`OPEN → SNOOZED_WITH_REASON → IN_PROGRESS`, `EXCEPTION_ESCALATED`, `CANCELLED_SUPERSEDED`, `CANCELLED_MATTER_CLOSED`, `RECEIPT_CONFIRMED`.

- Snooze needs a reason and records who/why; the original due date is preserved and overdue is judged on it (`[WA-T044]`).
- The **only** completion is `completeFromReceipt`, which requires a `RECEIPT_CONFIRMED` submission of the same id and version (`[WA-T041]`). An owner who cannot reach WSIB escalates (`EXCEPTION_ESCALATED`); there is no path that closes a task without receipt.
- Reassignment: principal only, increments `ownerEpoch`, keeps provenance (`[WA-T048]`).
- Closing the matter cancels its tasks and outstanding reminders (`[WA-ADV-18]`).

## Reminders

- Idempotent on `(task, ownerEpoch, offset)`.
- Recipient snapshot at schedule time. Because a snapshot goes stale on reassignment, **both** controls exist: `supersedeRemindersOnReassign` cancels the previous owner's pending reminders, and `decideDelivery` independently refuses a reminder whose epoch or recipient differs from the task (`[WA-ADV-11]`). This reconciles Grok's "snapshot, not live re-resolve" with the requirement not to notify a former assignee.
- Delivery re-checks authorization of the recipient for the matter at send time (`[WA-T047]`, `[WA-T100]`); matter closed, task closed, not yet due, or leased by another worker all skip.
- `claimForDelivery` is a lease: a second worker loses; after `DELIVERED_SINK` further claims are refused and a late duplicate outcome cannot regress the state (`[WA-ADV-10]`).
- Failure is `FAILED_RETRYABLE` then `DEAD_LETTER` after the configured attempts; both satisfy `isUndelivered` and must stay visible (`[WA-T045]`, `[WA-T046]`). A failed reminder never counts as notified.

## What is not covered (and needs the platform)

A durable outbox, real browser/push/e-mail delivery sinks, worker crash and restart (T059), and observed notification receipts. These require the deployed worker and are `BLOCKED_RUNTIME_OR_EXTERNAL`.

## External dependencies

Each dependency (WSIB claim file, ARF disposition, ARO decision, tribunal step) requires an owner. A configured window (for example 28–42 days for the partner-reported 4–6 weeks) produces `WAITING_WITHIN/PAST_EXPECTED_WINDOW` with `legalDeadline: false` always (`[WA-T031]`). File batches are recorded with page counts and notes; receipt of a batch never sets completeness, which is a professional judgement (`[WA-T032]`).
