# Full Cognition Degradation Governance

> **Doctrine.** Cognition degrades safely and institutionally. It never hallucinates operational certainty.

## Authority

This document binds the cognition surface of Nzila OS to a fail-closed, governance-safe, continuity-safe degradation contract. Cognition is **bounded interpretation under reviewer-of-record stewardship** — it is not an autonomous agent, not a copilot, not an ambient AI. The runtime must never fabricate governance interpretation, never over-authorize cognition output, and never hallucinate operational certainty. Anti-surveillance, evidence-anchored, cadence-bound.

## 1. Cognition surface enumeration

The cognition surface in Nzila OS comprises:

- the OpenAI completion path (governance interpretation, evidence summarization)
- the Whisper transcription path (voice → text)
- the embedding path (text → vector for retrieval)
- the schema validation layer that mediates every cognition response

Provider topology:

- `nzila-openai-eastus` — completion + embedding deployments
- `nzila-openai-eastus2` — Whisper deployment
- Provider keys mirrored in pilot KV today (`openai-key-pilot`); rotation cadence deferred

## 2. Degradation cells (live evidence required)

| Cell | Bounded behavior | Verdict |
|---|---|---|
| **OpenAI unavailable** (5xx from provider) | Bounded retry once; then explicit suppression with "cognition unavailable — reviewer-of-record path active" copy | **CONDITIONAL GO** — hardened at doctrine; live drill deferred |
| **Provider timeout** (>30s) | Single retry; then suppression; never a fabricated interpretation | **CONDITIONAL GO** |
| **Malformed cognition response** (schema violation) | Schema-validated rejection; never an implicit default; reviewer-of-record notified | **GO** at the schema layer |
| **Incomplete evidence** (governance context missing) | Cognition request **not dispatched**; UI shows "governance context required" | **GO** at the dispatcher layer |
| **Missing governance context** | Same as above — cognition is governance-mediated; no governance, no cognition | **GO** |
| **Missing continuity lineage** | Cognition request **not dispatched**; UI shows "continuity lineage required for interpretation"; reviewer-of-record path remains active | **GO** at the dispatcher layer |

## 3. Cognition disablement state

The runtime supports an explicit **cognition disablement state** controlled by the runtime mode lineage (see [`docs/nzila-tier2-hardening/full-runtime-mode-feature-sovereignty-hardening.md`](../nzila-tier2-hardening/full-runtime-mode-feature-sovereignty-hardening.md)):

- `NZILA_MODE=offline` → cognition disabled at the dispatcher; UI shows "cognition disabled — operational mode" banner
- `NZILA_MODE=pilot` → cognition gated by per-org governance opt-in; dispatcher emits suppression on missing opt-in
- `NZILA_MODE=staging` / `production` → cognition active under governance gating

The disablement is **explicit**, deterministic, governance-mediated. Operators can verify the state from the runtime banner without inspecting logs.

## 4. Reviewer-of-record preservation

Every cognition output carries a **reviewer-of-record anchor**:

- the user who triggered the request
- the governance context (case ID, member ID, org ID)
- the continuity lineage (cadence event, steward transition)
- the cognition response hash + provider response ID

When cognition is unavailable, the **reviewer-of-record path remains active** — the operator can still author the interpretation manually. The cognition layer **never** owns the institutional verdict; it merely accelerates the reviewer.

## 5. Bounded cognition fallback

When cognition is degraded, the bounded fallback is:

1. **Reviewer-of-record manual interpretation** — the operator authors the verdict; cognition is suppressed.
2. **Historical lineage retrieval** — prior interpretations on the same governance context are surfaced as read-only reference.
3. **Cadence-paused notice** — if cognition was the cadence trigger, the cadence emission is paused (see operational honesty banner taxonomy).

There is no implicit fallback to a cached interpretation, no implicit fallback to a default verdict, no implicit fallback to a "best-effort" cognition response.

## 6. Governance-safe interpretation fallback

If cognition produces an interpretation but governance context is partial, the runtime:

- holds the interpretation in **draft state**
- requires the reviewer-of-record to **explicitly accept** before the interpretation is bound to the governance lineage
- never auto-binds a partial interpretation to a governance event

## 7. Operational interpretation suppression

Operational interpretation suppression is the canonical fail-safe state. It is preferable to:

- fabricated interpretation
- silent partial output
- ambient AI vocabulary
- celebratory copy on a degraded path

Suppression is institutional honesty.

## 8. Anti-pattern enumeration (rejected)

The cognition layer must **never**:

- hallucinate operational certainty
- fabricate governance interpretation
- over-authorize cognition output
- emit a confidence score without a reviewer-of-record anchor
- emit "AI thinking" copy without explicit governance context
- silently retry beyond the bounded retry budget
- silently fallback to cached interpretation
- collapse into ambient AI assistant framing

These are forbidden across the proving layer.

## 9. Cadence

Cognition degradation drills are bound to a **stewardship cadence**, not a one-time emission. Drills are scheduled at:

- every cognition provider key rotation
- every Whisper / completion deployment SKU change
- every governance schema migration
- every reviewer-of-record cohort change

Drill artifacts are stored under `chore/cognition-degradation-drill-corpus` (deferred, recurring).

## 10. Verdict

Cognition in Nzila OS is **bounded, governance-mediated, continuity-safe, and reviewer-of-record anchored**. Degradation is explicit, suppression is honest, and the runtime never overstates cognition certainty.

**Aggregate verdict: GO at the doctrine layer; CONDITIONAL GO at the live drill layer.**
