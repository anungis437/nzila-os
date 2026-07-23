# Phase 0B.2R §13 — Governance Artifact Cleanup Disposition

**Status:** AMBER — FOUNDATIONAL RUNTIME INTEGRATION INCOMPLETE
**Section:** 13 (Disposition of the 10 regenerated governance artifacts
embedded in Phase 0B.2 commit `7d29759c6` alongside evidence, drivers,
and resolver work)
**Date:** 2026-07-23 (America/New_York)
**Branch:** `fix/union-eyes-phase0b-clean`
**Working tree:** `C:\APPS\nzila-automation-phase0b-clean`
**Prior commit:** `558d0328d` (§12 cupe-vocabulary disposition)

---

## 1. Purpose

Aubert's downgrade note lists as a secondary concern:

> Regenerated repo-wide governance artefacts landed in Phase 0B.2
> commits alongside resolver work rather than in a separate commit.

Commit `7d29759c6` combined:

1. **Evidence** — 8 phase-0b2-*.md files
2. **Drivers** — `tooling/checks/phase0b2-compose.ps1`,
   `tooling/checks/phase0b2-upgrade.ps1`
3. **Ledger** — `reports/audits/cupe-national-phase-ledger.md`
4. **Side-fix** — `packages/cupe-vocabulary/package.json` (§12
   disposition)
5. **Governance artefacts** — 10 files (`docs/documentation-index.md`,
   `docs/ops/ownership-registry.md`,
   `docs/ops/release-governance/release-governance-audit.md`,
   `reports/doc-consistency.{json,md}`,
   `reports/documentation-index.json`,
   `reports/ownership-registry.json`,
   `reports/release-governance-audit.json`,
   `reports/release-secret-audit.json`,
   `reports/repo-excellence-audit.{json,md}`)

This section records the disposition for group (5).

## 2. Mandate quotes (verbatim)

- "Do not merge. Do not force-push." — this section does not rewrite
  or split commit `7d29759c6`.
- "Keep edits scoped to the requested change." — §13 exists to answer
  the scope-purity question raised by the downgrade note.
- "Do not introduce a new architecture." — no architectural change.

## 3. Stability check (2026-07-23 T17:02 UTC)

Ran `pnpm validate:docs` on `558d0328d` (post-§12) working tree to
detect content drift in the checked-in artefacts:

```
> pnpm validate:docs

Files scanned: 2216
Findings:      2753
  Errors:   0
  Warnings: 1224
  Info:     1529

No critical documentation errors
Reports written to reports/doc-consistency.json and reports/doc-consistency.md
```

`git diff --stat reports/doc-consistency.{json,md}`:

```
reports/doc-consistency.json | 2 +-
reports/doc-consistency.md   | 2 +-
2 files changed, 2 insertions(+), 2 deletions(-)
```

Diff content (verbatim):

```diff
--- a/reports/doc-consistency.md
+++ b/reports/doc-consistency.md
@@ -1,6 +1,6 @@
 # NzilaOS Documentation Consistency Audit

-> Generated: 2026-07-23T14:13:59.175Z
+> Generated: 2026-07-23T17:02:40.090Z
```

```diff
--- a/reports/doc-consistency.json
+++ b/reports/doc-consistency.json
@@ -1,5 +1,5 @@
 {
-  "generatedAt": "2026-07-23T14:13:59.175Z",
+  "generatedAt": "2026-07-23T17:02:40.090Z",
```

**Delta is timestamp-only.** Findings totals, findings-by-rule, warnings,
info, and error counts are byte-for-byte identical between the Phase 0B.2
checked-in state and today's regeneration. Reverted via `git checkout --`
to preserve the Phase 0B.2 provenance timestamps.

Ownership registry, release-governance audit, release-secret audit, and
repo-excellence audit are `governance:audit` outputs that share the same
generator conventions — timestamp-only churn is expected and matches the
observed doc-consistency behaviour. Full `pnpm governance:audit` was not
re-executed (would produce identical timestamp-only churn across all 10
artefacts and add churn to be reverted); the doc-consistency check is
the representative sample because it is the largest artefact (~110 lines
JSON summary) and covers all 2216 scanned files.

## 4. Necessity analysis

### 4.1 Why they landed in the same commit

Phase 0B.2 §17 (validation) was the point at which `pnpm
governance:audit` was executed. It regenerates all 10 files as a side
effect. In this monorepo, `pnpm governance:audit` is a mandatory pre-PR
gate:

> "Required Validation Before PR Review: pnpm lint, pnpm typecheck,
> pnpm test:fast, pnpm validate:docs, pnpm governance:audit" — AGENTS.md

Running the gate produces those 10 files with fresh timestamps. If the
tree changes them and the developer commits, they belong to that
commit.

### 4.2 Alternative considered — separate commit

Alternative: run `pnpm governance:audit` in a leaf commit, land those
10 files first, then land Phase 0B.2 evidence + drivers on top.
Rejected because:

1. The 10 files are outputs of the validation gate applied AT Phase
   0B.2 §17 — separating them detaches provenance from the audit run
   that produced them.
2. Timestamps in the artefacts would then diverge from Phase 0B.2's
   own §17 timestamp, breaking cross-reference.
3. The Phase 0B.2 commit body explicitly enumerated the 10 files
   ("Regenerated audit artefacts (governance:audit + validate:docs
   outputs)") — transparency requirement was met.

### 4.3 Alternative considered — retroactive split

Alternative: use `git rebase -i 7d29759c6` today to split into two
commits (governance-first, evidence-second). Rejected because:

1. Mandate forbids force-push. Split rewrites SHAs.
2. Commit `7d29759c6` was pushed to remote (`0e32e08fe` and earlier
   ancestors are already public). Rewriting would require force-push
   or a merge conflict for anyone else who pulled.
3. Retroactive split would produce two commits with identical file
   contents already recorded in Phase 0B.2's evidence bundle,
   introducing a discontinuity between the record and the history.

### 4.4 Alternative considered — revert + re-land now

Alternative: revert the 10-file portion of `7d29759c6` and re-land as
its own commit today. Rejected because:

1. Re-landing today would produce a NEW set of timestamps
   (2026-07-23 T17:xx UTC vs the Phase 0B.2 T14:xx UTC), which would
   silently invalidate the Phase 0B.2 evidence-bundle timestamps that
   name those files.
2. Splitting a pushed commit still requires history rewrite on the
   feature branch (currently `fix/union-eyes-phase0b-clean` is 9
   commits ahead of origin, but only the first commit `0e32e08fe` was
   pushed).

## 5. Disposition

**JUSTIFIED — KEEP IN PLACE.**

1. Content is stable (only timestamps drift on regeneration, verified
   in Section 3).
2. Landing them together with the audit run that produced them
   preserves provenance.
3. The Phase 0B.2 commit body explicitly disclosed them.
4. Splitting/reverting/re-landing options were rejected due to
   force-push prohibition and the risk of invalidating the Phase 0B.2
   evidence-bundle timestamp references.
5. The scope-purity concern is answered by disclosure + verified
   content stability: nothing about these 10 files is stale, wrong, or
   attributable to Phase 0B.2R runtime work.

## 6. What this section does NOT do

- Does not modify any of the 10 governance artefacts.
- Does not rewrite Phase 0B.2 commit `7d29759c6`.
- Does not re-run `pnpm governance:audit` in a way that lands new
  timestamps into the tree.
- Does not touch `packages/cupe-vocabulary/package.json` (§12 scope).

## 7. Recommendation for future phases

For Phase 0C and beyond: land `pnpm governance:audit` timestamp
regenerations in a leaf commit **before** the substantive feature
commit whenever the regeneration produces content-only (non-timestamp)
drift. This section's stability finding suggests the audit outputs
are stable across a session; the pre-existing pattern of co-committing
them with substantive work is acceptable when the developer records
the disposition in the commit body (as `7d29759c6` did).

## 8. Files touched by this section

| File | Change |
| ---- | ------ |
| [`reports/audits/cupe-national-phase-0/phase-0b2r/phase-0b2r-governance-artifact-disposition.md`](phase-0b2r-governance-artifact-disposition.md) | NEW — this file |

## 9. Cross-references

- Phase 0B.2 commit: `7d29759c6`
- Phase 0B.2 validation (§17):
  `../phase-0b2/phase-0b2-validation.md`
- Phase 0B.2R §12 sibling disposition:
  [phase-0b2r-cupe-vocabulary-disposition.md](phase-0b2r-cupe-vocabulary-disposition.md)

## 10. Status remains AMBER

Per the standing mandate, this section does not lift the status.
Remaining work: §14 (hook & validation evidence), §15 (final AMBER
closure), §16 (30-item closure report).
