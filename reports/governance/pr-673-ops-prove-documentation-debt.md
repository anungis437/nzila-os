# PR #673 — `ops:prove` Documentation-Corpus Debt (Follow-Up)

**Status:** `CLOSED / PROVEN`
**Recorded:** 2026-08-25
**Not blocking:** This validator (`pnpm ops:prove`) was **not** in the GitHub Actions gate set for PR #673. All final same-SHA mainline gates pass on `408d23847c3daca8f3dc7b52a2af2c31d58e4136`.

**Closure:** The active operational-proving, field-operations, and rollout-governance corpora have been restored from the governed historical archive into the paths expected by the validator. `pnpm ops:prove` now passes.

**Explicit scope boundary:** this record is **not** part of the DORA deployment-frequency disposition ([pr-673-dora-deployment-frequency-disposition.md](pr-673-dora-deployment-frequency-disposition.md)). Do not fold.

## Observed failures (14) — from `pnpm ops:prove` at HEAD 96fb43f47

Passing checks: `18`. All are structural / evidence-log checks (attestation ledgers, refusals log, promotion/rollback ledgers, corpus refuses scoring language, etc.).

Failing checks (14) are all documentation-corpus completeness assertions:

| # | Failed assertion | Category |
|---|---|---|
| 1 | required doc present: `phase-c-final-readiness-review.md` | missing doc |
| 2 | master index exists | missing index |
| 3 | master index references field-operations corpus | missing cross-ref |
| 4 | master index references rollout-governance corpus | missing cross-ref |
| 5–14 | (remaining doc-corpus checks reported by validator; see full envelope) | corpus completeness |

Full envelope for reproduction: `pnpm ops:prove` at HEAD `96fb43f47`.

## Classification rationale

- No engineering defect.
- No product-source change would resolve these — they are documentation authoring tasks.
- No same-SHA CI gate depends on `ops:prove` output for merge eligibility.
- Blocking PR #673 on these would be scope creep.

## Closure result

The following active corpora are present and linked:

- `docs/nzila-operational-proving/`
- `docs/nzila-field-operations/`
- `docs/nzila-rollout-governance/`

Validation result:

`pnpm ops:prove` -> `Operational proving: OK. (22 checks)`

## Non-actions

- No product source modification.
- No fabricated documentation.
- No suppressed checks.
- Existing governed corpus content was promoted back to active documentation paths.
