# Union Eyes — you are here

This page describes the repository as of **SHA `0a2c9fa0b`** (`main`, 2026-08-31, post-Cluster-C /
post-ledger-rerun).
If you are about to change Union Eyes, read this page, then
[`reality-remediation/25_UE_SAAS_OPERATIONAL_READINESS_RERUN.md`](reality-remediation/25_UE_SAAS_OPERATIONAL_READINESS_RERUN.md)
(current gate ruling), then
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
real Entra auth, Azure Monitor telemetry, etc.) has not been executed — that work was never a
source-code problem and none of clusters A/B/C/D could have produced it. The next required step
is a focused **Phase 3A Runtime Acceptance workstream**, not further source remediation.

## 3. Capability registry

The single machine-readable source of truth for what each Union Eyes
capability actually does is
[`apps/union-eyes/lib/reality/capability-registry.ts`](../../apps/union-eyes/lib/reality/capability-registry.ts).

It is a **curated ledger of ~30 entries, not an inventory of all 43 nav
destinations or of every `/api/**` route.** The anti-theatre scanner's R-7
("route lacks a capability-registry entry") reports ~938 warnings — that is
expected backfill debt, not 938 broken features. Absence from the registry
means *unclassified*, not *`REAL`*.

Allowed capability states, and only these:
`REAL | LIMITED | DEGRADED | DISABLED | DEMO_ONLY | NOT_IMPLEMENTED | DEPRECATED | REMOVED`.
Never write `PROVEN_IN_STAGING`, `complete`, `green`, `ready`, or `delivered`
anywhere in this programme unless every listed proof is on file.

## 4. Open increment (in order)

1. Phase 3A Runtime Acceptance workstream — execute the `REQUIRED_BEFORE_SAAS_PASS` rows of
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
