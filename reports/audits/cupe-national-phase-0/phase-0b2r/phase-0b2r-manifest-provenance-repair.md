# Phase 0B.2R — §3 Manifest Provenance Repair

**Status:** AMBER — FOUNDATIONAL RUNTIME INTEGRATION INCOMPLETE
**Scope:** Section 3 of the 15-section corrective phase (§1 classification + §2 gap analysis
already landed in commit `0e32e08fe`; §3 ownership review + §4 catalog proof landed in commit
`fd76ddb0d`; this document covers the §3 **manifest provenance repair** code work).
**Commit:** 3/6 of the Phase 0B.2R corrective series.

---

## 1. Problem statement

The Phase 0B.2 ownership manifest declared 125 rows across 8 ownership enum values, but the
underlying provenance was untrustworthy:

1. **125 rows classified with no reviewer / no evidence source / no method flag.** The
   validator (`tooling/checks/schema-ownership-validate.ts`) enforced structural invariants
   (enum membership, no duplicate qualified table, no `OWNERSHIP_UNRESOLVED`, etc.) but had
   **no signal at all** about which rows were human-reviewed vs machine-guessed.
2. **31 rows had both `platform_sources: []` and `django_sources: []`.** These rows came from
   `EXTRA_MANIFEST_ENTRIES` in `scripts/audit/build-phase0b2-ownership-manifest.py`, which
   short-circuited the source-file scan. A downstream reviewer could not see *why* these rows
   were classified the way they were.
3. **`audit_events` and `organization_members` were labelled `PLATFORM_OWNED_SHARED` with no
   real "shared" side.** `organization_members` has no platform DDL in
   `packages/db/drizzle/`; the Django adoption at `auth_core/0004` references a non-existent
   table. `audit_events` has no Django `db_table` binding in `apps/union-eyes/backend/`; the
   "shared" side is fictional. These are **open ownership blockers**, but the manifest
   presented them as resolved.

Aubert's mandate (verbatim, §3):

> Every foundational row must be human-reviewed with evidence sources; validator must HARD
> FAIL when this is not true.

## 2. Response — manifest v2 with provenance fields

### 2.1 New per-row fields

Every row in `packages/db/schema-ownership-manifest.json` now carries:

| Field | Type | Purpose |
| --- | --- | --- |
| `review_status` | enum | HUMAN_REVIEWED, RULE_DERIVED_REVIEWED, AUTO_CLASSIFIED_UNREVIEWED, OWNERSHIP_UNRESOLVED |
| `reviewed_by` | string | Reviewer name (required when `review_status ∈ {HUMAN_REVIEWED, RULE_DERIVED_REVIEWED}`) |
| `reviewed_at` | ISO date | Review timestamp (required for the same statuses) |
| `evidence_sources` | string[] | Files consulted during review (required unless `OWNERSHIP_UNRESOLVED`) |
| `classification_method` | enum | MANUAL, RULE_BASED, AUTOMATED_HEURISTIC |
| `open_blocker_reason` | string (optional) | Machine-readable reason a foundational row is unresolved |

### 2.2 New manifest-level fields

- `version: 2` (was implicitly 1)
- `provenance_repair` block: phase, repaired_at, generator, description
- `allowed_review_statuses[]` and `allowed_classification_methods[]` enum declarations
- `provenance_rules{}` — four boolean toggles the validator honours:
  - `foundational_rows_must_be_reviewed`
  - `auto_classified_unreviewed_foundational_is_hard_fail`
  - `extra_generator_rows_must_have_non_empty_source_arrays`
  - `human_reviewed_requires_reviewer_and_date`
- `deferred_review_register[]` (90 entries): non-foundational tables that are
  `AUTO_CLASSIFIED_UNREVIEWED`, each with a `reason` and a `target_phase` (Wave 1 or later).
- `counts.review_status{}` and `counts.deferred_review_count`

### 2.3 Distribution after enrichment

```
HUMAN_REVIEWED                14
RULE_DERIVED_REVIEWED         19
AUTO_CLASSIFIED_UNREVIEWED    92
OWNERSHIP_UNRESOLVED           0
deferred_review_register      90
open foundational blockers     2  (audit_events, organization_members)
```

## 3. Validator — rules 11–17 (Phase 0B.2R additions)

`tooling/checks/schema-ownership-validate.ts` has been rewritten to keep all original rules
1–10 **and** add seven Phase 0B.2R provenance rules. `validateManifest(manifest): string[]` is
now exported for direct unit testing.

| Rule | Description | Failure mode |
| --- | --- | --- |
| 11 | `review_status` must be present and in the allowed enum. | Missing or unknown value. |
| 12 | `classification_method` must be present and in the allowed enum. | Missing or unknown value. |
| 13 | `evidence_sources[]` must be non-empty unless `review_status == OWNERSHIP_UNRESOLVED`. | Empty array on a reviewed row. |
| 14 | `HUMAN_REVIEWED` and `RULE_DERIVED_REVIEWED` require non-empty `reviewed_by` and `reviewed_at`. | Missing reviewer or date. |
| 15 | **Foundational rows MUST NOT have `review_status ∈ {AUTO_CLASSIFIED_UNREVIEWED, OWNERSHIP_UNRESOLVED}`.** | Any foundational row not explicitly reviewed. This is the **GREEN closure gate**. |
| 16 | If a row's `platform_sources[]` and `django_sources[]` are both empty, `review_status` must be `OWNERSHIP_UNRESOLVED`. | Fixes the EXTRA-generator weakness — every declared ownership must cite at least one source file. |
| 17 | Non-foundational rows with `review_status == AUTO_CLASSIFIED_UNREVIEWED` must appear in `deferred_review_register[]`. | Prevents silent drift; every unreviewed row must have a scheduled review target. |

The validator remains **v1-compatible**: if `manifest.version < 2`, only rules 1–10 fire.

## 4. Enrichment script (`scripts/audit/enrich-phase0b2r-ownership-manifest.py`)

New script that takes the v1 manifest and produces the v2 manifest. Key features:

- **`FOUNDATIONAL_HUMAN_REVIEWED`** (11 rows): explicit per-row records of every foundational
  row that Aubert reviewed, each with `evidence_sources`, `platform_sources`, and
  `django_sources` populated from actual DDL files (`packages/db/drizzle/0038…sql`,
  `packages/db/drizzle/0039…sql`, `auth_core/migrations/0003…py`, etc.).
- **`FOUNDATIONAL_OPEN_BLOCKERS`** (2 rows): `audit_events` and `organization_members`, each
  carrying `open_blocker_reason` documenting the §4/§5 decision path.
- **`DJANGO_FRAMEWORK_SOURCES`** (10 tables): every `django.contrib.*` table now cites the
  framework migration path.
- **`PLATFORM_PILOT_ALERT_SOURCES`** (4 tables): pilot alert + health-score tables now cite
  the Drizzle pilot schema.
- **`UE_DEFAULT_DJANGO_SOURCE`**: every unreviewed UE table cites
  `apps/union-eyes/backend/ai_core/0001_initial.py` (the anchor migration) so no source array
  stays empty.
- **`SNDM_EVIDENCE`**: the two `SAME_NAME_DIFFERENT_MEANING` tables (`documents`, `votes`) get
  explicit evidence citations for both lineages.

CLI:
- `--dry-run` — print the tally without writing.
- `--check` — exit 2 if the manifest would change (drift detection).
- Default: enrich in place.

## 5. Generator idempotency

`scripts/audit/build-phase0b2-ownership-manifest.py` now imports the enrichment module via
`importlib.util.spec_from_file_location` and applies `enrich_manifest()` as its final step.
This means re-running the generator produces an already-enriched v2 manifest — the generator
and the enricher are idempotent with each other. `EXTRA_MANIFEST_ENTRIES` rows that used to
have empty source arrays are now backfilled by the enrichment logic during the generator's
final pass.

## 6. Validator tests (`tooling/checks/schema-ownership-validate.test.ts`)

18 tests across 8 describe blocks:

- **baseline** (1 test): valid minimal v2 manifest passes.
- **Rule 11 — review_status enum** (2 tests): missing / invalid value.
- **Rule 12 — classification_method enum** (2 tests): missing / invalid value.
- **Rule 13 — evidence_sources** (2 tests): empty array rejected; empty allowed for
  `OWNERSHIP_UNRESOLVED`.
- **Rule 14 — reviewer + date** (3 tests): empty `reviewed_by` rejected for `HUMAN_REVIEWED`;
  empty `reviewed_at` rejected for `RULE_DERIVED_REVIEWED`; `AUTO_CLASSIFIED_UNREVIEWED` does
  not require reviewer.
- **Rule 15 — foundational hard fail** (2 tests): foundational + `AUTO_CLASSIFIED_UNREVIEWED`
  fails; foundational + `HUMAN_REVIEWED` passes.
- **Rule 16 — source arrays** (2 tests): empty source arrays rejected; allowed for
  `OWNERSHIP_UNRESOLVED`.
- **Rule 17 — deferred_review_register** (2 tests): missing entry rejected; present entry
  passes.
- **v1 backward compat** (1 test): v1 manifests skip provenance rules entirely.
- **counts.review_status tally** (1 test): mismatched count rejected.

Test project registered at `tooling/checks/vitest.config.ts` and added to root
`vitest.config.ts` under the `tooling-checks` project name.

Run: `pnpm exec vitest run --project tooling-checks`

## 7. Current validator output (evidence)

Running `pnpm tsx tooling/checks/schema-ownership-validate.ts` against the enriched manifest
produces **exactly** 4 errors — 2 rules failing on each of the 2 open blockers:

```
Schema ownership manifest FAILED validation:
  ✗ table "audit_events": foundational row has review_status="AUTO_CLASSIFIED_UNREVIEWED"
    — hard fail. open_blocker_reason: PLATFORM_OWNED_SHARED but no Django db_table
    binding exists in apps/union-eyes/backend. The 'shared' side is fictional. Requires
    §5 outcome: either add explicit Django managed=False model with tests, or
    reclassify as PLATFORM_OWNED_EXCLUSIVE.
  ✗ table "audit_events": platform_sources[] and django_sources[] are both empty
    (EXTRA-generator weakness)
  ✗ table "organization_members": foundational row has
    review_status="AUTO_CLASSIFIED_UNREVIEWED" — hard fail. open_blocker_reason:
    PLATFORM_OWNED_SHARED but no platform DDL exists in packages/db/drizzle/. Django
    adoption at auth_core/0004 references a non-existent table. Requires §4 outcome:
    (A) add platform DDL, (B) move to union_eyes, or (C) LEGACY_DEPRECATE.
  ✗ table "organization_members": platform_sources[] and django_sources[] are both
    empty (EXTRA-generator weakness)

4 error(s).
```

Exit code: `1`.

This is the **intended** behaviour. The validator now blocks GREEN closure until §4 and §5
resolve the two open blockers with evidence-backed outcomes. The manifest state cannot be
smuggled through by a re-run of the generator: any re-run will land at the same 4 errors.

## 8. What §3 does NOT do

- Does not resolve `organization_members` (that is §4).
- Does not resolve `audit_events` (that is §5).
- Does not migrate any tables or run any DDL.
- Does not modify runtime behaviour of any application.
- Does not touch the resolver integration (that is §7).

## 9. Files landed in commit 3/6

| File | Change |
| --- | --- |
| `packages/db/schema-ownership-manifest.json` | Rewritten as v2 with provenance fields on all 125 rows + `deferred_review_register` (90) + `provenance_repair` block |
| `tooling/checks/schema-ownership-validate.ts` | Rewritten to add rules 11–17 and export `validateManifest()` |
| `tooling/checks/schema-ownership-validate.test.ts` | New — 18 tests covering rules 11–17 + v1 compat |
| `tooling/checks/vitest.config.ts` | New — registers the `tooling-checks` vitest project |
| `vitest.config.ts` | Added `tooling/checks` to the project list |
| `scripts/audit/enrich-phase0b2r-ownership-manifest.py` | New — enriches v1 manifest to v2 |
| `scripts/audit/build-phase0b2-ownership-manifest.py` | Now calls the enrichment module at the end of `main()` to keep the generator idempotent with the enricher; fixes `pilot_health_scores` source lookup |
| `reports/audits/cupe-national-phase-0/phase-0b2r/phase-0b2r-manifest-provenance-repair.md` | This document |

## 10. Next phase-0b2r sections (unblocked by §3)

- **§4** — Resolve `organization_members` (choose one of A/B/C with evidence).
- **§5** — Resolve `audit_events` (either add Django `managed=False` model with tests or
  reclassify as `PLATFORM_OWNED_EXCLUSIVE`).
- **§6** — Re-verify org cross-schema contract after §4/§5.
- **§7** — Runtime resolver integration (largest scope; at least one live PG test).
- **§8** — Reconcile org ID types.
- **§9** — KPI migration proof re-run.
- **§10 / §11** — Clean composition proof + existing-DB proof.
- **§12** — Commits 4/6, 5/6, 6/6.
- **§13 / §14 / §15** — Validation, AMBER-only closure, 30-item report + HARD-STOP.

**Status remains AMBER. `AMBER — FOUNDATIONAL RUNTIME INTEGRATION INCOMPLETE`.**
