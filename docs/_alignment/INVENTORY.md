# Documentation alignment inventory — 2026-08-31

Working ledger for the `docs/ue-alignment-20260831` pass. Branch created from
`main` @ `6bbbb7350bb1da2fe804bbb32b2d073f785d88a6` (2026-08-31 14:09:34 -0400).

This file stays on the branch after merge; it is a record of the pass, not a
living document.

## Legend

| Class | Meaning |
|---|---|
| CURRENT | Describes HEAD. Kept in place (or moved to canonical folder). |
| STALE_NARRATIVE | Once true; superseded by a later ledger. Archived or flagged. |
| STUB | Placeholder with no evidence. Kept at path, stamped STUB. |
| EVIDENCE | Run logs, scan JSON, SHA attestations. Never archived as "old opinion." |
| DUPLICATE | Same claim in two places that now disagree. Canonical + pointer. |
| WRONG_LOCATION | Real content in the wrong tree. Moved + redirect stub. |

## `docs/union-eyes/reality-remediation/`

| Path | Class | Last meaningful SHA | Why |
|---|---|---|---|
| `00_PROGRAM_CHARTER.md` | CURRENT | this pass | Status block updated in this pass: "Wave 1+ NOT_STARTED" was false (Phase 2/3A already happened); wave table marked as analytic history, not sprint board. |
| `01_BASELINE_AND_SCOPE.md` | CURRENT | not re-verified | Not touched this pass; in scope for a future re-read, not required for this alignment. |
| `02_CAPABILITY_REALITY_REGISTER.md` | CURRENT | not re-verified | Not touched this pass. |
| `03_THREAT_AND_IMPACT_MODEL.md` | CURRENT | not re-verified | Not touched this pass. |
| `04_FINDINGS_AND_DISPOSITIONS.md` | CURRENT | live 25-finding register | Not touched — explicitly protected as a current ledger. |
| `05_REMEDIATION_PLAN.md` | STUB | n/a | Stamped `STUB / NOT MAINTAINED` this pass — was a one-line placeholder. |
| `06_ANTI_THEATRE_CI_CHECKS.md` | CURRENT | not re-verified | Not touched this pass. |
| `07_DEPLOYMENT_GUARDS.md` | CURRENT | not re-verified | Not touched this pass. |
| `08_OBSERVABILITY_AND_REALITY_ALERTS.md` | STUB | n/a | Stamped this pass. |
| `09_DATA_QUALITY_GATE.md` | STUB | n/a | Stamped this pass. |
| `10_AUTH_AND_AUDIT_CONSOLIDATION.md` | STUB | n/a | Stamped this pass. |
| `11_REALITY_E2E_TESTS.md` | STUB | n/a | Stamped this pass. |
| `12_VALIDATION_REPORT.md` | STUB | n/a | Stamped this pass. |
| `13_POST_REMEDIATION_RETROSPECTIVE.md` | STUB | n/a | Stamped this pass. |
| `14_GLOSSARY_AND_REFERENCES.md` | STUB | n/a | Stamped this pass. |
| `15_REMEDIATION_BASELINE.md` | CURRENT | not re-verified | Not touched this pass. |
| `16_ANTI_THEATRE_BASELINE.md` | CURRENT | protected | Not touched — explicitly protected. |
| `17_VALIDATION_MATRIX.md` | CURRENT | not re-verified | Not touched this pass. |
| `18_STAGING_ATTESTATION.md` | EVIDENCE | n/a | Not touched — staging attestation. |
| `19_AUTHORIZATION_VIOLATION.md` | CURRENT | not re-verified | Not touched this pass. |
| `19_ROUTE_RECONCILIATION.md` | CURRENT | not re-verified | Duplicate numbering (`19_*` used twice) pre-exists; not renumbered in this pass — renumbering the whole ledger is out of scope and would break every existing cross-reference for no truth-value gain. Flagged here, not fixed. |
| `20_OPERATIONAL_BUILD_DEMO_SCAN.md` | CURRENT | not re-verified | Not touched this pass. |
| `20_SEMANTIC_ISOLATION.md` | CURRENT | not re-verified | Same duplicate-numbering note as `19_*` above. |
| `21_WAVE_0_VALIDATION_MATRIX.md` | STALE_NARRATIVE → ARCHIVED | `d9b32eaeb` | Already self-marked `⚠️ SUPERSEDED` pointing to `23_WAVE_0_CORRECTION.md`. Moved to `archive/` this pass; 10-line redirect stub left at old path. |
| `22_WAVE_0_SUMMARY.md` | STALE_NARRATIVE → ARCHIVED | `4c2fd5b4a` | Same as above. |
| `23_WAVE_0_CORRECTION.md` | CURRENT | protected | Not touched except updating its two links to `21_*`/`22_*` to point at the new `archive/` path. |
| `24_UE_SAAS_OPERATIONAL_READINESS_AUDIT.md` | CURRENT | protected, `cebe1d52` | Not touched — the live, stale-but-authoritative gate. Confirmed stale relative to `HEAD` in `docs/union-eyes/README.md` rather than silently upgraded. |
| `archive/README.md` (new) | CURRENT | this pass | New — pointer table for the two archived files. |
| `deadline-engine/00-charter.md`, `01-current-state-inventory.md` | CURRENT | not re-verified | Not touched this pass. |

## `docs/union-eyes/` (root level and other subfolders)

| Path | Class | Why |
|---|---|---|
| `README.md` (new) | CURRENT | New "you are here" page — did not exist before this pass. |
| `any-elimination.md` | CURRENT | Live typing-debt tracker with an enforced ESLint ratchet; not a readiness claim, left as-is. |
| `pilot-evidence-pack/README.md` | STALE_NARRATIVE (partial) | Its `✅ CONTROLLED PILOT — GO` verdict (dated 2026-05-14/2026-05-21) predates and contradicts the current `NO_GO` gate. Not archived — a status-note banner was added at the top instead, since most of the pack's *contents* (CI captures, Azure live-capture runbooks, restore-drill records) are genuine dated evidence, not opinion, and the folder is not in the pass's authorized target-shape list to relocate wholesale. |
| `pilot-evidence-pack/*` (all other files) | EVIDENCE | Dated CI/Azure capture artifacts. Not touched. |
| `qa/rbac-reality-map.md`, `qa/user-story-coverage-matrix.md` | CURRENT | Not touched this pass; not re-verified against `HEAD`. |
| `dr/restore-drill-runbook.md` | CURRENT | Not touched this pass. |
| `runtime-convergence/*` (11 files + README) | CURRENT (flagged) | Doctrine-style "final/full X convergence" documents. Not archived (workspace/doctrine content is explicitly protected from archiving, and these files link to a validator script that still exists: `tooling/scripts/validate-runtime-convergence.mjs`). Flagged in `DIFF_NOTES.md` as worth a dedicated truth-audit in a future pass — several titles ("full-live-runtime-experience-certification", "final-runtime-convergence-review") use language this pass's own north star would flag as overclaiming if their content doesn't match `HEAD`. Not independently re-verified in this pass — out of scope, discovered not fixed. |

## Root-level and governance docs

| Path | Class | Why |
|---|---|---|
| `README.md` | CURRENT (edited) | Added a "Commercial spine" section distinguishing the two active GTM lanes (Union Eyes, CIVIC) from portfolio inventory; reworded the Domain Interfaces status column for CourtLens/Flow from "sell-now" to "portfolio inventory, not current spine" without touching any catalog data. |
| `ARCHITECTURE.md` | CURRENT (edited) | Added one paragraph pointing to `docs/union-eyes/README.md` and clarifying NzilaOS is internal IP, not directly sold. No structural changes. |
| `AGENTS.md` | CURRENT (edited) | Appended a "Union Eyes — before you touch it" section per this pass's own instructions. |
| `CLAUDE.md` | CURRENT (edited) | Same appended section as `AGENTS.md` — confirmed this is a separate file, not a symlink, so both needed the edit. |
| `governance/portfolio/product-catalog.json` | CURRENT | Not edited — no dollar/commercial fields were touched, per instruction. |
| `governance/portfolio/README.md` (new) | CURRENT | New — states the catalog is inventory, not a GTM plan, and names the two-lane commercial spine as the tie-breaker for narrative conflicts. |
| `apps/union-eyes/maturity.json` | CURRENT (edited) | Cluster C corrections applied directly (see `24_UE_SAAS_OPERATIONAL_READINESS_AUDIT.md` §8): `generated_from` reworded to stop claiming a generator that doesn't exist; `analytics_readiness` top-level promoted from `partial` to `closed` to match its own gap's already-`closed` status (audit found no evidence contradicting the closure); `access_reviews` blocker text corrected (CI enforcement exists via `.github/workflows/access-review-gate.yml`; what's actually still open is substantive Azure Entra-backed measurement, not CI enforcement). `contracts_complete` and `data_integrity` were **not** flipped, per instruction. |
| `apps/union-eyes/lib/reality/capability-registry.ts` | CURRENT | Not touched — no path in `ownedBy`/`evidence` needed correction after the moves in this pass (only `docs/union-eyes/reality-remediation/21_*`/`22_*` moved, and neither is referenced from the registry). |
| `reports/phase0/**`, `reports/wave-0*` | EVIDENCE | Not touched. `reports/wave-0-build-isolation-proof.md` and its JSON siblings already carry their own superseded header pointing at `23_WAVE_0_CORRECTION.md`; left under `reports/` per the "evidence stays under reports/" rule, referenced (not duplicated) from the new `archive/README.md`. |
| `.github/ISSUE_TEMPLATE/` | N/A | Directory does not exist in this repo — nothing to align. |
| `.github/PULL_REQUEST_TEMPLATE.md` | CURRENT | Not touched this pass — not found to reference a stale week/wave. |

## Not walked in this pass (explicitly out of scope)

`docs/business-plan/**`, `docs/categories/**`, `docs/CIVIC_OCI_ALIGNMENT.md`, and the rest of
`docs/` outside `docs/union-eyes/` were used only as read-only cross-reference sources (to
confirm the CIVIC lane already has a documented thesis, and to confirm no literal file titled
"Aug 26 condensed plan" exists — `docs/CIVIC_OCI_ALIGNMENT.md` is dated 2026-08-26 per
`docs/documentation-index.md` and is the closest match). A full audit of the business-plan tree
is a separate, larger pass and is not attempted here — this pass only asserts that nothing in
`docs/union-eyes/`, the root README/ARCHITECTURE/AGENTS files, `product-catalog.json`, or
`maturity.json` contradicts the two-lane commercial reality stated in the pass's own brief.
