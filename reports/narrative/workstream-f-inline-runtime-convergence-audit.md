# Workstream F — Inline Runtime Copy Convergence Audit

**App:** `apps/union-eyes`
**Branch:** `chore/post-delta-7-orchestrator-image-fix-2026-05-12`
**Strategic principle:** Union Eyes runtime surfaces should read as **explainable democratic
institutional infrastructure** — chronology-aware, continuity-safe, governance-neutral, and
reviewer-supervised.
**Layer:** Display / inline-string / narrative-CI configuration. **No runtime, schema, RBAC, or
behavioural change.**

## Method

For each priority route under `apps/union-eyes/app/[locale]/dashboard/`, read the
`page.tsx` file and inventory:

- `metadata.title` / `metadata.description`
- inline JSX text (headings, subtitles, footer copy)
- inline constants used as user-visible strings (e.g. `GUARANTEES`, button labels, empty-state copy)
- inline reasoning / chronology framing (storybook chapters, briefing highlights)

Each surface is classified across the 10-bucket WS F taxonomy.

> **Note on scan coverage.** `tooling/marketing/narrative-audit.ts` currently scans
> `app/[locale]/(dashboard)/**` (route-group), but the priority WS F routes live at
> `app/[locale]/dashboard/**` (no route group). They are therefore **not yet covered** by the
> internal narrative scan. Workstream F extends `INTERNAL_NARRATIVE_GLOBS` to include the
> priority routes specifically, so vocabulary drift is now CI-enforced on these surfaces.

## Priority route classification

### `dashboard/governance-center/page.tsx`

- **Bucket:** Fully aligned (Tier 1).
- Reads as a procurement-grade trust center: "Anti-surveillance guarantees", "Organizational
  scope only", "No workforce optimization", "No autonomous governance authority", "Explainable
  by construction", "Auditable provenance".
- Footer: *"all surfaces remain organizationally scoped, explainable, and labor-safe."*
- Verdict: **no copy change**. Already converged.

### `dashboard/continuity-intelligence/page.tsx`

- **Bucket:** SaaS drift + governance-overreach risk (Tiers 4 + 5).
- `metadata.description` reads: *"Executive organizational continuity oversight: fragility
  analysis, expertise concentration risks, succession readiness, and governance intelligence."*
  - "Executive ... oversight" → command/control posture.
  - "fragility analysis" → analytics drift.
  - "governance intelligence" → governance-overreach optics.
- Verdict: **reframe** to reviewer-assisted, chronology-aware framing.

### `dashboard/continuity-planning/page.tsx`

- **Bucket:** SaaS drift + intelligence-cockpit drift (Tier 4 + Tier 6).
- `metadata.description` includes "decision intelligence", "resilience roadmap", "action
  tracking".
- Verdict: **reframe** to reviewer-led continuity planning + resilience pathways +
  traceable action chronology.

### `dashboard/continuity-simulation/page.tsx`

- **Bucket:** Continuity-opportunity (Tier 7).
- `metadata.description` is acceptable but uses generic "mitigation strategies" framing.
- Verdict: **reframe** to *continuity safeguard strategies*.

### `dashboard/institutional-memory/page.tsx`

- **Bucket:** Mostly aligned but knowledge-management drift (Tier 2 + Tier 6).
- `metadata.description`: *"Navigate your organization's operational knowledge, procedures,
  and institutional history."*
- Verdict: **reframe** to *preserved institutional context · procedural lineage ·
  continuity-aware records*.

### `dashboard/longitudinal-cognition/page.tsx`

- **Bucket:** Mostly aligned (Tier 2) — chronology opportunity (Tier 8).
- The page is already deliberately calm: "No individual is profiled. No workforce inference is
  produced." Confidence chips and per-chapter anchors render evidence provenance well.
- `metadata.description` uses "institutional storytelling" — fine, but **chronology** is the
  stronger institutional frame.
- H1 *"Institutional Cognition Storybook"* → reframe to *"Institutional Chronology Storybook"*
  (keeps "storybook" UX metaphor; converges to chronology semantics).
- Verdict: **reframe headline + description; preserve all functional/technical copy**.

### `dashboard/executive-operating-intelligence/page.tsx`

- **Bucket:** Mostly aligned (Tier 2).
- "Signals routed for human review", "Reasoning chain", "engine(s) degraded", footer
  *"Organizationally scoped · explainable · labor-safe"* — these are strong governance-safe
  signals.
- Verdict: **no copy change** this pass. Already aligned with WS C–E posture.

### Redirect-only routes (no copy)

- `dashboard/governance-culture/page.tsx` — redirects to `/dashboard/governance?tab=culture`.
- `dashboard/governance-recommendations/page.tsx` — redirects to `?tab=recommendations`.
- `dashboard/institutional-intelligence/page.tsx` — redirects to `intelligence?tab=institutional`.
- `dashboard/institutional-operating-intelligence/page.tsx` — redirects to
  `intelligence?tab=executive-operating`.
- Verdict: **no copy to change.**

### Routes confirmed not present

- `dashboard/memory/page.tsx` — does not exist (covered by `institutional-memory` only).

## Protected-governance exposure audit

Searched the priority routes for accidental exposure of:

- Class-B / Class-A structural references → **none found** in runtime-visible copy.
- Reserved-matter logic → **none found** in runtime-visible copy.
- Founder-control / governance-lock semantics → **none found**.
- Veto semantics → **none found**.

Governance Center references **"reserved matters"** only as a sovereignty taxonomy label; it
does not enumerate the matters themselves. This is governance-safe and remains.

## Narrative-CI Part H additions

`apps/union-eyes/tooling/marketing/config/forbidden-vocabulary.ts`:

### New hard-fails (`surveillanceAi`)

These extend WS D / WS E coverage, targeting analytics-cockpit framing on internal runtime:

- "behavioural governance"
- "behavioral governance"
- "organizational analytics"
- "leadership analytics"
- "institutional scoring"
- "operational war room"

### New warnings (`warningLevel`)

Counted toward maturity drift. Chosen to flag intelligence-cockpit drift without breaking
already-aligned copy:

- "decision intelligence"
- "fragility analysis"
- "governance intelligence"
- "intelligence cockpit"
- "executive command"

### Scan-glob expansion

Add the priority WS F routes to `INTERNAL_NARRATIVE_GLOBS` so future drift on these surfaces is
caught by `pnpm narrative:check --ci`:

```
app/[locale]/dashboard/governance-center/**/page.tsx
app/[locale]/dashboard/continuity-intelligence/**/page.tsx
app/[locale]/dashboard/continuity-planning/**/page.tsx
app/[locale]/dashboard/continuity-simulation/**/page.tsx
app/[locale]/dashboard/longitudinal-cognition/**/page.tsx
app/[locale]/dashboard/executive-operating-intelligence/**/page.tsx
app/[locale]/dashboard/institutional-memory/**/page.tsx
```

(Selective rather than wholesale `dashboard/**` to avoid surfacing pre-existing drift on routes
that have not yet been reframed.)

## Acceptance gates

- `pnpm narrative:audit` — maturity ≥ 85, hard-fail = 0
- `pnpm narrative:check --ci` — green
- `pnpm typecheck` — 224 / 224

## Out-of-scope (deferred)

- Component-level inline copy under `components/knowledge-transfer/*` (the actual cockpit
  shells). The page.tsx files in WS F render those components but do not own their inline
  strings. A focused component pass would be a separate workstream to keep blast radius bounded.
- Other dashboard routes not in the WS F priority list. They will be brought under the internal
  glob in a future pass after their copy is converged.
