# Governance Entropy Signal Gap Report

ARTIFACT_TYPE: Question Architecture Audit™ — Part 4
DOCTRINE_VERSION: 1.1.0
AUDIT_VERSION: 1.0.0
GROUND_TRUTH: [QUESTION_ARCHITECTURE_INVENTORY.md](./QUESTION_ARCHITECTURE_INVENTORY.md)
FRAMEWORK_UNDER_AUDIT: Governance Entropy Scale (GES) — [apps/union-eyes/lib/oci/frameworks/governance-entropy-scale.ts](../../../apps/union-eyes/lib/oci/frameworks/governance-entropy-scale.ts)

> **Audit question.** Can the GES be computed *honestly* from observable, evidence-supported, reviewer-bounded signals in the current question pool — or does it rest on reviewer interpretation that the question architecture cannot back?

---

## 1. GES ordinal coverage (1–5)

GES outputs an ordinal entropy classification on a 1–5 scale. For each ordinal, the audit asks: do the inputs *generate* this level, or does the level appear because the framework allows it?

| GES level | Signal it should carry | Inputs in bank | Sufficiency |
|---|---|---|---|
| **1 — Coherent** | Governance reasoning is consistently reconstructible across transitions and time | `gv_01`, `gv_02`, `ccs_02`, `gis_01`, `im_01`, `im_03`, `orl_02`, `ccs_03` | **Strong (8 signals, mixed modality)** |
| **2 — Drift-tolerant** | Some interpretive drift but governance can be reconstructed with effort | `gv_04`, `gis_01`, `orl_02`, `et_01`, `et_05` | **Moderate (5 signals)** |
| **3 — Interpretation-bound** | Governance reasoning depends on long-tenured interpretation | `gv_03`, `gis_01`, `et_01`, `et_02`, `scs_02` | **Moderate (5 signals — only 1 topology)** |
| **4 — Reconstruction-burdened** | Significant governance reasoning cannot be reconstructed without specific individuals | `gv_03`, `orl_01`, `et_02`, `tr_02`, `scs_03` | **Weak (5 signals, all maturity_select except scs_03)** |
| **5 — Entropic** | Governance reasoning is no longer reconstructible at scale; rule-of-person | inferrable only via `gv_03` + `et_02` + `orl_01` co-incidence | **Insufficient (no direct probe)** |

---

## 2. Findings

### Finding E-1 (Critical). GES level 5 has no direct probe.

The only path to ordinal 5 today is the **co-occurrence of risk-inverted maturity items**. This means:

- Any reviewer assigning a 5 must do so by **interpreting cumulative risk-inverted signal**, not by reading a single observable answer.
- Reviewer variance on a 5-classification is therefore likely (escalation rules in [confidenceEscalationRules.ts](../../../apps/union-eyes/lib/oci/audit/confidenceEscalationRules.ts) should flag this case → enforced in [`entropyCoverage.test.ts`](../../../apps/union-eyes/lib/icra/__tests__/signal-integrity/entropyCoverage.test.ts)).

**Disposition.** Add 2 GES level-5 probes in v1.2.0:
- One `multiple_choice` topology prompt with an explicit "no one in the institution can reconstruct this reasoning today" option.
- One `likert_5` confidence statement: *"Governance decisions made before the current leadership cohort can be reconstructed without consulting individuals."*

### Finding E-2 (High). GES level 4 has only 1 non-maturity probe.

Maturity-select dominance on level 4 means that reviewer escalation to 4 rests almost entirely on self-reported ladder position. Disposition: add 1 `multiple_choice` topology probe targeting reconstruction burden (overlaps with RBI input).

### Finding E-3 (Medium). Governance interpretation drift has only one direct probe (`gis_01`).

A single probe for a Tier-1 signal is below the **≥ 3 evidence-bearing questions per ordinal** invariant. Disposition: add a `likert_5` statement on interpretation survivability + a `multiple_choice` on how interpretive ambiguity is resolved.

### Finding E-4 (Medium). No prompt asks about the *boundary* between policy and practice.

The `gv_04` prompt asks how consistently practice follows policy. There is no prompt asking what happens at the *boundary* — where policy is silent and practice has filled in. This is where governance entropy actually accrues. Disposition: add 1 `maturity_select` D4 prompt on policy-silence pattern.

### Finding E-5 (Pass). GES levels 1–3 are sufficiently supported.

8 signals at level 1; 5 at level 2; 5 at level 3 — all above the 3-signal floor. Modality diversity at levels 1–3 is acceptable.

---

## 3. Reviewer-overdependent classifications

GES level decisions where a reviewer must interpret beyond what the question pool observably provides:

| Decision | Reviewer interpretation required | Bounded by |
|---|---|---|
| Level 4 ↔ 5 boundary | Yes — must integrate ≥ 3 risk-inverted signals | reviewerVarianceModel.ts |
| Level 3 ↔ 4 boundary | Partial — `gv_03` rating + `orl_01` corroboration | reviewerVarianceModel.ts |
| Level 1 ↔ 2 boundary | Low — `ccs_02` directly signals | confidence floor |

> **Doctrine note.** Reviewer dependence is **not a defect** — it is the human-in-the-loop posture. The audit's concern is that reviewer dependence be **bounded, audited, and reproducible**, not eliminated. The escalation packet (entropyAuditPacketBuilder) already captures inputs; the gap is that level-5 escalation does not yet require a *minimum input cardinality* (Gap: enforce ≥ 3 risk-inverted inputs before allowing a level-5 assignment).

---

## 4. Low-confidence entropy pathways

The following classification paths today produce `confidence < 0.6` per the confidence model:

- Level 4 with `sampleSize < 5` in dependency questions → confidence cautionary
- Level 5 with no `multiple_choice` corroboration → confidence cautionary
- Any GES level where `dataCompleteness < 0.7` on governance section → confidence cautionary

These are correctly flagged by the existing confidence engine. The audit does not introduce new pathways here.

---

## 5. Coverage matrix — observable evidence by ordinal

| Ordinal | Has ≥ 1 observable structural signal | Has ≥ 1 topology signal | Has ≥ 1 confidence signal | Meets floor (≥ 3 signals, ≥ 2 modalities) |
|---|:--:|:--:|:--:|:--:|
| 1 | ✅ | ❌ | ✅ | ✅ |
| 2 | ✅ | ❌ | ❌ | ✅ |
| 3 | ✅ | ✅ | ❌ | ✅ |
| 4 | ✅ | ✅ | ❌ | ⚠️ (modality-mono) |
| 5 | ❌ | ❌ | ❌ | ❌ |

---

## 6. Enforcement

[`entropyCoverage.test.ts`](../../../apps/union-eyes/lib/icra/__tests__/signal-integrity/entropyCoverage.test.ts) asserts:

- Every GES ordinal has ≥ 3 inputs.
- Every GES ordinal has ≥ 2 distinct modalities.
- GES level 5 has ≥ 1 `multiple_choice` direct probe (currently failing; resolves with v1.2.0).
- Reviewer escalation to level 5 requires ≥ 3 risk-inverted inputs (currently failing; tracked).

Failing assertions are deliberately retained as `MUST_EVENTUALLY_PASS` invariants so the gap is a permanent CI signal until closed.
