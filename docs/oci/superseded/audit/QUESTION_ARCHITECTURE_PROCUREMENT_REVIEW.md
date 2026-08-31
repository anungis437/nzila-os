# Question Architecture Procurement Defensibility Review

ARTIFACT_TYPE: Question Architecture Audit™ — Part 10
DOCTRINE_VERSION: 1.1.0
AUDIT_VERSION: 1.0.0
GROUND_TRUTH: [QUESTION_ARCHITECTURE_INVENTORY.md](QUESTION_ARCHITECTURE_INVENTORY.md)
AUDIENCE: Procurement / risk / legal reviewers evaluating OCI as an institutional continuity instrument.

> **Procurement reading.** Procurement reviewers do not score methodologies on aesthetic. They ask whether the instrument generates **defensible** evidence and whether it imports **liability** (surveillance, profiling, opaque inference). The following review provides the eight-property defensibility scorecard.

---

## 1. Defensibility scorecard

| Property | Definition | Score | Evidence |
|---|---|:--:|---|
| **Rigor** | The instrument's design rests on a declared methodology with documented inputs, transformations, and outputs. | ✅ **Pass** | [OCI Method™ Whitepaper v1.1](../methodology/OCI_METHOD_WHITEPAPER_v1.md), Appendices A–T |
| **Observability** | Every emitted claim traces back to an observable signal (response, topology, or audited reviewer interpretation). | ✅ **Pass** | [EVIDENCE_EXTRACTION_AUDIT.md](EVIDENCE_EXTRACTION_AUDIT.md) §2, §5 |
| **Reproducibility** | Two reviewers given the same inputs produce the same envelope; the audit packet is reproducible by hash. | ✅ **Pass** | `entropyAuditPacketBuilder.reproducibilityHash` (SHA-256); reviewer-variance modelling |
| **Boundedness** | Reviewer interpretation is bounded by declared variance models; no unbounded inference is emitted. | ✅ **Pass** | [reviewerVarianceModel.ts](../../../../apps/union-eyes/lib/oci/audit/reviewerVarianceModel.ts); [EVIDENCE_EXTRACTION_AUDIT.md](EVIDENCE_EXTRACTION_AUDIT.md) §4 |
| **Explainability** | Every score, ordinal, and classification can be traced to a documented rule and input set. | ✅ **Pass** | confidence envelope co-emits rationale; entropy audit packet co-emits inputs |
| **Non-manipulation** | No prompt is designed to extract a desired answer; no prompt rewards a particular response. | ✅ **Pass** | [antiGamificationInvariant.test.ts](../../../../apps/union-eyes/lib/icra/__tests__/antiGamificationInvariant.test.ts); doctrine in [OCI_MODALITY_DOCTRINE.md](../assessment/OCI_MODALITY_DOCTRINE.md) |
| **Non-psychometric** | No prompt classifies individuals; no prompt infers behavioural traits; no prompt produces a person-level claim. | ✅ **Pass** | [LONGITUDINAL_SURVIVABILITY_AUDIT.md](LONGITUDINAL_SURVIVABILITY_AUDIT.md) §4; bank-wide audit |
| **Non-surveillance** | No prompt extracts personal identity, private member data, or behavioural observation about named persons. | ✅ **Pass** | [EVIDENCE_EXTRACTION_AUDIT.md](EVIDENCE_EXTRACTION_AUDIT.md) §7; bank-wide audit |

---

## 2. Property-by-property reviewer narrative

### 2.1 Rigor

The OCI instrument rests on a published methodology (OCI Method™ Whitepaper v1.1) with declared:
- five-dimension scoring construct,
- six-property confidence envelope (`score`, `confidence`, `sampleSize`, `dataCompleteness`, `stability`, `cautionState`),
- entropy audit packet schema with SHA-256 reproducibility hash,
- statistical anchor contracts (HHI, Gini, reviewer variance),
- crosswalks to ISO 22301 / 22317, ISO 37000, ISO 31000, COBIT 2019 (positioned as **complementary, not equivalent** — see anti-claims in §3).

### 2.2 Observability

Every scored prompt elicits an observable signal: a position on a 1-of-5 ladder, a confidence statement, or a topology pattern. Composite scores are derived by declared dimension weights; framework outputs (SDI, RBI, GES, CSM, CBM) are derived by declared rules over named inputs. Every envelope emission references its input set.

### 2.3 Reproducibility

The entropy audit packet is content-addressed (SHA-256). Two reviewers given the same inputs and the same packet will produce the same envelope. The packet includes:
- the routed bank fingerprint,
- the response set,
- the framework input set,
- the reviewer interpretation (where reviewer-anchored decisions occurred),
- the reproducibility hash itself.

### 2.4 Boundedness

Reviewer interpretation is restricted to:
- archetype tie-breaks,
- GES ordinal escalation,
- narrative emphasis.

Each is bounded by the declared reviewer-variance model. No reviewer can emit a claim outside the declared posture set.

### 2.5 Explainability

Every emitted score is traceable to (a) the inputs that fed it, (b) the rule that combined them, (c) the confidence envelope that bounds it. The narrative-engine emits claim-input pairs so that any sentence in the report is traceable to its supporting evidence.

### 2.6 Non-manipulation

No prompt:
- carries a "correct" answer,
- frames a position as desirable or undesirable,
- presents reward/penalty framing,
- uses leading language to elicit a target response.

Risk-inverted prompts (e.g. `gv_03`, `et_02`) explicitly probe negative-direction signals — these are methodologically transparent, not manipulative.

### 2.7 Non-psychometric

The instrument is **institutional**, not individual. No prompt:
- asks about a respondent's personality,
- infers a behavioural trait,
- classifies a person,
- predicts individual behaviour.

This is the strongest single defensibility property for procurement: the instrument **does not produce a person-level claim of any kind**.

### 2.8 Non-surveillance

The instrument:
- does not collect names of individuals,
- does not collect identifiers of staff, members, or other natural persons,
- does not collect free-text disclosure about specific people,
- does not extract evidence in real time within the survey,
- routes any documentary evidence collection to a **post-assessment facilitation phase** that is voluntary, institutionally-anchored, and bounded.

---

## 3. Anti-claims (declared)

The instrument **does NOT**:

- assert equivalence with ISO 22301, ISO 22317, ISO 37000, ISO 31000, COBIT 2019, NIST CSF, or any other ISO/IEC/COBIT/NIST standard;
- rank institutions against each other;
- produce a person-level claim;
- infer behaviour from response data;
- attribute observed outcomes to named individuals;
- surveil any human being;
- profile individuals psychometrically;
- generate a regulatory pass/fail determination;
- substitute for an external auditor.

These anti-claims are baked into the [OCI Method™ Whitepaper](../methodology/OCI_METHOD_WHITEPAPER_v1.md), the crosswalk documents, and the per-test invariants.

---

## 4. Open gaps disclosed to procurement

Honest disclosure: the following gaps are known and tracked, with timelines:

| Gap | Status | Resolution |
|---|---|---|
| Adaptive routing inert in v1 (full bank returned) | Disclosed | v1.2.0 — per-question metadata population |
| `maturity_select` 2.8 pp over doctrine ceiling | Disclosed | v1.2.0 — add modality-diverse items |
| GES level-5 has no direct probe | Disclosed | v1.2.0 — add 2 level-5 probes |
| Longitudinal stability model lacks data substrate | Disclosed | v1.3.0 — longitudinal store |
| Trust-debt dimension lacks topology probe | Disclosed | v1.2.0 — add `multiple_choice` |

**Posture.** Procurement reviewers should expect the methodology owner to **disclose gaps**, not to hide them. The audit's bar is honesty plus a credible resolution path, not perfection.

---

## 5. Recommendation

The OCI Question Architecture is **procurement-defensible** for institutional continuity assessment use cases on the following conditions:

1. The buyer accepts the **institutional (not individual)** scope of the instrument.
2. The buyer accepts that **adaptive routing is currently inert** (full bank returned) and will be enabled in v1.2.0.
3. The buyer accepts that **longitudinal trend interpretation requires v1.3.0** (longitudinal store).
4. The buyer accepts the published **anti-claims** as binding.

With these acknowledged, the instrument meets the eight-property defensibility scorecard and is suitable for use as a continuity-readiness assessment instrument.
