# Union Eyes — you are here

This page was reconciled against `main` at **SHA `e4602d3d0`** (2026-09-23). It supersedes the
previous version of this page, which described the repository at SHA `0a2c9fa0b` (2026-08-31) and
presented that snapshot as current.
If you are about to change Union Eyes, read this page, then
[`reality-remediation/25_UE_SAAS_OPERATIONAL_READINESS_RERUN.md`](reality-remediation/25_UE_SAAS_OPERATIONAL_READINESS_RERUN.md)
(the last gate ruling), then
[`reality-remediation/26_UE_PHASE3A_RUNTIME_ACCEPTANCE.md`](reality-remediation/26_UE_PHASE3A_RUNTIME_ACCEPTANCE.md)
(the open Phase 3A evidence ledger), then
[`../../apps/union-eyes/lib/reality/capability-registry.ts`](../../apps/union-eyes/lib/reality/capability-registry.ts).

## 1. What Union Eyes is

Union Eyes is labour continuity and governance infrastructure for unions and
labour organizations — assignment/case continuity, deadline tracking,
audit-evidenced governance, and institutional-memory preservation across
representative and leadership transitions. It is **not** general intake-
management software and it is **not** sold as "the Nzila OS" — Union Eyes is
the current commercial spine's near-term-revenue lane; NzilaOS itself is
internal acceleration IP, not a directly sold product. See
[`../CIVIC_OCI_ALIGNMENT.md`](../CIVIC_OCI_ALIGNMENT.md) for the second
(cautious, public-institution) commercial lane.

## 2. Gate status

**`UE_SAAS_OPERATIONAL_READINESS` = `NO_GO — RUNTIME_PROOF_REQUIRED`.**

That stamp is from
[`reality-remediation/25_UE_SAAS_OPERATIONAL_READINESS_RERUN.md`](reality-remediation/25_UE_SAAS_OPERATIONAL_READINESS_RERUN.md),
re-audited against `origin/main` SHA `0a2c9fa0b` on 2026-08-31, superseding the original
[`24_UE_SAAS_OPERATIONAL_READINESS_AUDIT.md`](reality-remediation/24_UE_SAAS_OPERATIONAL_READINESS_AUDIT.md)
(audited SHA `cebe1d520`, left unmodified as historical record). This is **current**, not stale:

- Cluster A (#742, staff members directory) — merged, verified closed in the rerun.
- Cluster B (#743, `/api/deadlines/upcoming` empty-success fabrication) — merged, verified closed.
- Cluster D (#744, nav vs. pilot-exclude mismatch) — merged, verified closed.
- Cluster C (#746, `maturity.json` reconciliation) — merged, verified closed.
- The ledger has been re-run against this exact `main` SHA (file 25).

**The gate is still `NO_GO`, but for a different reason than before.** All four source-code /
document-truth defects file 24 found are now closed (the one exception — institutional-memory
nav wiring — was always a deliberate parked scope decision, not a bug). The gate stays `NO_GO`
purely because the runtime-proof queue (deployed staging RLS probes, concurrent-worker recovery,
real Entra auth, Azure Monitor telemetry, etc.) had not been executed — that work was never a
source-code problem and none of clusters A/B/C/D could have produced it.

## 2a. What changed between 2026-08-31 and this page's reconciliation SHA

`main` advanced 104 commits between `0a2c9fa0b` and `e4602d3d0`. This section records what that
work does and does not establish. It changes no gate outcome; it removes the false impression
that Phase 3A is unstarted work.

**Still current from the 2026-08-31 statement**

- The gate value itself: `UE_SAAS_OPERATIONAL_READINESS = NO_GO — RUNTIME_PROOF_REQUIRED`. It is
  reaffirmed verbatim in [`P4_AUTHORITY_ROLLOUT_REMEDIATION.md`](P4_AUTHORITY_ROLLOUT_REMEDIATION.md)
  (2026-09-12), which is the most recent document in this tree to state a gate value.
- File 25 remains the ruling of record; no file 29 rerun exists.
- The capability registry remains the machine-readable authority (§3), and the parked scope in §5
  is unchanged.
- Phase 3B remains not started, and must not start while the gate reads `NO_GO`.

**Superseded**

- "The next required step is a focused Phase 3A Runtime Acceptance workstream." Phase 3A was
  **opened** on 2026-09-01 and its evidence ledger is committed as
  [`reality-remediation/26_UE_PHASE3A_RUNTIME_ACCEPTANCE.md`](reality-remediation/26_UE_PHASE3A_RUNTIME_ACCEPTANCE.md)
  (merged in #751, pinned to source SHA `d4f0aa0d0`, status `IN PROGRESS`).
- "The runtime-proof queue has not been executed" is no longer wholly true: parts of it ran and
  produced results. File 26 records deployment/source parity `PASS` for the pinned acceptance
  baseline, health-probe reconciliation as `INVALID_PROBE_PATH / NOT_A_PRODUCT_DEFECT`,
  observability `PARTIAL`, canonical route health `PARTIAL` (2-route unauthenticated spot-check),
  worker concurrency `NOT_RUN`, and three gates `BLOCKED_EXTERNAL_ACCESS`.
- The implied reason for `NO_GO` ("nothing is wrong in source, only proof is missing") is
  superseded by file 26 §4, which found a real defect against deployed staging on 2026-09-01:
  `UE_RUNTIME_RLS_TENANT_ISOLATION = FAIL — DATABASE_RLS_FOUNDATION_NOT_ENFORCED` (the deployed
  app's DB role had `rolbypassrls = true`, and nine representative tables had RLS disabled with
  zero policies). File 26 states its own precision limit: this proves DB-level tenant isolation
  was absent/bypassed in staging, not that a cross-tenant exploit was demonstrated through the
  application.

**Later evidence that does exist in this repository**

- RLS foundation remediation merged as #752 (2026-09-11): dedicated `union_eyes_runtime` /
  `union_eyes_system` roles, [`../../apps/union-eyes/db/migrations/0108_rls_tenant_isolation_foundation.sql`](../../apps/union-eyes/db/migrations/0108_rls_tenant_isolation_foundation.sql),
  and [`../../apps/union-eyes/scripts/rls-verify.ts`](../../apps/union-eyes/scripts/rls-verify.ts)
  as a deployment-time preflight.
- Schema-lineage and privileged-caller findings: [`reality-remediation/27_RLS_STORAGE_SCHEMA_CANONICALIZATION.md`](reality-remediation/27_RLS_STORAGE_SCHEMA_CANONICALIZATION.md)
  (23 physical tables with duplicate/conflicting `pgTable` declarations) and
  [`reality-remediation/28_RLS_PRIVILEGED_CALLER_AND_ORG_CONTEXT_AUDIT.md`](reality-remediation/28_RLS_PRIVILEGED_CALLER_AND_ORG_CONTEXT_AUDIT.md)
  (61/61 privileged-context callers reviewed, plus a disclosed blind spot and its ratchet).
- Scoped-migration RLS closure through 2026-09-23 (`0009`–`0013`, external-representation
  authority, workbook credential/payment authority, fail-closed communications auth).
- P4 authority rollout: an authority-only workflow
  (`.github/workflows/union-eyes-authority-rollout.yml`) and a production preflight that ended
  `NO_GO`; baseline disposition `P4_READY_FOR_REVIEW`, explicitly not an authorization to roll out.

**Later operational evidence that is absent from this repository**

- No record that the post-#752 image was deployed to staging and no rerun of the file 26 gates
  against a new, identified image digest. File 26 states it "does not transfer evidence between
  unidentified image digests", so its `FAIL` and `BLOCKED` rows stand unretired in the record.
- No committed output of `rls-verify.ts` against any deployed environment.
- No authenticated 43-destination persona route matrix, no concurrent worker/lease proof, no
  successor-reminder delivery proof, no Entra offboarding proof, no OTEL/Azure Monitor trace data.
- The most recent committed live-capture artifacts under `reports/runtime/` are dated 2026-05.

**Readiness statement the repository can support today**

`UE_SAAS_OPERATIONAL_READINESS = NO_GO — RUNTIME_PROOF_REQUIRED`, unchanged, with the added,
unretired staging finding from file 26 §4. The repository contains no evidence that would
establish a newer disposition in either direction: the September source work is `IMPLEMENTED`
(and in CI, `TESTED`), not `DEPLOYED`, `RUNTIME-VERIFIED`, or `OPERATIONALLY PROVEN`. Do not read
the volume of September RLS commits as runtime proof, and do not read file 26 §4's `FAIL` as a
current statement about a redeployed environment — neither is established here.

## 3. Capability registry

The single machine-readable source of truth for what each Union Eyes
capability actually does is
[`apps/union-eyes/lib/reality/capability-registry.ts`](../../apps/union-eyes/lib/reality/capability-registry.ts).

It is a **curated ledger of ~30 entries, not an inventory of all 43 nav
destinations or of every `/api/**` route.** The anti-theatre scanner's R-7
("route lacks a capability-registry entry") reports ~938 warnings — that is
expected backfill debt, not 938 broken features. Absence from the registry
means *unclassified*, not *`REAL`\*.

Allowed capability states, and only these:
`REAL | LIMITED | DEGRADED | DISABLED | DEMO_ONLY | NOT_IMPLEMENTED | DEPRECATED | REMOVED`.
Never write `PROVEN_IN_STAGING`, `complete`, `green`, `ready`, or `delivered`
anywhere in this programme unless every listed proof is on file.

## 4. Open increment (in order)

0. Redeploy the post-remediation image to staging with an identified digest, run
   `rls-verify.ts` against it, and commit the result — file 26 §4's finding cannot be retired
   without it.
1. Continue the Phase 3A Runtime Acceptance ledger (file 26, still `IN PROGRESS`) — execute the
   remaining `REQUIRED_BEFORE_SAAS_PASS` rows of
   file 25 §6 against real deployed staging infrastructure (Canada Central Container Apps
   environment): live PostgreSQL RLS tenant-boundary probes, concurrent worker/lease recovery,
   real successor reminder delivery, real auth/session against deployed Entra, deployed route
   health for all 43 canonical nav destinations, and OTEL → Azure Monitor telemetry — each with
   a captured evidence artifact.
2. Re-run the ledger a third time against the post-runtime-acceptance `main` SHA before
   evaluating the gate again.
3. Only after that rerun reads `PASS`: Phase 3B (recording environment, LIUNA fixtures, recording
   identities, recording certification artifacts).

## 5. Explicitly parked (not this increment)

Native dues engine · bulk import · federation/cross-local rollup for executive/governance
roles · institutional-memory nav wiring (`/dashboard/institutional-memory` exists but is not in
any persona's canonical navigation) · the ~938-route capability-registry backfill · stub
programme waves 8–13 (see `reality-remediation/`) · CourtLens / Flow go-to-market motions (these
are portfolio inventory, not part of the current two-lane commercial spine — see
[`../CIVIC_OCI_ALIGNMENT.md`](../CIVIC_OCI_ALIGNMENT.md) and
[`../../governance/portfolio/README.md`](../../governance/portfolio/README.md)).

## 6. Links

- Programme charter: [`reality-remediation/00_PROGRAM_CHARTER.md`](reality-remediation/00_PROGRAM_CHARTER.md)
- Current gate: [`reality-remediation/25_UE_SAAS_OPERATIONAL_READINESS_RERUN.md`](reality-remediation/25_UE_SAAS_OPERATIONAL_READINESS_RERUN.md)
  (supersedes [`24_UE_SAAS_OPERATIONAL_READINESS_AUDIT.md`](reality-remediation/24_UE_SAAS_OPERATIONAL_READINESS_AUDIT.md),
  left unmodified as historical record)
- Findings register: [`reality-remediation/04_FINDINGS_AND_DISPOSITIONS.md`](reality-remediation/04_FINDINGS_AND_DISPOSITIONS.md)
- Anti-theatre baseline: [`reality-remediation/16_ANTI_THEATRE_BASELINE.md`](reality-remediation/16_ANTI_THEATRE_BASELINE.md)
- Capability registry: [`../../apps/union-eyes/lib/reality/capability-registry.ts`](../../apps/union-eyes/lib/reality/capability-registry.ts)
- Portfolio catalog entry: [`../../governance/portfolio/product-catalog.json`](../../governance/portfolio/product-catalog.json) (`id: "union-eyes"`)
- Maturity file: [`../../apps/union-eyes/maturity.json`](../../apps/union-eyes/maturity.json)
- Repo architecture: [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md)
- Agent operating rules: [`../../AGENTS.md`](../../AGENTS.md)
- Reality-remediation folder map: [`reality-remediation/`](reality-remediation/) (numbered ledgers 00–25;
  05/08/09/10/11/12/13/14 are stamped `STUB / NOT MAINTAINED`; 21/22 are archived under
  [`reality-remediation/archive/`](reality-remediation/archive/))
