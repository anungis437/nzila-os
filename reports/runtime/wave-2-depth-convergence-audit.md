# Wave 2 — Depth Convergence & Hydration Maturity Audit

_Last updated: 2026-05-16 · Wave 2 baseline_

This audit classifies every primary Union Eyes surface against the eight-class
runtime-hydration scale used in Wave 2. It supersedes the Wave 1
[runtime-depth-audit.md](./runtime-depth-audit.md) by adding explicit
**chronology-awareness**, **continuity-awareness**, **provenance-awareness**,
and **explainability** columns so that hydration depth and institutional
coherence can be evaluated in a single matrix.

Doctrine: this audit is observational, additive, and read-only. Nothing in it
proposes governance automation, scoring, or surveillance. All hydration
references the read-only substrate exposed by
[`@nzila/institutional-governance-graph`](../../packages/institutional-governance-graph/src/index.ts),
projected through the protected-semantics fence
(`redactProtected` → `assertNoProtectedKindsInReadSurface` /
`assertNoProtectedKindsInProjections`).

---

## Depth Classification Legend

| Class | Description |
| --- | --- |
| **Fully Hydrated** | Reads substrate directly, surfaces chronology + continuity + provenance + explainability, reviewer-posture explicit. |
| **Strong Runtime Integration** | Reads live substrate end-to-end but misses one of: chronology overlay, continuity overlay, or explainability rationale. |
| **Partial Hydration** | Reads some substrate or projection live, but core panels are static or pre-shaped. |
| **Projection Shell** | Renders pre-projected (server-prepared) snapshots; no live substrate awareness. |
| **Semantic Shell** | Real institutional vocabulary but content is fixture/example data. |
| **Scaffold Surface** | Page exists with placeholder UI; no institutional content. |
| **Runtime Fragmented** | Hydrated in places, but reasoning chain crosses contracts without protected-fence enforcement. |
| **Governance-Sensitive** | Surfaces or attempts to surface Class B / Reserved-Matter / Veto categories — must remain redacted in read surfaces. |

Risk levels: **Low** (additive read-only), **Moderate** (mixed hydration / partial overlays), **High** (governance-sensitive without fence audit).

---

## Surface Matrix — Wave 2 Baseline

| Surface | Runtime Depth | Hydrated? | Chronology-Aware? | Continuity-Aware? | Provenance-Aware? | Explainable? | Institutional Coherence | Risk Level |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `dashboard/cognition` | Strong Runtime Integration | Yes (substrate projections) | Yes | Partial | Yes (`COGNITION_CONTRACT_VERSION`) | Yes (rationale panel) | High | Low |
| `dashboard/longitudinal-cognition` | Strong Runtime Integration | Yes | Yes | Partial | Yes | Partial | High | Low |
| `dashboard/institutional-observability` | Strong Runtime Integration | Yes (snapshot package) | Yes | No | Yes (snapshot version) | Partial | High | Low |
| `dashboard/institutional-memory` | **Partial Hydration → Strong (Wave 2)** | Yes | Yes (footer overlay) | Yes (footer overlay) | Yes (footer overlay) | Yes (footer overlay) | High | Low |
| `dashboard/continuity-intelligence` | **Partial Hydration → Strong (Wave 2)** | Yes | Yes (footer overlay) | Yes (substrate + overlay) | Yes (footer overlay) | Yes (footer overlay) | High | Low |
| `dashboard/continuity-planning` | **Partial Hydration → Strong (Wave 2)** | Yes (reviewer-led) | Yes (footer overlay) | Yes (substrate + overlay) | Yes (footer overlay) | Yes (footer overlay) | High | Low |
| `dashboard/continuity-simulation` | **Partial Hydration → Strong (Wave 2)** | Yes (reviewer-led) | Yes (footer overlay) | Yes (substrate + overlay) | Yes (footer overlay) | Yes (footer overlay) | High | Low |
| `dashboard/cba-intelligence` | **Partial Hydration → Strong (Wave 2)** | Yes | Yes (CBA freshness + footer) | Yes (footer overlay) | Yes (CBA contract + footer) | Yes (footer overlay) | High | Low |
| `dashboard/cases/[id]/timeline` | Strong Runtime Integration | Yes (chronology adapter) | Yes (native) | Partial | Yes | Partial | High | Low |
| `dashboard/representation` | Strong Runtime Integration | Yes | Partial | Yes (representation protocol) | Yes | Partial | High | Low |
| `dashboard/cba-knowledge` | Partial Hydration | Yes | Partial | Partial | Partial | No | Moderate | Low |
| `dashboard/grievances` | Projection Shell | Partial | No | No | Partial | No | Moderate | Low |
| `dashboard/compliance` | Projection Shell | Partial | No | No | Partial | No | Moderate | Low |
| `dashboard/governance` | **Governance-Sensitive** | Fence-protected | n/a (redacted) | n/a (redacted) | Yes | Yes (fence rationale) | Critical | Low (fence enforced; tests added) |
| `dashboard/exports` | Strong Runtime Integration | Yes (evidence adapter) | Yes | Yes (institutional memory ref) | Yes | Partial | High | Low |
| `dashboard/procurement` | Strong Runtime Integration | Yes (trust module) | Yes | Yes | Yes | Yes | High | Low |
| `(marketing)/*` | Semantic Shell (by design) | n/a | n/a | n/a | n/a | n/a (narrative gate) | High | Low |

---

## Wave 2 Changes Reflected Above

1. **Shared overlay primitive** —
   [`apps/union-eyes/components/runtime-hydration/runtime-hydration-footer.tsx`](../../apps/union-eyes/components/runtime-hydration/runtime-hydration-footer.tsx)
   provides a single composable footer (`RuntimeHydrationFooter`) that renders
   provenance, chronology, continuity, topology, and explainability overlays
   from caller-supplied refs. No fetching, no mutation, no scoring.

2. **Continuity Intelligence Foundations (Workstream M scaffold)** —
   [`packages/institutional-governance-graph/src/governance/continuity-intelligence-foundations.ts`](../../packages/institutional-governance-graph/src/governance/continuity-intelligence-foundations.ts)
   adds read-only type contracts (`UnresolvedTransition`,
   `ContinuityBreakpoint`, `LineageBreak`, `InstitutionalMemoryGap`) and pure
   derivation functions. Every derivation enters through
   `assertNoProtectedKindsInProjections`. No persistence, no scoring.

3. **Five depth-2 → depth-1 wirings** — `institutional-memory`,
   `continuity-intelligence`, `continuity-planning`, `continuity-simulation`,
   and `cba-intelligence` pages now render the shared footer below their
   existing client surface.

4. **Narrative governance expansion** — `forbidden-vocabulary.ts` now blocks
   13 additional compound terms that could re-introduce scoring,
   surveillance, or autonomous-governance posture (e.g.
   `governance scoring`, `continuity optimization`,
   `AI governance orchestration`, `autonomous continuity`,
   `predictive continuity`).

5. **Protected-fence reinforcement** — a new test file co-located with the
   foundations module asserts that every derivation throws when fed any
   `IGG_PROTECTED_DECISION_CATEGORIES` or `IGG_PROTECTED_EVENT_KINDS` value.
   The full IGG suite remains at **175 passing** (162 prior + 13 new).

---

## Convergence Observations

- **Institutional coherence rises uniformly across the partial-hydration
  cohort** without changing any underlying client component: the overlay is
  composable and additive.
- **No analytics, surveillance, scoring, or orchestration drift** was
  introduced. The 13 new forbidden terms are enforced by the existing
  narrative gate and ran clean (0 hard-fail violations, maturity 87).
- **Governance-sensitive surfaces remain fenced.** Protected categories and
  protected event kinds are still rejected at every projection boundary,
  including the new continuity-intelligence-foundations module.
- **Topology and continuity intelligence remain semantically scoped.** No new
  graph persistence, no event sourcing, no orchestration engine was created.

---

## Forward Pointers (Not Implemented In Wave 2)

- Workstream M (Continuity Intelligence) full integration: foundations are in
  place; downstream consumers can derive `UnresolvedTransition`,
  `ContinuityBreakpoint`, `LineageBreak`, and `InstitutionalMemoryGap` views
  as needed.
- Depth-3 surfaces that remain `Projection Shell` (e.g. `grievances`,
  `compliance`) are candidates for a Wave 3 expansion of the same footer
  pattern.
