# Synthetic Data Policy & Decision Framework

**Doc ID:** AI-SYN-2026-001
**Version:** 1.0
**Owner:** Data Lead + Privacy Lead
**Status:** ACTIVE
**Methodology source:** Info-Tech "Determine When You Should Use Synthetic Data"

## 1. What this is

Nzila uses synthetic data extensively in non-production environments
(`packages/staging-seed-*`). This policy formalizes WHEN synthetic data is
appropriate, what techniques are permitted, and what controls apply.

## 2. Permitted use cases (5 categories)

| # | Category | Nzila example |
|---|----------|--------------|
| 1 | **Privacy / security** — keep PII / PHI out of non-prod | All staging seeds for union-eyes, zonga, partners |
| 2 | **Scarcity** — generate data we lack | Edge-case load tests; rare-condition simulations |
| 3 | **Bias** — rebalance under-represented cohorts in eval sets | AI surface bias panels |
| 4 | **Simulation** — model rare or future scenarios | Disaster-recovery drills, fraud scenarios |
| 5 | **Cost** — when collecting real data is impractical | Local AI eval datasets |

## 3. Prohibited uses

- Substituting synthetic data for real data in **production** decisions about real people
- Generating synthetic data that includes recognizable personal characteristics of real individuals (re-identifiable composites)
- Generating training data for a Tier-1 AI surface without documented bias and provenance review
- Creating synthetic content to mislead users (deepfakes, impersonation) — see [ai-policy.md](ai-policy.md) §5

## 4. Decision framework (use this checklist)

For each proposed synthetic-data use:

- [ ] **Use case** — which of the 5 permitted categories applies?
- [ ] **Source** — is it generated rule-based, statistical, ML-based, or LLM-based?
- [ ] **Real-data input** — does generation start from real data? If yes, what is its tier?
- [ ] **Re-identification risk** — could records be linked back to real individuals? (k-anonymity ≥ 5 recommended)
- [ ] **Fidelity requirements** — what statistical properties must be preserved (distributions, correlations)?
- [ ] **Bias propagation** — could the generator reproduce bias from source data?
- [ ] **Validation** — how will we measure fidelity vs utility?
- [ ] **Storage tier** — synthetic data inherits the highest tier of any real-data input until validated as fully de-risked
- [ ] **Documentation** — recorded in `packages/<pkg>/SYNTHETIC.md` (or surface README)

If any answer is uncertain, escalate to AIGC.

## 5. Techniques sanctioned

| Technique | Use when | Caveats |
|-----------|----------|---------|
| **Rule-based** (faker, fixed lists) | Operational test data | Low fidelity; obvious to humans; fine for staging |
| **Statistical sampling** | Aggregate analytics test sets | Preserves marginals only |
| **Tabular GANs / VAEs** | Need joint distributions | Bias risk; validation required |
| **LLM-based** | Free-text scenarios | Hallucination risk; PII leakage risk; verify generator's training data provenance |
| **Differential-privacy synthesizers** | Highest-sensitivity replicas | Slower; complex tuning |

## 6. Validation

Before approving a synthetic dataset for use:

- **Utility:** does it support the downstream task (model training, load test, eval)?
- **Fidelity:** statistical similarity to real data measured (e.g., Kolmogorov-Smirnov, correlation matrix delta)
- **Privacy:** membership-inference resistance; k-anonymity on quasi-identifiers; absence of verbatim leakage from source
- **Bias:** distribution across protected attributes vs intended population

## 7. Existing Nzila practice — validation

`packages/staging-seed-*` is largely **rule-based + scenario-driven**
synthetic generation.

| Aspect | Status | Notes |
|--------|--------|------|
| Use case alignment | ✅ Privacy / Scarcity | Keeps real PII out of staging; provides volume for tests |
| Re-identification risk | ✅ Low | Generators do not consume production data |
| Documentation | ⚠️ Partial | Add `packages/staging-seed-*/SYNTHETIC.md` summarizing fidelity vs utility |
| Validation | ⚠️ Implicit | Add fidelity assertions in seed package tests |
| Bias | ⚠️ Unmeasured | Add cohort distribution check for surfaces that train evals on seeded data |

**Action:** raise tickets to add SYNTHETIC.md and validation assertions to
each `staging-seed-*` package.

## 8. Storage and retention

Synthetic datasets used for AI evaluation are versioned in source control
or referenced by hash from `evals/` directories. Discard generated PII-shaped
content from logs after the immediate test run; never persist beyond purpose.

## 9. Roles

- **Data Lead** — owns this policy
- **Surface / Package Owner** — implements per-surface
- **Privacy Lead** — reviews when generation source is real data
- **AIGC** — approves use for Tier-1 AI surfaces
