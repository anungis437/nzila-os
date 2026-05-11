# Platform Cognition Substrate Refactor

> Canonical realignment of platform intelligence packages toward **institutional cognition substrate**.

## 1. Convergence Statement

Platform packages currently named with AI-first or intelligence-first semantics must converge toward **cognition substrate** semantics:

- cognition substrate
- continuity reasoning substrate
- institutional memory substrate
- operational interpretation substrate
- bounded inference substrate
- governance-safe cognition substrate

Package architecture should reflect **institutional cognition infrastructure**, not "AI platform infrastructure."

## 2. Refactor Targets

| Current | Reframing (logical) | Rename Status |
|---------|--------------------|---------------|
| `packages/ai-core` | governance-safe cognition primitives | deferred |
| `packages/ai-control` | cognition control / budget substrate | deferred |
| `packages/ai-registry` | cognition asset registry (model cards, bias) | deferred |
| `packages/ai-sdk` | bounded cognition output SDK | deferred |
| `packages/clc-executive-intelligence` | executive cognition substrate | deferred |
| `packages/clc-decision-intelligence` | decision cognition substrate | deferred |
| `packages/cfo-intelligence` | financial operational cognition substrate | deferred |
| `packages/platform-intelligence` | platform cognition aggregator | deferred |
| `packages/workload-intelligence` | workload continuity substrate | deferred |
| `packages/policy-intelligence` | policy continuity substrate | deferred |
| `packages/trustops-intelligence` | trust-ops continuity substrate | deferred |
| `packages/zonga-intelligence` | content continuity substrate | deferred |

> Renames are non-blocking. The doctrinal posture (cognition substrate, bounded inference, anti-surveillance) is enforced **first**; symbol-level renames roll in over follow-on PRs to keep CI stable.

## 3. Required Substrate Behavior

Every cognition-related package must:

- expose bounded inference primitives only
- preserve audit/escalation surfaces
- avoid surveillance-risk primitives at the workforce or individual level
- avoid behavioral optimization scoring as a public primitive
- align with the [Institutional Operational Cognition Doctrine](institutional-operational-cognition-doctrine.md)

## 4. Naming Convention (Forward Direction)

When new packages are created in this domain, prefer:

- `*-cognition-substrate`
- `*-continuity-substrate`
- `*-memory-substrate`
- `*-bounded-inference`

over:

- `ai-*`
- `*-intelligence`
- `*-recommendation-engine`
- `*-copilot`

## 5. Authority

This refactor is anchored to the [Institutional Operational Cognition Doctrine](institutional-operational-cognition-doctrine.md).
