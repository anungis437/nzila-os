# Union Eyes Deadline Engine — Programme Charter

**Status:** ACTIVE (Wave 1 Phase A landed; awaiting live staging proof)
**Staging proof harness:** RETIRED. `app/api/staging-proof/deadline-engine/scenario/route.ts` authenticates as before and answers HTTP 501. A session-less caller cannot seed the case the engine schedules reminders for under the hardened database roles (the system role holds no INSERT on `grievances`, the tenant role needs a session user with a membership, and a `SECURITY DEFINER` seeding function is refused by the catalog admission contract). The proof is unbuilt, not passed; a replacement seeds through the tenant path as an operator who holds a membership.
**Owner:** Aubert Nungisa (sole approver)
**Branch:** `fix/union-eyes-reality-remediation`
**Scope boundary:** `nzila-canada-staging-rg` only. Pilot and production resources are OUT OF SCOPE.

---

## 1. Mission

Ensure that **no** Union Eyes labour-relations deadline — grievance, case, appeal,
filing, response, hearing, meeting, disclosure, or other regulated obligation —
can silently:

- disappear
- fail to schedule
- fail to notify
- deliver twice
- deliver to the wrong recipient
- retain stale reminders after rescheduling
- use the wrong timezone
- be lost during restart
- be skipped because a worker was unavailable
- be falsely reported as successfully processed

Every reminder is a durable, auditable outbox row. Every transition is traceable.
Failure paths are visible and countable.

## 2. Non-Weakening Rule

**Wave 0 controls MUST NOT be weakened by any deadline-engine change.**

Explicit invariants preserved:

| Wave 0 capability                    | Preservation check                                                       |
| ------------------------------------ | ------------------------------------------------------------------------ |
| `UE-BUILD-OPERATIONAL-ISOLATION`     | Deadline engine imports nothing from `@nzila/union-eyes-demo`. |
| `UE-DEMO-SEPARATE-PACKAGE`           | No `UE_DEMO_*` env var is read or written by engine code. |
| `UE-CRON-*` HTTP 501 protocol        | New cron routes use `withApi({ auth: { cron: true } })` — no anonymous surface. |
| RLS tenant isolation                 | All engine queries filter by `organization_id`; RLS policy uses the coalesce-tolerant form (see `migrations/0045_union_eyes_deadline_engine.sql`). |
| Append-only audit                    | `deadline_reminder_executions` and `deadline_audit_events` reject UPDATE/DELETE via `ue_reject_mutation()` trigger. |

## 3. Capability IDs (registered in `apps/union-eyes/lib/reality/capability-registry.ts`)

All five register at `LIMITED` (PARTIALLY_IMPLEMENTED) until the D1 live staging
scenario passes; only then do they promote to `PROVEN_IN_STAGING`.

| ID                        | Title                                              | Phase A scope |
| ------------------------- | -------------------------------------------------- | ------------- |
| `UE-DEADLINE-CORE`        | Core outbox schema (tables, RLS, indexes)          | ✅ landed     |
| `UE-DEADLINE-REMINDERS`   | Reminder scheduler (recipient snapshot + cancel-and-insert) | ✅ landed |
| `UE-DEADLINE-DELIVERY`    | Worker + at-least-once delivery (lease/fence)      | ✅ landed     |
| `UE-DEADLINE-OVERDUE`     | Overdue detector cron                              | ✅ landed     |
| `UE-DEADLINE-RECOVERY`    | Lease recovery + append-only audit                 | ✅ landed     |

## 4. Phase Gates

### Phase A (this landing)
- Schema, scheduler, worker, email adapter, overdue detector, cron routes, unit tests.
- Grievance deadlines only (grievor + assigned officer recipients).
- Org-admin escalation deferred to Phase B (requires slug→org-uuid resolver).
- Claim deadlines (`db/schema/deadlines-schema.ts`) deferred to Phase B.

### Phase B (next wave)
- Claim-deadline path.
- Org-admin escalation ladder (repeated overdue → org admin group).
- Calendar-aware offset arithmetic (business days, local business hours).
- Alerting on `deadLettered > 0` in a run.

### Phase C (post-pilot)
- Cross-tenant queue prioritisation.
- Digest bundling (multiple reminders for one recipient → single email).
- Reply-tracking (reminder → auto-cancel on grievor response).

## 5. Definition of "Complete" (per user's non-stop bar)

A capability is **complete** only after:

1. Implementation compiles clean (`pnpm typecheck`).
2. Unit tests prove the state machine.
3. Migration applies cleanly.
4. Immutable image build succeeds (`az acr run`).
5. Authorized staging deploy (`az containerapp update` with new digest).
6. **Live execution proof**: real Resend delivery, DB shows `sent`, execution row present, audit event `reminder.sent` written.
7. **Failure-path proof**: at least one dead-letter transition observed with a real failure classification.
8. Evidence dossier committed under `reports/phase0/wave-1-phase-a/`.

## 6. Files

- Migration: [migrations/0045_union_eyes_deadline_engine.sql](../../../../migrations/0045_union_eyes_deadline_engine.sql)
- Schema: [apps/union-eyes/db/schema/deadline-engine-schema.ts](../../../../apps/union-eyes/db/schema/deadline-engine-schema.ts)
- Engine: [apps/union-eyes/lib/deadline-engine/](../../../../apps/union-eyes/lib/deadline-engine/)
- Cron routes:
  - [apps/union-eyes/app/api/cron/deadline-reminders/route.ts](../../../../apps/union-eyes/app/api/cron/deadline-reminders/route.ts)
  - [apps/union-eyes/app/api/cron/deadline-overdue/route.ts](../../../../apps/union-eyes/app/api/cron/deadline-overdue/route.ts)
- Wire-in: `apps/union-eyes/lib/deadline-tracking-system.ts` was deleted, since no production code called it; reminders are scheduled by `apps/union-eyes/lib/deadline-engine/assignment-sync.ts` and the `deadline-overdue` cron route above
- Registry: [apps/union-eyes/lib/reality/capability-registry.ts](../../../../apps/union-eyes/lib/reality/capability-registry.ts) (5 new IDs)

## 7. Calendar-day deadlines and the organization's time zone

Owner decision: a deadline set or calculated for a calendar DAY (a date picker, "N days after filing", an extension "to <date>", a
CBA step "within 10 days") falls due at **23:59 on that day in the union organization's local time zone**. The columns stay
`timestamp with time zone`; only the instant written changes. One module holds the rule, the province mapping and the default:
[apps/union-eyes/lib/deadline-engine/deadline-day.ts](../../../../apps/union-eyes/lib/deadline-engine/deadline-day.ts).

- **Zone source, in order:** `organizations.settings.timezone` when it names a known IANA zone (the administrator's setting,
  written through `PUT /api/settings/organization`); else the zone of `organizations.province_territory`, then of
  `organizations.address.province` (ON/QC → America/Toronto, BC → America/Vancouver, AB → America/Edmonton, MB →
  America/Winnipeg, SK → America/Regina, NS/NB/PE → America/Halifax, NL → America/St_Johns, YT → America/Whitehorse,
  NT → America/Yellowknife, NU → America/Iqaluit); else `DEFAULT_ORGANIZATION_TIME_ZONE` = **America/Toronto**. No database
  column holds the zone. Zone rules come from the runtime's IANA data (Node 24 ships tzdata 2026b, in which America/Vancouver
  stays on UTC-7 from November 2026).
- **Writers that take a calendar day:** `POST /api/deadlines` and `POST /api/deadlines/compliance` (`dueDate`,
  `originalDeadline`), `POST /api/arbitrations` and `PATCH /api/arbitrations/{id}` (`submissionDeadline`, `evidenceDeadline`,
  `replyDeadline`, `awardDeadline`), and the override in `POST /api/grievance-deadlines/{id}/confirmation`. A bare
  `YYYY-MM-DD` becomes 23:59 local; a datetime is an instant and is stored as sent.
- **Reminders:** `scheduled_for` is N calendar days before the due instant at the same local time in the organization's zone
  (23:59 for a calendar-day deadline), and `deadline_reminders.timezone` records that zone instead of `UTC`.
- **Overdue:** the overdue cron and `processOverdueDeadlines` compare the stored instant with `now()`, so a calendar-day deadline
  reads overdue once 23:59 local on its day has passed.
- **Existing rows** keep the instants they were stored with; nothing was backfilled.
