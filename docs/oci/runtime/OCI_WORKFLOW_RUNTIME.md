# OCI Workflow Runtime™

**Status:** Doctrine for the continuity-aware workflow runtime layer of OCI Runtime Infrastructure™ (Product 4).

**Audience:** Stewards of the runtime, engineering stewards of `apps/union-eyes/lib/runtime/workflow/`.

---

## 1. Purpose

Operational systems already run workflows. The Continuity Workflow Runtime adds a single capability: a refusable reading that says whether the current step is safe to advance under the current continuity context. The runtime never advances a step itself. The institution's operational system retains authority.

---

## 2. The verdict

`evaluateWorkflowAdvance(annotation)` returns one of:

- `safe_to_advance` — no continuity reasons surface.
- `reviewer_attention_required` — continuity-sensitive context or missing annotation metadata; the institution should bring a reviewer in before advancing.
- `refused` — the action is `continuity_critical` and the annotation lacks the lineage and memory references required to be re-read by a successor steward.

`refused` is the runtime's strongest available statement. It is not an enforcement; it is a refusal-of-claim. The operational system can still proceed under reviewer-led ratification.

---

## 3. Lifecycle hooks

`governanceAwareWorkflowHooks.ts` exposes:

- `onBeforeAdvance(annotation)` — evaluates the verdict, optionally emits a `ContinuityBreakpointIntroduced` event when the verdict is `refused`.
- `onAfterRatification(annotation)` — emits a `GovernanceRecoveryRatified` event.

Hooks are pure functions. They do not persist, dispatch, or schedule. The operational system is responsible for what it does with the returned events.

---

## 4. Posture

- **Refusal-first.** Missing reviewer reference, missing governance lineage on a continuity-critical action, or missing memory reference on a continuity-critical action all produce `refused`.
- **Deterministic.** Same input, same output.
- **Anti-surveillance.** Annotations carry refIds and reviewer references; no names.
- **No enforcement.** The runtime returns readings; it does not gate.

---

## 5. Boundaries

The Workflow Runtime is not:

- a workflow orchestrator,
- a state machine,
- a job scheduler,
- a notification engine.

It is a deterministic, refusable per-step continuity reading.

---

## 6. Cross-references

- `docs/oci/OCI_AI_BOUNDARY.md`
- `docs/oci/OCI_ANTI_SURVEILLANCE_POSITION.md`
- `docs/oci/runtime/OCI_OPERATING_PRIMITIVES.md`
- `docs/oci/runtime/OCI_EVENT_RUNTIME.md`
- `docs/oci/runtime/OCI_GOVERNANCE_MEMORY_RUNTIME.md`
