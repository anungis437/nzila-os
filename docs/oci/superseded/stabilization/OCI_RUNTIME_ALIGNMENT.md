# OCI Runtime Alignment

**Status:** Framework doctrine for the alignment between the canonical OCI Method™ phases and the P3 Operationalization corpus runtimes.

**Audience:** Stewards of the method, certified facilitators, and engineering stewards of the runtime engines in `apps/union-eyes/lib/workbook/engines/`.

**Convention used in this document:** "the method" refers to the OCI Method™ as a whole. "the runtime" refers to the deterministic engines that observe and read what an institution is producing while practising the method. "the corpus" refers to the operationalization documents listed in `OCI_METHOD.md` §13.

---

## 1. Purpose of this document

The OCI Method™ is defined by five canonical phases (`OCI_METHOD.md` §2). The P3 Operationalization corpus introduced additional doctrinal layers that did not exist when the canonical phases were first written:

- a stabilization state engine,
- a stewardship redistribution framework,
- a governance recovery framework,
- a stabilization progression model,
- an executive stabilization model,
- a facilitator runtime,
- a runtime transition model,
- a continuity operationalization model,
- a longitudinal stabilization runtime.

This document states, plainly and once, how those layers align with the canonical five phases. It does not displace the canonical phases. It does not change what the method is. It explains where each runtime artefact attaches.

The alignment described here is a reading. It is not a workflow, a sequence, or a pipeline.

---

## 2. The alignment table

Each P3 corpus runtime attaches to exactly one canonical phase. Attachment means: this runtime is permitted to read what the institution produces while practising that phase. Attachment never means: this runtime drives the phase.

| Canonical phase                  | Runtime attachments                                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Phase 1 — Recognition            | None. Recognition is a human practice. The runtime does not read recognition.                              |
| Phase 2 — Mapping                | None. Mapping is a human practice. The runtime does not read mapping.                                       |
| Phase 3 — Stabilization          | Stabilization state engine, stewardship redistribution, governance recovery, stabilization progression, executive stabilization model, facilitator runtime, continuity operationalization. |
| Phase 4 — Embedding              | Runtime transition model. The five named transitions out of stabilization are read here.                    |
| Phase 5 — Closure                | Longitudinal stabilization runtime. Read only with explicit institutional consent and under k-anonymity.    |

Phases 1, 2, and 5 are not exhaustively instrumented by design. The runtime is allowed to read structural artefacts the institution chooses to surface. The runtime is not allowed to read the human conversation those phases consist of.

---

## 3. Read-only posture

Every runtime named in §2 is read-only with respect to the institution. The runtime composes signals from artefacts the institution has already produced. The runtime never:

- generates the artefact,
- prompts the institution to produce the artefact,
- writes back to the institution's governance record,
- produces any reading that has not been requested by a facilitator under explicit institutional consent.

This posture is binding. It is enforced by the engines themselves: every engine accepts pre-computed inputs and refuses to fetch, persist, or transmit. Persistence sketches in the corpus documents are non-binding examples and are not implemented as runtime behaviour.

---

## 4. Refusal as the default disposition

Across the runtime, refusal is the default disposition. An engine that cannot read something returns `not_yet_readable`, not a guess. A transition that fails any gate is `refused`, not `offered_with_caveats`. A hook whose readiness is insufficient is `deferred_readiness_insufficient`, not `applied_anyway`.

This discipline traces back to `OCI_AI_BOUNDARY.md` and `OCI_ANTI_SURVEILLANCE_POSITION.md`. The runtime is reviewer-led. The default is silence.

---

## 5. K-anonymity discipline

The longitudinal runtime enforces a k-anonymity floor (default k=5) on the underlying intervention ledger. When the floor is not met, the runtime withholds the envelope and the trajectory engine returns `not_yet_readable`. This discipline is consistent with the benchmark intelligence architecture stated in `OCI_METHOD.md` §9.

The floor applies per institution to the institution's own longitudinal reading. The floor applies again, separately, at the aggregation boundary when an institution has opted into benchmark contribution.

---

## 6. Vocabulary discipline

Every runtime in §2 is held to the method language register stated in `OCI_METHOD.md` §7. Forbidden vocabulary (productivity, optimization, automation as applied to institutional work, scoring, demo, frictionless, seamless, behavioural analytics) is rejected by invariant tests on every engine and on every narrative builder downstream of the engines.

The runtime does not extend the vocabulary. New corpus documents are amended into the method's controlled vocabulary, never the other way around.

---

## 7. Forward references

When an institution moves from Product 3 (Stabilization) toward Product 5 (Longitudinal Continuity Intelligence), the runtime transition model and the longitudinal stabilization runtime are the bridge. The transition model reads whether the institution is in a posture from which a forward move is offerable. The longitudinal runtime reads whether the institution's own history is dense enough to support a non-misleading reading.

Neither runtime authorises the forward move. The institution authorises the forward move. The runtime composes a refusable reading the institution may use to inform that authorisation.

---

## 8. Cross-references

- `docs/oci/OCI_ANTI_SURVEILLANCE_POSITION.md`
- `docs/oci/OCI_AI_BOUNDARY.md`
- `docs/oci/OCI_DATA_HANDLING.md`
- `docs/oci/OCI_METHOD.md` §§1–13
- `docs/oci/stabilization/OCI_STABILIZATION_FRAMEWORK.md`
- `docs/oci/stabilization/OCI_STABILIZATION_LIFECYCLE.md`
- `docs/oci/stabilization/OCI_RUNTIME_TRANSITION_MODEL.md`
- `docs/oci/stabilization/OCI_CONTINUITY_OPERATIONALIZATION.md`
- `docs/oci/stabilization/OCI_LONGITUDINAL_STABILIZATION.md`
