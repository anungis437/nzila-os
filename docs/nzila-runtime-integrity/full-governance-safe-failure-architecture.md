# Full Governance-Safe Failure Architecture

> Establishes institutional, governance-safe behavior under runtime failure. Eliminates fail-open auth, silent fallback, hidden role degradation, and silent cognition degradation. Authorizes a separate runtime hardening PR.

## Authority Anchors

- [Runtime Integrity README](README.md)
- [Full Auth & Role Lineage Audit](full-auth-role-lineage-audit.md)
- [Full Dashboard & Runtime Failure Integrity](full-dashboard-runtime-failure-integrity.md)

## Posture

Runtime failures must behave **institutionally**. The runtime must move from:

- fail-open auth → **fail-closed governance**
- silent fallback → **explicit degradation**
- hidden role degradation → **bounded runtime behavior**
- implicit default behavior → **continuity-safe fallback**
- swallowed governance errors → **operationally honest messaging**
- silent cognition degradation → **bounded cognition disablement**

Failures must increasingly feel **institutionally governed**, not broken.

## Architectural Targets

| Surface | Current Posture | Target Posture |
| --- | --- | --- |
| auth resolution failure | currently catches and falls through to Entra (acceptable) and to anonymous (currently fail-open in some routes) | every authenticated route must fail closed; anonymous fall-through only at explicitly public routes |
| role resolution failure | `getUserRole` throws `Authorization system unavailable` (good) | every consumer of `getUserRole` must propagate this as a governance-safe runtime banner, not a 500 |
| org resolution failure | currently throws but is caught higher up | must surface as an explicit identity-recovery view |
| cognition synthesis failure | currently renders empty surfaces | must render bounded-cognition-unavailable state with reviewer-of-record contact |
| governance gate failure | currently shown only in CI logs | must surface in-app for stewards/governance roles when relevant |
| pilot infra unavailability | currently silent in dashboard | must show pilot-mode-degraded banner with continuity-safe read-only mode |

## Required Implementation (downstream PR)

The downstream PR (`refactor/nzila-governance-safe-failure-architecture`) must actually:

- introduce a `RuntimeDegradationBanner` primitive that surfaces structured degradation with severity, scope, and reviewer-of-record contact
- introduce a `BoundedReadOnlyMode` primitive that transitions a surface to a continuity-safe read-only state when its writes would be governance-unsafe
- replace all `try { ... } catch { /* swallow */ }` patterns in dashboard layouts and API routes with one of: (a) reconciled success path, (b) `RuntimeDegradationBanner`, (c) `BoundedReadOnlyMode`, (d) explicit thrown identity error
- ensure cognition surfaces transition to a bounded-cognition-disabled state under synthesis failure rather than rendering empty fail-open shells
- ensure every degradation event is emitted to instrumentation as evidence-anchored observability data

## Forbidden Posture

The following are explicitly rejected:

- **ai-first** error remediation paths (forbidden — recovery is institutional, not ai-powered, not copilot-driven, not chatbot-driven, not workforce ai)
- **autonomous executive** silent privilege re-grant (forbidden — privilege transitions are reviewer-of-record gated)
- **engagement gamification** of degraded states (forbidden — degradation UX is institutional, never a productivity optimization, never an ai assistant or ai ceo surface)
- silent fail-open behavior on any authenticated route (forbidden — silence is incompatible with governance-safe operation)

## Stewardship Cadence

Failure architecture observations are reviewed on the standing daily / weekly / monthly / quarterly stewardship cadence. Recurrent fail-open patterns are treated as continuity-safe regressions and remediated under reviewer-of-record approval.

## Authorized Downstream PR

This document authorizes exactly one runtime hardening PR titled `refactor/nzila-governance-safe-failure-architecture`. It must not bundle other axis work.
