# OCI / OCRA Benchmark Governance Review

> **Status:** Publication guard IMPLEMENTED (cohort floors, safe/unsafe claim
> catalogue, mandatory honesty clause as an executable gate); governance process
> (§8 sign-off, withdrawal) remains operational, not code.
> **Audience:** Statisticians, regulators, auditors, procurement evaluators
> **Existing assets:** `lib/oci/benchmark/`, `lib/oci/statistics/`, observatory
> ethics doctrine (`OCI_INTELLIGENCE_ETHICS.md`), k-anonymity K=5
> **Implementation:**
> [`lib/oci/benchmark/publicationGuard.ts`](../../../apps/union-eyes/lib/oci/benchmark/publicationGuard.ts)
> (`guardBenchmarkClaim` — suppress-by-default; enforces §3 cohort minimums, §4.2
> forbidden forms, §4.3 honesty clause). Tests:
> [`publicationGuard.test.ts`](../../../apps/union-eyes/lib/oci/benchmark/__tests__/publicationGuard.test.ts).

---

## 1. Why benchmark governance matters for government

Benchmarks are the most dangerous public-sector claim a methodology can make. "You
are below average for your sector" can become a headline, a budget weapon, or a
defamation exposure. A government-grade benchmark capability must be **honest about
what it cannot say** as much as what it can. This document defines the governance
rules that keep OCI/OCRA benchmarking defensible.

---

## 2. What already protects benchmark integrity (verified)

- **Comparability invariant:** identical 0–100 scale across all institutions; the
  scoring core never forks by sector (preserved by the
  [architecture decision](./GOVERNMENT_READINESS_ARCHITECTURE_DECISION.md)).
- **Characteristic, not normative baselines:** sector baselines describe typical
  ranges; they are explicitly **not** targets or grades (`lib/oci/benchmark/`).
- **k-anonymity K=5:** no aggregate is published unless ≥5 institutions
  contribute, preventing re-identification.
- **Opt-in + refusal-first:** institutions are never benchmarked without consent;
  the observatory can refuse to answer (`EthicsVerdict`).
- **No rankings, ever:** the observatory produces patterns, not league tables.
- **Coefficients flagged as practitioner-informed (v1.0.0), not empirically
  calibrated** (`coefficient-registry.yaml`) — an honesty asset, not a weakness.

These are strong. The government-readiness task is to **codify the publication
rules** that govern their use.

---

## 3. Minimum cohort sizes

| Benchmark claim | Minimum cohort | Rationale |
| --- | --- | --- |
| Any published aggregate | **K ≥ 5** | Existing k-anonymity floor; re-identification protection |
| Sector characteristic range | **N ≥ 20** | Below this, "typical range" is noise |
| Cross-sector comparison | **N ≥ 20 per sector** | Both sides must be stable |
| Sub-sector / regional cut | **N ≥ 20 and K ≥ 5** | Prevents thin-slice over-claiming |
| Time-trend statement | **≥ 3 periods, N ≥ 20 each** | One or two points is not a trend |

**Rule:** if a cut falls below threshold, the system **suppresses the number** and
reports "insufficient cohort to publish" — never a degraded estimate.

> **Now enforced in code.** `guardBenchmarkClaim` applies exactly these floors per
> claim kind (`published-aggregate` → K ≥ 5; `sector-characteristic-range` →
> N ≥ 20; `cross-sector-comparison` → N ≥ 20 *per sector*, ≥ 2 sectors;
> `subsector-regional-cut` → N ≥ 20 **and** K ≥ 5; `time-trend` → ≥ 3 periods,
> each N ≥ 20). Any shortfall yields `decision: 'suppress'` with itemised
> violations. `COHORT_MINIMUM` may be raised by callers but never lowered.

---

## 4. Publication thresholds (safe vs. unsafe claims)

### 4.1 Safe benchmark claims

- "Institutions of this profile **typically** fall in range X–Y on operational
  memory." (characteristic, ranged, cohort-backed)
- "Your transition-readiness posture is **less commonly evidenced** than peers of
  similar scale." (pattern, not rank)
- "Across this sector, succession documentation is **frequently** at VERBAL
  evidence level." (aggregate evidence pattern, K≥5)

### 4.2 Unsafe benchmark claims (forbidden)

- ❌ "You rank 14th of 30." (ranking)
- ❌ "You are below average." (normative grading on a characteristic baseline)
- ❌ "You are in the bottom quartile." (implied league table)
- ❌ "Your score predicts a 30% failure probability." (probability claim — the
  model makes none)
- ❌ Any cut below cohort/K thresholds.
- ❌ Naming or making any single institution identifiable.

### 4.3 The honesty clause

Every benchmark statement must carry its **cohort size, evidence basis, and the
caveat that baselines are characteristic, not normative.** A benchmark without its
limitations attached is an unsafe claim.

> **Now enforced in code.** A claim missing `honestyClauseAttached` is suppressed
> (`MISSING_HONESTY_CLAUSE`), and the forbidden forms in §4.2 (`ranking`,
> `normative-grade`, `probability-claim`) are rejected outright regardless of
> cohort size (`FORBIDDEN_CLAIM_FORM`). The guard reports *all* violations rather
> than short-circuiting, so a reviewer sees every reason a claim is held.

---

## 5. Cross-sector comparison rules

Cross-sector comparison is permitted **only** under these constraints:

1. **Same instrument, same scale.** Because the score never forks by sector, the
   0–100 composite is genuinely comparable. (This is precisely why the
   architecture decision rejected a government scoring overlay — an overlay would
   make cross-sector comparison invalid.)
2. **Context disclosed, not adjusted.** Sector context is reported alongside, not
   baked into the number.
3. **No value ordering of sectors.** "Healthcare typically evidences continuity
   more than associations" is descriptive; "healthcare is better than
   associations" is forbidden.
4. **Confidence-gated.** Comparisons inherit the lower confidence of the two
   cohorts.

---

## 6. Normalization rules

- **The composite is already normalized** (0–100, sector-independent). No
  post-hoc sector normalization is applied — doing so would reintroduce the
  benchmark fragmentation the architecture decision rejects.
- **Interpretation, not the number, is contextualized** via
  `contextualScoreNormalizer` (labels only). Benchmarks compare **numbers**;
  reports contextualize **interpretation.** These are kept strictly separate.
- **Evidence-level aggregates** (e.g., "% of cohort at DOCUMENTED or above") are a
  preferred benchmark primitive because they are robust and honest.

---

## 7. Stated limitations (must accompany every benchmark)

1. **Coefficients are practitioner-informed (v1.0.0), not empirically
   calibrated.** Baselines describe observed patterns in an opt-in, self-selected
   population.
2. **Opt-in selection bias.** The observatory population is not a random sample;
   it over-represents continuity-conscious institutions.
3. **Characteristic, not normative.** Ranges describe what is typical, not what is
   required or good.
4. **No predictive claim.** Benchmarks describe distribution, not future outcomes.
5. **Cohort-bounded.** Every statement is only as valid as its cohort size and
   recency.

---

## 8. Governance process for benchmark releases

- **Pre-publication ethics check.** Every benchmark artifact passes the
  refusal-first `EthicsVerdict` gate (K≥5, no re-identification, no ranking).
- **Versioned cohort definition.** Each benchmark records its cohort definition,
  N, K, and coefficient-registry version.
- **Reviewer sign-off.** A human reviewer attests the claim is within the safe set
  before release.
- **Right to withdraw.** Opt-in institutions can withdraw; affected aggregates are
  recomputed or suppressed.

---

## 9. Recommendations

| Recommendation | Type | Touches score? |
| --- | --- | --- |
| Codify cohort minimums (N≥20, K≥5) | Governance rule | No |
| Publish safe/unsafe claim catalogue | Governance rule | No |
| Mandate honesty clause on every claim | Reporting rule | No |
| Prefer evidence-level aggregates | Methodology preference | No |
| Keep characteristic (non-normative) baselines | Validate existing | No |
| Keep no-ranking, refusal-first observatory | Validate existing | No |

> The benchmark capability is already built on the right foundations: one
> universal scale, characteristic baselines, k-anonymity, no rankings. Government
> readiness is about **writing down the publication discipline** — cohort floors,
> the safe/unsafe claim catalogue, and a mandatory honesty clause — so that every
> benchmark OCI/OCRA publishes is one it can defend in front of an auditor.
