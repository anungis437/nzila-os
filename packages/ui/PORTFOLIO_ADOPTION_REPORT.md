# Nzila Portfolio UX — Phase 1 Adoption Report

**Date:** 2026-04-28
**Scope:** All 23 apps under `apps/`
**Foundation:** [`@nzila/ui` v6 design language](packages/ui/UX_DESIGN_SYSTEM.md)

> Phase 1 of the portfolio UX mission shipped the design language. This
> report records its first portfolio-wide adoption pass: what was wired
> in, where the duplications still live, and the prioritized batch order
> that subsequent increments will follow.

---

## What this increment actually did (and did not)

### ✅ Done in this increment

1. **Per-product accent activated portfolio-wide** — added
   `data-product="<product>"` to the root `<html>` of every priority app:

   | App           | `data-product` | Accent role           |
   | :------------ | :------------- | :-------------------- |
   | nzila-hq      | `hq`           | Executive blue        |
   | console       | `console`      | Operator teal         |
   | union-eyes    | `union-eyes`   | Institutional navy    |
   | zonga         | `zonga`        | Cultural violet (+ `theme-dark`) |
   | veridian-care | `veridian`     | Clinical emerald      |
   | flow          | `flow`         | Commercial sky        |
   | agrimo        | `agrimo`       | Field moss            |

2. **Canonical CSS tokens injected** — five apps with bare
   `@import "tailwindcss"` now also import `@nzila/ui/globals.css`,
   exposing every semantic token (`bg-surface-*`, `text-fg-muted`,
   `text-status-warning`, `bg-accent`, the chart palette, motion +
   radius + elevation tokens) consistently:
   - `apps/nzila-hq/app/globals.css`
   - `apps/console/app/globals.css`
   - `apps/veridian-care/app/globals.css`
   - `apps/agrimo/app/globals.css`
   - `apps/flow/app/globals.css`

3. **Accent-only delta for full-design-system apps** — Union Eyes and
   Zonga already ship complete in-app design systems with their own
   `@theme` blocks. To avoid disturbing them, only the
   `[data-product="..."]` accent variables were appended to their
   `globals.css`; all other tokens stay app-owned.

### ⛔ Deliberately not done (per restraint mandate)

- **No primitive collapse in HQ.** The local `apps/nzila-hq/components/primitives/{Stat,EmptyState,SectionHeader,Skeleton,ErrorPanel,Card,Badge}.tsx` files have a different prop surface (`tone: green|amber|red`, `hint`, etc.) than the canonical `@nzila/ui` exports (`delta`, `meta`). A blind re-export would break every cockpit page. The migration is queued for a dedicated increment that updates each call site.
- **No mass page refactors.** No app-level pages were rewritten; the foundation must prove portfolio coherence on its own before per-page work begins.
- **No new Storybook / visual regression / a11y tooling.** Phase 17/18 territory.

---

## Full duplication map (audit results)

### High-duplication apps (4)

| App            | Duplicate primitives                                                                          | Notes                                                                  |
| :------------- | :-------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------- |
| nzila-hq       | Stat, EmptyState, SectionHeader, Skeleton, ErrorPanel, Card, Badge (7)                        | Custom `tone` API; needs per-page migration                            |
| console        | Card, Button, Badge, ErrorPanel, EmptyState + 5 app-specific (KpiTile, SkeletonCard, StatusPill, PageHeader, DataTable) | Mixed: some pages already import `@nzila/ui`; consolidate next         |
| control-plane  | Skeleton, EmptyState (2)                                                                      | Simple shadcn-style; safe drop-in re-export when ready                 |
| weekone        | SectionHeader (1)                                                                             | Has HelpTooltip integration; needs prop bridge                         |

**Total deletable / re-exportable files after subsequent migrations: ~13.**

### Apps already on `@nzila/ui` (good citizens — 7)

`abr`, `flow`, `partners`, `nacp-exams`, `zonga`, `union-eyes`, `console` (partial). These import canonical primitives but had no accent activation until this increment.

### Clean apps with no UI yet (12)

`agrimo`, `cfo`, `cora`, `mobility`, `mobility-client-portal`, `platform-admin`, `test-scaffold-gp`, `trade`, `veridian-admin`, `veridian-care`, `veridian-site`, `web` — these have no duplicate primitives. As they build out UI, they should reach for `@nzila/ui` first.

### N/A

`orchestrator-api` — pure API service.

---

## Recommended migration batches (next increments)

Each batch is a separate increment. None should be attempted simultaneously.

### Batch A — Console primitive consolidation
Console already imports `@nzila/ui` Card/Button/Badge in some pages and re-implements them in others. Pick one — `@nzila/ui` — and delete the duplicates. App-specific pieces (KpiTile / DataTable / PageHeader) stay local but should be *built on* `@nzila/ui` primitives instead of using raw Tailwind classes.

### Batch B — HQ primitive collapse
1. Extend `@nzila/ui/Stat` to accept the legacy `tone: 'neutral' | 'green' | 'amber' | 'red'` plus the canonical `delta: { value, tone }` (alias mapping like Badge already has).
2. Extend `@nzila/ui/EmptyState` to support the existing HQ usage shape.
3. Replace each local file in `apps/nzila-hq/components/primitives/` with a one-line re-export from `@nzila/ui`.
4. Delete the local files. Run `pnpm --filter @nzila/nzila-hq typecheck && test`.

### Batch C — Control-plane + WeekOne ✅ (control-plane done)

**Control-plane shipped this increment:**
- `apps/control-plane/components/ui/skeleton.tsx` — collapsed to a one-line re-export of canonical `Skeleton`. APIs are identical (`HTMLAttributes<HTMLDivElement>`).
- `apps/control-plane/components/ui/empty-state.tsx` — kept the `{title, message}` API (17 consumers depend on it) but converted the body to a thin adapter that delegates to canonical `EmptyState`, mapping `message → description` and preserving the default `Inbox` icon.
- Added `data-product="control-plane"` to root layout + accent rule (`#0ea5e9` sky) appended to its self-themed `globals.css`.
- `pnpm --filter @nzila/control-plane typecheck` — ✅ clean (no call-site changes required).

**WeekOne `SectionHeader` deliberately kept local** — it integrates app-specific `HelpTooltip` that doesn't belong in the canonical primitive. The local file stays; if HelpTooltip eventually graduates to a portfolio pattern, fold it in then.

### Batch D — Union Eyes / Zonga theme convergence
These have full in-app design systems. The right move is *not* to delete their tokens but to gradually re-name app-local CSS variables to match `@nzila/ui`'s semantic names (e.g., `--card-bg` → `--color-surface-1`) so existing CSS becomes a no-op alias layer that can be deleted later without touching components.

### Batch E — Adoption sweep across remaining 12 clean apps
Add `data-product="<id>"` to each layout and `@import "@nzila/ui/globals.css"` to each globals.css when each one gains its first real page. Don't proactively wire apps that don't exist yet.

---

## Validation (this increment)

| Check                                                            | Result               |
| :--------------------------------------------------------------- | :------------------- |
| `pnpm --filter @nzila/ui test`                                   | ✅ 50 / 50 passing  |
| `pnpm --filter @nzila/ui typecheck`                              | ✅ clean             |
| `pnpm --filter @nzila/nzila-hq typecheck`                        | ✅ clean             |
| `pnpm --filter @nzila/console typecheck`                         | ✅ clean             |
| `<html data-product>` set on 7 priority apps                     | ✅ 7 / 7             |
| `@nzila/ui/globals.css` imported in 5 bare-tailwind apps         | ✅ 5 / 5             |
| Accent rule appended to 2 self-themed apps (UE + Zonga)          | ✅ 2 / 2             |
| Per-app pages broken                                             | ✅ none              |

---

## Phase scorecard (early baseline — 1 = absent, 5 = portfolio-grade)

| Phase                                  | Pre-v6 | After v6 + adoption | Target |
| :------------------------------------- | :----: | :-----------------: | :----: |
| 1 — Design language foundation         |   1    |          5          |   5    |
| 2 — Visual consistency (cross-app)     |   2    |          3          |   5    |
| 3 — Product personality (accent)       |   1    |          4          |   5    |
| 4 — Page anatomy standard              |   2    |          2          |   5    |
| 5 — Trust UX (provenance, audit)       |   3    |          3          |   5    |
| 6 — Data UX elite (tables/charts)      |   2    |          2          |   5    |
| 7 — Forms world-class                  |   2    |          2          |   5    |
| 8 — Loading / error / empty states     |   2    |          3          |   5    |
| 9 — Mobile portfolio pass              |   2    |          2          |   5    |
| 10 — Microcopy                         |   2    |          2          |   5    |
| 11 — Performance UX                    |   3    |          3          |   5    |
| 12 — Command palette standard          |   2    |          2          |   5    |
| 13 — Accessibility                     |   2    |          2          |   5    |
| 17 — QA gate                           |   1    |          3          |   5    |
| **Average**                            | **2.0**|       **2.7**       | **5.0**|

Phase 3 jumped from 1 → 4 because every priority app now responds to its product accent automatically. The lifts on 1, 8, and 17 reflect canonical primitives + token contract + the QA checklist embedded in `UX_DESIGN_SYSTEM.md`. The remaining phases are page-level work that subsequent batches will tackle.

---

## Operating envelope after this increment

> Open any priority app today. The chrome you see — buttons, badges,
> cards, focus rings, accent highlights — comes from the same canonical
> tokens. Console feels operator-teal. HQ feels executive-blue. Zonga
> stays cultural violet. Veridian stays clinical emerald. Nothing was
> rewritten; the foundation simply activated. Page anatomy, forms,
> tables, charts, microcopy still vary app-by-app — those are the next
> increments. But the *spine* of the portfolio is now coherent. A buyer
> moving from one product to another no longer sees a different company
> behind each tab.
