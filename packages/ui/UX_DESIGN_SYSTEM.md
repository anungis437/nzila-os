# Nzila UX Design System — Phase 1: Design Language

The portfolio-grade UX operating standard for every product in the
nzila-os monorepo. This document is the **contract**. Everything in
`packages/ui` exists to satisfy it.

> Use restraint. Use discipline. Use systems thinking.
> Ship portfolio-grade UX.

---

## What Phase 1 ships

This increment ships the **foundation**: tokens, themes, accent layers,
canonical primitives. It does **not** refactor any consuming app — that
is downstream work each app picks up at its own pace.

| Surface                       | File                              | Status      |
| :---------------------------- | :-------------------------------- | :---------- |
| TypeScript token catalog      | `src/tokens.ts`                   | New         |
| Tailwind v4 `@theme` + themes | `src/globals.css`                 | Rewritten   |
| Per-product accent layers     | `src/globals.css`                 | New         |
| `Button` (token-driven)       | `src/components/Button.tsx`       | Rewritten   |
| `Card` (token-driven)         | `src/components/Card.tsx`         | Rewritten   |
| `Badge` (semantic + aliases)  | `src/components/Badge.tsx`        | Rewritten   |
| `Stat`                        | `src/components/Stat.tsx`         | New         |
| `SectionHeader`               | `src/components/SectionHeader.tsx`| New         |
| `EmptyState`                  | `src/components/EmptyState.tsx`   | New         |
| `Skeleton.{Line,Block,KpiStrip,Table}` | `src/components/Skeleton.tsx` | New |
| `ErrorPanel`                  | `src/components/ErrorPanel.tsx`   | New         |

---

## The token contract

There is **one** source of truth for every visual decision. If you
catch yourself reaching for `bg-blue-600`, `px-7`, `rounded-2xl`, or
`shadow-md`, stop — the design system already has the right answer.

### Spacing

A 4-px base, eleven steps. Use `gap-*`, `p-*`, `m-*` Tailwind utilities
that map to these values. Never invent a midpoint.

```
0  px  4  8  12  16  20  24  32  40  48  64  80  96
```

### Radius — three sizes

| Token          | Use                              |
| :------------- | :------------------------------- |
| `--radius-sm`  | Badges, chips, inputs in tables  |
| `--radius-md`  | Buttons, inputs                  |
| `--radius-lg`  | Cards, sheets                    |
| `--radius-xl`  | Modals only                      |

### Type — eight steps

| Token         | Use                                  |
| :------------ | :----------------------------------- |
| `--text-xs`   | Metadata labels (11px)               |
| `--text-sm`   | Secondary body (13px)                |
| `--text-base` | Body (14px)                          |
| `--text-md`   | Section header lead (16px)           |
| `--text-lg`   | Page header lead (18px)              |
| `--text-xl`   | KPI value (24px)                     |
| `--text-2xl`  | Hero KPI (32px)                      |
| `--text-3xl`  | Dashboard hero only (40px)           |

Two weights: 450 (regular) and 600 (semibold). Never bolder than 600.

### Color — semantic only

There are **no hue-named utilities** in product code. Use the role:

| Surface roles   | Foreground roles  | Status roles                           |
| :-------------- | :---------------- | :------------------------------------- |
| `bg`            | `fg`              | `status-ok` / `status-ok-soft`         |
| `surface-1`     | `fg-muted`        | `status-warning` / `status-warning-soft` |
| `surface-2`     | `fg-subtle`       | `status-critical` / `status-critical-soft` |
| `surface-3`     | `fg-inverse`      | `status-info` / `status-info-soft`     |
| `overlay`       |                   | `status-neutral` / `status-neutral-soft` |

The single product accent — `--color-accent` and `--color-accent-soft`
— is set per-product at the root via `data-product="..."`.

### Per-product accent

Set on `<html>` (or the app's root layout `<div>`):

```html
<html data-product="zonga">
```

| Product       | Accent     |
| :------------ | :--------- |
| `hq`          | Executive blue   |
| `console`     | Operator teal    |
| `union-eyes`  | Institutional navy |
| `zonga`       | Cultural violet  |
| `veridian`    | Clinical emerald |
| `flow`        | Commercial sky   |
| `agrimo`      | Field moss       |
| `first-stone` | Procurement amber |

### Themes

Three themes, set via class on `<html>`:

- *(default — light)*
- `theme-dark`
- `theme-enterprise`

### Charts — 8-slot color-blind-safe palette

`chartPalette` from `@nzila/ui` rotates in order. Tested against
deuteranopia. Do not invent your own scheme.

### Motion — two durations only

| Token              | Use                                 |
| :----------------- | :---------------------------------- |
| `--duration-fast`  | 120ms — hover, focus, button press  |
| `--duration-normal`| 200ms — panel show/hide             |
| `--ease-standard`  | Single curve, no bounce             |

`@media (prefers-reduced-motion: reduce)` halts all transitions.

---

## Phase 17 — Pre-ship Design QA Checklist

Every page change in any app must pass this checklist before merge.
A page that passes is portfolio-grade. A page that fails ships at the
quality of whoever was last in a hurry.

### Spacing pass
- [ ] All gaps, paddings, margins use the spacing scale (no `p-7`, `gap-5px`, etc.)
- [ ] Page has a single, calm rhythm (4 / 8 / 16 / 24 / 32 multiples)
- [ ] Cards align to the same baseline grid as their headers

### Mobile pass
- [ ] Layout works at 360px width with no horizontal scroll
- [ ] Tap targets are ≥ 44px tall on touch
- [ ] Sticky headers don't cover focused inputs

### Copy pass
- [ ] No marketing voice ("Awesome!", "Boom!", "Let's go 🚀")
- [ ] No jargon without first use ("OAS", "ABR", "DORA" — define on first use per page)
- [ ] Numbers have units ("$", "%", "users", "min")
- [ ] Empty states name *why* it's empty, not just "No data"

### Accessibility pass
- [ ] All interactive elements show a focus ring
- [ ] Color is never the only signal (use icon + text + dot)
- [ ] Headings nest correctly (one h1 per page, no skipped levels)
- [ ] All images / icons have `alt` or `aria-hidden`

### Loading pass
- [ ] Every async surface has a `Skeleton` (no spinner-only pages)
- [ ] Loading skeletons preserve the final layout's footprint
- [ ] No CLS (cumulative layout shift) when data lands

### Error pass
- [ ] Errors use `<ErrorPanel>` with severity + incident ID
- [ ] No raw stack traces in production
- [ ] At least one recovery action ("Retry", "Contact support")

### Trust pass
- [ ] Every aggregated number has provenance ("source: live", "as of …")
- [ ] No fabricated metrics — `Stat.delta` is omitted, not faked
- [ ] Dates show timezone when ambiguous

### Performance pass
- [ ] No client component when a server component will do
- [ ] Tables paginate or virtualize beyond ~200 rows
- [ ] First meaningful paint within 1.5s on staging

---

## Migration guide for app teams

This Phase 1 release is **fully backward compatible**:

- `<Badge variant="success">` still works (alias → `ok`)
- `<Badge variant="danger">` still works (alias → `critical`)
- `<Card variant="bordered">` styling is calmer but the API is identical
- `<Button>` keeps every variant name; only the colors changed

**To upgrade a page to Phase 1 quality:**

1. Add `data-product="<your-product>"` to your root layout `<html>` tag
2. Replace local `Stat`/`EmptyState`/`SectionHeader`/`Skeleton`/`ErrorPanel` re-implementations with imports from `@nzila/ui`
3. Replace any hardcoded `bg-gray-*`/`text-gray-*` with `bg-surface-*`/`text-fg-*` semantic equivalents
4. Run the Phase 17 checklist above

---

## Phases 2-18

Phases 2-18 of the portfolio UX mission (brand coherence, navigation,
page anatomy, data UX, forms, trust UX, states, speed, mobile, a11y,
microcopy, onboarding, palette, product priorities, performance, QA,
deliverables) build on this foundation in subsequent increments. Each
phase ships independently; no big-bang rewrite.
