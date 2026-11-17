# Union Eyes V2 base operational monitoring

Status: source implementation under qualification. No staging acceptance or production deployment is claimed by this document.

The base release needs continuous checks after a successful one-time journey. The deployment-owned `union-eyes-v2-base` profile requires an actual database/catalog check, a usable NAR signing key, the document container and the clamd-backed scanner. Optional legacy readiness flags cannot disable those requirements. An unknown declared profile refuses readiness. Third-party health is not inferred from configured credentials.

## Measurements

- Automatic backups: read the primary server's Azure backup metadata, require a completed automatic full backup within 26 hours, and reject future or malformed timestamps. This does not replace a retained-copy restore drill or prove WAL recovery usability.
- Core workers: read actual Container Apps executions for deadline reminders, overdue deadlines, observability alerts, the SLA watchdog, intake reaping and signature expiry. Require a completed successful execution within twice its declared cadence plus five minutes. A newer failure or run exceeding five minutes fails the check. Finance, Django and Redis are not added to satisfy unrelated legacy probes.
- Reminder queue: measure pending/failed reminders overdue for processing by 15 minutes, claimed rows with missing or expired leases, and dead letters from the preceding 24 hours. This rolling dead-letter measure does not close older operational incidents.
- Mail: read the provider receipt of a real persisted reminder. Refuse missing credentials/receipt, denied reads, mismatched identifiers, failure events and acceptance that has not settled within 15 minutes. Report provider acceptance and reported delivery separately. Neither is human inbox confirmation. The probe sends no email and emits no recipient or message content.
- Daily audit checkpoints: verify the canonical chain and declared immutable event fields, then append a keyed checkpoint per partition and UTC day to the existing canonical audit ledger. Use a deterministic primary key and the same partition lock as ordinary audit appends. Monitoring requires a valid checkpoint within 25 hours, including the SYSTEM-only platform partition. Corrupt/unsupported history, missing retained keys and bounded scan limits fail closed; history is never backfilled or rewritten. This is a checkpoint over retained history, not an external immutable anchor or a general guarantee against privileged deletion of the entire ledger.
- External detection: a separate Azure log alert evaluates the latest actual monitor result and a missing/stale heartbeat. It must detect loss of the monitor itself, rather than relying on a process to announce its own outage.

`POST /api/cron/daily-audit-seal` and `POST /api/cron/base-operations-monitor` use the existing cron authentication. The former checks hourly and creates at most one checkpoint per UTC day; the latter runs every five minutes. Their schedules and new metadata permissions are staging-only. Missing measurements return a failed job response, never an empty success. Existing no-organization canonical security/job audit events now use the dedicated SYSTEM connection and durable NULL-organization partition.

Azure metadata permissions are Reader at the primary server and each of the six existing core jobs. No subscription/resource-group Reader grant, database grant, RLS relaxation, row reset or migration replay is introduced. Shared-key document storage remains within its existing private endpoint configuration. Mail reads use the existing configured provider key; no provider permissions or account-wide webhook settings are changed.

## Qualification still required

All five repository checks, source CI, actual native role/concurrency/rollback tests, exact candidate build and retained-copy qualification precede rollout. The staging apply still requires a reviewed resource preview under CHG-2026-0114. After rollout, collect real scheduled runs, queue/provider measurements, fresh audit checkpoint verification, an external alert firing on loss of the owned monitor and its actual recovery. Preserve earlier failed attempts. No test header or injected success heartbeat may substitute for those observations.

Application source/image provenance and the separately qualified invitation email-check repair remain distinct. The original controlled invitation retry and saved first case are still pending recipient confirmation and independent durable readback. Other base persona, matching/load, document/export, expiry, deadline/inbox and lifecycle journeys also remain open. Full base STAGING GO remains held.

## Leadership data contract repair in this candidate

Review of the remaining action coverage found a concrete producer/consumer defect: the actual KPI aggregate emits employer trends `up`, `down` and `stable`, while the table indexed `increasing`, `decreasing` and `stable`. Rendering the actual producer output reproduced four crashes across English/French rising and falling variants; both stable variants rendered. Earlier page tests replaced the table with a double and therefore missed this seam.

The aggregate and table now share the public trend type without changing API values or metric calculations. The page rejects unknown trend values before rendering and provides localized error/retry presentation. A real producer-to-table test keeps both the aggregation and the table intact. This is source/component evidence; actual staged metric accuracy, data freshness, scope, role denials and permitted drill-down still require their own proof. No employer page is invented or advertised.
