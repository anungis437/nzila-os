# Diff notes — `docs/ue-alignment-20260831`

Branch created from `main` @ `6bbbb7350bb1da2fe804bbb32b2d073f785d88a6`.
Full classification detail is in `docs/_alignment/INVENTORY.md`.

## What moved

- `docs/union-eyes/reality-remediation/21_WAVE_0_VALIDATION_MATRIX.md` →
  `docs/union-eyes/reality-remediation/archive/21_WAVE_0_VALIDATION_MATRIX.md`
  (via `git mv`). A 10-line redirect stub was left at the old path.
- `docs/union-eyes/reality-remediation/22_WAVE_0_SUMMARY.md` →
  `docs/union-eyes/reality-remediation/archive/22_WAVE_0_SUMMARY.md`
  (via `git mv`). A 10-line redirect stub was left at the old path.
- Both files were already self-marked `⚠️ SUPERSEDED` before the move; content was not edited,
  only relocated. `23_WAVE_0_CORRECTION.md`'s two links to them were updated to the new path.

Nothing else was moved. `reports/**` was left untouched (evidence stays under `reports/`).

## What was stub-stamped

`05_REMEDIATION_PLAN.md`, `08_OBSERVABILITY_AND_REALITY_ALERTS.md`,
`09_DATA_QUALITY_GATE.md`, `10_AUTH_AND_AUDIT_CONSOLIDATION.md`,
`11_REALITY_E2E_TESTS.md`, `12_VALIDATION_REPORT.md`,
`13_POST_REMEDIATION_RETROSPECTIVE.md`, `14_GLOSSARY_AND_REFERENCES.md` — each replaced with the
`STUB / NOT MAINTAINED` template pointing at the nearest real tracking artifact (mostly file 24's
§8/§9, or the relevant `maturity.json` gap). None were filled with generated optimism.

## What was created

- `docs/union-eyes/README.md` — the one "you are here" page this pass was asked to produce.
  States the gate (`NO_GO`, stale relative to `HEAD`), the open increment in order (Cluster D,
  Cluster C, re-author file 24, staging Sean path, then Phase 3B), and what's explicitly parked.
- `docs/union-eyes/reality-remediation/archive/README.md` — pointer table for the two archived
  files.
- `governance/portfolio/README.md` — states the catalog is inventory, not a GTM plan, and names
  the current two-lane commercial spine as the tie-breaker for any narrative conflict.
- `docs/_alignment/INVENTORY.md`, this file.

## What was corrected in place (no move)

- `docs/union-eyes/reality-remediation/00_PROGRAM_CHARTER.md` — status block: "Wave 1+
  NOT_STARTED" was false (Phase 2 / Phase 3A already happened); the wave table is now explicitly
  labelled analytic history, not the current sprint board, with a pointer to file 24 §9/§10.
- `apps/union-eyes/maturity.json` — three Cluster C corrections named in file 24 §8:
  `generated_from` no longer claims a generator that doesn't exist; `analytics_readiness`
  top-level promoted from `partial` to `closed` to match its own already-`closed` gap (no
  evidence found contradicting that closure); `access_reviews` blocker text corrected to state
  that CI enforcement *does* exist, and that the actual remaining gap is substantive Azure
  Entra-backed measurement. `contracts_complete` and `data_integrity` were left untouched, as
  instructed.
- `docs/union-eyes/pilot-evidence-pack/README.md` — added a status-note banner at the top; its
  `✅ CONTROLLED PILOT — GO` verdict (dated May 2026) predates and contradicts the current
  `NO_GO` gate. The rest of the pack (dated CI/Azure evidence) was left untouched.
- Root `README.md` — added a "Commercial spine" section naming the two active lanes (Union Eyes,
  CIVIC) and reworded the Domain Interfaces status column for CourtLens/Flow to
  "portfolio inventory, not current spine." No catalog data was changed.
- Root `ARCHITECTURE.md` — one paragraph added pointing to `docs/union-eyes/README.md` and
  clarifying NzilaOS is internal IP, not directly sold.
- Root `AGENTS.md` and `CLAUDE.md` — appended the same "Union Eyes — before you touch it"
  section (confirmed these are two separate files, not a symlink).

## What was refused / left alone

- Did **not** upgrade `UE_SAAS_OPERATIONAL_READINESS` to `PASS`. It is explicitly documented as
  stale-but-still-`NO_GO` in the new `docs/union-eyes/README.md`.
- Did **not** re-author `24_UE_SAAS_OPERATIONAL_READINESS_AUDIT.md` against `HEAD` — that's
  listed as open work, not done in this pass, per the brief's own instruction that Cluster D is
  still open and the ledger must be re-run only after all four clusters land.
- Did **not** flip `contracts_complete` or `data_integrity` to closed in `maturity.json`.
- Did **not** touch any dollar/revenue field in `governance/portfolio/product-catalog.json`.
- Did **not** renumber the duplicate `19_*`/`20_*` filenames in `reality-remediation/`
  (`19_AUTHORIZATION_VIOLATION.md` / `19_ROUTE_RECONCILIATION.md`, and similarly for `20_*`).
  Renumbering the whole ledger would touch every cross-reference in the folder for no
  truth-value gain — flagged in `INVENTORY.md`, not fixed.
- Did **not** archive `docs/union-eyes/runtime-convergence/**` or
  `docs/union-eyes/pilot-evidence-pack/**` wholesale — see "discovered, not fixed" below.
- Did **not** touch `docs/business-plan/**`, `docs/categories/**`, or any other doc outside
  `docs/union-eyes/` and the specific root files named in the brief — a full repo-wide docs
  audit is a larger, separate pass.

## Discovered, not fixed

- `docs/union-eyes/runtime-convergence/` contains 11 doctrine-style files with titles like
  `full-live-runtime-experience-certification.md` and `final-runtime-convergence-review.md`.
  These read as completion claims and were not independently re-verified against `HEAD` in this
  pass — worth a dedicated truth-audit later, same discipline as file 24 applied to the
  dashboard nav surface.
- `docs/union-eyes/reality-remediation/` has two pairs of duplicate section numbers (`19_*`,
  `20_*`) from an earlier authoring pass. Cosmetic, not touched.
- `apps/union-eyes/maturity.json`'s `contracts_complete` blocker text ("case-timeline and
  org-picker pending final auth assertion coverage") was flagged by file 24 §8 as
  `REQUIRES_REVALIDATION`, not confirmed accurate or inaccurate — left as-is per the audit's own
  instruction not to infer closure from partial signals.

## Verification performed before opening the PR

- `git grep` for the two moved filenames confirmed the only remaining references are the
  redirect stubs themselves, `23_WAVE_0_CORRECTION.md` (now pointing at `archive/`), the new
  `archive/README.md`, and `docs/documentation-index.md` (an auto-generated index — regenerated
  via `pnpm docs:index` as part of this pass rather than hand-edited).
- Confirmed `apps/union-eyes/maturity.json` remains valid JSON after edits.
- Confirmed no script under `scripts/**` or `tooling/**` reads the literal `generated_from` or
  `analytics_readiness` values from `maturity.json` in a way this pass's edits would break.
- This is a docs/JSON-metadata-only pass; no runtime source files were modified.

## Addendum (Cluster C reconciliation, rebased onto post-Cluster-D `main`)

This branch was originally cut from `main` @ `6bbbb7350` (post-Cluster-B, pre-Cluster-D). Both
commits were cherry-picked forward, unchanged, onto `main` @ `026e10ba1` (post-Cluster-D, PR #744
merged) to close out Cluster C as the last of the B → D → C remediation sequence. On top of the
cherry-picked commits:

- `apps/union-eyes/maturity.json`'s `last_validated` bumped from `2026-08-27` to `2026-08-31` to
  reflect this reconciliation pass. No other maturity fields were touched beyond what the
  original commit already applied — `contracts_complete`, `data_integrity`, and `observability`
  remain `false`/`partial`/`partial`, not optimistically closed.
- `docs/union-eyes/README.md` updated in place to reflect that Cluster D (#744) has since merged
  (was "open at time of writing" when this branch was first authored) and that this Cluster C
  pass is the last piece of source/document remediation before file 24 is re-authored against
  `HEAD`. This is an in-place correction of a still-open working document, not a rewrite of the
  audit ledger itself (file 24 remains untouched and will be re-authored as a separate, later
  pass per its own instruction).
- No other files from the original two commits were altered.
