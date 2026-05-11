# Live Governance Surfaces

> **Status:** Canonical governance experience · **Layer:** Surfaces · **Inherits:** [governance-experience-system.md](governance-experience-system.md)

## 1. Objective

Build actual governance-native operational surfaces that consume the operations primitives and render them as institutional reading material.

## 2. Required surfaces

| Surface | Implementation root |
|---|---|
| Governance posture overview | `apps/control-plane/app/(dashboard)/governance-experience/page.tsx` |
| Continuity posture page | `apps/control-plane/app/(dashboard)/governance-experience/continuity/page.tsx` |
| Deployment legitimacy page | `apps/control-plane/app/(dashboard)/governance-experience/legitimacy/page.tsx` |
| Governance review queue page | `apps/control-plane/app/(dashboard)/governance-experience/review/page.tsx` |
| Stabilization review page | `apps/control-plane/app/(dashboard)/governance-experience/stabilization/page.tsx` |
| Executive briefing page | `apps/console/app/(dashboard)/governance-experience/page.tsx` |

## 3. Required UX

Surfaces MUST:

- Feel institutional — printed-and-bound aesthetic preferred over SaaS-dashboard aesthetic.
- Remain sparse — one truth per card, generous whitespace.
- Remain interpretable — every reading is paired with an institutional sentence.
- Avoid telemetry walls.
- Avoid alert saturation.

## 4. Required components

- Posture cards (banded reading + interpretation + citation).
- Attestation panels (verdict + content hash + cited evidence).
- Continuity bands (dimension + banding + trajectory + stabilization guidance).
- Stabilization summaries (signal + banding + advisory).
- Governance-safe timeline (banded events, no payload exposure).
- Decision ledger panel (append-only, supersession history visible).

## 5. Discipline

A live governance surface succeeds when an operator can answer "what is the institution's governance state?" within five seconds of arrival, and can stop reading without anxiety.
