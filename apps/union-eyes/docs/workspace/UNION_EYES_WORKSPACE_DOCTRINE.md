# Union Eyes Workspace Doctrine

> Status: v1
> Pattern: Club360-style workspace consolidation
> Owner: Union Eyes product/engineering

## Why this exists

Union Eyes grew into a large collection of disconnected operational pages.
Each page is individually useful, but the overall experience is fragmented:
there is no single surface that answers "how is the union doing right now, and
what needs my attention?"

This doctrine applies a **proven workspace consolidation pattern** — the
**Club360 pattern** — to Union Eyes.

## The Club360 pattern (the precedent)

Club360 was a workspace transformation applied to a different product ("The
Button"). It did **not** delete the legacy pages. It **subordinated** them into
one workspace surface. The pattern is:

1. Create a single workspace entry point.
2. Group existing pages into a small number of canonical tabs.
3. Make each tab answer **one** operational question.
4. Require every tab to expose: **Current State**, **Required Actions**, **Deep Work Link**.
5. Keep legacy pages alive as execution surfaces.
6. Add telemetry to track: workspace opened, tab opened, deep-work clicked, legacy page visited.
7. Gradually retire or subordinate legacy navigation **only after workspace adoption is proven**.

This document applies that exact pattern to Union Eyes. We do **not** invent a
new information-architecture pattern.

## Mission

> Union Eyes should feel like one operating system, not a collection of pages.

This is **not** a UI redesign. It is a **route-consolidation and
operational-surface program**.

## Target route

The workspace lives at:

```
app/[locale]/dashboard/workspace
```

### Route choice rationale

The mission brief suggested `app/(dashboard)/workspace`. Union Eyes, however,
already has a stronger, established dashboard convention:

- All operational pages live under `app/[locale]/dashboard/*`.
- The dashboard chrome (sidebar, organization selector, auth guards) is provided
  by `app/[locale]/dashboard/layout.tsx`.
- There is a separate, nearly empty `app/[locale]/(dashboard)/` route group that
  only contains `analytics` and does **not** carry the dashboard shell.

To inherit the existing dashboard shell, auth, and locale handling — and to keep
the change boring and deterministic — the workspace is placed at
`app/[locale]/dashboard/workspace`. This is the documented deviation from the
brief's suggested path.

## Canonical tabs (v1)

Union Eyes v1 has **exactly seven** top-level tabs:

```
Overview
Case Operations
Members
Governance
Continuity
Financial
Documents
```

- **Intelligence is NOT a top-level tab in v1.**
- **OCI / OCRA belongs under Continuity**, never as a separate top-level workspace.

The detailed tab contract and question-per-tab mapping is defined in
[UNION_EYES_TAB_SCHEMA.md](./UNION_EYES_TAB_SCHEMA.md).

## Universal tab contract

Every tab renders exactly three sections:

| Section | Question it answers |
| --- | --- |
| **Current State** | What is true right now? |
| **Required Actions** | What needs attention? |
| **Deep Work** | Where does the user go to execute the detailed workflow? |

**Deep Work links to existing legacy routes wherever possible.** The workspace
does **not** duplicate legacy execution pages — it subordinates and points to
them.

## Overview invariant

> **Overview may summarize all tabs, but cannot own any deep workflow directly
> unless that route is already owned by another tab.**

Overview is a cross-tab health summary, not an execution surface. Every Deep
Work link on Overview must point at a route that another tab already owns. This
prevents Overview from becoming a dumping ground for orphaned routes. (Enforced
by `components/workspace/__tests__/workspace-config.test.ts`.)

## Continuity is the strategic differentiator

> Continuity is **more than assessments.** In addition to OCI/OCRA, the
> Continuity tab **must own** officer transition, knowledge transfer, and
> institutional memory.

Keeping these under Continuity is what makes it a strategic differentiator
rather than "just the assessment tab." OCI/OCRA stays here — never top-level.

## Data rule

- Use **real data only where cleanly available**.
- Where no canonical data source exists, render an **honest empty state** (for
  example: "Awaiting first case data.", "Awaiting continuity assessment.",
  "No governance records connected yet.").
- **Never fabricate metrics.** Never invent demo numbers unless clearly marked
  as fixture/demo data in a non-production context.

## Legacy route subordination

- We do **not** delete existing routes.
- Every existing dashboard route is mapped to one workspace tab in
  [UNION_EYES_WORKSPACE_MAP.md](./UNION_EYES_WORKSPACE_MAP.md).
- Legacy navigation remains live until workspace adoption is proven by telemetry.

## Telemetry

Telemetry exists **only** to validate workspace usefulness and legacy-route
subordination. The schema and privacy rules are defined in
[UNION_EYES_TELEMETRY_SCHEMA.md](./UNION_EYES_TELEMETRY_SCHEMA.md).

Telemetry **must not** include member identifiers, case identifiers, grievance
details, user productivity data, or surveillance-style behavior profiles.

## OCI / OCRA guardrail

The OCRA complexity validation has passed and is a **non-regression guard**:

- world-class complexity validation passed
- API boundary validation passed
- adaptation regression suites passed
- `test:fast` passed

The workspace **must not** change OCI/OCRA scoring or routing behavior. It only
links into the existing OCI/OCRA surfaces from the Continuity tab.

## Implementation sequence

1. **Doctrine** — this file plus tab schema, telemetry schema, workspace map.
2. **Static shell** — workspace route, tab navigation, shared panel components,
   empty-state component, deep-work link component.
3. **Tab panels** — all seven tabs with the universal contract.
4. **Deep-work wiring** — link tabs to existing dashboard routes.
5. **Telemetry** — lightweight emitter and endpoint.
6. **Navigation subordination** — workspace as the primary dashboard entry
   point; legacy nav retained.
7. **Validation** — typecheck, lint, route/component tests, OCI/OCRA complexity
   validation if touched.

## Acceptance criteria

1. Workspace doctrine files created.
2. Workspace route exists and renders.
3. Seven canonical tabs exist.
4. Every tab exposes Current State, Required Actions, Deep Work.
5. Existing routes are mapped, not deleted.
6. OCI/OCRA is under Continuity, not top-level.
7. Telemetry schema exists; implementation emits only allowed events.
8. No fabricated production metrics.
9. Typecheck and lint pass.
10. Summary explains exactly which legacy routes were subordinated.
