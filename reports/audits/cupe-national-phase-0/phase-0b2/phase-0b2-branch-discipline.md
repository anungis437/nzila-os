# Phase 0B.2 — Branch Discipline

**Status:** ✅ Verified 2026-07-23.

Phase 0B.2 product-implementation work occurs on **one** branch only:

```
fix/union-eyes-phase0b-clean
```

Local worktree: `C:\APPS\nzila-automation-phase0b-clean`.
Branch base commit: `4d6f63511a1bde7f02408f5621a1ce9ca8a42245`
("Phase 0A.1: closure docs + phase ledger amendment (GREEN)").

## Historical branch role

The historical branch `fix/union-eyes-reality-remediation`
(HEAD `c83e55efc669365d0bf1dfa457f38847b47b806d`) is retained **as
audit evidence only**. No further product changes will land on it during
Phase 0B.2. It may receive only pointer/evidence updates that reference
the Phase 0B.2 outcome; no schema code, no resolver code, no migrations,
no application code will land there.

## Hard constraints (still active for Phase 0B.2)

- **No** cherry-pick of historical Phase 0B commits (`1e5a6bd94`,
  `511c9c1cb`, `7a1c90ab3`, `896a18e0c`, `c40a3e33a`, `c83e55efc`) onto
  the clean branch. Only selective **path-level** extraction of specific
  audit artefacts is permitted, tracked in
  [`phase-0b-clean-branch-provenance.md`](../phase-0b1/phase-0b-clean-branch-provenance.md).
- **No** force-push, working-branch reset, or history rewrite on either
  branch.
- **No** deletion of existing commits on `origin`.
- **No** import of the 255-file test-timeout sweep (`1e5a6bd94`); it
  belongs on a future dedicated branch
  `chore/test-infrastructure-stabilization`.
- **No** repo-wide vitest configuration changes, no ABR/CourtLens/Flow/
  Mobility/OpenAPI/governance sweeps.
- **No** deployment. **No** Phase 0C, 0D, 1. **No** CUPE scenario
  graduation. **No** loss of unrelated work.

## Verification (2026-07-23, immediately before Section 4)

```
$ git rev-parse --abbrev-ref HEAD
fix/union-eyes-phase0b-clean

$ git rev-parse HEAD
4d6f63511a1bde7f02408f5621a1ce9ca8a42245

$ git log --oneline -1 4d6f63511a1bde7f02408f5621a1ce9ca8a42245
4d6f63511 (HEAD -> fix/union-eyes-phase0b-clean) Phase 0A.1: closure docs
+ phase ledger amendment (GREEN)
```

Working tree at Section 3 checkpoint contains only staged Phase 0B.1
evidence extraction (22 files) plus the in-progress Phase 0B.2
architecture-approval edits described in
[`phase-0b2-architecture-approval.md`](phase-0b2-architecture-approval.md).

All subsequent Phase 0B.2 code (Sections 4–19) will be authored on this
branch only and pushed to `origin` under governed lefthook execution.
