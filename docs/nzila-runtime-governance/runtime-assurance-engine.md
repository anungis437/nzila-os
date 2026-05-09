# Runtime Assurance Engine

> **Status:** Canonical runtime governance · **Layer:** Runtime assurance computation · **Inherits:** [../nzila-assurance/institutional-trust-scoring-model.md](../nzila-assurance/institutional-trust-scoring-model.md), [../nzila-assurance/institutional-certification-framework.md](../nzila-assurance/institutional-certification-framework.md)

The **runtime assurance engine** is the layer that continuously computes interpretive posture reads across governance dimensions, from the live governance event stream and the standing assurance instruments. It is the runtime form of the [institutional trust scoring model](../nzila-assurance/institutional-trust-scoring-model.md).

The engine produces *reading aids*. It does not produce authority. It does not produce performance attribution. It does not produce coercive ranking.

---

## 1. Posture

The engine:

- **Computes** interpretive posture reads across governance dimensions
- **Aggregates** at scope at which individual resolution is impossible
- **Bands** outputs (`strong` / `established` / `forming` / `concern`) — never composite scores
- **Cites** the evidence supporting each band
- **Acknowledges** uncertainty — every read carries a confidence indication
- **Refuses** ranking, productivity attribution, behavioral inference

A runtime assurance engine that drifts toward authority becomes a coercive scoring system under stewardship language. This engine is built to refuse that drift.

---

## 2. Continuously Computed Postures

Per [trust scoring model](../nzila-assurance/institutional-trust-scoring-model.md):

- Governance legitimacy posture
- Continuity resilience posture
- Deployment legitimacy posture
- Executive cognitive safety posture
- Operational calmness posture
- Governance-safe AI posture
- Continuity-safe modernization posture

Each posture is a band per dimension, per scope (product / environment / pilot / org), with cited evidence and trajectory note.

---

## 3. Required Implementation Surfaces

Materialized in [packages/assurance-engine](../../packages/assurance-engine):

- **Assurance calculators** — pure functions taking evidence windows and returning bands
- **Interpretive scoring models** — encoded banding rules with explicit thresholds
- **Governance-safe aggregation logic** — aggregation that refuses individual resolution
- **Score explanation generators** — emit structured `why this band` records
- **Uncertainty-aware scoring** — bands carry `confidence` (`high` / `moderate` / `low`) bound to evidence completeness

---

## 4. Categorical Refusals

The engine categorically refuses:

- Composite collapse (one number across dimensions)
- Coercive interpretation (bands as performance evaluation)
- Behavioral optimization (engine outputs as throughput levers)
- Productivity ranking (cross-team or cross-individual)
- Cross-customer ranking
- Marketing surfaces of bands

These refusals are non-negotiable. Their breach makes the engine a doctrine violation.

---

## 5. Banding Discipline

| Band | Meaning |
|------|---------|
| `strong` | Sustained evidence at C3+ for the dimension's anchor class |
| `established` | Sustained evidence at C2 with credible trajectory to C3 |
| `forming` | Reviews and partial evidence in place; trajectory unclear |
| `concern` | Drift indicators present, doctrine violations on file, or evidence absence |

Bands are read from cited evidence in the [governance evidence ledger](governance-evidence-ledger.md). They are not assigned by impression.

---

## 6. Output Shape

```ts
interface AssurancePostureRead {
  readonly dimension: AssuranceDimension
  readonly scope: AssuranceScope
  readonly band: 'strong' | 'established' | 'forming' | 'concern'
  readonly confidence: 'high' | 'moderate' | 'low'
  readonly trajectory: 'improving' | 'stable' | 'drifting'
  readonly citedEvidence: readonly EvidenceReference[]
  readonly window: { from: string; to: string }
  readonly emittedAt: string
}
```

Output is structured. There are no free-form score strings. There is no composite total.

---

## 7. Cadence

- **Per governance event** — incremental updates where the event materially changes the read
- **Scheduled** — periodic recomputation per dimension scope
- **On-demand** — for standing readiness review and procurement engagements

Real-time per-individual scoring is not supported, by construction.

---

## 8. Trust Constraints

Assurance reads feed:

- Standing readiness review
- Procurement evidence packs (per stewardship discretion)
- Internal stewardship deliberation
- Long-horizon institutional engagements (board / partners)

Assurance reads do *not* feed:

- Performance evaluations
- Compensation
- Cross-team ranking
- Marketing surfaces
- Competitive collateral

---

## 9. Anti-Patterns

- Composite "Nzila trust score" surfaces
- Bands without cited evidence
- Aspirational banding (claiming `strong` when evidence supports `established`)
- Real-time individual or team-level reads
- Confidence inflation (`high` where evidence is partial)
- Marketing extraction of bands
- Recommendations that translate to human pressure

---

## 10. Discipline

The runtime assurance engine is the discipline by which Nzila reads itself honestly while running. Honest reads sustained over time are the substrate of external trust. Inflated reads are the substrate of eventual external collapse.

The engine is built so that the honest read is the easy read.
