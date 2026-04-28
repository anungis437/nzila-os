# Synthetic Data — `tooling/staging-seed`

**Owner:** Platform Lead
**Policy:** [`governance/ai/synthetic-data-policy.md`](../../governance/ai/synthetic-data-policy.md)

## 1. Purpose

This package generates synthetic data for non-production environments
(local dev + staging) so engineers and reviewers can interact with realistic
volumes and shapes WITHOUT exposing real production data.

It maps to the **Privacy / Security** and **Scarcity** categories of the
synthetic data decision framework.

## 2. Generation approach

- **Rule-based** (deterministic + faker-style randomness with fixed seeds where reproducibility matters)
- **Scenario-driven** profiles (e.g., demo-light → investor-showcase) with bounded record counts
- **No production data is consumed** as input — generators do not derive from real datasets, so no re-identification risk against real individuals
- **Scoped tenant**: synthetic content is written under a synthetic org id (e.g. `org-ue-staging-local-9999`) so it is isolated and easy to purge

## 3. Decision-framework checklist

| Question | Answer |
|----------|--------|
| Use case | Privacy/Security + Scarcity |
| Source | Rule-based with fixed seeds |
| Real-data input | None |
| Re-identification risk | None — generators never consume production data |
| Fidelity requirements | Sufficient for UI density, eval scaffolding, perf smoke tests |
| Bias propagation | Generator distributions documented per seeder; cohort distributions reviewed before use in AI evals |
| Validation | Seeder unit tests assert record counts and shape per profile |
| Storage tier | Treated as **Internal** (synthetic, but conservative default) |

## 4. What this is NOT for

- Substituting synthetic data for real data in production decisions about real people — **prohibited**
- Generating training data for any Tier-1 AI surface without a documented bias and provenance review (see [`governance/ai/synthetic-data-policy.md`](../../governance/ai/synthetic-data-policy.md) §3)
- Creating recognizable composites of real individuals — **prohibited**

## 5. Cohort & bias notes

When seeded data is used to populate AI eval datasets under
`tooling/ai-evals/datasets/`, the seeder author MUST:

- Document the cohort distribution actually produced (age / sex / language / jurisdiction proxies as applicable)
- Add or update a bias panel under `tooling/ai-evals/` so disparities are measurable
- Flag any oversampling / undersampling deliberately introduced

## 6. Lifecycle

- Seed runs are reproducible (fixed seeds where applicable)
- Synthetic content is purged when the synthetic org is rotated
- Logs about synthetic content carry no special protection (it is synthetic) but standards for log hygiene still apply (no secrets / no real PII proxies)

## 7. References

- Policy: [`governance/ai/synthetic-data-policy.md`](../../governance/ai/synthetic-data-policy.md)
- Data tiers: [`governance/privacy/policies/data-classification-standard.md`](../../governance/privacy/policies/data-classification-standard.md)
- Eval harness: [`tooling/ai-evals/`](../ai-evals/)
