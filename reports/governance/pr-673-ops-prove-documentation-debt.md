# PR #673 — `ops:prove` Documentation-Corpus Debt (Follow-Up)

**Status:** `FOLLOW_UP_DOCUMENTATION_DEBT`
**Recorded:** 2026-08-25
**Not blocking:** This validator (`pnpm ops:prove`) is **not** in the GitHub Actions gate set for PR #673. All 92 non-DORA CI checks pass on `96fb43f47`.

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

## Recommended follow-up

Open a separate issue titled *"Ops proving corpus: restore master index cross-refs and add phase-c-final-readiness-review.md"* with:

- Reproduction command: `pnpm ops:prove`
- Full 14-item failure list from the validator output
- Owner: Ops governance / documentation
- Priority: normal (not merge-blocking)
- Suggested SLA: independent from PR #673 merge

## Non-actions

- No product source modification.
- No fabrication of doc content to make the validator green.
- No suppression of the failing checks.
