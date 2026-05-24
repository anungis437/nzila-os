# Longitudinal Survivability Audit™

ARTIFACT_TYPE: Question Architecture Audit™ — Part 6
DOCTRINE_VERSION: 1.1.0
AUDIT_VERSION: 1.0.0
GROUND_TRUTH: [QUESTION_ARCHITECTURE_INVENTORY.md](./QUESTION_ARCHITECTURE_INVENTORY.md)

> **Audit question.** Will today's answers still mean the same thing in 24 / 36 / 60 months, or are they tied to transient state (current tooling, current incumbents, current events) that would silently invalidate trend interpretation?

---

## 1. Survivability classification

| Class | Definition |
|---|---|
| **L-Stable** | Prompt asks about a structural / interpretive / dependency property the institution will continue to possess across leadership, tooling, and event cycles. |
| **L-Decaying** | Prompt is phrased generally but contains a latent dependency on current tooling, an active project, a current incumbent, or a near-term event. |
| **L-Transient** | Prompt is bound to a temporary state (named system, named role-holder, named program). |

---

## 2. Per-question classification (scored bank)

| ID | Class | Reason |
|---|:--:|---|
| All `ctx_*` metadata | L-Stable | profile fields, drift only over years |
| od_01..od_05 | L-Stable | structural continuity properties |
| icb_01, icb_02 | L-Stable | invisible-labour recognition is a *posture*, not a project |
| ccs_01 | L-Stable | longitudinal confidence statement (purpose-built) |
| scs_01..scs_05 | L-Stable | topology probes — institutional shapes, not events |
| gv_01..gv_04, gis_01 | L-Stable | governance discipline properties |
| ccs_02..ccs_04, ccs_07 | L-Stable | confidence backbone (purpose-built for trend) |
| im_01..im_04 | L-Stable | memory-as-asset properties |
| orl_01, orl_02 | L-Stable | recurring-reconstruction property |
| if_01 | L-Stable | learning-from-adversity property |
| tr_01..tr_05 | L-Stable | transition readiness properties |
| onb_01 | L-Stable | onboarding institutional-intelligence property |
| oc_01..oc_05 | L-Stable | coordination discipline properties |
| cf_01 | L-Stable | equity-of-burden property |
| et_01..et_05 | L-Stable | trust / explainability properties |
| sg_01..sg_04 | L-Stable | sovereignty / governance-control properties |
| mt_01 | L-Stable | modernization continuity property |
| **mt_02** | **L-Decaying** | "deliberately evaluate whether modernization preserves continuity" — wording is L-Stable, **but** modernization activity itself is event-bound; longitudinal interpretation requires a stable *anchor* on modernization rate |

### 2.1 Distribution

| Class | Count | Share | Doctrine target |
|---|---:|---:|---|
| L-Stable | 53 | 98.1 % | ≥ 95 % |
| L-Decaying | 1 | 1.9 % | ≤ 5 % |
| L-Transient | 0 | 0.0 % | 0 % |

**Finding L-1 (Pass).** The bank is overwhelmingly longitudinal-stable. **Zero transient prompts.** This is a direct consequence of the doctrine choice to ask about *properties* rather than *projects*.

---

## 3. Anchoring requirements

For honest longitudinal interpretation, each `ccs_*` confidence-sensitive prompt must be accompanied by a **stable anchor** so that a year-over-year delta is meaningful:

| Prompt | Stable anchor declared? | Status |
|---|:--:|---|
| ccs_01 | ✅ (`institutional_continuity` baseline) | OK |
| ccs_02 | ✅ (`governance_replay` baseline) | OK |
| ccs_03 | ✅ (`reconstruction_confidence` baseline) | OK |
| ccs_04 | ✅ (`onboarding_confidence` baseline) | OK |
| ccs_05 | ✅ (`modernization_continuity` baseline) | OK |
| ccs_06 | ✅ (`sustained_absence_resilience` baseline) | OK |
| ccs_07 | ✅ (`operational_clarity` baseline) | OK |

All confidence prompts anchor to stable interpretive baselines (not to a specific project, system, or person). Trend interpretation is therefore valid.

---

## 4. Findings

**Finding L-2 (Medium).** `mt_02` is L-Stable in wording but **a year-over-year delta on `mt_02` is only meaningful when normalized against modernization activity rate**. Disposition: longitudinal report should pair `mt_02` with a derived "modernization-activity normalization factor" rather than presenting a raw delta.

**Finding L-3 (Low).** Sector-bound profile fields (`ctx_sector`, `ctx_org_type`) are L-Stable at the institutional level but **invalidate trend comparison across institutional re-classification events** (e.g., a union that becomes a federation). Disposition: longitudinal report should declare a baseline-reset on profile change rather than carrying a misleading continuity.

**Finding L-4 (Pass).** No prompt asks about a named individual, a named department, a named system, a named program, or a current event. The institutional anti-personality discipline is honored bank-wide and is itself the strongest longitudinal-stability guarantor.

---

## 5. Enforcement

[`longitudinalSignalStability.test.ts`](../../../apps/union-eyes/lib/icra/__tests__/signal-integrity/longitudinalSignalStability.test.ts) asserts:

- Zero `L-Transient` prompts.
- ≥ 95 % of scored bank is `L-Stable`.
- Every `ccs_*` confidence prompt declares a stable anchor in `questionIntelligenceMetadata`.
- No prompt text contains personal names, current-year strings, or active-project markers.
