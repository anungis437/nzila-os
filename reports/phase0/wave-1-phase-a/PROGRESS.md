# Wave 1 Phase A — Remediation Progress

Tracker for the correction plan issued after the invalidation of the original
Wave 1 Phase A evidence at commit `32de2ef67`. This file reflects **actual
verified state** on the branch — no future tense, no aspirations.

Last updated: 2026-07-21T20:50Z on branch `fix/union-eyes-reality-remediation`.

## Status line (source of truth)

> **Wave 1 Phase A IN_PROGRESS** — reminder worker and direct provider paths
> proven; deadline lifecycle, scheduling, overdue processing, retries,
> recovery, recipient resolution, and tenant isolation remain unproven
> end-to-end at the service boundary. Two lifecycle scenarios (schedule +
> reschedule + cancel-on-completed) have proof infrastructure ready but
> require an image rebuild + redeploy before execution.

## Landed commits on `fix/union-eyes-reality-remediation`

| Commit      | Category            | What it does                                                                                                                     |
| ----------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `3030b55e0` | Reality registry    | Reverts 5 caps from `PROVEN_IN_STAGING` (invalid state) to `LIMITED` with honest notes; adds 4 narrow proven-slice caps; supersedes evidence dossier with IN_PROGRESS banner without deleting original claims. |
| `df9283163` | Migration ledger    | Registers migration `0045_union_eyes_deadline_engine.sql` in the immutability manifest so drift is now detectable in CI.         |
| `bc89869e9` | Secret rotation     | Rotates cron secret and converts `cron-secret` and `resend-api-key` from inline container-app secrets to `keyvaultref` bindings via a new system-assigned managed identity. Proven live: old secret → HTTP 401, new secret → HTTP 200. Evidence records secret names, Key Vault version IDs, rotation timestamps, and authentication outcomes; no values or fingerprints are committed. |

Pending commits (in this working tree, to be added before push):
- Staging-proof scenario route + schema-drift verifier + this doc.

## The 20-item correction plan — real status

Legend: ✅ done · 🟢 ready-to-execute (code landed, one action from evidence)
· 🟡 partially done · 🔴 not started · ⚠️ blocked / needs human decision

### Track A — Reality registry & evidence hygiene

1. ✅ **Downgrade 5 over-promoted caps.** `apps/union-eyes/lib/reality/capability-registry.ts` (commit `3030b55e0`).
2. ✅ **Split proven slices into narrow caps.** `UE-DEADLINE-WORKER-CLAIM`, `UE-DEADLINE-EXECUTION-PERSISTENCE`, `UE-DEADLINE-PROVIDER-ACCEPTANCE`, `UE-DEADLINE-DIRECT-DEAD-LETTER`.
3. ✅ **Prepend SUPERSEDES banner to dossier without deleting original.** `reports/phase0/wave-1-phase-a/EVIDENCE-DOSSIER.md`.
4. ✅ **Sanitize evidence tree.** Grep sweep of `reports/phase0/wave-1-phase-a/` found no live secrets or secret fingerprints.

### Track B — Secrets & governance

5. ✅ **Rotate cron secret.** Evidence records the Key Vault secret identity and rotation outcome without secret-derived fingerprints.
6. ✅ **Bind container-app secrets to KV references** via system-assigned MI (principal `20d5f517-1f03-4ced-ae19-cfc32c4c2c13`, role `Key Vault Secrets User` on `nzila-staging-kv`).
7. ✅ **Prove rotation live.** Old value → HTTP 401, new → HTTP 200 on staging FQDN (revision `--kvrot-2607211642`).
8. 🔴⚠️ **Rotate Resend API key.** Blocked on human — requires Resend dashboard access. Instructions in [reports/phase0/wave-1-phase-a/RESEND-ROTATION-REQUEST.md](reports/phase0/wave-1-phase-a/RESEND-ROTATION-REQUEST.md).
9. ✅ **Register migration `0045` in immutability manifest** (commit `df9283163`). Checksum `406ae1eac346989275ee54c4a05cc4ad52491372a9b3ab41403ea776c70cecca`.

### Track C — Schema-drift protection

10. 🟢 **CI drift check.** `scripts/wave1a/verify-deadline-engine-schema.ts` validates: 3 tables, 40+ columns, 2 unique indexes, RLS on 3 tables, 3 policies, 3 triggers, manifest checksum. Runs against any `DATABASE_URL`. **Needs**: (a) wire into `.github/workflows/`, (b) execute against staging DB once and archive the JSON in `reports/phase0/wave-1-phase-a/`.

### Track D — Deadline lifecycle proofs (the hard part)

11. 🟡 **Scenario runner is being hardened**: the source route is not live and must use a dedicated proof secret, environment identity gate, signed replay-protected requests, server-generated synthetic data, durable audit records, and verified cleanup before it may be deployed. **Needs**: complete hardening and tests → image rebuild → deploy → set proof-only environment variables → execute 3 POSTs → archive redacted JSON → disable the route.
12. 🔴 **Overdue-transition scenario.** Not yet coded — requires a scenario that inserts a due-date-in-the-past deadline, invokes `/api/cron/deadline-overdue`, and asserts the state transition + `deadline.became_overdue` audit event.
13. 🔴 **Retry classification scenario.** Requires an email-adapter shim that can inject transient/permanent provider failures and a scenario that fires the worker with an override, asserting attempt count grows for transient and freezes for permanent.
14. 🔴 **Replay scenario.** Insert one reminder, run worker, then re-run worker with same lease — assert idempotent (no second provider call, executions table shows exactly one attempt).
15. 🔴 **Concurrent-claim scenario.** Spawn two worker invocations in parallel against the same reminder; assert exactly one wins the claim and the other observes 0 examined.
16. 🔴 **Lease recovery scenario.** Simulate worker crash by inserting an owned-and-abandoned lease past `lease_expires_at`; assert next worker run reclaims it.
17. 🔴 **Bounce / provider-webhook reconciliation.** Not yet coded — requires the webhook route to exist first (currently no bounce endpoint in `apps/union-eyes/app/api/webhooks/`).
18. 🔴 **TZ / DST scenario.** Compute reminders across a DST boundary (America/Toronto) and assert `scheduled_for` UTC values match the intended local-time semantics.
19. 🔴 **Tenant isolation via app identities.** Requires an `X-Tenant-Id` header + a route that sets `SET LOCAL app.current_org_id`; then scenario asserts a reminder inserted by tenant A is invisible to tenant B via the RLS policy. Cannot be proven with a bypass-RLS DB user.
20. 🔴 **Real scheduler wiring.** Prove that the union-eyes UI/API path that creates a `grievance_deadlines` row DOES invoke `scheduleGrievanceDeadlineReminders`. Currently only unit tests exist (`no-op-regression.test.ts`). Needs a scenario that hits the actual grievance-creation endpoint and asserts reminders appear.

### Track E — Container-image hygiene

21. 🔴⚠️ **Residual CVEs.** Trivy still flags 1 critical + 3 high in Debian `perl` package inside `node:20-slim` base. Options:
    - Swap base to `node:20-alpine` (needs runtime validation for native modules).
    - Swap to `node:22-slim` (may pull newer perl).
    - Purge perl during Dockerfile RUN.
    - Formal risk-acceptance request to Aubert with expiry.
    None of these has been executed on this branch yet.

## What "PROVEN_IN_STAGING" now requires (updated definition)

For any capability to move from `LIMITED` back to `PROVEN_IN_STAGING`, its
scenario MUST:

1. Run against the deployed container image (not a local Node process).
2. Go through the real service boundary (HTTP route → service function →
   DB), not raw INSERTs.
3. Persist an evidence JSON under `reports/phase0/wave-1-phase-a/` with:
   - correlation ID, container revision, image digest;
   - inputs (never secrets);
   - full assertion list with pass/fail;
   - timing.
4. Be reproducible by running the same POST payload against the staging
   FQDN and getting the same `passed: true`.

## Immediate next actions (in order)

1. Build & push `nzila-os-union-eyes` image containing the staging-proof
   route and `STAGING_PROOFS_ENABLED=true` in the staging container-app
   env vars.
2. Execute the 3 shipped scenarios; archive results as
   `reports/phase0/wave-1-phase-a/scenario-{schedule-basic|reschedule|cancel-on-completed}.json`.
3. Run `verify-deadline-engine-schema.ts` against staging DB; archive as
   `reports/phase0/wave-1-phase-a/schema-drift.json`.
4. Wire both into `.github/workflows/*` (fail branch protection on drift).
5. Rotate Resend key (human action).
6. Address residual CVEs (Track E).
7. Code scenarios 12-20 (Track D) — largest remaining slice.
