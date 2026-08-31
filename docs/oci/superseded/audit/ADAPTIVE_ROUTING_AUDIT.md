# Adaptive Routing Sophistication Audit™

ARTIFACT_TYPE: Question Architecture Audit™ — Part 8
DOCTRINE_VERSION: 1.1.0
AUDIT_VERSION: 1.0.0
GROUND_TRUTH: [QUESTION_ARCHITECTURE_INVENTORY.md](QUESTION_ARCHITECTURE_INVENTORY.md)
ENGINE: [apps/union-eyes/lib/icra/adaptation/questionRoutingEngine.ts](../../../../apps/union-eyes/lib/icra/adaptation/questionRoutingEngine.ts)

> **Audit question.** Does adaptation **deepen** continuity interpretation for the institution being assessed, or does it merely **shorten the survey**?

---

## 1. Routing sophistication classification

| Class | Definition |
|---|---|
| **R-Cosmetic** | Routing changes presentation order or hides items based on demographic profile without altering the *interpretation* the assessment generates. |
| **R-Contextual** | Routing selects items that better fit institutional profile (e.g. federation vs. small union vocabulary) without changing methodological depth. |
| **R-Structural** | Routing **deepens** the assessment for the institution by selecting items that probe the structural realities most relevant to its profile (e.g. federation-coordination items for a federated org, modernization-pressure items for an org in active modernization). |
| **R-Methodological** | Routing changes the **methodological posture** itself (e.g. additional reviewer required, different confidence floor) for high-stakes profiles (mission-critical, public-trust). |

---

## 2. Current routing state

| Aspect | State |
|---|---|
| Engine | Implemented, deterministic, rationale-emitting |
| Per-question adaptive metadata | **None declared** |
| Effective behaviour | **Full bank returned to every respondent** (safe-default fallback) |
| Profile classification | Computed and persisted, but currently unused for selection |
| **Today's classification** | **R-Cosmetic** (the engine produces an audit trail; it does not yet deepen interpretation) |

**Finding R-1 (Critical).** Adaptive routing today is classified **R-Cosmetic** — it exists structurally and generates rationale, but no question carries the metadata required to enable contextual / structural / methodological routing. This was acknowledged in the inventory as Gap-R1.

---

## 3. Designed target distribution (v1.2.0)

| Class | Target share of routing decisions | Rationale |
|---|---:|---|
| R-Cosmetic | 0 % | Cosmetic routing has no methodological value |
| R-Contextual | 30 % | Vocabulary / framing tailoring is appropriate |
| R-Structural | 55 % | Most routing decisions should *deepen* the assessment |
| R-Methodological | 15 % | High-stakes profiles deserve methodological adjustment |

---

## 4. Per-rule sophistication review

The 8 eligibility rules in `questionEligibilityRules.ts`, classified:

| Rule | Class today | Class once metadata populated |
|---|---|---|
| `weight === 'core'` always include | R-Cosmetic | R-Cosmetic (correctly so — backbone) |
| `suppressedFor` match → defer | R-Cosmetic | **R-Contextual** |
| `complexity_floor` not met → defer | R-Cosmetic | **R-Contextual** |
| `complexity_ceiling` exceeded → defer | R-Cosmetic | **R-Contextual** |
| `requiredFor` match → include | R-Cosmetic | **R-Structural** |
| `recommendedFor` match → include | R-Cosmetic | **R-Structural** |
| `relevance` constraints → include if any match | R-Cosmetic | **R-Structural** |
| `usedConservativeDefault` → full bank | R-Cosmetic | R-Methodological (safety posture) |

**Finding R-2 (High).** The rule grammar is sufficient to support **R-Contextual** and **R-Structural** routing today. The only blocker is per-question metadata population.

---

## 5. Routing risks (when adaptive metadata is populated)

The audit identifies three categories of risk that v1.2.0 metadata authoring must avoid:

### Risk A — Demographic short-circuiting

Routing on `ctx_sector = healthcare` alone (without structural justification) would be R-Cosmetic at best and discriminatory at worst.

**Guardrail.** Every `suppressedFor` / `requiredFor` declaration must cite a **structural** justification, audited via [`adaptiveRouteDepth.test.ts`](../../../../apps/union-eyes/lib/icra/__tests__/signal-integrity/adaptiveRouteDepth.test.ts).

### Risk B — Survey-shortening posture

If routing reduces the question count to fit a UX target rather than to deepen the assessment, the system optimizes for completion rate at the expense of methodology.

**Guardrail.** Minimum routed count is bounded below at 18; the audit additionally requires that the *median* routed count across realistic profiles be **≥ 28** (≥ 52 % of bank). Enforced in `adaptiveRouteDepth.test.ts`.

### Risk C — Profile-class collapse

If `federated_complex` and `mid_sized` profiles produce indistinguishable question sets, the routing carries no structural signal.

**Guardrail.** Any two distinct profile classifications must produce question sets with **Jaccard distance ≥ 0.15** on the routed set. Enforced in `adaptiveRouteDepth.test.ts`.

---

## 6. Adaptive **depth** vs. adaptive **breadth**

The user-facing question is *"does adaptation deepen interpretation, or merely shorten the survey?"*

Answer (post-v1.2.0 target state):

- **Depth-routing** is the primary use of adaptive metadata: `requiredFor` + `recommendedFor` add items that probe the structural realities most relevant to the institution's profile.
- **Breadth-routing** (`suppressedFor`, `complexity_ceiling`) is the secondary use: it removes items that would be confusing or out-of-scope, but never below the methodological floor.

The bank is **not** designed to shorten the assessment. It is designed to **shape** the assessment toward the institution's continuity reality. The audit enforces this directional posture.

---

## 7. Enforcement

[`adaptiveRouteDepth.test.ts`](../../../../apps/union-eyes/lib/icra/__tests__/signal-integrity/adaptiveRouteDepth.test.ts) asserts:

- Median routed-bank size across the realistic profile matrix ≥ 28 questions.
- Jaccard distance between any two distinct profile classifications ≥ 0.15 (currently failing because all profiles return full bank; tracked).
- Every `suppressedFor` / `requiredFor` declaration carries a `rationale` field referencing a structural property.
- No routing rule references demographic fields (`ctx_sector`, `ctx_org_type`, `ctx_membership_size`) without a structural co-criterion.
- `weight === 'core'` items are always included (backbone invariant).
