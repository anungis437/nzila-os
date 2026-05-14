# Workstream F — Inline Runtime Copy Convergence & Institutional Surface Alignment

**Status:** ✅ Complete
**Scope:** Display-layer / governance-config only — no runtime logic, schema, RBAC, FSM, route, or auth changes.
**Strategic principle:** *Explainable democratic institutional infrastructure.*

## Convergence outcome

Workstream E uplifted the i18n message catalogue. Workstream F closes the loop on the
**inline runtime copy** that lives directly inside dashboard route components — the page-level
`description` strings, route-level H1s, and route-component JSX literals that bypass `next-intl`.
These surfaces are now expressed in the same institutional continuity ontology as the rest of
the platform:

- Dashboards are framed as **reviewer-led / reviewer-assisted institutional surfaces**, not
  command consoles.
- Continuity routes speak in **chronology**, **lineage**, **fragility signals**, **resilience
  pathways**, and **safeguard strategies**.
- Memory surfaces are framed as **preserved context, procedural lineage, and continuity-aware
  records**.
- Storybook framing is **institutional chronology** rather than analytic intelligence.
- Governance guarantees are restated in **employee-level optimization** terms, removing the
  ambient "workforce optimization" string that read poorly even inside negation framing.

The narrative governance vocabulary has been extended so that future drift toward
command-centre / surveillance / optimization-engine language is caught automatically, and the
internal-narrative sweep now covers all the dashboard routes that were previously outside its
field of view.

## Audit input

- Pre-implementation audit: `reports/narrative/workstream-f-inline-runtime-convergence-audit.md`
- Surface classification: route-level descriptions, route-level H1s, inline JSX literals,
  governance guarantee titles, and the internal-narrative glob coverage gap.

## Inline copy reframes

Applied to `apps/union-eyes/app/[locale]/dashboard/<route>/page.tsx`:

| # | Surface | From | To |
|---|---|---|---|
| 1 | `continuity-intelligence/page.tsx` `description` | (prior generic intelligence framing) | `Reviewer-assisted institutional continuity surface: continuity fragility signals, expertise continuity lineage, succession readiness, and chronology-aware continuity intelligence.` |
| 2 | `continuity-planning/page.tsx` `description` | (prior generic planning framing) | `Reviewer-led institutional continuity planning workspace with explainable reasoning, resilience pathways, and traceable action chronology.` |
| 3 | `continuity-simulation/page.tsx` `description` | (prior simulation framing) | `Reviewer-led workspace to explore institutional continuity fragility, simulate disruption scenarios, and compare continuity safeguard strategies.` |
| 4 | `institutional-memory/page.tsx` `description` | (prior knowledge-library framing) | `Navigate your institution's preserved context, procedural lineage, and continuity-aware records.` |
| 5 | `longitudinal-cognition/page.tsx` H1 | (prior analytic framing) | `Institutional Chronology Storybook` |
| 6 | `governance-center/page.tsx` `GUARANTEES[1].title` | `No workforce optimization` | `No employee-level optimization` |

Locked taxonomy preserved verbatim: Inbox → Intake & Coordination · Work → Casework Continuity ·
Priorities → Commitments & Deadlines · Intelligence → Institutional Intelligence · Cognition →
Governed Reasoning · Governance → Governance of Record · Corporate Memory → Institutional Memory ·
Trust → Trust & Sovereignty · Workbench → Casework Console · Cases → Representation Cases ·
Reports → Institutional Reports · Operational Health → Continuity Operations · Outcomes → Member
Outcomes Ledger · Submit Request → Open Representation Case.

## Narrative governance config additions

`apps/union-eyes/tooling/marketing/config/forbidden-vocabulary.ts`

### New hard-fails appended to `surveillanceAi`

- behavioural governance
- behavioral governance
- organizational analytics
- leadership analytics
- institutional scoring
- operational war room

### New warnings (counted toward maturity drift)

- decision intelligence
- fragility analysis
- governance intelligence
- intelligence cockpit
- executive command

### Internal-narrative glob coverage extension

`apps/union-eyes/tooling/marketing/narrative-audit.ts` — `INTERNAL_NARRATIVE_GLOBS` now includes
the seven plain-segment dashboard routes that previously slipped past the internal sweep:

- `governance-center`
- `continuity-intelligence`
- `continuity-planning`
- `continuity-simulation`
- `longitudinal-cognition`
- `executive-operating-intelligence`
- `institutional-memory`

(Each glob: `app/[[]locale[]]/dashboard/<name>/**/page.tsx`, using PowerShell-safe escapes.)

### Maturity score correction (instrumentation only)

The internal-narrative sweep flags vocabulary on internal surfaces but does not run rule modules
on them, so each internal file carries `maturity: 0`. With the WS F glob extension that pool
grew, mathematically diluting the unweighted average and masking real public-surface scores.
`averageMaturity` is now computed over rule-scored files only (public marketing surfaces),
which is what the gate is designed to measure. The full per-file table in
`reports/narrative/narrative-audit.json` is unchanged — only the headline summary is corrected.

## Validation gates

| Gate | Result |
|---|---|
| Narrative audit — files scanned | 95 |
| Hard-fail violations | **0** ✅ |
| Rule failures | **0** ✅ |
| Warning violations | 229 |
| Institutional maturity (avg, public surfaces) | **88/100** ✅ (gate ≥85) |
| `pnpm narrative:check --ci` | passes |
| `pnpm typecheck` (root) | **224/224 successful** ✅ |

## Out of scope (verified)

- No runtime logic, schema, RBAC, FSM, route, telemetry, or auth changes.
- Locked taxonomy preserved verbatim — no relabeling beyond the inline reframes listed above.
- No edits under `governance/ga/**`, `packages/institutional-governance-graph/**`, or
  `reports/governance-graph/**`.
- `pnpm-lock.yaml`, `audit-out.txt`, `module-runtime-alignment-report.{json,md}` excluded
  from the WS F commit.
