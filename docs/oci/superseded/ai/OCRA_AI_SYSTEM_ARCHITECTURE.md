# OCRA AI System Architecture

**DOCTRINE_VERSION:** 1.0.0
**STATUS:** Internal/engineering — not part of the public method surface. The canonical AI
doctrine is [`docs/oci/OCI_AI_BOUNDARY.md`](../../OCI_AI_BOUNDARY.md); this document describes
an implementation layer, not the method. See [`SUPERSEDED.md`](../../SUPERSEDED.md).
**PARENT:** [OCI_AI_AUGMENTATION_DOCTRINE.md](OCI_AI_AUGMENTATION_DOCTRINE.md)

---

## Canonical layer model

```
┌─────────────────────────────────────────────┐
│  Deterministic Continuity Core              │   apps/union-eyes/lib/icra/scoring.ts
│  (pure functions, version-locked)           │   apps/union-eyes/lib/icra/adaptation/
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│  Structured Continuity Signals              │   typed band/archetype/breakpoint signals
│  (band labels + identifiers only)           │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│  AI-Assisted Synthesis Layer                │   apps/union-eyes/lib/icra-ai/
│  (narrative drafting; no scoring)           │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│  Human Review Layer                         │   reviewWorkflow.ts (draft → reviewed → approved)
│  (mandatory state transitions)              │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│  Institutional Delivery Layer               │   Executive Brief PDF · Workshop summary · Board brief
│  (reviewer-endorsed artefacts)              │
└─────────────────────────────────────────────┘
```

---

## Layer responsibilities

### 1. Deterministic Continuity Core

- Pure, versioned, deterministic.
- Computes scores, bands, archetypes, breakpoints, confidence signals.
- **AI never participates in this layer.**

### 2. Structured Continuity Signals

- Typed contract between core and synthesis.
- Band labels, archetype identifiers, breakpoint identifiers, adaptive context bands.
- **No raw answers, no free text, no telemetry.**

### 3. AI-Assisted Synthesis Layer (`lib/icra-ai/`)

- Receives a `NarrativeContext` built by `buildNarrativeContext.ts`.
- Issues prompts through `systemPromptRegistry.ts` with guardrails from `promptGuardrails.ts`.
- Generates draft narratives of typed kinds (`ExecutiveSummary`, `ContinuityNarrative`, etc.).
- Outputs pass through `narrativeOutputValidator.ts` before reaching reviewers.

### 4. Human Review Layer

- Every AI draft starts at status `draft`.
- A reviewer transitions through `reviewed → approved` (or `rejected`).
- Approval gates delivery — no AI draft enters delivery without a recorded approval.
- See [`reviewWorkflow.ts`](../../../../apps/union-eyes/lib/icra-ai/reviewWorkflow.ts).

### 5. Institutional Delivery Layer

- Surfaces approved narratives in:
  - the Executive Continuity Brief PDF (separated section with disclosure)
  - the workshop summary surface
  - the facilitator companion
- Always co-rendered with deterministic findings and the AI disclosure.

---

## What AI **never** does in this architecture

- AI never **calculates** scores.
- AI never **determines** maturity.
- AI never **determines** continuity risk.
- AI never **changes** adaptive routing.
- AI never **alters** telemetry.
- AI never **profiles** users.
- AI never **infers** emotions.
- AI never **ranks** institutions.

These eight prohibitions are pinned by `antiSurveillanceAiInvariant.test.ts`.

---

## Versioning

Three independent version axes govern the AI layer:

| Axis | Constant | Drift policy |
|------|----------|--------------|
| Synthesis engine | `SYNTHESIS_ENGINE_VERSION` | Bump on any output-shape or contract change |
| Prompt registry  | `PROMPT_REGISTRY_VERSION`  | Bump on any system-prompt change |
| Disclosure copy  | `AI_DISCLOSURE_VERSION`    | Bump on any disclosure-copy change |

All three are persisted in `aiNarrativeAuditRecord.ts` for every artefact.

---

## Failure modes (graceful)

- AI provider unavailable → narrative is omitted; deterministic findings still render; disclosure notes "AI-assisted narrative not generated for this artefact."
- AI output fails validation → output is discarded; failure is recorded against synthesis-version + prompt-version; deterministic findings still render.
- Reviewer rejects → artefact returns to draft pool; no delivery surface receives it.

The deterministic core is never blocked by the AI layer. Continuity findings reach the institution regardless of AI availability.
