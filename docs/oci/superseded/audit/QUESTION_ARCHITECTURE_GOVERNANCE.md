# Question Architecture Governance™

ARTIFACT_TYPE: Question Architecture Audit™ — Part 13
DOCTRINE_VERSION: 1.1.0
AUDIT_VERSION: 1.0.0
SCOPE: Process governance for any change to the OCI / OCRA question pool, adaptive routing, or facilitation surface.

> **Posture.** Question changes are **methodology changes**. The lightweight PR-review cadence is insufficient; this document declares the seven-stage review process that every question change must pass.

---

## 1. Change classes

Borrowed from [METHODOLOGY_CHANGELOG.md](../methodology/METHODOLOGY_CHANGELOG.md):

| Class | Definition | Review depth |
|---|---|---|
| `editorial` | Wording polish; no semantic change. | One reviewer; tests must still pass. |
| `standard` | New question, new framework, modality rebalance, adaptive metadata population. | Full 7-stage review. |
| `breaking` | Change that invalidates prior assessment records; rename of a stable ID. | Full 7-stage review + cross-version migration plan + executive sign-off. |

---

## 2. The seven-stage review

Every `standard` or `breaking` change must complete the following stages **in order**:

### 2.1 Stage 1 — Methodology review

Reviewer: a maintainer who can trace the proposed change to a published doctrine document (whitepaper, modality doctrine, adaptive doctrine).

Checklist:
- Does the change reference an existing doctrine clause, or does it propose a new one?
- If new, has the doctrine document been updated in the same PR?
- Does the change preserve the eight anti-claims (see [QUESTION_ARCHITECTURE_PROCUREMENT_REVIEW.md](QUESTION_ARCHITECTURE_PROCUREMENT_REVIEW.md) §3)?

### 2.2 Stage 2 — Confidence-impact review

Reviewer: maintainer of `@nzila/oci-confidence`.

Checklist:
- Does the change affect any of `score`, `confidence`, `sampleSize`, `dataCompleteness`, `stability`, `cautionState`?
- If yes, is the new contribution declared in `questionIntelligenceMetadata`?
- Does [`confidenceGenerationCoverage.test.ts`](../../../../apps/union-eyes/lib/icra/__tests__/signal-integrity/confidenceGenerationCoverage.test.ts) still pass?
- Are dimension floors still met (≥ 5 questions per dimension feeding score, ≥ 1 likert per dimension)?

### 2.3 Stage 3 — Adaptive-routing review

Reviewer: maintainer of `questionRoutingEngine.ts`.

Checklist:
- Does the change add a new question? If yes, does it carry adaptive metadata?
- Does the change touch any `suppressedFor` / `requiredFor` / `recommendedFor` rule? If yes, is the rationale structural (not demographic-only)?
- Does [`adaptiveRouteDepth.test.ts`](../../../../apps/union-eyes/lib/icra/__tests__/signal-integrity/adaptiveRouteDepth.test.ts) still pass (Jaccard distance, median bank size)?
- Does the change preserve the safe-default floor (≥ 18 routed questions)?

### 2.4 Stage 4 — Evidence-sufficiency review

Reviewer: maintainer of `entropyAuditPacketBuilder.ts`.

Checklist:
- Is the new question facilitation-anchorable to ≥ 1 evidence artifact class?
- Does the change preserve `E-Reviewer-Unbounded = 0` across all emitted claims?
- Does the entropy audit packet schema accommodate the new input?
- Does the SHA-256 reproducibility hash remain stable under repeated identical inputs?

### 2.5 Stage 5 — Statistical-interpretation review

Reviewer: maintainer of `@nzila/oci-confidence` statistics module.

Checklist:
- Is the new question's statistical role explicitly declared (`S-Ordinal-Safe` / `S-Interval-Eligible` / `S-Categorical` / `S-Nominal`)?
- Does the change introduce any path where forbidden statistics could be emitted? (See [STATISTICAL_INTERPRETABILITY_AUDIT.md](STATISTICAL_INTERPRETABILITY_AUDIT.md) §2.)
- Does [`statisticalInterpretability.test.ts`](../../../../apps/union-eyes/lib/icra/__tests__/signal-integrity/statisticalInterpretability.test.ts) still pass?
- Are HHI / Gini emissions still bounded by sampleSize disclosure?

### 2.6 Stage 6 — Anti-surveillance review

Reviewer: unknown maintainer (mandatory; no exceptions).

Checklist:
- Does the prompt request personal identity?
- Does the prompt request information about a named individual?
- Does the prompt request psychological state?
- Does the prompt request private member data?
- Does the prompt invite free-text disclosure about specific people?
- Does the prompt embed evidence extraction (forbidden — evidence is facilitation-phase only)?
- Does [`antiGamificationInvariant.test.ts`](../../../../apps/union-eyes/lib/icra/__tests__/antiGamificationInvariant.test.ts) still pass?

Any "yes" answer to questions 1–6 **blocks** the change.

### 2.7 Stage 7 — Longitudinal-survivability review

Reviewer: unknown maintainer.

Checklist:
- Does the prompt anchor to a stable institutional property (not a transient event, tooling, role-holder, or program)?
- If `likert_5` confidence prompt: does it declare a stable anchor in `questionIntelligenceMetadata`?
- Does [`longitudinalSignalStability.test.ts`](../../../../apps/union-eyes/lib/icra/__tests__/signal-integrity/longitudinalSignalStability.test.ts) still pass?
- Does the change preserve `L-Transient = 0` across the bank?

---

## 3. Review artifact

Every Stage 1–7 reviewer records their decision in the PR. The PR description must include a **review block**:

```
methodology-review:    [pass|fail|n/a] — reviewer, reason
confidence-review:     [pass|fail|n/a] — reviewer, reason
routing-review:        [pass|fail|n/a] — reviewer, reason
evidence-review:       [pass|fail|n/a] — reviewer, reason
statistical-review:    [pass|fail|n/a] — reviewer, reason
anti-surveillance:     [pass|fail]     — reviewer, reason (n/a is forbidden)
longitudinal-review:   [pass|fail|n/a] — reviewer, reason
```

A `fail` at any stage blocks merge. `n/a` is acceptable at any stage **except** anti-surveillance (always required).

---

## 4. Change-class to stage mapping

| Change class | Required stages |
|---|---|
| `editorial` | Anti-surveillance only |
| `standard` | All 7 stages |
| `breaking` | All 7 stages + cross-version migration plan + executive sign-off |

---

## 5. Doctrine update obligation

If a change introduces a new pattern not covered by existing doctrine, the PR must update **all** of:
- the relevant doctrine document under `docs/oci/assessment/`,
- the [OCI Method™ Whitepaper](../methodology/OCI_METHOD_WHITEPAPER_v1.md) (append a new appendix entry if structural),
- the [METHODOLOGY_CHANGELOG.md](../methodology/METHODOLOGY_CHANGELOG.md) (declare `change_class` and `affected_artifacts`),
- this document if a new review stage is required.

---

## 6. Emergency hotfix protocol

A change that fixes a **safety issue** (privacy leak, surveillance-shaped prompt, evidence-leak path) may merge after Stages 1 and 6 alone, with the remaining stages completed within 72 hours post-merge. The PR must carry an `emergency: safety-fix` label.

No other emergency exemption exists.

---

## 7. Annual audit cadence

This Question Architecture Audit (Parts 1–11) is **re-run annually** at minimum. Triggers for an interim audit:
- a `breaking` change to the question pool,
- introduction of a new framework consuming the question pool,
- a confidence-model change that alters envelope semantics,
- procurement-driven defensibility review request,
- discovery of a doctrine breach in production.

Audit re-runs are versioned: `AUDIT_VERSION` advances; prior versions are preserved.
