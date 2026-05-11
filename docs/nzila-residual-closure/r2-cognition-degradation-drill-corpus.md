# R2 — Cognition Degradation Drill Corpus

> **Status: PARTIALLY CLOSED.** Drill protocol shipped; live execution scoped to recurring chore cadence `chore/r2-cognition-degradation-drill-corpus`.

## Authority

This document is the canonical cognition degradation drill protocol for Nzila OS. Cognition is bounded interpretation under reviewer-of-record stewardship — it must NEVER hallucinate operational certainty, fabricate governance interpretation, or over-authorize cognition output. Governance-safe, continuity-safe, anti-surveillance, evidence-anchored. Operational, institutional, deterministic, bounded.

## 1. Drill matrix

| Drill | Trigger | Expected runtime behavior | Reviewer-of-record preservation |
|---|---|---|---|
| **OpenAI outage** | unset `OPENAI_API_KEY` (in dev) or block egress (in staging/demo via NSG rule) | bounded retry once → suppression with "cognition unavailable — reviewer-of-record path active" | reviewer-of-record path remains active; manual interpretation enabled |
| **Provider timeout** | inject 60s sleep proxy in front of OpenAI endpoint | bounded retry once → suppression; never a fabricated interpretation | preserved |
| **Malformed responses** | inject schema-violating payload via test proxy | schema-validated rejection; no implicit default | reviewer-of-record notified |
| **Incomplete evidence** | submit cognition request with empty `evidence_corpus` | request **not dispatched**; UI shows "evidence required" | preserved |
| **Cognition disablement** | set `NZILA_MODE=offline` | dispatcher emits suppression; UI shows "cognition disabled — operational mode" banner | preserved |
| **Governance-context absence** | submit cognition request without `case_id` / `member_id` / `org_id` | request **not dispatched**; UI shows "governance context required" | preserved |
| **Continuity-context absence** | submit cognition request without `cadence_event_id` or `steward_transition_id` | request **not dispatched**; UI shows "continuity lineage required for interpretation" | preserved |

## 2. Execution procedure (live drill)

For each environment (dev / staging / demo; pilot deferred until R1 sidecar binds the cognition surface):

1. Capture pre-drill baseline: cognition request → 200 with bounded interpretation
2. Execute degradation trigger (table column 2)
3. Capture runtime behavior + UI screenshot + log excerpt
4. Verify reviewer-of-record path remains active (manual interpretation can still be authored)
5. Restore baseline
6. Record the drill artifact under `chore/r2-cognition-degradation-drill-corpus` evidence directory

## 3. Required outputs (per drill)

For EACH drill, the chore PR must capture:

- **runtime behavior** — request/response trace
- **cognition suppression behavior** — dispatcher log line confirming suppression
- **reviewer-of-record preservation** — manual interpretation path verified
- **operational honesty behavior** — UI banner copy verified against [`../nzila-sovereignty-proving/full-operational-honesty-certification.md`](../nzila-sovereignty-proving/full-operational-honesty-certification.md)
- **governance-safe messaging** — no inflated readiness language; no fabricated confidence score
- **continuity-safe fallback** — historical lineage retrieval remains read-only available

## 4. Anti-pattern enumeration (rejected)

The cognition layer must NEVER:

- hallucinate operational certainty
- fabricate governance interpretation
- over-authorize cognition output
- emit a confidence score without a reviewer-of-record anchor
- silently retry beyond the bounded retry budget
- silently fallback to cached interpretation
- collapse into ambient AI assistant framing
- emit "AI thinking" copy without explicit governance context

## 5. Cadence

Cognition degradation drills are bound to a stewardship cadence:

- per cognition provider key rotation (R8 trigger)
- per Whisper / completion deployment SKU change
- per governance schema migration
- per reviewer-of-record cohort change

## 6. Verdict

R2 protocol is **fully specified, evidence-anchored, reviewer-of-record bound, cadence-aligned**. Embodied institutional maturity; calm under provider degradation; deterministic; inevitable; singular.

**Status: PARTIALLY CLOSED. Chore PR: `chore/r2-cognition-degradation-drill-corpus` (recurring).**
