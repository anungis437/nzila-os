# Evidence Extraction Audit™

ARTIFACT_TYPE: Question Architecture Audit™ — Part 9
DOCTRINE_VERSION: 1.1.0
AUDIT_VERSION: 1.0.0
GROUND_TRUTH: [QUESTION_ARCHITECTURE_INVENTORY.md](QUESTION_ARCHITECTURE_INVENTORY.md)

> **Audit question.** When the assessment generates a continuity claim, is that claim **auditable** — can a reviewer trace it back to an observable signal? Or are claims resting on reviewer assumption alone?

---

## 1. Evidence postures (definitions)

| Posture | Definition |
|---|---|
| **E-Direct** | The question itself elicits an observable signal (a topology pattern, an explicit confidence statement, a structural property). |
| **E-Inferred-Bounded** | The claim is inferred from a combination of inputs, with the inference rule documented and the input set logged. |
| **E-Reviewer-Anchored** | A reviewer interprets cumulative signal; the interpretation is captured in the entropy audit packet and bounded by reviewer-variance modelling. |
| **E-Reviewer-Unbounded** | A reviewer interprets without traceable input or bounded process. **Forbidden.** |

---

## 2. Per-claim posture inventory

| Claim type | Posture | Bounded by |
|---|---|---|
| Dimension score | E-Direct (weighted ordinal aggregation) | weights declared in `questions.ts` |
| Composite continuity score | E-Inferred-Bounded | dimension-weight matrix |
| Confidence envelope | E-Direct (from likert) + E-Inferred-Bounded (from completeness/sample) | `@nzila/oci-confidence` |
| Stewardship Density Index (SDI) | E-Inferred-Bounded | framework rule + topology inputs |
| Reconstruction Burden Index (RBI) | E-Inferred-Bounded | framework rule + memory inputs |
| Governance Entropy Scale (GES) ord. 1–4 | E-Inferred-Bounded | input set logged in audit packet |
| GES ord. 5 | **E-Reviewer-Anchored** (today) | reviewer-variance model — but **no direct probe exists** (Finding E-1) |
| Continuity Survivability Matrix (CSM) | E-Inferred-Bounded | transition inputs |
| Continuity Burden Map (CBM) | E-Inferred-Bounded | burden inputs |
| Continuity archetype classification | E-Direct (topology MC) + E-Inferred-Bounded (corroboration) | scs_* + corroborating maturity |
| Narrative claim | E-Inferred-Bounded | adaptiveNarrativeEngine + claim-input audit |

**Finding EV-1 (Pass).** Zero claims are emitted in the **E-Reviewer-Unbounded** posture.

---

## 3. Evidence-blind question audit

A prompt is "evidence-blind" if its rating cannot, even in principle, be corroborated against an observable artifact during facilitation.

| ID | Could be facilitation-anchored to evidence? | Notes |
|---|:--:|---|
| od_01..od_05 | ✅ | succession plans, role docs, handover records |
| icb_01, icb_02 | ✅ | invisible-labour recognition policies, recognition awards |
| gv_01..gv_04 | ✅ | minutes, decision logs, governance manuals |
| gis_01 | ✅ | interpretation memos, governance reading guides |
| im_01..im_04 | ✅ | archives, historical records, knowledge bases |
| orl_01, orl_02 | ✅ | post-incident reviews, lessons-learned logs |
| if_01 | ✅ | retro records |
| tr_01..tr_05, onb_01 | ✅ | transition plans, succession matrices, onboarding playbooks |
| oc_01..oc_05 | ✅ | coordination tools, ops dashboards, vendor logs |
| cf_01 | ✅ | role-load surveys, stewardship reviews |
| et_01..et_05 | ✅ | governance audit trails, dispute logs, notice templates |
| sg_01..sg_04 | ✅ | data sovereignty registers, vendor contracts, authority matrices |
| mt_01, mt_02 | ✅ | modernization-impact assessments, migration playbooks |
| ccs_01..ccs_07 (likert) | partial | confidence is **self-reported**; corroboration via behavioral evidence (e.g. did the onboarding actually succeed?) |
| scs_01..scs_05 (multiple choice topology) | ✅ | the selected option *is* the observable pattern |

**Finding EV-2 (Pass).** Every scored question is at least *facilitation-anchorable*. Zero evidence-blind prompts.

---

## 4. Reviewer-assumption audit

Where reviewer interpretation is required, the audit asks: is it bounded?

| Reviewer-anchored decision | Inputs logged in audit packet? | Variance bounded? |
|---|:--:|:--:|
| GES ord. 5 escalation | ✅ | ✅ (via reviewerVarianceModel) |
| Archetype tiebreak | ✅ | ✅ |
| Narrative emphasis | ✅ | ✅ |
| Facilitation prompt selection | ✅ | n/a (facilitator discretion is bounded by doctrine) |

**Finding EV-3 (Pass).** Every reviewer-anchored decision is logged and variance-bounded.

---

## 5. Unverifiable continuity claims

A continuity claim is "unverifiable" if no observation could in principle refute it.

| Claim | Refutable? |
|---|:--:|
| "Operational knowledge is consistently recoverable when key individuals are unavailable" (ccs_01) | ✅ (operational continuity through a tested absence) |
| "Governance decisions can be traced from current outcomes back to documented rationale" (ccs_02) | ✅ (decision-trace audit) |
| "The institution can reconstruct the reasoning behind past decisions without long-tenured individuals" (ccs_03) | ✅ (reconstruction exercise) |
| "A newly onboarded senior leader could act on real institutional context within their first quarter" (ccs_04) | ✅ (onboarding outcome review) |
| Every `maturity_select` ladder position | ✅ (position is observable via documentary discipline) |
| Every `multiple_choice` topology | ✅ (topology is the observable pattern) |

**Finding EV-4 (Pass).** No unverifiable claims emitted. The assessment is methodologically refutable end-to-end.

---

## 6. Weak auditability paths

The audit identifies one weak path:

**Finding EV-5 (Medium).** The link between a `likert_5` confidence rating and the facilitation-phase evidence that would corroborate it is **conceptually present but not procedurally enforced**. A facilitation session that omits the confidence-corroboration step would still produce a complete assessment record. Disposition: introduce an optional `evidence_corroboration_record` in the facilitation packet that flags which `ccs_*` items were anchored against observable evidence during the workshop; tracked for v1.2.0.

---

## 7. Anti-surveillance posture (re-verified)

| Invariant | Status |
|---|---|
| No prompt asks for individual identity | ✅ |
| No prompt asks for psychological state | ✅ |
| No prompt asks for private member data | ✅ |
| No prompt encourages free-text disclosure about specific people | ✅ |
| No prompt asks the respondent to surveil colleagues | ✅ |
| Evidence collection happens in **facilitation phase only**, never embedded in the survey | ✅ |

**Finding EV-6 (Pass).** Anti-surveillance posture upheld by the evidence model: evidence is **post-assessment, voluntary, institutionally-anchored**, never extracted from the respondent in real-time.

---

## 8. Enforcement

Evidence-audit invariants are enforced via cross-references in [`questionSignalIntegrity.test.ts`](../../../../apps/union-eyes/lib/icra/__tests__/signal-integrity/questionSignalIntegrity.test.ts):

- No claim type carries `E-Reviewer-Unbounded` posture.
- Every scored prompt is facilitation-anchorable (≥ 1 evidence artifact class declared).
- Every reviewer-anchored decision logs ≥ 1 input in the entropy audit packet.
- No prompt text matches the forbidden surveillance patterns (PII probes, behavioural probes about named individuals, psychometric prompts).
