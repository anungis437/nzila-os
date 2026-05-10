# Governance Operations Event Interpretation

> **Status:** Canonical governance operations · **Layer:** Interpretation · **Inherits:** [governance-evidence-explorer.md](governance-evidence-explorer.md)

## 1. Objective

Translate governance events into governance-readable operational interpretation that an executive, operator, or auditor can read without orientation.

## 2. Interpretable categories

| Category | Calm interpretation pattern |
|---|---|
| Governance warnings | "Doctrine X requires attention; current state is banded `warming`." |
| Continuity signals | "Continuity is banded `stable`; trajectory is `holding`." |
| Legitimacy drift | "Environment Y is banded `partial`; manifest hash matches; isolation is verified." |
| Doctrine enforcement outcomes | "Policy Z denied N route attempts in the last window; reason: pilot isolation." |
| AI governance events | "Capability Q was refused N times; reason: unregistered version." |
| Operational stabilization events | "Calmness threshold crossed; recommendation is to extend cadence by one cycle." |

## 3. Posture

Interpretation MUST:

- **Explain calmly.** Every interpretation is a single short institutional sentence.
- **Cite doctrine.** Every interpretation references the relevant doctrine document where applicable.
- **Avoid alarm framing.** Words like "critical", "urgent", "emergency" are reserved for actual `critical` events with a verified blocking decision.
- **Refuse to dramatize.** Repetition of the same warning does not escalate the language.

## 4. Required helpers

- `interpretEnvelope(envelope)` — pure function returning a short text interpretation.
- `interpretBanding(banding)` — pure function returning the institutional reading of a band.
- `interpretVerdict(verdict)` — pure function returning the institutional reading of a verdict.

## 5. Discipline

Interpretation succeeds when readers feel oriented and unsurprised. Interpretation that prompts reactive behavior has crossed into alarm and is rejected.
