# Union Eyes — you are here

This page describes the repository as of **SHA `026e10ba1`** (`main`, 2026-08-31, post-Cluster-D).
If you are about to change Union Eyes, read this page, then
[`reality-remediation/24_UE_SAAS_OPERATIONAL_READINESS_AUDIT.md`](reality-remediation/24_UE_SAAS_OPERATIONAL_READINESS_AUDIT.md),
then [`../../apps/union-eyes/lib/reality/capability-registry.ts`](../../apps/union-eyes/lib/reality/capability-registry.ts).

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

**`UE_SAAS_OPERATIONAL_READINESS` = `NO_GO`.**

That stamp is from
[`reality-remediation/24_UE_SAAS_OPERATIONAL_READINESS_AUDIT.md`](reality-remediation/24_UE_SAAS_OPERATIONAL_READINESS_AUDIT.md),
audited against `origin/main` SHA `cebe1d520aeb6d95e7a3e4cd70ddf071eff93428`
on 2026-08-31. It is **stale relative to `HEAD`**, not upgraded to `PASS`:

- Cluster A (#742, staff members directory) — merged.
- Cluster B (#743, `/api/deadlines/upcoming` empty-success fabrication) — merged.
- Cluster D (#744, nav vs. pilot-exclude mismatch) — merged.
- Cluster C (`maturity.json` blocker-text corrections) — not done as a numbered cluster; the
  specific corrections file 24 §8 identified are applied directly in this alignment pass
  (see `DIFF_NOTES.md`) plus `last_validated` bumped to the reconciliation date.
- The ledger itself has not yet been re-run against the post-A/B/C/D `main` SHA.

Do not read "A, B, C, and D merged" as "gate is PASS." The gate is **stale**, and stays `NO_GO`
until file 24 is re-authored against a `HEAD` that includes all four clusters — that rerun is
the next required step, and it may legitimately conclude `NO_GO — RUNTIME_PROOF_REQUIRED` even
with zero remaining source-code/document blockers, since several `REQUIRED_BEFORE_SAAS_PASS`
runtime proofs in file 24 do not close merely because source blockers close.

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

1. Cluster C — `maturity.json` blocker-text corrections (see file 24 §8) — applied in this pass.
2. Re-author `24_UE_SAAS_OPERATIONAL_READINESS_AUDIT.md` against `HEAD` now that A+B+C+D have landed.
   Recompute: canonical route matrix; anti-theatre scan; persona matrix; Sean continuity matrix;
   maturity state; runtime-proof queue; code blockers. Expected valid outcome even with zero
   remaining source blockers: `NO_GO — RUNTIME_PROOF_REQUIRED` if any file-24 runtime proof is
   still unproven — proceed into a focused Phase 3A Runtime Acceptance workstream in that case,
   not back into miscellaneous source remediation.
3. Staging Sean continuity path (assign → successor → deadline → reminder + audit + RLS) — see
   file 24 §6/§9 runtime-proof queue. This is code-proven in places, **not** proven against
   deployed staging infrastructure.
4. Only after the gate reads `PASS`: Phase 3B (recording environment, LIUNA fixtures, recording
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
- Current gate: [`reality-remediation/24_UE_SAAS_OPERATIONAL_READINESS_AUDIT.md`](reality-remediation/24_UE_SAAS_OPERATIONAL_READINESS_AUDIT.md)
- Findings register: [`reality-remediation/04_FINDINGS_AND_DISPOSITIONS.md`](reality-remediation/04_FINDINGS_AND_DISPOSITIONS.md)
- Anti-theatre baseline: [`reality-remediation/16_ANTI_THEATRE_BASELINE.md`](reality-remediation/16_ANTI_THEATRE_BASELINE.md)
- Capability registry: [`../../apps/union-eyes/lib/reality/capability-registry.ts`](../../apps/union-eyes/lib/reality/capability-registry.ts)
- Portfolio catalog entry: [`../../governance/portfolio/product-catalog.json`](../../governance/portfolio/product-catalog.json) (`id: "union-eyes"`)
- Maturity file: [`../../apps/union-eyes/maturity.json`](../../apps/union-eyes/maturity.json)
- Repo architecture: [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md)
- Agent operating rules: [`../../AGENTS.md`](../../AGENTS.md)
- Reality-remediation folder map: [`reality-remediation/`](reality-remediation/) (numbered ledgers 00–24;
  05/08/09/10/11/12/13/14 are stamped `STUB / NOT MAINTAINED`; 21/22 are archived under
  [`reality-remediation/archive/`](reality-remediation/archive/))
