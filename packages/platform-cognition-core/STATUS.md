# Cognition Engine — Implementation Status

This document is the source of truth for what is **real**, what is **stubbed
intentionally**, and what is **deferred**. It is updated with every release
of this package.

## Phase 1 (this release — v0.1.0)

### Real and shipping

| Component | Status | Notes |
|---|---|---|
| Memory event store (file-backed JSON) | ✅ Real | Mirrors `platform-decision-engine` precedent. zod-validated on every read/write. |
| Recall ranking (recency × salience × tag-match) | ✅ Real | Exponential decay w/ configurable half-life. |
| Preference profile aggregation | ✅ Real | Sigmoid-bounded per-tag scores. |
| Soft redaction (`redactedAt` + reason) | ✅ Real | Recall silently excludes; audit reads still see envelope. |
| Hard purge for retention | ✅ Real | Separate explicit operation. |
| Trajectory feature extraction | ✅ Real | OLS frequency slope, mean inter-event gap, escalation/valence counts. |
| Trajectory scoring (5 kinds) | ✅ Real, **not trained** | Version-pinned logistic w/ hand-calibrated coefficients. See "Honesty about ML" below. |
| Per-feature contributions | ✅ Real | Every score returns signed contributions for the UI explain panel. |
| Confidence ∝ data sufficiency | ✅ Real | Linear ramp 0.1 → 1.0 over event-count 0 → 15. |
| State inference (6 dimensions) | ✅ Real, **not trained** | Bounded weighted-sum w/ version-pinned coefficients. |
| Consent policy + jurisdiction overlay | ✅ Real | CA / EU / US / AF / OTHER profiles. |
| Consent gate (sync + async, fail-closed) | ✅ Real | Producer exceptions surface as `allowed: false`, never reject. |
| Decision-engine adapter | ✅ Real | Maps risk scores to `OperationalSignal`s the existing pipeline already accepts. |
| Drizzle schema declaration | ✅ Real | Pure shape only — not bound to runtime store yet. |
| Test suite (memory, consent, trajectory, state, integration) | ✅ Real | ~50 assertions across the four engines plus the adapter. |
| `cognition:test` and `cognition:report` scripts | ✅ Real | Wired into root `package.json`. |
| Vitest workspace registration | ✅ Real | Added to root `vitest.config.ts`. |

### Honesty about ML

Phase-1 scoring is **calibrated, not trained**. We do not have labeled outcome
data (e.g. grievance escalation labels, customer churn labels) for the
Nzila-specific verticals yet. Shipping a "trained" model on synthetic labels
would be a fiction.

What we ship instead:

- Logistic models with **interpretable, version-pinned coefficients**
  (`churn-logistic-v1`, `escalation-logistic-v1`, etc.).
- **Bounded feature extractors** so a single extreme event cannot saturate
  the logit and contributions stay readable.
- **Per-feature contribution arrays** so every score is auditable end to end.
- A **`modelVersion` string** on every score record. When `@nzila/ml-core`
  promotes a trained model with the same feature contract, the kind's
  registry entry is updated and the version bumps. Call sites do not change.

### Stubbed intentionally (visible, not faked)

| Item | What's there | What's deferred |
|---|---|---|
| Drizzle migration SQL under `migrations/` | Schema declared in `src/schema.ts` | Migration SQL waits on DBA review of column types and index plan. |
| Persistent score history table | `cognitionRiskScores` schema | Runtime writes — Phase-1 scores are recomputed on demand from memory events. |
| Persistent consent policy table | `cognitionConsentPolicies` schema | Runtime — Phase-1 policies are passed in by callers. |

## Phase 2 (next)

In rough priority order:

1. Bind memory store to Postgres via `cognitionMemoryEvents` table; preserve
   the file-backed implementation behind a feature flag for local dev.
2. Persist consent policies; add API for subject-driven policy updates and
   renewal-tracking via `lastConfirmedAt`.
3. Persist score history; add drift monitoring (KS test on feature
   distributions vs. the calibration window).
4. Wire one trained model from `@nzila/ml-core` (likely escalation-risk for
   Union Eyes once labels exist) and validate the version-bump swap path.
5. Cross-product memory sync gated on `cross_product` consent zone.
6. Per-vertical adapters: FairCase (investigation timeline risk), Flow (quote
   conversion), Zonga (listener retention), Cora/Agrimo (yield trajectory),
   CareAI/Memora (routine drift).

## Phase 3 (research)

- Sequence transformers over event-type embeddings, replacing the
  hand-engineered sequence features. Only worth it once we have ≥10k labeled
  trajectories per kind.
- Bayesian belief tracking for state inference (priors per persona).
- Differential privacy noise on cross-tenant aggregates.

## Non-goals

- Foundation-model training. Nzila does not train base models.
- Generic "AI agent" framework — the existing `@nzila/platform-agent-workflows`
  and `@nzila/ai-core` packages own that surface.
- Rule engine for decisions — `@nzila/platform-decision-engine` already owns
  rule evaluation; cognition feeds it, never replaces it.
