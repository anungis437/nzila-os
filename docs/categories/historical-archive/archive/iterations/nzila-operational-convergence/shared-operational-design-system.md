# Shared Operational Design System

> **Status:** Canonical convergence · **Layer:** Design system · **Inherits:** [docs/nzila-governance-experience/governance-experience-design-system.md](../nzila-governance-experience/governance-experience-design-system.md)

## 1. Objective

Express one operational design language — calm, restrained, institutional — that every Nzila product inherits.

## 2. Canonical tokens

| Token | Value |
|---|---|
| Section spacing | ≥ 32px |
| Card internal padding | ≥ 24px |
| Body line-height | ≥ 1.6 |
| Maximum heading weight | 600 |
| Posture card border | Banded text colour at low saturation |
| Posture card surface | `bg-card` token |
| Decision card | `border-border bg-card text-card-foreground` |
| Eyebrow text | uppercase, tracking-wide, muted |
| Motion | None for routine; ≥ 200ms opacity for cadence refresh |

## 3. Standardized components

- Posture card.
- Continuity band view.
- Stabilization summary.
- Attestation panel.
- Legitimacy summary card.
- Governance timeline.
- Decision ledger panel.

These ship from [`apps/control-plane/components/governance-experience`](../../apps/control-plane/components/governance-experience) and SHOULD be the visual source of truth for every Nzila app's governance surfaces. Cross-app reuse happens via co-located, identical-shape RSCs in each app — never via cross-app imports.

## 4. Standardized presentation rules

- Bandings are text-first, colour-second.
- Verdicts are text-first, colour-second.
- Content hashes are mono-font and always visible on attestations.
- Doctrine citations are visible on every governance card.

## 5. Discipline

The design language succeeds when a printout from any Nzila product belongs in the same institutional binder.
