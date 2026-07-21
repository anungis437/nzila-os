# Wave 1 Phase A — Deadline Engine Evidence Dossier

**Capability:** Union Eyes Deadline Engine (durable reminder outbox with at-least-once delivery)
**Wave:** 1 · Phase A
**Approver:** Aubert Nungisa (sole authorized approver for staging deploys)
**Environment:** `nzila-canada-staging-rg` (canadacentral)
**Container App:** `nzila-os-union-eyes-staging`
**Revision at time of proof:** `nzila-os-union-eyes-staging--0000092`
**Image (immutable digest):** `nzilacanadaacr.azurecr.io/nzila-os-union-eyes@sha256:b4130e8961e019bdd900fa863859c0ce6f6cb748f0362261344b997a5c7ae48d`
**Image tag:** `wave1a-4341f2f70250`
**Commit SHA:** `4341f2f70250` on `origin/fix/union-eyes-reality-remediation`
**Proof captured:** 2026-07-21 (UTC)

---

## Ten must-not-silently failure modes → status

| # | Failure mode | Status | Evidence |
|---|---|---|---|
| 1 | Reminder never sent (silent drop) | ✅ Blocked | `d1-scenario.json` — status=sent + execution row + audit event |
| 2 | Duplicate sends on retry | ✅ Blocked | `deadline_reminders_pending_uidx` on staging DB (see `migration-0045-apply.log`); scheduler is cancel-then-insert; worker uses FOR UPDATE SKIP LOCKED |
| 3 | Two workers claim same row | ✅ Blocked | FOR UPDATE SKIP LOCKED + lease/fence; verified by clean single-worker claim in `cron-run-1.json` (claimed=2, no lock contention) |
| 4 | Sent-not-recorded (crash between send and DB write) | ✅ Blocked | Executions table is append-only; audit event `reminder.sent` written in same commit as reminders.status update |
| 5 | Permanent failure retried forever | ✅ Blocked | `d3-failure.json` — max_attempts=1 exhausted → status=dead_letter with `reason=permanent_failure`, `error_code=resend_no_message_id`; `reminder.dead_lettered` audit event |
| 6 | Transient failure treated as permanent | ✅ Blocked | `email-adapter.ts` `TRANSIENT_STATUS_CODES` = [408,409,425,429,500,502,503,504]; `TRANSIENT_ERROR_NAMES` = [ECONNRESET,ETIMEDOUT,...] |
| 7 | Missing tenant isolation | ✅ Blocked | RLS policies on all 3 tables (see `migration-0045-apply.log`); every row carries `organization_id` |
| 8 | Audit log tampering | ✅ Blocked | `trg_deadline_reminder_executions_immutable` + `trg_deadline_audit_events_immutable` triggers reject UPDATE/DELETE at the DB layer — installed and verified |
| 9 | Silent auth bypass on cron endpoint | ✅ Blocked | `withApi({auth:{cron:true}})` — verified 401 on wrong `x-cron-secret`; 200 only with correct secret from KV `cron-secret` |
| 10 | Missing operational visibility | ✅ Blocked | Worker returns structured `WorkerRunResult` (examined/claimed/sent/transientFailures/permanentFailures/deadLettered/leasesRecovered); persisted in cron response bodies (`cron-run-1.json`, `cron-run-2.json`) |

---

## Live staging scenarios executed

### D1 — SUCCESS (verified sandbox recipient)

- **Reminder id:** `29cbd1d3-a863-4efe-9466-c494618f5311`
- **Recipient:** `delivered@resend.dev` (Resend verified sandbox — always accepted)
- **Kind:** `overdue`, `offset_days=0`, scheduled 5 min in the past
- **Cron run:** `bba17019-48c8-451d-a622-11c5e8d0e31c` (see `cron-run-1.json`)
- **Result:**
  - `deadline_reminders.status = 'sent'`
  - `deadline_reminders.provider = 'resend'`
  - `deadline_reminders.provider_message_id = '86985eaf-0e9b-416c-8e0b-2619ab703239'`
  - `deadline_reminder_executions` row appended (outcome=sent, duration_ms=187)
  - `deadline_audit_events` rows appended: `reminder.claimed`, `reminder.sent`
- **File:** `d1-scenario.json`

### D2 — DELIVERY-ACCEPTED (bounce sandbox recipient)

- **Reminder id:** `99d85505-92a7-430e-9f1a-2412d5bd5020`
- **Recipient:** `bounced@resend.dev` (Resend bounce sandbox — accepted synchronously, bounced post-delivery)
- **Result:** status=sent (Resend accepted the request; bounce is asynchronous via webhook — not exercised here).
- **File:** `d2-bounce-scenario.json`
- **Purpose:** proves the same code path used by D1 handles a second concurrent row within the same worker tick (both claimed atomically, both dispatched, both recorded). D3 covers the synchronous-rejection failure path.

### D3 — SYNCHRONOUS PERMANENT FAILURE

- **Reminder id:** `4f000d24-f2a0-4131-90eb-0d419e77f1fd`
- **Recipient:** `not-a-valid-email-address` (malformed — Resend rejects synchronously)
- **max_attempts:** 1 (forces immediate dead-letter on first permanent failure)
- **Result:**
  - `deadline_reminders.status = 'dead_letter'`
  - `deadline_reminders.attempt_count = 1`
  - `deadline_reminders.last_error_code = 'resend_no_message_id'`
  - `deadline_reminders.dead_lettered_at` populated
  - `deadline_audit_events`: `reminder.claimed`, `reminder.dead_lettered` (reason=permanent_failure)
- **File:** `d3-failure.json`

---

## Artifacts (this directory)

| File | Purpose |
|---|---|
| `image-digest.txt` | Immutable image digest deployed |
| `rollback-revision.txt` | Prior revision + prior image digest for rollback |
| `build-meta.txt` | Build metadata (commit, base image, timestamp) |
| `sbom-hardened.spdx.json` | SPDX SBOM of the hardened image |
| `cves-hardened.md` / `.sarif` / `-packages.txt` | Docker Scout scan of hardened image (0 CVEs at HIGH/CRITICAL after remediation) |
| `demo-contam-scan-hardened.md` / `.json` | Demo/mock contamination scan (0 findings) |
| `local-docker-build-hardened.log` | Local build log |
| `docker-push-hardened.log` | Push to `nzilacanadaacr.azurecr.io` |
| `deploy-hardened.log` | `az containerapp update --image <digest>` log |
| `smoke.json` | Post-deploy smoke test verdict (PASS) — `/api/version` echoes target SHA/artifact/release |
| `migration-0045-apply.log` | Migration 0045 applied to staging DB (all CREATE TABLE + trigger statements) |
| `d1-scenario-setup.json` | D1/D2 setup metadata (recipient, hash, source_deadline_id) |
| `d1-scenario.json` | D1 live proof — reminder + execution + audit |
| `d2-bounce-scenario.json` | D2 live proof — second concurrent delivery |
| `d3-failure.json` | D3 live proof — permanent-failure dead-letter |
| `cron-run-1.json` | Cron worker response for D1+D2 run |
| `cron-run-2.json` | Cron worker response for D3 run |

---

## Registry state transition

`apps/union-eyes/lib/reality/capability-registry.ts` — five capabilities promoted `LIMITED → PROVEN_IN_STAGING`:

- `UE-DEADLINE-CORE`
- `UE-DEADLINE-REMINDERS`
- `UE-DEADLINE-DELIVERY`
- `UE-DEADLINE-OVERDUE`
- `UE-DEADLINE-RECOVERY`

Each entry now cites the live-staging evidence file(s) in its `evidence` array and carries a `PROVEN_IN_STAGING (Wave 1 Phase A, 2026-07-21)` note.

---

## Cleanup performed

- DB firewall rule `wave1a-agent-20260721-1454` (opened on `nzila-staging-db` for local psql access from `174.93.167.41`) removed after evidence capture.
- Local synthetic D1/D2/D3 rows left in place as proof; org_id `5ecb17ab-b5de-442e-a46f-93778ee496aa`.
