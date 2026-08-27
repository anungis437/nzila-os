# PR #673 — DORA Deployment Frequency Governance Disposition

**Status:** `DISPOSITIONED_NON_BLOCKING_FOR_PR_673`
**Record ID:** `DORA_DEPLOYMENT_FREQUENCY_DISPOSITION`
**Canonical PR SHA:** `53c5457ede36d0656b5769da35f19258ddbfe9cd`
**Final green mainline SHA:** `408d23847c3daca8f3dc7b52a2af2c31d58e4136`
**PR:** [#673 fix(union-eyes): reality remediation](https://github.com/anungis437/nzila-os/pull/673)
**Branch:** `fix/union-eyes-reality-remediation`
**Recorded:** 2026-08-25

---

## 1. Facts (from committed evidence at 96fb43f47)

Source: `ops/outputs/dora-metrics.json` (collected 2026-08-25T20:47:21Z, authoritative).

| Field | Value |
|---|---|
| 30-day merge count | `2` |
| Deployment frequency | `0.47 deploys/week` |
| Tier | `medium` |
| Policy minimum (CI env) | `>= 1 deploy/week` (`DORA_MIN_DEPLOYS_PER_WEEK=1`) |
| Change failure rate | `0%` (elite) |
| MTTR | `0 hours` (elite; vulnerability-remediation dashboard source) |
| Lead time for change | `null` (insufficient merge history) |
| Predictive signal | `elevated` (slope `-0.75/wk`, projected `0` next week) |
| Weekly deploy series (12wk) | `[0, 1, 6, 8, 44, 9, 11, 2, 0, 0, 0, 0]` |

## 2. Explicit non-conditions

- **No evidence defect.** B3 freshness is CLOSED; Azure Cost Management API authoritative; snapshot dated 2026-08-25.
- **No engineering defect.** All 92 non-DORA CI checks pass on the same SHA. All local engineering gates green.
- **No source regression.** R1B canonical semantics (CFO/Zonga `getProperties()`, ABR/Agrimo/Flow Blob-free) verified in-tree.
- **Artificial deployments to inflate the metric are expressly prohibited.**
- **Silent lowering of `DORA_MIN_DEPLOYS_PER_WEEK` is expressly prohibited.**

## 3. Institutional question

> Is deployment frequency intended to operate as a hard per-PR merge invariant for a long-lived convergence/remediation branch that has legitimately low merge cadence during structured tranche landing?

## 4. Valid outcomes (choose exactly one)

### 4A. `BLOCK_MERGE_UNTIL_METRIC_RECOVERS`

Interpretation: DORA deployment frequency is a hard invariant, even for convergence branches.

Effect:
- PR remains open.
- No artificial deployments performed.
- Await organic recovery (main-branch merge cadence must exceed the policy floor before this PR is remerged onto main).

### 4B. `ACKNOWLEDGE_OPERATIONAL_THRESHOLD_MISS_AND_ALLOW_MERGE`

Interpretation: DORA deployment frequency is an operational health signal, not a per-PR merge invariant. During a structured convergence tranche the metric truthfully reflects deliberately reduced merge cadence.

Effect:
- Approver records the acknowledgment (below).
- The merge-policy mechanism implementing this disposition must be re-run against the same SHA and yield a terminal green state before merge.
- Final classification transitions to `MERGE_READY`.

## 5. Approval block (fill on selection)

```
Selected outcome  : ACKNOWLEDGE_OPERATIONAL_THRESHOLD_MISS_AND_ALLOW_MERGE
Approver (GitHub) : Repository maintainers via PR #673 merge
Approval date     : 2026-08-27
Approval SHA base : 53c5457ede36d0656b5769da35f19258ddbfe9cd
Merge-policy re-run URL (if 4B): GitHub Actions on 408d23847c3daca8f3dc7b52a2af2c31d58e4136
Terminal same-SHA state (if 4B): CI/Governance/GA/GitOps/Release gates SUCCESS
```

## 6. Scope discipline

- This disposition covers **DORA deployment frequency only** for PR #673.
- The `pnpm ops:prove` 14-check documentation-corpus gaps are recorded separately as `FOLLOW_UP_DOCUMENTATION_DEBT` in [`reports/governance/pr-673-ops-prove-documentation-debt.md`](pr-673-ops-prove-documentation-debt.md) and are **not folded into this disposition**.
- No DORA engineering fix was performed; the metric remains an operational KPI.
- No artificial deployments were performed.
- No threshold, window, branch, or metric semantics were changed.
- Final same-SHA mainline gates are green at `408d23847c3daca8f3dc7b52a2af2c31d58e4136`.

## 7. Non-actions preserved

- Engineering source landed through PR #673 and follow-on convergence commits.
- This record is a governance disposition, not a source change authorization.
