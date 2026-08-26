# Wave 1 Phase A — Current State Inventory

**Snapshot date:** at commit landing on `fix/union-eyes-reality-remediation`
**Purpose:** Document what existed *before* the deadline engine landed, so
future auditors can confirm the no-op was removed and every claimed
reminder produces an observable side effect.

---

## 1. Pre-existing "reminder" surface (removed / replaced)

### 1.1 `apps/union-eyes/lib/deadline-tracking-system.ts::scheduleReminders`

**Prior body (Wave 0 baseline):**
- Cancelled any existing reminders via `cancelDeadlineReminders(deadlineId)`.
- Logged `logger.warn('deadline-tracking: scheduleReminders is a no-op ...')`.
- Returned. **No reminder was ever created.**

Every call to `deadline-tracking-system.upsertDeadline` triggered this function.
Every "reminder scheduled" claim in downstream code was a lie.

**After Wave 1 Phase A:**
- Function delegates to `scheduleGrievanceDeadlineReminders(...)` from
  `@/lib/deadline-engine`.
- No-op warn string is gone (regression test asserts its absence — see
  `apps/union-eyes/lib/deadline-engine/__tests__/no-op-regression.test.ts`).
- Failure to schedule throws — no silent success.

### 1.2 Cron routes that returned HTTP 501 (Wave 0 remediation)

| Route                                                | Wave 0 behaviour                     | Wave 1 Phase A behaviour        |
| ---------------------------------------------------- | ------------------------------------ | ------------------------------- |
| `app/api/cron/deadline-reminders/route.ts`           | did not exist                        | **new — invokes worker**         |
| `app/api/cron/deadline-overdue/route.ts`             | did not exist                        | **new — invokes overdue scan**   |
| `app/api/cron/monthly-dues/route.ts`                 | 501                                  | unchanged (Wave 5)              |
| `app/api/cron/overdue-notifications/route.ts`        | 501                                  | unchanged (Wave 3)              |
| `app/api/cron/process-messages/route.ts`             | 501                                  | unchanged (Wave 4)              |
| `app/api/cron/process-notifications/route.ts`        | 501                                  | unchanged (Wave 4)               |
| `app/api/cron/scheduled-reports/route.ts`            | 501                                  | unchanged (Wave 8)               |

## 2. The 18-step flow now in place

```
[grievance created / rescheduled]
  → deadline-tracking-system.upsertDeadline
    → scheduleReminders(deadlineId, dueDate, offsets)
      → scheduleGrievanceDeadlineReminders    (deadline-engine)
        1. resolveGrievanceDeadlineRecipients (recipient snapshot)
        2. tx: cancel prior pending rows
        3. tx: insert one row per (recipient × offset)
        4. audit: reminder.cancelled_reschedule ×N
        5. audit: reminder.scheduled ×M
        6. audit: deadline.created | deadline.rescheduled (summary)

[cron: /api/cron/deadline-reminders]  (invoked every N minutes by ACA cron)
  → runDeadlineReminderWorker
    7.  recover expired leases → pending
    8.  audit: reminder.lease_recovered ×K
    9.  claim (FOR UPDATE SKIP LOCKED, max_batch=25, lease_ms=60000)
    10. audit: reminder.claimed ×batch
    11. per row: deliverDeadlineReminderEmail (Resend)
    12. on sent: tx insert execution + update status='sent'
    13. audit: reminder.sent
    14. on transient + attempts remaining: tx update status='pending'
    15. audit: reminder.failed_transient
    16. on permanent | out of attempts: tx update status='dead_letter'
    17. audit: reminder.dead_lettered
    18. return WorkerRunResult { runId, examined, claimed, sent, ..., deadLettered }

[cron: /api/cron/deadline-overdue]  (invoked hourly by ACA cron)
  → scan grievance_deadlines past due without in-flight overdue reminder
  → scheduleGrievanceDeadlineReminders(reminderKind='overdue', offsets=[0])
  → audit: overdue.detected per deadline
```

## 3. Recipient snapshot rules (Phase A)

Snapshot is captured at schedule time and **never re-resolved at delivery**.
This means:

- If a user is deactivated between scheduling and delivery, the reminder
  still fires (using the captured email).
- If the grievor changes email after scheduling, the reminder uses the old
  address. **Rescheduling** (a new call to `scheduleGrievanceDeadlineReminders`)
  is the only way to refresh the snapshot — this is intentional and matches
  the append-only audit posture.

### Included recipients

| Role                | Source                                                          |
| ------------------- | --------------------------------------------------------------- |
| `grievor`           | `grievances.grievantEmail` (captured at intake)                 |
| `assigned_officer`  | `users` row for `grievances.unionRepId` where `is_active=true`  |

### Skipped recipients (Phase B)

| Role                | Reason                                                          |
| ------------------- | --------------------------------------------------------------- |
| `org_admin`         | `organizationMembers.organizationId` stores slug, not uuid; escalation resolver deferred to Phase B. |
| Claim deadlines     | Requires wiring through `db/schema/deadlines-schema.ts` — Phase B. |

## 4. Body content (deliberately min-necessary)

The email body contains only:
- Deadline kind (e.g. "filing_deadline")
- Days-to-deadline (or "PAST DUE" if negative)
- Claim URL (deep link into the app)

It does **NOT** contain:
- Grievance title / description
- Member name
- Any PII beyond what the recipient submitted themselves
- Any secret or provider key

This is enforced by `email-adapter.test.ts` assertions and by
`AuditMetadataSchema` in `types.ts`.

## 5. Failure classifications

| HTTP / signal                          | Classification        |
| -------------------------------------- | --------------------- |
| 408, 409, 425, 429, 500, 502, 503, 504 | transient — retry     |
| ECONNRESET, ETIMEDOUT, EAI_AGAIN       | transient — retry     |
| any other 4xx (400, 401, 403, 404, …)  | permanent — dead-letter |
| `RESEND_API_KEY` missing               | disabled — dead-letter |

## 6. Known Phase-A gaps (tracked for Phase B)

1. Org-admin escalation ladder not implemented.
2. Claim deadlines (`db/schema/deadlines-schema.ts`) not covered.
3. Calendar-aware offset arithmetic (business hours, holidays) — currently
   simple millisecond math.
4. No alerting when a worker run produces `deadLettered > 0` (Phase B: wire
   into Sentry).
5. No digest bundling — a recipient with three reminders due in the same
   minute receives three separate emails.
6. `NEXT_PUBLIC_APP_URL` fallback is hard-coded to `https://unioneyes.app` —
   Phase B should read from validated env schema.
