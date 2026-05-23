# Signal Depth™ & Signal Diversity™ Audit

ARTIFACT_TYPE: Question Architecture Audit™ — Parts 2 & 3
DOCTRINE_VERSION: 1.1.0
AUDIT_VERSION: 1.0.0
GROUND_TRUTH: [QUESTION_ARCHITECTURE_INVENTORY.md](./QUESTION_ARCHITECTURE_INVENTORY.md)

> **Bar.** A continuity-grade question architecture cannot rest on surface self-rating. The audit grades every scored question on a five-level **Signal Depth™** scale and against a ten-class **Signal Diversity™** taxonomy. Where the bank over-indexes on shallow geometry, this document names it and refers a fix.

---

## 1. Signal Depth™ scale (definitions)

| Level | Name | Definition | Observable correlate |
|---|---|---|---|
| **D1** | Surface | Self-rated maturity ladder on a generally-stated capability. | Single rating; no structural reference. |
| **D2** | Structural | Probes a structural feature of the institution (process, mechanism, documentation discipline). | Asks about a mechanism that either exists or does not. |
| **D3** | Dependency | Probes a continuity dependency (who/what would change, what would slow, where reconstruction would be costly). | Asks "if X were unavailable…" or "what would be hardest to reconstruct". |
| **D4** | Interpretive | Probes whether the institution interprets its own continuity (interpretation drift, governance reading, ambiguity resolution). | Asks about how meaning travels, not whether a doc exists. |
| **D5** | Longitudinal | Probes survival of an institutional property across a transition, period, or modernization. | Asks "across a transition…" or "after a departure…" or "since the last system change…". |

A mature continuity bank should distribute weight **away from D1** and toward **D3 / D4 / D5**.

---

## 2. Signal Depth™ classification (per-question)

The following classification is grounded in the verbatim prompts inventoried in [QUESTION_ARCHITECTURE_INVENTORY.md](./QUESTION_ARCHITECTURE_INVENTORY.md). Where a single prompt spans two levels, the audit assigns the **lower** of the two (conservative posture).

### 2.1 `operational_dependency` (9 questions)

| ID | Modality | Depth | Rationale |
|---|---|:--:|---|
| od_01 | maturity_select | **D3** | "if one or two key people become unavailable" — dependency framing |
| od_02 | maturity_select | **D2** | documentation discipline — structural |
| od_03 | maturity_select | **D2** | handover process — structural |
| od_04 | maturity_select | **D3** | knowledge distribution breadth — dependency topology |
| od_05 | maturity_select | **D5** | onboarding a new senior leader — longitudinal |
| icb_01 | maturity_select | **D4** | recognition of informal continuity work — interpretive |
| icb_02 | maturity_select | **D2** | deliberate distribution — structural |
| ccs_01 | likert_5 | **D5** | "consistently recoverable when key individuals are unavailable" — longitudinal confidence |
| scs_01 | multiple_choice | **D3** | how continuity transfers — dependency topology |

### 2.2 `governance_visibility` (7 questions)

| ID | Modality | Depth |
|---|---|:--:|
| gv_01 | maturity_select | **D2** |
| gv_02 | maturity_select | **D2** |
| gv_03 | maturity_select | **D3** |
| gv_04 | maturity_select | **D2** |
| gis_01 | maturity_select | **D5** |
| ccs_02 | likert_5 | **D4** |
| scs_02 | multiple_choice | **D3** |

### 2.3 `institutional_memory` (9 questions)

| ID | Modality | Depth |
|---|---|:--:|
| im_01 | maturity_select | **D2** |
| im_02 | maturity_select | **D4** |
| im_03 | maturity_select | **D5** |
| im_04 | maturity_select | **D2** |
| orl_01 | maturity_select | **D5** |
| orl_02 | maturity_select | **D4** |
| if_01 | maturity_select | **D5** |
| ccs_03 | likert_5 | **D5** |
| scs_03 | multiple_choice | **D3** |

### 2.4 `transition_readiness` (8 questions)

| ID | Modality | Depth |
|---|---|:--:|
| tr_01 | maturity_select | **D5** |
| tr_02 | maturity_select | **D5** |
| tr_03 | maturity_select | **D2** |
| tr_04 | maturity_select | **D3** |
| tr_05 | maturity_select | **D5** |
| onb_01 | maturity_select | **D5** |
| ccs_04 | likert_5 | **D5** |
| scs_05 | multiple_choice | **D3** |

### 2.5 `operational_coordination` (7 questions)

| ID | Modality | Depth |
|---|---|:--:|
| oc_01 | maturity_select | **D3** |
| oc_02 | maturity_select | **D2** |
| oc_03 | maturity_select | **D2** |
| oc_04 | maturity_select | **D3** |
| oc_05 | maturity_select | **D2** |
| cf_01 | maturity_select | **D3** |
| ccs_07 | likert_5 | **D3** |

### 2.6 `explainability_trust` (5 questions)

| ID | Modality | Depth |
|---|---|:--:|
| et_01 | maturity_select | **D4** |
| et_02 | maturity_select | **D4** |
| et_03 | maturity_select | **D2** |
| et_04 | maturity_select | **D2** |
| et_05 | maturity_select | **D3** |

### 2.7 `sovereignty_governance` (6 questions)

| ID | Modality | Depth |
|---|---|:--:|
| sg_01 | maturity_select | **D3** |
| sg_02 | maturity_select | **D2** |
| sg_03 | maturity_select | **D2** |
| sg_04 | maturity_select | **D3** |
| mt_01 | maturity_select | **D5** |
| mt_02 | maturity_select | **D4** |

---

## 3. Signal Depth™ distribution

| Depth | Count | Share | Doctrine target |
|---|---:|---:|---|
| D1 (Surface) | 0 | 0.0 % | ≤ 10 % |
| D2 (Structural) | 17 | 31.5 % | 20 – 35 % |
| D3 (Dependency) | 15 | 27.8 % | ≥ 25 % |
| D4 (Interpretive) | 7 | 13.0 % | ≥ 10 % |
| D5 (Longitudinal) | 15 | 27.8 % | ≥ 20 % |
| **D3 + D4 + D5 (deep)** | **37** | **68.5 %** | **≥ 60 %** |

**Finding D-1 (Pass).** The scored bank carries **zero D1 (Surface) prompts** and 68.5 % of items qualify as D3-or-deeper. This places the bank above the doctrine floor and rebuts the "shallow signal geometry" failure mode at the bank level.

**Finding D-2 (Caution).** Of the 17 D2 items, **15 are `maturity_select`** — they are structurally serviceable but participate in the `maturity_select` over-share (Finding M-1, see [QUESTION_ARCHITECTURE_INVENTORY.md](./QUESTION_ARCHITECTURE_INVENTORY.md) §5). When v1.2.0 rebalances modality share by **adding** items (Option B), the new items should be D3+ to avoid worsening D-share.

---

## 4. Signal Diversity™ taxonomy (ten classes)

| Class | Definition | Bank items |
|---|---|---|
| **SD-1** Maturity scales | Ladder of progression on a stated capability | 32 (all non-risk-inverted `maturity_select`) |
| **SD-2** Dependency mapping | "If X were unavailable…" / single-point dependency surfacing | 5 (od_01, od_04, tr_02, ccs_01, scs_01) |
| **SD-3** Continuity topology | Pattern of how continuity transfers / is held / breaks | 5 (scs_01, scs_02, scs_03, scs_05, gis_01) |
| **SD-4** Evidence confirmation | Asks for documentary/observable evidence | **0** (Gap) |
| **SD-5** Contradiction detection | Surfaces gap between stated/practiced reality | 3 (gv_04, orl_01, et_02 — risk-inverted) |
| **SD-6** Confidence calibration | Self-confidence rating on a specific continuity property | 7 (ccs_01–ccs_07) |
| **SD-7** Transitional survivability | What survives across a transition | 8 (od_05, tr_01, tr_02, tr_05, onb_01, gis_01, ccs_03, ccs_04) |
| **SD-8** Governance reconstruction | Ability to reconstruct governance reasoning | 4 (im_01, im_03, orl_02, ccs_03) |
| **SD-9** Modernization instability | Modernization as continuity loss pathway | 3 (mt_01, mt_02, ccs_05) |
| **SD-10** Operational fallback visibility | Visibility of fallback paths when normal operation breaks | 1 (oc_04) |

> Items can belong to multiple classes; counts above sum to > 54.

---

## 5. Signal Diversity™ findings

**Finding SD-A (Critical).** **Class SD-4 (Evidence confirmation) is empty.** Zero questions in the assessment ask the respondent to anchor a rating against documentary evidence. This is a *deliberate* anti-surveillance posture (the assessment senses; the *facilitation* phase confirms) — but it is currently undeclared as a positioning choice and exposes the bank to a reviewer challenge of "self-rating only." Disposition: add explicit doctrine note + introduce a single non-scoring, optional `evidence_anchor` prompt per section in v1.2.0 (covered in [EVIDENCE_EXTRACTION_AUDIT.md](./EVIDENCE_EXTRACTION_AUDIT.md)).

**Finding SD-B (High).** **SD-10 (Operational fallback visibility) is under-represented (1 item).** Continuity readiness without fallback visibility is incomplete. Roadmap: introduce 2 items (one `multiple_choice` topology, one `maturity_select` D3) in v1.2.0.

**Finding SD-C (Medium).** **SD-9 (Modernization instability) has only 3 items and they all reside in `sovereignty_governance`** — modernization risk is structurally invisible to other sections. Roadmap: cross-section modernization prompts (CSM and CBM should both reference modernization survivability).

**Finding SD-D (Medium).** **SD-2 (Dependency mapping) carries only 5 items** despite being the core stewardship-concentration signal. Add 2 explicit single-point dependency prompts in v1.2.0.

**Finding SD-E (Pass).** SD-1, SD-3, SD-5, SD-6, SD-7, SD-8 are all at or above floor; the bank is **not** mono-class.

---

## 6. Redundancy check

Pairs flagged for review (both items measure substantially the same property):

| Pair | Overlap | Disposition |
|---|---|---|
| `gv_01` & `gv_02` | both probe governance recording / visibility discipline | **Keep both** — `gv_01` is decision-level, `gv_02` is process-level |
| `im_01` & `im_04` | both probe organization-as-knowledge-keeper | **Keep both** — `im_01` is historical, `im_04` is current |
| `tr_01` & `tr_02` | planned vs. unplanned transition | **Keep both** — the *gap* between them is itself a signal |
| `oc_02` & `gv_01` | recording discipline | **Keep both** — operational vs. governance domain |

No redundant-prompt removals required. The bank is dense without duplication.

---

## 7. Enforcement

The following invariants are enforced by [`questionSignalIntegrity.test.ts`](../../../apps/union-eyes/lib/icra/__tests__/signal-integrity/questionSignalIntegrity.test.ts):

- Zero D1 prompts.
- ≥ 60 % of scored bank is D3-or-deeper.
- Each Signal Diversity™ class except SD-4 has ≥ 1 representative.
- No two prompts share identical English text (anti-redundancy).
