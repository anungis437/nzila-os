# AI Disclosure Notice

**DOCTRINE_VERSION:** 1.0.0
**STATUS:** Canonical
**PARENT:** [OCI_AI_AUGMENTATION_DOCTRINE.md](./OCI_AI_AUGMENTATION_DOCTRINE.md)

This document provides the canonical disclosure language that must appear wherever OCRA surfaces AI-assisted narrative content.

---

## Canonical disclosure (en-CA)

> Certain narrative summaries in this report may be AI-assisted. Findings remain grounded in structured continuity signals, deterministic assessment logic, and reviewer-led interpretation.

## Canonical disclosure (fr-CA)

> Certains résumés narratifs de ce rapport peuvent être assistés par IA. Les constats demeurent fondés sur des signaux structurés de continuité, une logique d'évaluation déterministe et une interprétation menée par un réviseur.

These strings are exported in machine-readable form from [`apps/union-eyes/lib/icra-ai/aiDisclosureCopy.ts`](../../../apps/union-eyes/lib/icra-ai/aiDisclosureCopy.ts) and verified by `aiDisclosureIntegrity.test.ts`.

---

## Where the disclosure must appear

| Surface | Required |
|---------|----------|
| Executive Continuity Brief PDF (AI-assisted narrative section) | ✅ Yes |
| Workshop summary surface (when AI-assisted) | ✅ Yes |
| Facilitator companion (when AI-assisted) | ✅ Yes |
| Board-brief artefacts (when AI-assisted) | ✅ Yes |
| Trust center "What AI is used for" section | ✅ Yes |
| Procurement pack AI boundary page | ✅ Yes |

---

## Forbidden disclosure variants

The disclosure must never be softened or rephrased to claim more than the canonical statement permits. The following variants are explicitly forbidden:

- "AI evaluated this institution"
- "AI determined that…"
- "AI identified risks of…"
- "Powered by AI"
- "AI-generated insights"

The forbidden variants are part of [`prohibitedAiPatterns.ts`](../../../apps/union-eyes/lib/icra-ai/prohibitedAiPatterns.ts) and will fail the output validator.
