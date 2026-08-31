# AI Data Boundary Model

**DOCTRINE_VERSION:** 1.0.0
**STATUS:** Internal/engineering — not part of the public method surface. The canonical AI
doctrine is [`docs/oci/OCI_AI_BOUNDARY.md`](../../OCI_AI_BOUNDARY.md); this document is an
implementation reference for engineers only. See [`SUPERSEDED.md`](../../SUPERSEDED.md).
**PARENT:** [OCI_AI_AUGMENTATION_DOCTRINE.md](OCI_AI_AUGMENTATION_DOCTRINE.md)

This document defines, by data type, what may and may not be passed to the AI synthesis layer.

---

## Allowance matrix

| Data Type                              | AI Allowed?                  | Notes |
|----------------------------------------|------------------------------|-------|
| Structured continuity signals          | ✅ Yes                       | Band labels + identifiers only |
| Archetype summaries                    | ✅ Yes                       | Canonical identifiers + canonical summaries |
| Maturity bands                         | ✅ Yes                       | Band labels only (e.g. `'developing'`) |
| Adaptive context bands                 | ✅ Yes                       | `institutionalScale`, `continuityExposure`, etc. |
| Continuity breakpoint identifiers      | ✅ Yes                       | Identifiers + canonical descriptions |
| Onboarding survivability findings      | ✅ Yes                       | Deterministic findings only |
| Governance continuity observations     | ✅ Yes                       | Deterministic findings only |
| Reviewer notes                         | ✅ Yes (when reviewer-added) | Treated as reviewer-authored input |
| Raw telemetry                          | ❌ No                        | Never crosses the AI boundary |
| Behavioural metadata                   | ❌ No                        | Never collected, never passed |
| Typing cadence                         | ❌ No                        | Never collected |
| Session timing                         | ❌ No                        | Never passed |
| Personal profiling                     | ❌ No                        | Out of scope; not a product |
| Organization free text                 | ⚠️ Restricted                | Only with explicit consent + reviewer presence |
| Workshop transcript                    | ⚠️ Optional + consented only | Separate workflow, not OCRA-default |
| Raw answers (Likert / select values)   | ❌ No                        | Never reach the synthesis layer |
| Email / contact / persona free text    | ❌ No                        | Never reach the synthesis layer |
| Organization name                      | ⚠️ Restricted                | Only for board-brief artefacts AND only with consent |

---

## Enforcement

The `NarrativeContext` shape in [`narrativePromptContracts.ts`](../../../../apps/union-eyes/lib/icra-ai/narrativePromptContracts.ts) is the typed wall. Any caller that attempts to inject a forbidden field fails TypeScript compilation; the runtime builder ([`buildNarrativeContext.ts`](../../../../apps/union-eyes/lib/icra-ai/buildNarrativeContext.ts)) additionally strips unexpected keys defensively.

The privacy regression suite ([`__tests__/aiPromptBoundary.test.ts`](../../../../apps/union-eyes/lib/icra-ai/__tests__/aiPromptBoundary.test.ts)) attempts injection of forbidden fields and asserts they never reach the prompt payload.

---

## Consent for restricted categories

If a deployment ever requires passing free-text or workshop-transcript material through the synthesis layer:

1. Consent must be recorded against the assessment row.
2. Reviewer must be present in the workflow.
3. A separate prompt-version and audit-record version must be used.
4. The disclosure copy must be upgraded to name the consented data type explicitly.

OCRA's default deployment never enables this path.
